import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { addedChartToRow, rowToAddedChart } from '../lib/hccAddedChartsMapper';
import { dbToJs, updatesToDb } from '../lib/patientMapper';
import { callDetailDbToJs, callDetailJsToDb } from '../lib/callDetailsMapper';
import { enrichCallRecord } from '../data/callDetailsEnrich';
import { generateFlowFromPrompt } from '../lib/flowGenerator';
import { kpiRowToJs, tsRowToJs, tableRowToJs, barRowToJs, configRowToJs, groupTimeSeries } from '../lib/eventMapper';
import { domainDbToJs, domainJsToDb, componentDbToJs, componentJsToDb, auditLogDbToJs } from '../lib/embedMapper';
import { popGroupRowToJs, popGroupJsToDb } from '../lib/popGroupMapper';
import { hccDocumentRowToJs, hccDocumentJsToDb } from '../lib/hccDocumentMapper';
import { toast } from '../components/Toast/Toast';
// Fallback datasets (~220KB raw across all of these) are imported lazily
// inside the fetch actions that consume them, so they don't bloat the entry
// chunk. They're only needed when Supabase returns empty or errors.
import { updateHash } from '../lib/router';
import { track } from '../lib/tracking';
import { applyTheme, getResolvedTheme, getStoredTheme, subscribeToSystem, applyNavStyle, getStoredNavStyle } from '../lib/theme';
import { createBlock, createBlockTree, collectBlockTree, buildParentMap, cloneBlockTree, extractSubtree, cloneStoredTree } from '../features/email-builder/blockHelpers';
import { extractEncountersSync } from '../features/hcc/upload/mockOcr';
import { getChartDocs } from '../features/hcc/data/chartDocs';
import { applyManualDecision as applyHccManualComplianceDecision } from '../features/hcc/compliance';
import { makeInitialDocument } from '../features/email-builder/initialDocument';
import * as hccLifecycle from '../features/hcc/assignment/lifecycle';
import { hydrateFromMember, dosKey as hccDosKey } from '../features/hcc/assignment/dosState';
import { DEFAULT_SAMPLING_RATES } from '../features/hcc/assignment/sampling';
import { ASTRANA_STAFF, staffById as hccStaffById } from '../features/hcc/assignment/astranaStaff';
import { normalizeReviewerLabel as hccNormalizeReviewerLabel } from '../features/hcc/reviewedBy';
import { makeActivityRow as buildHccActivityRow } from '../features/hcc/activityLog';
import { hccRoleDefaultFilters } from '../features/hcc/filters';
import { CAREGAP_ACTIVITY_MOCK } from '../features/hedis-worklist/data/caregapActivityMock';

// Central failure reporter for every persistHccXxx helper. Historically
// each of these was fire-and-forget with only console.warn on error — so
// when RLS blocked a write, or an UPDATE matched 0 rows (spawned row
// never persisted), or the underlying table didn't exist (e.g. the
// hcc_activity_log migration was never applied), the user saw a success
// UI + optimistic toast but the change reverted on refresh with no
// signal. Route every failure through this helper so:
//   1. console.warn stays (dev debug),
//   2. an event lands in tracking (production observability),
//   3. a single user-visible toast surfaces (debounced 3s so a burst of
//      failures doesn't stack toasts).
let _lastPersistToastAt = 0;
function reportPersistFailure(op, error) {
  const msg = (error && error.message) || 'unknown error';
  console.warn(`${op} failed:`, msg);
  try { track('persist.failed', { op, message: msg }); } catch { /* ignore */ }
  const now = Date.now();
  if (now - _lastPersistToastAt > 3000) {
    _lastPersistToastAt = now;
    try { toast.error?.("Couldn't save changes — refresh to see the last saved state."); } catch { /* ignore */ }
  }
}

// Persist a per-(ICD × DOS) coder action to hcc_gap_dos_actions. The
// row key is deterministic (`${member}|${code}|${dos}`) so the same
// helper handles both first-write inserts and subsequent updates via
// upsert. Fire-and-forget — the store already updated optimistically.
function dosActionRowKey(memberName, code, dos) {
  return `${memberName}|${code}|${dos}`;
}
function persistHccGapDosAction(memberName, code, dos, patch) {
  if (!memberName || !code || !dos) return;
  const id = dosActionRowKey(memberName, code, dos);
  const row = {
    id, member_name: memberName, code, dos,
    action: null, dismiss_reason: null, dismiss_note: null, removed: false,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  supabase
    .from('hcc_gap_dos_actions')
    .upsert(row, { onConflict: 'id' })
    .select('id')
    .then(({ data, error }) => {
      if (error) return reportPersistFailure(`persistHccGapDosAction(${code}|${dos})`, error);
      if (!data || data.length === 0) reportPersistFailure(`persistHccGapDosAction(${code}|${dos})`, { message: 'affected 0 rows' });
    });
}
// Clear a DOS-action row entirely — used when the user toggles the same
// action off (undo) or after a manual ICD is deleted (its DOS rows go
// with it).
function persistHccGapDosActionDelete(memberName, code, dos) {
  if (!memberName || !code || !dos) return;
  supabase
    .from('hcc_gap_dos_actions')
    .delete()
    .eq('id', dosActionRowKey(memberName, code, dos))
    .then(({ error }) => {
      // No .select() here — deleting a row that doesn't exist is a no-op,
      // not a failure (undo of an action never persisted).
      if (error) reportPersistFailure(`persistHccGapDosActionDelete(${code}|${dos})`, error);
    });
}
// Wipe every DOS-action row scoped to a deleted manual ICD — mirrors the
// in-memory cleanup in deleteHccGap.
function persistHccGapDosActionDeleteAll(memberName, code) {
  if (!memberName || !code) return;
  supabase
    .from('hcc_gap_dos_actions')
    .delete()
    .eq('member_name', memberName)
    .eq('code', code)
    .then(({ error }) => {
      if (error) reportPersistFailure(`persistHccGapDosActionDeleteAll(${code})`, error);
    });
}

// Persist an ICD-level state change to hcc_diagnosis_gaps by code. The
// store mutates optimistically; this fire-and-forget round-trip keeps the
// DB in sync so the change survives reload. Scoping by (code) alone is
// safe because the store's hccDiagnosisGaps slice is already filtered to
// the currently-open member.
function persistHccGapUpdate(code, memberName, patch) {
  if (!code) return;
  let q = supabase.from('hcc_diagnosis_gaps').update(patch).eq('code', code);
  if (memberName) q = q.eq('member_name', memberName);
  q.select('code').then(({ data, error }) => {
    if (error) return reportPersistFailure(`persistHccGapUpdate(${code})`, error);
    if (!data || data.length === 0) reportPersistFailure(`persistHccGapUpdate(${code})`, { message: 'affected 0 rows' });
  });
}
function persistHccGapInsert(row) {
  if (!row?.code) return;
  supabase.from('hcc_diagnosis_gaps').insert(row).then(({ error }) => {
    if (error) reportPersistFailure(`persistHccGapInsert(${row.code})`, error);
  });
}
// ── caregap_activity row mapping ──
// Common columns are lifted out; everything variant-specific (callDetails,
// detailCard, fromAssignee, commentBody, file, …) rides in `payload` jsonb so
// new ActivityLog variants never need a schema change.
function caregapActivityToRow(memberId, entry) {
  const { id, when, at, actor, t, title, ...payload } = entry;
  return {
    id: String(id),
    member_id: memberId,
    at: when ?? at ?? new Date().toISOString(),
    actor: actor ?? null,
    t: t ?? null,
    title: title ?? null,
    payload,
  };
}
function caregapRowToEntry(row) {
  return {
    id: row.id,
    when: row.at,
    actor: row.actor ?? undefined,
    t: row.t ?? undefined,
    title: row.title ?? undefined,
    ...(row.payload || {}),
  };
}
// Fire-and-forget insert — the local state is already updated optimistically;
// a failed write is surfaced through the shared persist-failure toast.
function persistCaregapActivityInsert(memberId, entry) {
  if (!memberId || !entry?.id) return;
  supabase.from('caregap_activity').insert(caregapActivityToRow(memberId, entry)).then(({ error }) => {
    if (error) reportPersistFailure(`persistCaregapActivityInsert(${entry.id})`, error);
  });
}
function persistHccGapDelete(code, memberName) {
  if (!code) return;
  let q = supabase.from('hcc_diagnosis_gaps').delete().eq('code', code);
  if (memberName) q = q.eq('member_name', memberName);
  q.then(({ error }) => {
    // 0-row delete is fine (already gone / never persisted) — don't flag it.
    if (error) reportPersistFailure(`persistHccGapDelete(${code})`, error);
  });
}

// Insert a spawned hcc_members row. Called from addHccGapNewRow when a
// New Diagnosis Gap picks a DOS that doesn't exist for the patient — the
// app materializes the encounter as its own worklist row so the DOS can
// carry its own workflow state, and this makes the row survive reload.
// Fire-and-forget; failures log a warning without rolling back the state
// change (the row still shows in-session).
function persistHccMemberInsert(m) {
  if (!m?.id) return;
  const dbRow = {
    id: m.id,
    member_id: m.memberId || null,
    name: m.name,
    initials: m.in,
    gender: m.g,
    age: m.age,
    current_visit: m.cv,
    total_visits: m.tv,
    dos_list: m.dos_list || [],
    visit_type: m.visitType || m.vt,
    rendering_provider: m.rp,
    open_icds: m.open,
    doc_status: m.docStatus || [],
    chart_count: m.ch,
    create_date: m.date,
    due_label: m.due,
    due_color: m.dueCol,
    support_name: m.sup, support_status: m.supS,
    coder_name: m.cdr, coder_status: m.cdrS,
    reviewer1_name: m.r1, reviewer1_status: m.r1s,
    reviewer2_name: m.r2, reviewer2_status: m.r2s,
    raf_score: m.raf,
    raf_impact: m.ri,
    risk_utilization: m.ru,
    ipa: m.ipa,
    health_plan: m.hp,
    pcp: m.pcp,
    decile: m.dec,
    cohort: m.coh,
    risk_level: m.rl,
    advillness: m.ad,
    frailty: m.fr,
    language: m.language || 'en',
    is_spawned: true,
  };
  supabase.from('hcc_members').insert(dbRow).then(({ error }) => {
    if (error) reportPersistFailure(`persistHccMemberInsert(${m.id})`, error);
  });
}

// Persist a member's dos_list / docStatus / chart_count / other non-role
// mutations to Supabase. hccCreateOrMergeFromEncounter appends new DOS
// rows and stamps other member-level metadata; without this write those
// mutations reverted on reload. Fire-and-forget.
function persistHccMemberDetails(memberId) {
  if (!memberId) return;
  const m = useAppStore.getState().hccMembers.find(x => x.id === memberId);
  if (!m) return;
  const patch = {
    dos_list:    m.dos_list || [],
    doc_status:  m.docStatus || [],
    chart_count: m.ch ?? null,
    open_icds:   m.open ?? null,
  };
  supabase
    .from('hcc_members')
    .update(patch)
    .eq('id', memberId)
    .select('id')
    .then(({ data, error }) => {
      if (error) return reportPersistFailure(`persistHccMemberDetails(${memberId})`, error);
      if (!data || data.length === 0) reportPersistFailure(`persistHccMemberDetails(${memberId})`, { message: 'affected 0 rows (spawned row never persisted?)' });
    });
}

// Persist a single HCC role's status (and optionally name) to Supabase.
// Fire-and-forget — failures log a warning without rolling back the
// optimistic in-memory update. Used by every HCC status mutation in this
// slice (transitionHccDos, hccSetRoleStatus, hccReassignRole) so the
// worklist row survives reload.
function persistHccMemberRoleStatus(memberId, role, status, name) {
  const colsByRole = {
    support:   { name: 'support_name',   status: 'support_status'   },
    coder:     { name: 'coder_name',     status: 'coder_status'     },
    reviewer:  { name: 'reviewer1_name', status: 'reviewer1_status' },
    reviewer2: { name: 'reviewer2_name', status: 'reviewer2_status' },
  };
  const cols = colsByRole[role];
  if (!cols || !memberId) return Promise.resolve({ error: { message: 'invalid role or memberId' } });
  const patch = {};
  if (status !== undefined) patch[cols.status] = status;
  if (name !== undefined && name !== null) patch[cols.name] = name;
  if (Object.keys(patch).length === 0) return Promise.resolve({ error: null });
  // Returns the Supabase result so callers can await + surface failure. A
  // silent fire-and-forget lets successful toasts mask writes that never
  // reach the DB (RLS, unreachable, missing row), so the assignment
  // "vanishes" on the next reload with no user-visible signal.
  return supabase
    .from('hcc_members')
    .update(patch)
    .eq('id', memberId)
    .select('id')
    .then(({ data, error }) => {
      if (error) {
        console.warn(`persistHccMemberRoleStatus(${memberId}, ${role}) failed:`, error.message);
        return { error };
      }
      if (!data || data.length === 0) {
        const err = { message: `no hcc_members row for id=${memberId}` };
        console.warn(`persistHccMemberRoleStatus(${memberId}, ${role}) affected 0 rows`);
        return { error: err };
      }
      return { error: null };
    });
}

// Append-only HCC activity log writer. Fire-and-forget: the optimistic
// in-memory append (handled by the caller via set()) is what the timeline
// renders; the Supabase insert is for durability. Caller passes the same
// shape as makeActivityRow() — see src/features/hcc/activityLog.js.
function persistHccActivityRow(row) {
  if (!row || !row.event_name) return;
  supabase
    .from('hcc_activity_log')
    .insert(row)
    .then(({ error }) => {
      if (error) reportPersistFailure(`persistHccActivityRow(${row.event_name})`, error);
    });
}

// ── DiagPanel ancillary tab writes ────────────────────────────────────
// Comments / Notes / Documents composers post to Supabase org-wide tables
// so a refresh (or another reviewer) sees the same content. Fire-and-forget
// — the composer already updated local state optimistically.
function persistHccDiagComment(row) {
  if (!row?.id) return;
  supabase
    .from('hcc_diag_comments')
    .insert({
      id: row.id,
      author: row.author,
      role: row.role,
      date: row.date,
      time: row.time,
      edited: !!row.edited,
      body: row.body,
      // Scope columns added in supabase/hcc_diag_comment_scope_migration.sql.
      // If the migration hasn't run yet, Supabase will reject the insert with
      // "column ... does not exist" — the warning below surfaces that.
      icd: row.icd ?? null,
      dos: row.dos ?? null,
      // Status-transition context — added in
      // supabase/hcc_diag_comment_status_migration.sql. Set when a coder
      // flips a DOS to a status that requires a mandatory comment
      // (currently "Record Requested").
      status_from: row.statusFrom ?? null,
      status_to:   row.statusTo   ?? null,
    })
    .then(({ error }) => {
      if (error) reportPersistFailure(`persistHccDiagComment(${row.id})`, error);
    });
}

function persistHccDiagCommentUpdate(row) {
  if (!row?.id) return;
  supabase
    .from('hcc_diag_comments')
    .update({ body: row.body, edited: true })
    .eq('id', row.id)
    .select('id')
    .then(({ data, error }) => {
      if (error) return reportPersistFailure(`persistHccDiagCommentUpdate(${row.id})`, error);
      if (!data || data.length === 0) reportPersistFailure(`persistHccDiagCommentUpdate(${row.id})`, { message: 'affected 0 rows' });
    });
}

function persistHccDiagCommentDelete(id) {
  if (!id) return;
  supabase
    .from('hcc_diag_comments')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) reportPersistFailure(`persistHccDiagCommentDelete(${id})`, error);
    });
}

function persistHccDiagNote(row) {
  if (!row?.id) return;
  supabase
    .from('hcc_diag_notes')
    .insert({
      id: row.id,
      title: row.title || row.body?.slice(0, 60) || 'Untitled note',
      author: row.author,
      role: row.role,
      date: row.date,
      time: row.time,
      signed: row.signed ?? true,
      body: row.body,
    })
    .then(({ error }) => {
      if (error) reportPersistFailure(`persistHccDiagNote(${row.id})`, error);
    });
}

function persistHccDiagDocument(row) {
  if (!row?.id) return;
  supabase
    .from('hcc_diag_documents')
    .insert({
      id: row.id,
      name: row.name,
      ext: row.ext,
      doc_type: row.type || row.docType || 'Other',
      uploaded_by: row.uploadedBy || 'You',
      role: row.role || 'Coder',
      date: row.date,
      time: row.time,
      status: row.status || 'pending',
    })
    .then(({ error }) => {
      if (error) reportPersistFailure(`persistHccDiagDocument(${row.id})`, error);
    });
}

// Persist a manually-uploaded chart document: push the file bytes to the
// `chart-uploads` Storage bucket, then insert the metadata row. Fire-and-forget
// (the store updated optimistically); a missing table/bucket just warns so the
// doc still works for the session.
async function persistHccAddedChart(memberId, doc, file) {
  if (!memberId || !doc) return;
  let pdfUrl = doc.pdf && /^https?:/i.test(doc.pdf) ? doc.pdf : null;
  let storagePath = null;
  try {
    if (file) {
      const path = `${memberId}/${doc.id}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('chart-uploads')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
      if (upErr) {
        reportPersistFailure(`persistHccAddedChart.upload(${doc.id})`, upErr);
      } else {
        storagePath = path;
        pdfUrl = supabase.storage.from('chart-uploads').getPublicUrl(path).data.publicUrl;
      }
    }
    const { error } = await supabase
      .from('hcc_added_charts')
      .insert(addedChartToRow(memberId, { ...doc, pdf: pdfUrl, storagePath }));
    if (error) reportPersistFailure(`persistHccAddedChart.insert(${doc.id})`, error);
  } catch (e) {
    reportPersistFailure(`persistHccAddedChart(${doc.id})`, e || { message: 'unknown' });
  }
}

function parseTaskDateStr(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  const [m, d, y] = parts;
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isPastDate(str) {
  const d = parseTaskDateStr(str);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function parseDuration(str) {
  const parts = (str || '00:00').split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}
function formatDuration(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function nextDate(lace) {
  const d = new Date();
  d.setDate(d.getDate() + (lace === 'High' ? 7 : lace === 'Medium' ? 14 : 30));
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// Restore navigation state from sessionStorage on reload
const _savedPage = sessionStorage.getItem('activePage') || 'population';
const _savedTab = sessionStorage.getItem('activeTab') || 'toc-worklist';
const _savedSettingsTab = sessionStorage.getItem('settingsTab');

// Hydrate theme from localStorage so the store agrees with what the
// index.html blocking script already applied to <html>.
const _initialThemeSetting = getStoredTheme();
const _initialResolvedTheme = getResolvedTheme(_initialThemeSetting);
const _initialNavStyle = getStoredNavStyle();
// Apply nav style at module load so it lands before React mounts (the index.html
// blocking script handles the color theme but not this one yet).
applyNavStyle(_initialNavStyle);

// ── Settings → Content → Emails: SWR cache ────────────────────────────────
// Keyed by `${page}|${perPage}|${searchLowercased}|${status}`. Lives at
// module scope so cache survives store rebuilds during HMR. Cleared by any
// campaign mutation (delete / bulk delete / duplicate / draft insert).
const _contentEmailsCache = new Map();
const CONTENT_EMAILS_TTL_MS = 60_000;
function _invalidateContentEmailsCache() {
  _contentEmailsCache.clear();
}

// ── Settings → Content → Forms: SWR cache ─────────────────────────────────
// Same shape/strategy as the emails cache above. Keyed by
// `${page}|${perPage}|${searchLowercased}|${status}`; cleared by any form
// mutation (create draft / duplicate / delete / save).
const _contentFormsCache = new Map();
const CONTENT_FORMS_TTL_MS = 60_000;
function _invalidateContentFormsCache() {
  _contentFormsCache.clear();
}

// ── Form row mapper ──
// Translates a Supabase `forms` row into the JS shape the UI consumes. List
// fetches omit the heavy `schema`/`scoring` JSONB; the builder pulls the full
// row via fetchFormById so those land as the saved objects, not defaults.
function formRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    category: row.category || null,
    status: row.status || 'draft',
    // Present only on the full-row fetch; undefined on slim list rows so the
    // builder knows it still needs to hydrate.
    schema: row.schema,
    scoring: row.scoring,
    settings: row.settings || {},
    responseCount: row.response_count || 0,
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
    updatedByName: row.updated_by_profile?.full_name || null,
  };
}

// ── Campaign row mapper ──
// Single source of truth for translating Supabase campaigns rows into the JS
// shape the UI consumes. Used by both fetchCampaigns (bulk load) and the
// CampaignBuilder (after an INSERT / UPDATE returns the row).
function campaignRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    channel: row.channel || 'email',
    section: row.section || 'scheduled',
    audience: row.audience || 0,
    dynamic: row.dynamic || false,
    health: row.health,
    delivered: row.delivered,
    opened: row.opened,
    startDate: row.start_date,
    duration: row.duration,
    progress: row.progress || 0,
    executesIn: row.executes_in,
    enabled: row.enabled || false,
    emailTemplate: row.email_template,
    colorVariables: row.color_variables,
    // New Campaign builder fields ───────────────────────────────
    audienceInclude: row.audience_include || [],
    audienceExclude: row.audience_exclude || [],
    sendVia: row.send_via || ['email'],
    startMode: row.start_mode || 'immediately',
    startAt: row.start_at,
    endDate: row.end_date,
    campaignType: row.campaign_type || 'one_time',
    senderName: row.sender_name || '',
    sendFrom: row.send_from || '',
    subjectLine: row.subject_line || '',
    // Content → Emails surfaces these in the list table.
    category: row.category || null,
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
    // Joined user display name when the fetch selects it via FK
    // (campaigns.updated_by → profiles.id). campaignRowToJs collapses the
    // nested object so the UI just reads .updatedByName.
    updatedByName: row.updated_by_profile?.full_name || null,
  };
}

// Reverse: JS-shape patch → DB-shape patch. Only includes keys present in the
// patch so we never overwrite columns with `undefined`.
const CAMPAIGN_FIELD_MAP = {
  name: 'name',
  description: 'description',
  channel: 'channel',
  section: 'section',
  audience: 'audience',
  enabled: 'enabled',
  audienceInclude: 'audience_include',
  audienceExclude: 'audience_exclude',
  sendVia: 'send_via',
  startMode: 'start_mode',
  startAt: 'start_at',
  endDate: 'end_date',
  campaignType: 'campaign_type',
  senderName: 'sender_name',
  sendFrom: 'send_from',
  subjectLine: 'subject_line',
  category: 'category',
};
function campaignPatchToDb(patch) {
  const out = {};
  for (const [jsKey, value] of Object.entries(patch)) {
    const dbKey = CAMPAIGN_FIELD_MAP[jsKey];
    if (dbKey) out[dbKey] = value;
  }
  return out;
}

// Debounced auto-save for the Campaign builder. We coalesce rapid field edits
// (typing, slider drags) into one PATCH per 600ms window per campaign id.
const _campaignSaveTimers = new Map();

// ── HCC upload: batched "extracting" toast ────────────────────────────
// queueHccDocumentForOcr is called once per file, so a 20-file drop used to
// fire 20 back-to-back toasts. Accumulate filenames pushed within a short
// window and flush a single combined toast instead.
const _hccExtractQueue = { names: [], timer: null };
function _flushHccExtractToast() {
  const { names } = _hccExtractQueue;
  _hccExtractQueue.names = [];
  _hccExtractQueue.timer = null;
  if (names.length === 0) return;
  const toast = useAppStore.getState().showToast;
  if (!toast) return;
  if (names.length === 1) {
    toast(`${names[0]} — extracting in the background`);
  } else {
    toast(`${names.length} files — extracting in the background`);
  }
}
function _queueHccExtractToast(fileName) {
  _hccExtractQueue.names.push(fileName);
  if (_hccExtractQueue.timer) return;
  _hccExtractQueue.timer = setTimeout(_flushHccExtractToast, 150);
}
function scheduleCampaignSave(id, fn) {
  const existing = _campaignSaveTimers.get(id);
  if (existing) clearTimeout(existing);
  _campaignSaveTimers.set(id, setTimeout(() => {
    _campaignSaveTimers.delete(id);
    fn();
  }, 600));
}

// Human-readable labels for HCC DOS lifecycle transitions, used by the
// Activity Log to format "DOS 07/04/2024 — Support Completed" style entries.
const HCC_TRANSITION_LABEL = {
  markSupportInProgress: 'Support In Progress',
  completeSupport:       'Support Completed',
  markInsufficient:      'Marked Insufficient',
  rejectDos:             'DOS Rejected',
  completeCoder:         'Coding Completed',
  requestRecords:        'Records Requested',
  recordsReceived:       'Records Received',
  completeReviewer:      'QA Completed',
  completeReviewer2:     'Compliance Completed',
  returnDos:             'DOS Returned',
  reassignRole:          'Role Reassigned',
};

// Maps a shared-list label to the store-state key that holds its active
// filter selections. Used by the generic saved-filter actions below so that
// saving / applying a filter on any list writes to the right slice.
// Lists not listed here fall back to `activeFilters` (the TOC default).
const LIST_FILTER_KEY = {
  HCC:   'hccFilters',
  HEDIS: 'hedisFilters',
};

// Remove a list's active saved-filter selection and persist the change.
// Used when the user edits/clears filters (which detaches the saved view).
function detachSaved(activeSavedIdByList, list) {
  if (!activeSavedIdByList || !(list in activeSavedIdByList)) return activeSavedIdByList;
  const next = { ...activeSavedIdByList };
  delete next[list];
  try { localStorage.setItem('activeSavedIdByList', JSON.stringify(next)); } catch {/* */}
  return next;
}

// Read the persisted saved-filter definitions (falls back to the legacy key,
// then to sensible defaults).
function readSavedFiltersByList() {
  try {
    const raw = localStorage.getItem('savedFiltersByList');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {/* fall through */}
  try {
    const legacy = localStorage.getItem('hccSavedFilters');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return { HCC: parsed };
    }
  } catch {/* */}
  return {
    HCC: [
      { id: 'sf1', name: 'High Risk Members',  filters: { rl: ['High'] } },
      { id: 'sf2', name: 'Overdue Incomplete', filters: { supS: ['Assign'], cdrS: ['Assign'] } },
    ],
  };
}

// Read the persisted active saved-filter id per list (falls back to legacy key).
function readActiveSavedIdByList() {
  try {
    const raw = localStorage.getItem('activeSavedIdByList');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {/* */}
  const legacy = localStorage.getItem('hccActiveSavedId');
  return legacy ? { HCC: legacy } : {};
}

// Hydrate a list's filter slice from its active saved filter at boot. Only
// `activeSavedIdByList` is persisted (not the filter slice), so without this a
// reload would show the SavedFiltersChip as active with no filters applied.
function hydrateListFilters(list) {
  const active = readActiveSavedIdByList()[list];
  if (!active) return {};
  const f = (readSavedFiltersByList()[list] || []).find(x => x.id === active);
  return f ? { ...f.filters } : {};
}

// Safe JSON read from sessionStorage — returns fallback on missing/parse error.
function _readJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// ── Care team row mapper ──
// Translates a Supabase `care_teams` row to/from the JS shape the
// ConfigureTeamDrawer + Care Team table consume (see hccCareTeams below).
function careTeamRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    teamType: row.team_type,
    allocatedTins: row.allocated_tins || [],
    createdAt: row.created_label,
    createdBy: row.created_by,
    lastModifiedAt: row.modified_label,
    lastModifiedBy: row.modified_by,
    members: row.members || [],
  };
}
function careTeamJsToDb(t) {
  return {
    id: t.id,
    name: t.name,
    kind: t.kind,
    team_type: t.teamType,
    allocated_tins: t.allocatedTins || [],
    created_label: t.createdAt,
    created_by: t.createdBy,
    modified_label: t.lastModifiedAt,
    modified_by: t.lastModifiedBy,
    members: t.members || [],
    updated_at: new Date().toISOString(),
  };
}

/**
 * Seed historical document-upload batches into the HCC activity feed so
 * the History drawer's Documents tab has realistic content out of the
 * box. Each batch reads as a completed upload: a `batch.created`,
 * `file.uploaded`, `ocr.completed`, and `batch.processing_completed`
 * row stamped with believable counts and timestamps in the recent
 * past. Real backend wipes this once Supabase returns rows.
 */
function buildSeedHccActivityFeed() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  // Older first — we reverse at the end so newest sorts to the top.
  const batches = [
    { id: 'seed-b1', file: 'progress-notes-week-of-04-14.pdf', actor: 'Dr. Sarah Connor',
      approved: 8, rejected: 0, encounters: 8, source: 'manual', daysAgo: 0.2,
      rejectedList: [] },
    { id: 'seed-b2', file: 'sftp-overnight-2026-04-12.pdf', actor: 'SFTP',
      approved: 12, rejected: 3, encounters: 15, source: 'sftp', daysAgo: 1.4,
      rejectedList: [
        { patientName: 'Patricia Moore', dos: '04/10/2026' },
        { patientName: 'Robert Kim', dos: '04/09/2026' },
        { patientName: 'James Walker', dos: '04/09/2026' },
      ]},
    { id: 'seed-b3', file: 'annual-wellness-bulk.pdf', actor: 'You',
      approved: 5, rejected: 1, encounters: 6, source: 'manual', daysAgo: 3.0,
      rejectedList: [{ patientName: 'Jane Doe', dos: '04/08/2026' }] },
    { id: 'seed-b4', file: 'discharge-summaries-april.pdf', actor: 'Dr. Helen Yu',
      approved: 4, rejected: 0, encounters: 4, source: 'manual', daysAgo: 5.5,
      rejectedList: [] },
    { id: 'seed-b5', file: 'multi-patient-chart-batch.pdf', actor: 'M. Singh',
      approved: 0, rejected: 0, encounters: 0, source: 'sftp', daysAgo: 7.0,
      rejectedList: [],
      // Failed extraction — surfaces as Processing/Failed status in the tab.
      failed: true },
  ];
  const rows = [];
  batches.forEach(b => {
    const baseTs = new Date(now - b.daysAgo * day);
    const iso = (offsetMin) => new Date(baseTs.getTime() + offsetMin * 60_000).toISOString();
    const scope = { batchId: b.id, fileId: b.file, source: b.source };
    rows.push({
      id: `${b.id}-c`, ts: iso(0), event_name: 'batch.created',
      batch_id: b.id, category: 'intake', severity: 'info',
      actor_name: b.actor,
      headline: `Batch ${b.id} created — 1 file queued.`,
      scope,
      payload: { batchId: b.id, fileCount: 1, fileName: b.file, actor: b.actor },
    });
    rows.push({
      id: `${b.id}-u`, ts: iso(1), event_name: 'file.uploaded',
      batch_id: b.id, category: 'intake', severity: 'info',
      actor_name: b.actor,
      headline: `${b.actor} uploaded ${b.file}.`,
      scope,
      payload: { actor: b.actor, fileName: b.file, pageCount: Math.max(1, Math.ceil(b.encounters / 2)) },
    });
    if (b.failed) {
      rows.push({
        id: `${b.id}-fail`, ts: iso(2), event_name: 'ocr.failed',
        batch_id: b.id, category: 'ocr', severity: 'error',
        actor_name: 'System',
        headline: `OCR failed on ${b.file}.`,
        scope,
        payload: { fileName: b.file, reason: 'Could not read PDF — likely corrupt or password-protected.' },
      });
    } else {
      rows.push({
        id: `${b.id}-oc`, ts: iso(2), event_name: 'ocr.completed',
        batch_id: b.id, category: 'ocr', severity: 'success',
        actor_name: 'System',
        headline: `OCR completed on ${b.file} — ${b.encounters} encounters extracted.`,
        scope,
        payload: {
          fileName: b.file,
          encounterCount: b.encounters,
          pageCount: Math.max(1, Math.ceil(b.encounters / 2)),
        },
      });
      rows.push({
        id: `${b.id}-pc`, ts: iso(3), event_name: 'batch.processing_completed',
        batch_id: b.id, category: 'intake', severity: 'success',
        actor_name: b.actor,
        headline: `Batch ${b.id} complete — ${b.approved} approved, ${b.rejected} rejected.`,
        scope,
        payload: {
          batchId: b.id,
          fileName: b.file,
          approvedCount: b.approved,
          rejectedCount: b.rejected,
          pendingCount: 0,
          acceptedList: [],
          rejectedList: b.rejectedList,
          actor: b.actor,
        },
      });
    }
  });
  // Newest-first.
  return rows.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
}

export const useAppStore = create((set, get) => ({
  // ─── Theme ───────────────────────────────────────────────────────────
  // `theme` is the user's chosen setting: 'light' | 'dark' | 'system'
  // `resolvedTheme` is what's actually rendered: 'light' | 'dark'
  // (these diverge when theme === 'system' and OS preference is dark)
  theme: _initialThemeSetting,
  resolvedTheme: _initialResolvedTheme,
  setTheme: (next) => {
    const from = get().theme;
    track('theme.changed', { from, to: next });
    const resolved = applyTheme(next);
    set({ theme: next, resolvedTheme: resolved });
  },
  // Called once from main.jsx — wires the OS preference listener
  // so 'system' theme follows live OS dark-mode toggles.
  _initThemeSubscriptions: () => {
    if (get()._themeSubscribed) return;
    set({ _themeSubscribed: true });
    subscribeToSystem(
      () => get().theme,
      (resolved) => set({ resolvedTheme: resolved })
    );
  },
  _themeSubscribed: false,

  // ─── Nav style ───────────────────────────────────────────────────────
  // 'default' = per-theme dark-purple chrome (existing behavior)
  // 'light'   = light sidebar (white surface, primary purple accent),
  //             applied consistently across all color themes
  navStyle: _initialNavStyle,
  setNavStyle: (next) => {
    const from = get().navStyle;
    track('nav.style_changed', { from, to: next });
    const applied = applyNavStyle(next);
    set({ navStyle: applied });
  },

  // ─── Featurebase (Help → Give Feedback) ─────────────────────────────
  // Identity-verification JWT minted by the featurebase-jwt Edge Function
  // after login (see App.jsx). Used to build the portal SSO link so users
  // land on feedback.foldhealth signed in. Null for dev-bypass sessions.
  featurebaseJwt: null,
  setFeaturebaseJwt: (jwt) => set({ featurebaseJwt: jwt }),

  // ─── Changelog (Help → What's New) ──────────────────────────────────
  // Rows are inserted by .github/workflows/changelog.yml on each push to
  // main; the app only reads. `changelogSeenAt` drives the unread badge and
  // persists per-browser so the count survives reloads.
  changelogEntries: [],
  changelogLoading: false,
  _changelogFetched: false,
  changelogSeenAt: (() => { try { return localStorage.getItem('changelogSeenAt'); } catch { return null; } })(),
  fetchChangelog: async () => {
    if (get()._changelogFetched) return;
    set({ _changelogFetched: true, changelogLoading: true });
    const { data, error } = await supabase
      .from('changelog_entries')
      .select('id, title, kind, compare_url, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) console.warn('[store] changelog fetch failed:', error.message);
    set({ changelogEntries: data || [], changelogLoading: false });
  },
  markChangelogSeen: () => {
    const now = new Date().toISOString();
    try { localStorage.setItem('changelogSeenAt', now); } catch { /* private mode */ }
    set({ changelogSeenAt: now });
  },

  // Pending add-task request — set by CreateNewPopover or WorklistRow "Add Task"
  pendingAddTask: null,

  // Top-level navigation (sidebar) — restored from sessionStorage
  activePage: _savedPage === 'builder' ? 'settings' : _savedPage,
  // Tab navigation within pages
  activeTab: _savedTab,
  subnavCollapsed: false,
  viewBy: 'window',

  // Sticky Notes
  stickyNotes: [],
  stickyNoteHistory: [],
  quickNotes: [],
  quickNoteHistory: [],
  fetchStickyNotes: async (patientId) => {
    const { data } = await supabase.from('sticky_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: true });
    if (data) set({ stickyNotes: data });
  },
  fetchStickyNoteHistory: async (patientId) => {
    const { data } = await supabase.from('sticky_note_history').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (data) set({ stickyNoteHistory: data });
  },
  createStickyNote: async (note) => {
    const { data, error } = await supabase.from('sticky_notes').insert(note).select().single();
    if (!error && data) {
      track('note.sticky_created', { noteId: data.id });
      await supabase.from('sticky_note_history').insert({ sticky_note_id: data.id, patient_id: note.patient_id, author_name: note.author_name || 'You', action: 'added a Note', note_text: note.text, ehr_instance: note.ehr_profile || 'Central Profile' });
      get().fetchStickyNotes(note.patient_id);
      get().fetchStickyNoteHistory(note.patient_id);
    }
    return data;
  },
  updateStickyNote: async (id, updates, patientId) => {
    track('note.sticky_updated', { noteId: id });
    await supabase.from('sticky_notes').update(updates).eq('id', id);
    if (patientId) {
      await supabase.from('sticky_note_history').insert({ sticky_note_id: id, patient_id: patientId, author_name: updates.author_name || 'You', action: 'Updated a Note', note_text: updates.text, ehr_instance: updates.ehr_profile || 'Central Profile' });
      get().fetchStickyNotes(patientId);
      get().fetchStickyNoteHistory(patientId);
    }
  },
  deleteStickyNote: async (id, patientId) => {
    track('note.sticky_deleted', { noteId: id });
    // Log the deletion as an audit activity before removing the note
    const { data: noteData } = await supabase.from('sticky_notes').select('*').eq('id', id).maybeSingle();
    if (noteData) {
      await supabase.from('sticky_note_history').insert({
        sticky_note_id: id,
        patient_id: patientId || noteData.patient_id,
        author_name: 'You',
        action: 'deleted a Note',
        note_text: noteData.text,
        ehr_instance: noteData.ehr_profile || 'Central Profile',
      });
    }
    await supabase.from('sticky_notes').delete().eq('id', id);
    if (patientId) {
      get().fetchStickyNotes(patientId);
      get().fetchStickyNoteHistory(patientId);
    }
  },

  // Quick Notes (global / home page)
  fetchQuickNotes: async () => {
    const { data } = await supabase.from('sticky_notes').select('*').eq('patient_id', 'global').order('created_at', { ascending: false });
    if (data) set({ quickNotes: data });
  },
  fetchQuickNoteHistory: async () => {
    const { data } = await supabase.from('sticky_note_history').select('*').eq('patient_id', 'global').order('created_at', { ascending: false });
    if (data) set({ quickNoteHistory: data });
  },
  createQuickNote: async (text) => {
    const note = { patient_id: 'global', text, author_name: 'You', ehr_profile: 'Quick Note' };
    const { data, error } = await supabase.from('sticky_notes').insert(note).select().single();
    if (!error && data) {
      track('note.quick_created', { noteId: data.id });
      await supabase.from('sticky_note_history').insert({ sticky_note_id: data.id, patient_id: 'global', author_name: 'You', action: 'added a Note', note_text: text, ehr_instance: 'Quick Note' });
      get().fetchQuickNotes();
      get().fetchQuickNoteHistory();
    }
    return data;
  },
  updateQuickNote: async (id, text) => {
    track('note.quick_updated', { noteId: id });
    await supabase.from('sticky_notes').update({ text, author_name: 'You' }).eq('id', id);
    await supabase.from('sticky_note_history').insert({ sticky_note_id: id, patient_id: 'global', author_name: 'You', action: 'Updated a Note', note_text: text, ehr_instance: 'Quick Note' });
    get().fetchQuickNotes();
    get().fetchQuickNoteHistory();
  },
  deleteQuickNote: async (id) => {
    track('note.quick_deleted', { noteId: id });
    const { data: noteData } = await supabase.from('sticky_notes').select('*').eq('id', id).maybeSingle();
    if (noteData) {
      await supabase.from('sticky_note_history').insert({ sticky_note_id: id, patient_id: 'global', author_name: 'You', action: 'deleted a Note', note_text: noteData.text, ehr_instance: 'Quick Note' });
    }
    await supabase.from('sticky_notes').delete().eq('id', id);
    get().fetchQuickNotes();
    get().fetchQuickNoteHistory();
  },

  // P360 Profile data
  p360Profile: null,
  p360Loading: false,
  fetchP360Profile: async (patientId) => {
    set({ p360Loading: true });
    try {
      const { data, error } = await supabase
        .from('p360_profiles')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle();
      if (!error && data) {
        set({ p360Profile: data });
      } else {
        set({ p360Profile: null });
      }
    } catch {
      set({ p360Profile: null });
    }
    set({ p360Loading: false });
  },
  updateP360Profile: async (patientId, updates) => {
    const { error } = await supabase
      .from('p360_profiles')
      .update(updates)
      .eq('patient_id', patientId);
    if (!error) {
      // Refresh
      get().fetchP360Profile(patientId);
    }
    return !error;
  },

  // Patient detail view
  selectedPatientId: null,
  patientProfileTab: 'Overview',
  // When set alongside a navigateToPatient({ programCode }) call, the Care
  // Programs tab picks this up, ensures the program is enrolled, and opens
  // its ProgramDetailView on mount. Cleared once consumed.
  pendingCareProgramCode: null,
  navigateToPatient: (patientId, opts = {}) => {
    const from = get().activePage;
    track('nav.patient_opened', { patientId, from });
    const updates = { selectedPatientId: patientId };
    if (opts.profileTab) updates.patientProfileTab = opts.profileTab;
    if (opts.programCode) updates.pendingCareProgramCode = opts.programCode;
    set(updates);
    const state = get();
    if (state.activePage !== 'population') set({ activePage: 'population' });
    updateHash?.(get());
  },
  navigateBackToWorklist: () => {
    const patientId = get().selectedPatientId;
    track('nav.patient_closed', { patientId });
    set({ selectedPatientId: null, pendingCareProgramCode: null });
    updateHash?.(get());
  },
  setPatientProfileTab: (tab) => {
    const from = get().patientProfileTab;
    track('nav.patient_tab_changed', { patientId: get().selectedPatientId, from, to: tab });
    set({ patientProfileTab: tab });
  },
  clearPendingCareProgramCode: () => set({ pendingCareProgramCode: null }),

  // HCC chart documents manually added via "Upload New Chart" (per member id).
  // System (default) docs come from chartDocs.generateDefaultCharts; these are
  // the extra ones the user uploads, kept so the count/list stay in sync.
  hccAddedCharts: {},
  addChartDoc: (memberId, doc, file) => {
    if (!memberId || !doc) return;
    set((state) => ({
      hccAddedCharts: {
        ...state.hccAddedCharts,
        [memberId]: [...(state.hccAddedCharts[memberId] || []), doc],
      },
    }));
    // Durability: upload the file + persist the record to Supabase.
    persistHccAddedChart(memberId, doc, file);
    // Always drop a timeline entry so uploads land on the Activity tab
    // regardless of which surface triggered the add (Chart Review drawer,
    // Diag Panel Documents tab, quick Upload popover). The 1500ms dedup
    // guard on addActivityEntry stops a caller that also logs manually
    // from producing a duplicate row.
    const activeIcd = useAppStore.getState().diagActivityIcd;
    const role = useAppStore.getState().hccUserRole || 'Coder';
    useAppStore.getState().addActivityEntry({
      _memberId: memberId,
      t: 'upload', by: 'You', role,
      icds: activeIcd ? [activeIcd] : undefined,
      headline: activeIcd ? `Document Uploaded for ${activeIcd}` : 'Document Uploaded',
      file: doc.n,
      fileType: doc.docType,
      docId: doc.id,
    });
  },
  // Load persisted uploads so manually-added docs survive a reload. Grouped by
  // member id into the same map addChartDoc maintains. Single-fire per session
  // — the HCC worklist and DiagPanel both mount and call this on entry.
  hccAddedChartsDidFetch: false,
  fetchHccAddedCharts: async () => {
    if (useAppStore.getState().hccAddedChartsDidFetch) return;
    set({ hccAddedChartsDidFetch: true });
    const { data, error } = await supabase
      .from('hcc_added_charts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { console.warn('fetchHccAddedCharts failed:', error.message); return; }
    const map = {};
    (data || []).forEach((row) => {
      (map[row.hcc_member_id] = map[row.hcc_member_id] || []).push(rowToAddedChart(row));
    });
    set({ hccAddedCharts: map });
  },

  // Per-document review status overrides (keyed by member id → doc id), set
  // when a reviewer marks a chart Pass/Fail in the Document Available drawer.
  // getChartDocs applies these so the worklist "Documents" evidence cell stays
  // in sync with the drawer (All Passed / mixed / All Pending).
  // Active HCC reviewer role gates role-specific behaviour (only Support gets
  // the actionable document drawer + document Pass/Fail; Coder/QA/Compliance
  // get a read-only Document Preview and can accept/reject ICDs). This lived on
  // my branch as `hccRole`; foldhealth/main already has the canonical,
  // localStorage-backed `hccUserRole` (below), so mine is commented out per the
  // merge-resolution instruction and all consumers use hccUserRole.
  // hccRole: 'Coder',
  // setHccRole: (role) => set({ hccRole: role }),

  hccChartStatus: {},
  hccChartStatusDidFetch: false,
  fetchHccChartStatus: async () => {
    if (get().hccChartStatusDidFetch) return;
    try {
      const { data, error } = await supabase.from('hcc_chart_status').select('*');
      if (error) throw error;
      const map = {};
      for (const row of (data || [])) {
        (map[row.member_id] ||= {})[row.doc_id] = row.status;
      }
      set({ hccChartStatus: map, hccChartStatusDidFetch: true });
    } catch (err) {
      console.warn('fetchHccChartStatus:', err?.message || err);
      set({ hccChartStatusDidFetch: true });
    }
  },
  setChartDocStatus: (memberId, docId, status, opts) => {
    if (!memberId || !docId) return;
    set((state) => ({
      hccChartStatus: {
        ...state.hccChartStatus,
        [memberId]: { ...(state.hccChartStatus[memberId] || {}), [docId]: status },
      },
    }));
    // Persist so the Pass/Fail mark survives reload.
    supabase
      .from('hcc_chart_status')
      .upsert({
        id: `${memberId}|${docId}`,
        member_id: memberId,
        doc_id: docId,
        status,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.warn(`setChartDocStatus persist(${memberId}|${docId}) failed:`, error.message);
      });
    // Callers reviewing docs inside the ChartDetailDrawer pass deferSync so
    // the record's supS doesn't flip mid-review — flipping it there would
    // drop the row out of the "New / In Progress" filter and unmount the
    // drawer before the user finishes reviewing. The drawer syncs the
    // derived status itself on close via deriveStatus + syncSupportStatus.
    if (opts?.deferSync) return;
    // Cascade to Support status when Support has just marked docs failed —
    // "all documents failed" is the coder's contract for Insufficient. If
    // AT LEAST ONE doc lands as Passed later, revert Support to In Progress
    // so the coder can pick it back up.
    queueMicrotask(() => {
      const st = useAppStore.getState();
      const member = st.hccMembers.find(m => m.id === memberId);
      if (!member) return;
      const dos = member.dos_list?.[0]?.date || member.dos;
      if (!dos) return;
      const charts = getChartDocs(
        member,
        st.hccAddedCharts[memberId] || [],
        st.hccChartStatus[memberId] || {},
        st.hccRemovedCharts[memberId] || [],
      );
      if (charts.length === 0) return;
      const statuses = charts.map(c => String(c.status || 'pending').toLowerCase());
      const allFailed = statuses.every(s => s === 'failed');
      const anyPassed = statuses.some(s => s === 'passed');
      const supportStatusField = 'supS';
      const currentSupport = member[supportStatusField];
      if (allFailed && currentSupport !== 'Insufficient') {
        st.hccSetRoleStatus?.(memberId, dos, 'support', 'Insufficient');
      } else if (anyPassed && currentSupport === 'Insufficient') {
        st.hccSetRoleStatus?.(memberId, dos, 'support', 'In Progress');
      }
    });
  },

  // Docs unlinked from a member's chart (keyed by member id → array of doc ids).
  // getChartDocs filters the merged list by these ids so it covers BOTH the
  // client-generated seeded defaults (`::sys{i}`, which live in no array) and
  // uploaded docs uniformly. Uploaded docs are additionally spliced out of
  // hccAddedCharts (and their Supabase row deleted) so the count truly drops.
  hccRemovedCharts: {},
  hccRemovedChartsDidFetch: false,
  fetchHccRemovedCharts: async () => {
    if (get().hccRemovedChartsDidFetch) return;
    try {
      const { data, error } = await supabase.from('hcc_removed_charts').select('*');
      if (error) throw error;
      const map = {};
      for (const row of (data || [])) {
        (map[row.member_id] ||= []).push(row.doc_id);
      }
      set({ hccRemovedCharts: map, hccRemovedChartsDidFetch: true });
    } catch (err) {
      console.warn('fetchHccRemovedCharts:', err?.message || err);
      set({ hccRemovedChartsDidFetch: true });
    }
  },
  removeChartDoc: (memberId, docId) => {
    if (!memberId || !docId) return;
    set((state) => ({
      hccRemovedCharts: {
        ...state.hccRemovedCharts,
        [memberId]: [...new Set([...(state.hccRemovedCharts[memberId] || []), docId])],
      },
      hccAddedCharts: {
        ...state.hccAddedCharts,
        [memberId]: (state.hccAddedCharts[memberId] || []).filter((d) => d.id !== docId),
      },
    }));
    // Persist the tombstone so removed system-seeded docs (`::sys{n}`) also
    // stay removed after reload — hcc_added_charts DELETE only covers
    // uploaded rows.
    supabase
      .from('hcc_removed_charts')
      .upsert({
        id: `${memberId}|${docId}`,
        member_id: memberId,
        doc_id: docId,
      })
      .then(({ error }) => {
        if (error) console.warn(`removeChartDoc tombstone(${memberId}|${docId}) failed:`, error.message);
      });
    // Best-effort Supabase cleanup for uploaded/DB-backed docs (no-op for
    // client-only `::sys` defaults, which were never persisted).
    supabase
      .from('hcc_added_charts')
      .delete()
      .eq('id', docId)
      .then(({ error }) => {
        if (error) console.warn(`removeChartDoc(${memberId}, ${docId}) delete failed:`, error.message);
      });
  },

  // Support-only DOS deletion. Surface-agnostic: strips the entry from
  // member.dos_list (so ChartDetailDrawer and the Diagnosis Gap drawer,
  // which both read that array, drop the DOS on the next render) and
  // clears every hccDosAssignments entry for that date. Fire-and-forget
  // Supabase write via persistHccMemberDetails so the removal survives a
  // reload. Callers are expected to enforce the role/stage gate — this
  // action does not re-check it.
  hccDeleteDos: (memberId, dosDate) => {
    if (!memberId || !dosDate) return;
    const st = useAppStore.getState();
    const member = st.hccMembers.find(m => m.id === memberId);
    if (!member) return;
    const idx = (member.dos_list || []).findIndex(d => d.date === dosDate);
    if (idx < 0) return;
    set((state) => ({
      hccMembers: state.hccMembers.map(m => {
        if (m.id !== memberId) return m;
        const nextDosList = (m.dos_list || []).filter(d => d.date !== dosDate);
        const nextDocStatus = Array.isArray(m.docStatus)
          ? m.docStatus.filter((_, i) => i !== idx)
          : m.docStatus;
        return { ...m, dos_list: nextDosList, docStatus: nextDocStatus };
      }),
      // Composite hccDosAssignments keys are `${memberId}|${dos}|…`. Strip
      // every key that matches this member + date so downstream role state
      // for the deleted DOS doesn't linger.
      hccDosAssignments: Object.fromEntries(
        Object.entries(state.hccDosAssignments || {}).filter(([, v]) =>
          !(v?.patientId === memberId && v?.dosDate === dosDate)
        )
      ),
    }));
    persistHccMemberDetails(memberId);
    useAppStore.getState().addActivityEntry({
      _memberId: memberId,
      t: 'delete_dos',
      by: 'You', role: useAppStore.getState().hccUserRole || 'Support',
      dos: dosDate,
      headline: `Deleted DOS ${dosDate}`,
    });
    useAppStore.getState().logHccActivity?.({
      eventName: 'dos.deleted',
      scope:     { patientId: memberId, dos: dosDate, source: 'manual' },
      payload:   { actor: 'You', patientName: member.name, dos: dosDate },
    });
  },

  // Care Programs — enrolled programs are per-patient. A patient starts with
  // none; only programs a user explicitly adds are visible on their profile.
  // Persisted to Supabase (patient_care_programs) so enrollments survive
  // reload; on cold load we hydrate from the DB and fall back to
  // programsForPatient() when the row set is empty.
  careProgramsByPatient: {},
  careProgramsLoadedFor: {},

  fetchCareProgramsForPatient: async (patientId) => {
    if (!patientId) return;
    if (get().careProgramsLoadedFor[patientId]) return;
    const { data, error } = await supabase
      .from('patient_care_programs')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });
    if (error) console.warn('fetchCareProgramsForPatient:', error.message);
    const rows = (data || []).map(r => ({
      id:           r.id,
      code:         r.code,
      name:         r.name,
      acuity:       r.acuity,
      status:       r.status || 'New',
      statusColor:  r.status_color || 'var(--primary-300)',
      startDate:    r.start_date || '—',
      endDate:      r.end_date || '—',
      lastUpdated:  r.last_updated || '—',
      assignee:     r.assignee || 'Unassigned',
      pcp:          r.pcp || '—',
      progress:     Number(r.progress) || 0,
    }));
    set(s => ({
      careProgramsByPatient: { ...s.careProgramsByPatient, [patientId]: rows },
      careProgramsLoadedFor: { ...s.careProgramsLoadedFor, [patientId]: true },
    }));
  },

  addCareProgram: (patientId, entry) => {
    if (!patientId || !entry) return;
    let program;
    set((state) => {
      const existing = state.careProgramsByPatient[patientId] || [];
      if (existing.some((p) => p.code === entry.code)) return {};
      program = {
        id: `pcp-${patientId}-${entry.code}`,
        code: entry.code,
        name: `${entry.name} (${entry.code})`,
        acuity: null,
        status: 'New',
        statusColor: 'var(--primary-300)',
        startDate: '—',
        endDate: '—',
        lastUpdated: '—',
        assignee: 'Unassigned',
        pcp: '—',
        progress: 0,
      };
      track('care_program.added', { patientId, code: entry.code });
      return {
        careProgramsByPatient: {
          ...state.careProgramsByPatient,
          [patientId]: [...existing, program],
        },
      };
    });
    // Persist. Fire-and-forget — the optimistic local update already
    // rendered the row; a slow network shouldn't block the UI.
    if (program) {
      supabase.from('patient_care_programs').upsert({
        id:            program.id,
        patient_id:    patientId,
        code:          program.code,
        name:          program.name,
        acuity:        program.acuity,
        status:        program.status,
        status_color:  program.statusColor,
        start_date:    program.startDate,
        end_date:      program.endDate,
        last_updated:  program.lastUpdated,
        assignee:      program.assignee,
        pcp:           program.pcp,
        progress:      program.progress,
      }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.warn('addCareProgram — insert failed:', error.message);
      });
    }
  },

  // Table
  patients: [],
  patientsLoading: true,
  patientsError: null,
  selectedIds: [],
  currentPage: 1,
  perPage: 10,
  searchQuery: '',

  // Filters
  activeFilters: {},  // { gender: 'F', language: 'es', lace: 'High', ... }
  activeSubnavList: 'TOC',  // which SubNav list is selected

  // Flipped to true when the update-checker poller sees a newer build
  // hash than the one this tab loaded with. Drives UpdateAvailableBanner.
  hasNewBuild: false,
  setHasNewBuild: (v) => set({ hasNewBuild: !!v }),

  // HCC role — the logged-in user's role for the HCC coding workflow (Support
  // / Coder / QA / Compliance). Drives which status vocab and per-role actions
  // the worklist and DiagPanel expose. Persisted so it survives reload.
  hccUserRole: (() => {
    try { return localStorage.getItem('hccUserRole') || 'Coder'; } catch { return 'Coder'; }
  })(),
  setHccUserRole: (role) => {
    try { localStorage.setItem('hccUserRole', role); } catch {/* */}
    set({ hccUserRole: role });
    // Reset the worklist to this role's default queue (own assignments in
    // New / In Progress) so switching roles lands on the right view.
    get().applyHccRoleDefaultFilters();
  },
  // Reset hccFilters to the current role's canonical queue: Assignee = me
  // + role-specific status in ['New', 'In Progress']. Also detaches any
  // active saved filter so the SavedFiltersChip doesn't lie.
  applyHccRoleDefaultFilters: async () => {
    let s = get();
    // Ensure a currentUserProfile has been resolved once — otherwise the very
    // first paint in dev-bypass mode ships with Assignee = null and the queue
    // looks empty until profiles arrive.
    if (!s.currentUserProfile && s.taskProfiles.length === 0) {
      await get().fetchTaskProfiles();
      s = get();
    }
    const roleToEngine = { Support: 'support', Coder: 'coder', QA: 'reviewer', Compliance: 'reviewer2' };
    const devFallback = () => {
      const eng = roleToEngine[s.hccUserRole];
      return eng ? ASTRANA_STAFF.find(m => m.role === eng && m.active)?.name : null;
    };
    const userName = s.currentUserProfile?.name || devFallback();
    const filters = hccRoleDefaultFilters(s.hccUserRole, userName);
    set({
      hccFilters: filters,
      hccActiveSavedId: null,
      activeSavedIdByList: detachSaved(s.activeSavedIdByList, 'HCC'),
      currentPage: 1,
    });
  },

  // ── Population Groups: persistent create-group CSV processing session ──
  pgSession: null,            // { fileName, fileSize, segName, status:'loading'|'complete', procStep, startedAt, result }
  pgMinimized: false,
  pgReopenToken: 0,

  // HEDIS worklist state lives at line ~1558 (caregapActivity, hedisMembers,
  // setHedisMembers, updateGapStatus, etc.) — defined by upstream.


  // Call Details
  _allCallDetails: [],   // full sorted dataset (DB + supplemental local)
  callDetails: [],
  callDetailsLoading: true,
  callDetailsHasMore: false,

  // Calls UI config (nav items, phone lines, session list) — loaded from Supabase
  callNavItems: [],       // inbox + channel nav items
  callLines: [],          // phone line dropdown options
  callSessions: [],       // middle-panel call list
  callsConfigLoading: true,

  // System Health (Phase 3)
  systemHealth: { ehr: 'ok', retell: 'ok', redis: 'ok', supabase: 'ok' },

  // Goals Directory
  goalsData: null, // null = not yet loaded, array = loaded from DB/fallback
  goalsLoading: true,
  goalDetailId: null,
  goalWizardOpen: false,
  goalWizardEditId: null,

  // Settings navigation (left subnav)
  settingsNavItem: sessionStorage.getItem('settingsNavItem') || 'member/leads',
  // Active sub-tab inside Settings → Member/Leads (Tags / Custom Contact Type
  // / Custom Contact Fields / Code Groups / Worklist / Care Team). Persisted
  // in the hash so deep links survive.
  memberLeadsTab: sessionStorage.getItem('memberLeadsTab') || 'care-team',

  // Messages section
  messageTab: 'chat-settings',
  messagesUnreadCount: 0,
  pendingChatUserEmail: null,

  // Chat Groups (Messages > Chat Settings)
  chatGroupsData: null,
  chatGroupsLoading: true,
  chatGroupDetailId: null,
  agentRulesGroupId: null,
  businessHoursOpen: false,

  // Embedded Components
  embeddedComponentsTab: 'domain-registry',
  accountTab: 'users',
  contentTab: 'emails',
  componentWizardOpen: false,
  componentWizardEditId: null,
  componentPreviewId: null,

  // Agents (settings)
  agents: [],
  agentsLoading: true,
  settingsTab: _savedSettingsTab || 'agents',
  showCreateAgent: false,

  // Agent Builder (canvas)
  builderAgent: null,       // { id, name, prompt } of the agent being edited
  builderFlow: null,        // { id, nodes, edges, viewport, version }
  builderFlowLoading: false,
  builderSelectedNode: null, // id of currently selected node
  _pendingAgentId: null,    // set by router on refresh — triggers re-open in AppLayout
  _pendingCampaignBuilderId: null, // set by router on refresh — triggers campaign builder open
  _pendingEmailEditId: null,       // set by router on refresh — triggers email builder open
  builderVersions: [],      // list of saved versions
  builderPrompt: '',        // original creation prompt
  builderConfig: null,      // agent_config row for current agent
  builderConfigLoading: false,

  // UI state
  workflowPatient: null,
  workflowStep: 0,
  stepStates: {},
  callPopoverPatient: null,
  callPopoverBtnRef: null,
  outreachPopoverPatient: null,
  activeCallPatient: null,
  activeCallSeconds: 0,
  activeCallTimerRef: null,
  showInvokeModal: false,
  showCreateNew: false,
  showFilterBar: false,
  queueTabDot: false,

  // ─── Notifications (bell-icon dropdown) ───────────────────────────
  // Newest-first array of { id, type, title, body, ts, read, action }.
  // The `action` is a string the popover maps to a side-effect (e.g.
  // 'openHccReview' → expandHccUpload + nav).
  notifications: [],
  addNotification: (n) => set(s => ({
    notifications: [
      { id: n.id || `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), read: false, ...n },
      ...(s.notifications || []),
    ].slice(0, 50),  // keep the last 50
  })),
  markNotificationRead: (id) => set(s => ({
    notifications: (s.notifications || []).map(n => n.id === id ? { ...n, read: true } : n),
  })),
  markAllNotificationsRead: () => set(s => ({
    notifications: (s.notifications || []).map(n => ({ ...n, read: true })),
  })),
  dismissNotification: (id) => set(s => ({
    notifications: (s.notifications || []).filter(n => n.id !== id),
  })),
  callTimerRef: null,
  detailPatient: null,
  detailPatientCalls: [],
  activeCallRow: null,
  liveDrawerPatient: null,

  // ─── Supabase: Fetch patients ───
  fetchPatients: async () => {
    set({ patientsLoading: true, patientsError: null });
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Supabase patients fetch failed:', error.message);
      set({
        patients: [],
        patientsLoading: false,
        patientsError: error.message,
      });
    } else {
      // Build maps for merging: in-memory state (from active invocations) + fallback seed data
      const existing = get().patients;
      const overrides = {};
      for (const ep of existing) {
        if (ep.agentAssigned) overrides[ep.id] = ep;
      }
      const patients = data.map(dbToJs).map(p => {
        const isPeter = p.name === 'Peter Kim' || p.id === 'p11';
        const mem = overrides[p.id];
        return {
          ...p,
          name: isPeter ? 'Clara Mitchell' : p.name,
          initials: isPeter ? 'CM' : p.initials,
          // Priority: in-memory invoke state > DB state
          agentAssigned: mem?.agentAssigned || p.agentAssigned || '',
          agentRole: mem?.agentRole || p.agentRole || '',
          onCall: mem ? mem.onCall : (p.onCall || false),
          status: mem ? mem.status : p.status,
          callDuration: mem ? mem.callDuration : p.callDuration,
          nextAction: mem?.nextAction || p.nextAction,
        };
      });
      // Sort by numeric part of id (p1, p2, ... p10, p11, ...)
      patients.sort((a, b) => {
        const na = parseInt(a.id.replace(/\D/g, ''), 10);
        const nb = parseInt(b.id.replace(/\D/g, ''), 10);
        return na - nb;
      });
      set({
        patients,
        patientsLoading: false,
      });
    }
  },

  // ─── Supabase: Fetch call details — all records, client-side pagination ───
  fetchCallDetails: async () => {
    const PAGE_SIZE = 10;
    set({ callDetailsLoading: true });

    const { data, error } = await supabase
      .from('call_details')
      .select('*')
      .neq('call_type', 'ongoing')
      .order('started_at', { ascending: false });

    if (error) console.warn('call_details fetch failed:', error.message);
    const combined = (data || [])
      .map(c => enrichCallRecord(callDetailDbToJs(c)))
      .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));

    set({
      _allCallDetails: combined,
      callDetails: combined.slice(0, PAGE_SIZE),
      callDetailsLoading: false,
      callDetailsHasMore: combined.length > PAGE_SIZE,
    });
  },

  fetchMoreCallDetails: () => {
    const { _allCallDetails, callDetails, callDetailsLoading } = get();
    if (callDetailsLoading) return;
    const PAGE_SIZE = 10;
    const offset = callDetails.length;
    if (offset >= _allCallDetails.length) return;
    set(s => ({
      callDetails: [...s.callDetails, ..._allCallDetails.slice(offset, offset + PAGE_SIZE)],
      callDetailsHasMore: offset + PAGE_SIZE < _allCallDetails.length,
    }));
  },

  // ─── Supabase: Fetch calls UI config (nav items, phone lines, session list) ───
  fetchCallsConfig: async () => {
    set({ callsConfigLoading: true });
    const [navRes, linesRes, sessRes] = await Promise.allSettled([
      supabase.from('call_nav_items').select('*').order('sort_order'),
      supabase.from('call_lines').select('*').order('sort_order'),
      supabase.from('call_sessions').select('*').order('created_at'),
    ]);

    const mapNav = row => ({
      id: row.id,
      section: row.section,
      icon: row.icon || null,
      label: row.label,
      isCustomIcon: row.is_custom_icon,
      sortOrder: row.sort_order,
    });
    const mapLine = row => ({ id: row.id, label: row.label, phoneNumber: row.phone_number });
    const mapSession = row => ({
      id: row.id,
      name: row.name === 'Williamy Jammy' ? 'Clara Mitchell' : row.name,
      status: row.status,
      time: row.time, dir: row.dir, pinned: row.pinned, active: row.active,
    });

    const navData = navRes.status === 'fulfilled' ? (navRes.value.data || []) : [];
    const linesData = linesRes.status === 'fulfilled' ? (linesRes.value.data || []) : [];
    const sessData = sessRes.status === 'fulfilled' ? (sessRes.value.data || []) : [];

    set({
      callNavItems: navData.map(mapNav),
      callLines: linesData.map(mapLine),
      callSessions: sessData.map(mapSession),
      callsConfigLoading: false,
    });
  },

  // Helper: get call records for a patient
  getCallsForPatient: (patientId) => {
    return get().callDetails.filter(c => c.patientId === patientId);
  },

  // Helper: get latest call of a specific type
  getLatestCall: (patientId, callType) => {
    return get().callDetails.find(c => c.patientId === patientId && c.callType === callType);
  },

  // Create a new call record (on agent invoke)
  createCallRecord: (record) => {
    track('call.record_created', { callId: record?.id });
    set(s => ({ callDetails: [enrichCallRecord(record), ...s.callDetails] }));
    // Persist to Supabase in background
    supabase.from('call_details').insert(callDetailJsToDb(record)).then(({ error }) => {
      if (error) console.warn('Failed to persist call record:', error.message);
    });
  },

  // Update an existing call record
  updateCallRecord: (callId, updates) => {
    set(s => ({
      callDetails: s.callDetails.map(c => c.id === callId ? { ...c, ...updates } : c)
    }));
  },

  // ─── Supabase: Persist a patient update ───
  persistPatient: async (id, updates) => {
    const dbUpdates = updatesToDb(updates);
    const { error } = await supabase
      .from('patients')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Failed to persist patient update:', error.message);
    }
  },

  // Actions
  setActivePage: (page) => {
    const from = get().activePage;
    if (from !== page) track('nav.page_changed', { from, to: page });
    sessionStorage.setItem('activePage', page);
    set({ activePage: page });
    updateHash(get);
  },

  // ── Population Groups: persistent create-group CSV processing session ──
  startPgSession: (sess) => set({ pgSession: { ...sess }, pgMinimized: true }),
  updatePgSession: (patch) => set(s => ({ pgSession: s.pgSession ? { ...s.pgSession, ...patch } : null })),
  expandPgSession: () => set(s => ({ pgMinimized: false, pgReopenToken: s.pgReopenToken + 1 })),
  closePgSession: () => set({ pgSession: null, pgMinimized: false }),

  // Navigation guard for full-screen takeovers. When the user clicks a Sidebar
  // entry while the EmailBuilder or CampaignBuilder is open, we don't want the
  // page to silently change underneath them — instead we ask the open builder
  // to handle the navigation, including any unsaved-changes confirmation it
  // owns. `pendingNavTarget` is the page we're trying to reach; the builder
  // clears it once it has decided what to do.
  pendingNavTarget: null,
  setPendingNavTarget: (page) => set({ pendingNavTarget: page }),
  requestNavigate: (page) => {
    const s = get();
    // Email Builder takeover — defer to its unsaved-changes flow.
    if (s.editingCampaignId) {
      set({ pendingNavTarget: page });
      return;
    }
    // Campaign Builder takeover — auto-saved on every edit, so we can close
    // and navigate immediately.
    if (s.campaignBuilderId) {
      set({ campaignBuilderId: null });
      sessionStorage.setItem('activePage', page);
      set({ activePage: page });
      updateHash(get);
      return;
    }
    // No takeover open — plain navigation.
    sessionStorage.setItem('activePage', page);
    set({ activePage: page });
    updateHash(get);
  },
  requestAddTask: (opts = {}) => {
    track('task.create_requested', { source: opts?.source || null });
    sessionStorage.setItem('activePage', 'tasks');
    set({ activePage: 'tasks', pendingAddTask: { member: opts.member || null } });
    updateHash(get);
  },
  clearPendingAddTask: () => set({ pendingAddTask: null }),
  setActiveTab: (tab) => {
    const from = get().activeTab;
    if (from !== tab) track('nav.tab_changed', { scope: 'population', from, to: tab });
    sessionStorage.setItem('activeTab', tab);
    set({ activeTab: tab });
    updateHash(get);
  },
  setSettingsTab: (tab) => {
    const from = get().settingsTab;
    if (from !== tab) track('nav.tab_changed', { scope: 'settings', from, to: tab });
    sessionStorage.setItem('settingsTab', tab);
    set({ settingsTab: tab });
    updateHash(get);
  },
  setShowCreateAgent: (v) => set({ showCreateAgent: v }),

  // Settings nav
  setSettingsNavItem: (item) => {
    const from = get().settingsNavItem;
    if (from !== item) track('nav.settings_section_changed', { from, to: item });
    sessionStorage.setItem('settingsNavItem', item);
    set({ settingsNavItem: item });
    updateHash(get);
  },
  setMemberLeadsTab: (tab) => {
    sessionStorage.setItem('memberLeadsTab', tab);
    set({ memberLeadsTab: tab });
    updateHash(get);
  },

  // Chat Groups actions
  setMessagesUnreadCount: (n) => set({ messagesUnreadCount: n }),
  setPendingChatUserEmail: (email) => set({ pendingChatUserEmail: email }),
  setMessageTab: (tab) => { set({ messageTab: tab }); updateHash(get); },
  setChatGroupDetailId: (id) => {
    if (id) track('chat.group_detail_opened', { groupId: id });
    set({ chatGroupDetailId: id });
    updateHash(get);
  },
  setAgentRulesGroupId: (id) => {
    if (id) track('chat.rules_opened', { groupId: id });
    set({ agentRulesGroupId: id });
    updateHash(get);
  },
  setBusinessHoursOpen: (open) => { set({ businessHoursOpen: open }); updateHash(get); },

  setEmbeddedComponentsTab: (tab) => { set({ embeddedComponentsTab: tab }); updateHash(get); },
  setAccountTab: (tab) => { set({ accountTab: tab }); updateHash(get); },
  setContentTab: (tab) => { set({ contentTab: tab }); updateHash(get); },
  setComponentWizard: (open, editId = null) => { set({ componentWizardOpen: open, componentWizardEditId: editId }); },
  setComponentPreviewId: (id) => { set({ componentPreviewId: id }); },

  fetchChatGroups: async () => {
    set({ chatGroupsLoading: true });
    const { data, error } = await supabase
      .from('chat_groups')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('chat_groups fetch failed, using fallback:', error.message);
      console.warn('Supabase chat_groups fetch failed:', error.message);
      set({ chatGroupsData: [], chatGroupsLoading: false });
    } else {
      const mapped = data.map(row => ({
        id: row.id,
        name: row.name,
        users: row.users || [],
        roles: row.roles || [],
        location: row.location || 'Global Template',
        updated: row.updated_at ? new Date(row.updated_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '',
        updatedBy: row.updated_by || '',
        activeChats: row.active_chats || 0,
        hasAgent: row.has_agent || false,
        agentName: row.agent_name || '',
      }));
      set({ chatGroupsData: mapped, chatGroupsLoading: false });
    }
  },

  addChatGroup: async (group) => {
    const row = {
      name: group.name,
      users: group.users || [],
      roles: group.roles || [],
      location: group.location || 'Global Template',
      updated_by: group.updatedBy || '',
      active_chats: 0,
      has_agent: group.hasAgent || false,
      agent_name: group.agentName || null,
    };
    let { data, error } = await supabase.from('chat_groups').insert(row).select();
    if (error) {
      console.warn('Failed to create chat group:', error.message);
      // Show user feedback
      get().showToast?.('Failed to save group. Please try again.');
      return;
    }
    if (data?.[0]) {
      const newGroup = {
        id: data[0].id, name: data[0].name, users: data[0].users || [], roles: data[0].roles || [],
        location: data[0].location, updated: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        updatedBy: data[0].updated_by || '', activeChats: 0, hasAgent: data[0].has_agent, agentName: data[0].agent_name || '',
      };
      track('chat.group_created', { groupId: newGroup.id });
      set(s => ({ chatGroupsData: [newGroup, ...(s.chatGroupsData || [])] }));
      get().logAudit('ChatGroup', newGroup.id, newGroup.name, 'created', `Chat group created`, 'Lifecycle');
    }
  },

  updateChatGroup: async (id, updates) => {
    track('chat.group_updated', { groupId: id });
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.users !== undefined) dbUpdates.users = updates.users;
    if (updates.roles !== undefined) dbUpdates.roles = updates.roles;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.hasAgent !== undefined) dbUpdates.has_agent = updates.hasAgent;
    if (updates.agentName !== undefined) dbUpdates.agent_name = updates.agentName;
    dbUpdates.updated_at = new Date().toISOString();
    const { error } = await supabase.from('chat_groups').update(dbUpdates).eq('id', id);
    if (error) { console.warn('Failed to update chat group:', error.message); return; }
    set(s => ({
      chatGroupsData: (s.chatGroupsData || []).map(g => g.id === id ? {
        ...g, ...updates,
        updated: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      } : g),
    }));
    const group = (get().chatGroupsData || []).find(g => g.id === id);
    get().logAudit('ChatGroup', id, group?.name || '', 'updated', Object.keys(updates).join(', ') + ' changed', 'Configuration');
  },

  deleteChatGroup: async (id) => {
    track('chat.group_deleted', { groupId: id });
    const group = (get().chatGroupsData || []).find(g => g.id === id);
    set(s => ({ chatGroupsData: (s.chatGroupsData || []).filter(g => g.id !== id) }));
    const { error } = await supabase.from('chat_groups').delete().eq('id', id);
    if (error) console.warn('Failed to delete chat group:', error.message);
    if (group) get().logAudit('ChatGroup', id, group.name, 'deleted', 'Chat group deleted', 'Lifecycle');
  },

  // Knowledge Base add trigger (used by AgentsTable to tell KnowledgeBasePanel to open add form)
  kbAddTrigger: false,
  setKbAddTrigger: (v) => set({ kbAddTrigger: v }),

  // Domain Registry add trigger (used by EmbeddedComponentsSettings to tell DomainRegistryPanel to open add modal)
  domainAddTrigger: false,
  setDomainAddTrigger: (v) => set({ domainAddTrigger: v }),

  // ── Population Groups (Supabase-backed) ──
  popGroups: [],
  popGroupsLoading: false,
  fetchPopGroups: async () => {
    set({ popGroupsLoading: true });
    const { data, error } = await supabase
      .from('population_groups')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[store] population_groups fetch failed — run supabase/population_groups_migration.sql:', error.message);
      set({ popGroupsLoading: false });
      return;
    }
    set({ popGroups: (data || []).map(popGroupRowToJs), popGroupsLoading: false });
  },
  createPopGroup: async (group) => {
    const { data, error } = await supabase
      .from('population_groups')
      .insert(popGroupJsToDb(group))
      .select()
      .single();
    if (error) {
      console.warn('[store] createPopGroup failed:', error.message);
      get().showToast(`Failed to save group: ${error.message}`);
      return null;
    }
    const saved = popGroupRowToJs(data);
    set(s => ({ popGroups: [saved, ...s.popGroups] }));
    return saved;
  },
  updatePopGroup: async (id, updates) => {
    const { data, error } = await supabase
      .from('population_groups')
      .update(popGroupJsToDb(updates))
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.warn('[store] updatePopGroup failed:', error.message);
      get().showToast(`Failed to update group: ${error.message}`);
      return null;
    }
    const saved = popGroupRowToJs(data);
    set(s => ({ popGroups: s.popGroups.map(g => g.id === id ? saved : g) }));
    return saved;
  },

  // ── Embed Domains (Supabase-backed) ──
  embedDomains: [],
  embedDomainsLoading: false,
  fetchEmbedDomains: async () => {
    set({ embedDomainsLoading: true });
    const { data, error } = await supabase.from('embed_domains').select('*').order('id');
    if (error) { console.warn('[store] embed_domains fetch failed:', error.message); set({ embedDomainsLoading: false }); return; }
        set({ embedDomains: (data || []).map(domainDbToJs), embedDomainsLoading: false });
  },
  addEmbedDomain: async (domain) => {
    track('embed.domain_added', { domain: domain?.domain || domain?.host || domain?.url || null });
    // Check for duplicate domain
    const existing = get().embedDomains.find(d => d.domain?.toLowerCase() === domain.domain?.toLowerCase());
    if (existing) {
      get().showToast(`Domain "${domain.domain}" is already registered`);
      return null;
    }
    const row = domainJsToDb(domain);
    const { data, error } = await supabase.from('embed_domains').insert(row).select();
    if (error) {
      console.warn('[store] addEmbedDomain failed:', error.message);
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        get().showToast(`Domain "${domain.domain}" already exists`);
      } else {
        get().showToast(`Failed to register domain: ${error.message}`);
      }
      return null;
    }
        const newDomain = domainDbToJs(data[0]);
    set(s => ({ embedDomains: [newDomain, ...s.embedDomains] }));
    get().logAudit('Domain', newDomain.id, newDomain.domain, 'created', `Registered — category: ${newDomain.category}, HIPAA: ${newDomain.hipaa}`, 'Lifecycle');
    return newDomain;
  },
  updateEmbedDomain: async (id, updates) => {
    track('embed.domain_updated', { domainId: id });
    const oldDomain = get().embedDomains.find(d => d.id === id);
    const dbUpdates = domainJsToDb(updates);
    await supabase.from('embed_domains').update(dbUpdates).eq('id', id);
    set(s => ({ embedDomains: s.embedDomains.map(d => d.id === id ? { ...d, ...updates } : d) }));
    const changes = [];
    if (oldDomain) {
      for (const key of Object.keys(updates)) {
        if (oldDomain[key] !== updates[key]) {
          changes.push({ field: key, from: String(oldDomain[key] || ''), to: String(updates[key] || ''), type: key === 'enabled' ? 'status' : 'text' });
        }
      }
    }
    get().logAudit('Domain', id, oldDomain?.domain || '', 'updated', Object.keys(updates).join(', ') + ' changed', 'Configuration', changes);
  },
  deleteEmbedDomain: async (id) => {
    track('embed.domain_deleted', { domainId: id });
    // Block deletion if components reference this domain
    const compsUsingDomain = get().embedComponents.filter(c => c.domainId === id);
    if (compsUsingDomain.length > 0) {
      get().showToast(`Cannot delete — ${compsUsingDomain.length} component(s) use this domain. Remove or reassign them first.`);
      return false;
    }
    const domain = get().embedDomains.find(d => d.id === id);
    await supabase.from('embed_domains').delete().eq('id', id);
    set(s => ({ embedDomains: s.embedDomains.filter(d => d.id !== id) }));
    if (domain) get().logAudit('Domain', id, domain.domain, 'deleted', `Domain removed`, 'Lifecycle');
    return true;
  },
  toggleEmbedDomain: async (id) => {
    const domain = get().embedDomains.find(d => d.id === id);
    if (!domain) return;
    const newEnabled = !domain.enabled;
    track('embed.domain_toggled', { domainId: id, enabled: newEnabled });
    await supabase.from('embed_domains').update({ enabled: newEnabled }).eq('id', id);
    set(s => ({ embedDomains: s.embedDomains.map(d => d.id === id ? { ...d, enabled: newEnabled } : d) }));
    get().logAudit('Domain', id, domain.domain, newEnabled ? 'enabled' : 'disabled', newEnabled ? 'Domain enabled' : 'Domain disabled', 'Status',
      [{ field: 'enabled', from: domain.enabled ? 'Enabled' : 'Disabled', to: newEnabled ? 'Enabled' : 'Disabled', type: 'status' }]);
  },

  // ── Embed Components (Supabase-backed) ──
  embedComponents: [],
  embedComponentsLoading: false,
  fetchEmbedComponents: async () => {
    set({ embedComponentsLoading: true });
    const { data, error } = await supabase.from('embed_components').select('*').order('id');
    if (error) { console.warn('[store] embed_components fetch failed:', error.message); set({ embedComponentsLoading: false }); return; }
        set({ embedComponents: (data || []).map(componentDbToJs), embedComponentsLoading: false });
  },
  addEmbedComponent: async (comp) => {
    track('embed.component_added', { componentType: comp?.type || comp?.category || null });
        const row = componentJsToDb(comp);
    const { data, error } = await supabase.from('embed_components').insert(row).select();
    if (error) { console.warn('[store] addEmbedComponent failed:', error.message); return null; }
        const newComp = componentDbToJs(data[0]);
    set(s => ({ embedComponents: [newComp, ...s.embedComponents] }));
    get().logAudit('Component', newComp.id, newComp.name, 'created', `Created on domain ${newComp.domain}`, 'Lifecycle');
    return newComp;
  },
  updateEmbedComponent: async (id, updates) => {
    track('embed.component_updated', { componentId: id });
    const oldComp = get().embedComponents.find(c => c.id === id);
    const dbUpdates = componentJsToDb(updates);
    await supabase.from('embed_components').update(dbUpdates).eq('id', id);
    set(s => ({ embedComponents: s.embedComponents.map(c => c.id === id ? { ...c, ...updates } : c) }));
    // Build structured changes for rich audit log
    const changes = [];
    if (oldComp) {
      const trackFields = ['name', 'category', 'description', 'domain', 'url', 'visibleTo', 'activation', 'tokenLifetime', 'enabled'];
      for (const key of trackFields) {
        if (updates[key] !== undefined && String(oldComp[key] || '') !== String(updates[key] || '')) {
          changes.push({ field: key, from: String(oldComp[key] || ''), to: String(updates[key] || ''), type: key === 'enabled' ? 'status' : 'text' });
        }
      }
    }
    get().logAudit('Component', id, oldComp?.name || '', 'updated', Object.keys(updates).join(', ') + ' changed', 'Configuration', changes);
  },
  deleteEmbedComponent: async (id) => {
    track('embed.component_deleted', { componentId: id });
    const comp = get().embedComponents.find(c => c.id === id);
    await supabase.from('embed_components').delete().eq('id', id);
    set(s => ({ embedComponents: s.embedComponents.filter(c => c.id !== id) }));
    if (comp) get().logAudit('Component', id, comp.name, 'deleted', `Component removed`, 'Lifecycle');
  },
  toggleEmbedComponent: async (id) => {
    const comp = get().embedComponents.find(c => c.id === id);
    if (!comp) return;
    const newEnabled = !comp.enabled;
    await supabase.from('embed_components').update({ enabled: newEnabled }).eq('id', id);
    set(s => ({ embedComponents: s.embedComponents.map(c => c.id === id ? { ...c, enabled: newEnabled } : c) }));
    get().logAudit('Component', id, comp.name, newEnabled ? 'enabled' : 'disabled', newEnabled ? 'Component enabled' : 'Component disabled', 'Status',
      [{ field: 'enabled', from: comp.enabled ? 'Enabled' : 'Disabled', to: newEnabled ? 'Enabled' : 'Disabled', type: 'status' }]);
  },
  duplicateEmbedComponent: async (id) => {
    track('embed.component_duplicated', { componentId: id });
    const comp = get().embedComponents.find(c => c.id === id);
    if (!comp) return null;
        const dup = { ...comp, name: comp.name + ' (Copy)', enabled: false, id: undefined };
    const row = componentJsToDb(dup);
    delete row.id;
    const { data, error } = await supabase.from('embed_components').insert(row).select();
    if (error) { console.warn('[store] duplicateEmbedComponent failed:', error.message); return null; }
        const newComp = componentDbToJs(data[0]);
    set(s => ({ embedComponents: [...s.embedComponents, newComp] }));
    get().logAudit('Component', newComp.id, newComp.name, 'created', `Duplicated from "${comp.name}"`, 'Lifecycle');
    return newComp;
  },

  // ── Audit Log (Supabase-backed) ──
  // changes: JSON string of [{field, from, to, type}] for rich diff display
  logAudit: async (entityType, entityId, entityName, action, details, category, changes) => {
    // Get the current user's full name from Supabase auth
    let userName = 'Current User';
    try {
      const { data } = await supabase.auth.getUser();
      const meta = data?.user?.user_metadata || {};
      if (meta.first_name && meta.last_name) userName = `${meta.first_name} ${meta.last_name}`;
      else if (meta.full_name) userName = meta.full_name;
      else if (data?.user?.email) userName = data.user.email.split('@')[0];
    } catch (e) { /* fallback to Current User */ }
    const row = {
      entity_type: entityType, entity_id: String(entityId), entity_name: entityName,
      action, user_name: userName, details: details || null,
      category: category || null,
    };
    // Store changes in the details field as JSON if provided
    if (changes && changes.length > 0) {
      row.details = JSON.stringify({ text: details, changes });
    }
    const { error } = await supabase.from('audit_logs').insert(row);
    if (error) console.warn('[store] logAudit failed:', error.message);
  },
  fetchAuditLogs: async (entityType, entityId) => {
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    const { data, error } = await query.limit(100);
    if (error) { console.warn('[store] fetchAuditLogs failed:', error.message); return []; }
        return (data || []).map(auditLogDbToJs);
  },

  // FAQs
  faqsData: null,
  fetchFaqs: async () => {
    const { data, error } = await supabase.from('faqs').select('*').order('id');
    if (error) { console.warn('[store] faqs fetch failed:', error.message); return; }
    set({ faqsData: data.map(r => ({ id: r.id, question: r.question, answer: r.answer, category: r.category, updatedAt: r.updated_at || r.created_at })) });
  },
  addFaq: async (faq) => {
    const row = { question: faq.question, answer: faq.answer, category: faq.category };
    const { data, error } = await supabase.from('faqs').insert(row).select();
    if (!error && data && data[0]) {
      const r = data[0];
      track('chat.faq_created', { faqId: r.id });
      set(s => ({ faqsData: [...(s.faqsData || []), { id: r.id, question: r.question, answer: r.answer, category: r.category, updatedAt: new Date(r.updated_at || r.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) }] }));
    }
  },
  updateFaq: async (id, updates) => {
    track('chat.faq_updated', { faqId: id });
    const now = new Date().toISOString();
    await supabase.from('faqs').update({ ...updates, updated_at: now }).eq('id', id);
    set(s => ({ faqsData: (s.faqsData || []).map(f => f.id === id ? { ...f, ...updates, updatedAt: new Date(now).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) } : f) }));
  },
  deleteFaq: async (id) => {
    track('chat.faq_deleted', { faqId: id });
    await supabase.from('faqs').delete().eq('id', id);
    set(s => ({ faqsData: (s.faqsData || []).filter(f => f.id !== id) }));
  },

  // Agent Rules
  agentRulesData: null,
  fetchAgentRules: async () => {
    const { data, error } = await supabase.from('agent_rules').select('*').order('sort_order');
    if (error) { console.warn('[store] agent_rules fetch failed:', error.message); return; }
    set({ agentRulesData: data.map(r => ({ id: r.id, name: r.name, type: r.type, locked: r.locked, enabled: r.enabled, condition: r.condition_text, action: r.action_text, priority: r.priority_label, sortOrder: r.sort_order })) });
  },
  addAgentRule: async (rule) => {
    const row = { name: rule.name, type: 'custom', locked: false, enabled: true, condition_text: rule.condition, action_text: rule.action, sort_order: rule.sortOrder || 99 };
    const { data, error } = await supabase.from('agent_rules').insert(row).select();
    if (!error && data) {
      const mapped = { id: data[0].id, name: data[0].name, type: 'custom', locked: false, enabled: true, condition: data[0].condition_text, action: data[0].action_text, sortOrder: data[0].sort_order };
      track('chat.rule_created', { ruleId: mapped.id });
      set(s => ({ agentRulesData: [...(s.agentRulesData || []), mapped] }));
    }
  },
  updateAgentRule: async (id, updates) => {
    track('chat.rule_updated', { ruleId: id });
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
    if (updates.condition !== undefined) dbUpdates.condition_text = updates.condition;
    if (updates.action !== undefined) dbUpdates.action_text = updates.action;
    await supabase.from('agent_rules').update(dbUpdates).eq('id', id);
    set(s => ({ agentRulesData: (s.agentRulesData || []).map(r => r.id === id ? { ...r, ...updates } : r) }));
  },
  deleteAgentRule: async (id) => {
    track('chat.rule_deleted', { ruleId: id });
    await supabase.from('agent_rules').delete().eq('id', id);
    set(s => ({ agentRulesData: (s.agentRulesData || []).filter(r => r.id !== id) }));
  },

  // Chat Participants
  participantsData: null,
  fetchParticipants: async () => {
    const { data, error } = await supabase.from('chat_participants').select('*').order('id');
    if (error) { console.warn('[store] chat_participants fetch failed:', error.message); return; }
    set({ participantsData: data.map(r => ({ id: r.id, name: r.name, role: r.role, type: r.type, isAgent: r.is_agent })) });
  },

  // Business Hours
  businessHoursData: null,
  fetchBusinessHoursData: async () => {
    const { data, error } = await supabase.from('business_hours').select('*').order('id');
    if (error) { console.warn('[store] business_hours fetch failed:', error.message); return; }
    set({ businessHoursData: data.map(r => ({ id: r.id, day: r.day_of_week, available: r.available, slots: r.slots })) });
  },
  updateBusinessHoursDay: async (id, updates) => {
    const dbUpdates = {};
    if (updates.available !== undefined) dbUpdates.available = updates.available;
    if (updates.slots !== undefined) dbUpdates.slots = updates.slots;
    await supabase.from('business_hours').update(dbUpdates).eq('id', id);
    set(s => ({ businessHoursData: (s.businessHoursData || []).map(d => d.id === id ? { ...d, ...updates } : d) }));
  },

  // Holidays
  holidaysData: null,
  fetchHolidays: async () => {
    const { data, error } = await supabase.from('holidays').select('*').order('date');
    if (error) { console.warn('[store] holidays fetch failed:', error.message); return; }
    set({ holidaysData: data.map(r => ({ id: r.id, date: r.date, name: r.name })) });
  },
  addHoliday: async (holiday) => {
    const { data, error } = await supabase.from('holidays').insert({ date: holiday.date, name: holiday.name }).select();
    if (!error && data) set(s => ({ holidaysData: [...(s.holidaysData || []), { id: data[0].id, date: data[0].date, name: data[0].name }] }));
  },
  deleteHoliday: async (id) => {
    await supabase.from('holidays').delete().eq('id', id);
    set(s => ({ holidaysData: (s.holidaysData || []).filter(h => h.id !== id) }));
  },

  // Goals actions
  setGoalDetailId: (id) => {
    if (id) track('goal.detail_opened', { goalId: id });
    set({ goalDetailId: id });
    updateHash(get);
  },
  setGoalWizard: (open, editId) => {
    if (open) track('goal.wizard_opened', { mode: editId ? 'edit' : 'new', goalId: editId || null });
    set({ goalWizardOpen: open, goalWizardEditId: editId || null });
    updateHash(get);
  },

  fetchGoals: async () => {
    set({ goalsLoading: true });
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('goals fetch failed:', error.message);
      set({ goalsData: [], goalsLoading: false, goalsError: error.message });
    } else {
      // Map DB snake_case → JS camelCase
      const mapped = data.map(row => ({
        id: row.id,
        name: row.name,
        program: row.program,
        programColor: row.program_color || (row.program === 'TCM' ? 'purple' : row.program === 'Outreach' ? 'blue' : 'amber'),
        description: row.description || '',
        status: row.status || 'draft',
        weightedScoring: row.weighted_scoring || false,
        passingScore: row.passing_score || 100,
        mode: row.mode || 'all-mandatory',
        steps: row.steps || [],
        successMetrics: row.success_metrics || [],
        agents: row.agents || [],
        completionRate: row.completion_rate || 0,
        totalRuns: row.total_runs || 0,
        created: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      }));
      set({ goalsData: mapped, goalsLoading: false });
    }
  },

  addGoal: async (goal) => {
    track('goal.created', { goalId: goal.id, goalKind: goal.kind || goal.program || null });
    // Optimistic update
    set(s => {
      const current = s.goalsData || [];
      return { goalsData: [goal, ...current] };
    });
    // Persist to Supabase
    const row = {
      id: goal.id,
      name: goal.name,
      program: goal.program,
      program_color: goal.programColor,
      description: goal.description,
      status: goal.status,
      weighted_scoring: goal.weightedScoring,
      passing_score: goal.passingScore,
      mode: goal.mode,
      steps: goal.steps,
      success_metrics: goal.successMetrics,
      agents: goal.agents,
      completion_rate: goal.completionRate,
      total_runs: goal.totalRuns,
    };
    const { error } = await supabase.from('goals').insert(row);
    if (error) console.warn('Failed to persist goal:', error.message);
    get().logAudit('Goal', goal.id, goal.name, 'created', `Goal created — program: ${goal.program}, status: ${goal.status}`, 'Lifecycle');
  },

  updateGoal: async (goal) => {
    track('goal.updated', { goalId: goal.id });
    // Optimistic update
    set(s => {
      const current = s.goalsData || [];
      return { goalsData: current.map(g => g.id === goal.id ? goal : g) };
    });
    // Persist to Supabase
    const row = {
      name: goal.name,
      program: goal.program,
      program_color: goal.programColor,
      description: goal.description,
      status: goal.status,
      weighted_scoring: goal.weightedScoring,
      passing_score: goal.passingScore,
      mode: goal.mode,
      steps: goal.steps,
      success_metrics: goal.successMetrics,
      agents: goal.agents,
    };
    const { error } = await supabase.from('goals').update(row).eq('id', goal.id);
    if (error) console.warn('Failed to update goal:', error.message);
    get().logAudit('Goal', goal.id, goal.name, 'updated', `Goal updated — ${goal.name}`, 'Configuration');
  },

  deleteGoal: async (id) => {
    track('goal.deleted', { goalId: id });
    const goal = (get().goalsData || []).find(g => g.id === id);
    set(s => ({ goalsData: (s.goalsData || []).filter(g => g.id !== id) }));
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) console.warn('Failed to delete goal:', error.message);
    if (goal) get().logAudit('Goal', id, goal.name, 'deleted', `Goal deleted`, 'Lifecycle');
  },

  toggleSubnav: () => set(s => {
    const open = s.subnavCollapsed; // becomes !collapsed after the set, so "open" is the new state
    track('nav.subnav_toggled', { open });
    return { subnavCollapsed: !s.subnavCollapsed };
  }),
  setViewBy: (v) => set({ viewBy: v, currentPage: 1 }),
  setActiveFilters: (filters) => set({ activeFilters: filters, currentPage: 1 }),
  setFilter: (key, value) => {
    track('worklist.filter_applied', { filterKey: key, filterValue: value });
    set(s => {
      const next = { ...s.activeFilters };
      if (value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return { activeFilters: next, currentPage: 1 };
    });
  },
  clearAllFilters: () => {
    track('worklist.filters_cleared_all');
    set({ activeFilters: {}, currentPage: 1 });
  },
  setActiveSubnavList: (list) => {
    const from = get().activeSubnavList;
    if (from !== list) track('nav.list_changed', { from, to: list });
    set({ activeSubnavList: list, currentPage: 1 });
    updateHash(get);
    // First time we land on the HCC list with no filters yet, seed the
    // role-scoped default queue so users don't stare at the full worklist.
    if (list === 'HCC') {
      const s = get();
      const hasNoFilters = !s.hccFilters || Object.keys(s.hccFilters).length === 0;
      const hasNoSaved = !s.activeSavedIdByList?.HCC;
      if (hasNoFilters && hasNoSaved) get().applyHccRoleDefaultFilters();
    }
  },

  fetchAgents: async () => {
    set({ agentsLoading: true });
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Failed to fetch agents:', error.message);
      set({ agents: [], agentsLoading: false });
    } else {
      // Sort by numeric part of id for consistent order
      data.sort((a, b) => {
        const na = parseInt(a.id.replace(/\D/g, ''), 10);
        const nb = parseInt(b.id.replace(/\D/g, ''), 10);
        return na - nb;
      });
      set({ agents: data, agentsLoading: false });
    }
  },

  updateAgent: async (id, updates) => {
    track('builder.agent_updated', { agentId: id });
    const agent = get().agents.find(a => a.id === id);
    set(s => ({
      agents: s.agents.map(a => a.id === id ? { ...a, ...updates } : a)
    }));
    await supabase.from('agents').update(updates).eq('id', id);
    get().logAudit('Agent', id, agent?.name || '', 'updated', Object.keys(updates).join(', ') + ' changed', 'Configuration');
  },

  // ─── Agent Builder actions ───
  openBuilder: (agent, prompt) => {
    track('builder.opened', { agentId: agent?.id });
    sessionStorage.setItem('activePage', 'builder');
    set({ builderAgent: agent, activePage: 'builder', builderSelectedNode: null, builderPrompt: prompt || '' });
    get().fetchFlow(agent.id, prompt);
    updateHash(get);
  },

  closeBuilder: () => {
    track('builder.closed', { agentId: get().builderAgent?.id });
    sessionStorage.setItem('activePage', 'settings');
    set({ builderAgent: null, builderFlow: null, builderSelectedNode: null, builderVersions: [], builderPrompt: '', builderConfig: null, activePage: 'settings', _pendingAgentId: null });
    updateHash(get);
  },

  updateBuilderAgent: (patch) => set(s => ({
    builderAgent: s.builderAgent ? { ...s.builderAgent, ...patch } : s.builderAgent,
  })),

  /** Counter bumped when the toolbar Save attempts to save with invalid
   *  Global Settings. GlobalSettings listens to this and forces all
   *  required fields into the "touched" state so inline errors appear. */
  builderValidationAttempt: 0,
  bumpBuilderValidationAttempt: () => set(s => ({
    builderValidationAttempt: (s.builderValidationAttempt || 0) + 1,
  })),

  /** Returns { valid, errors } for the current agent's required global-settings
   *  fields. Errors keyed by field. Used by Save to gate version bumps and by
   *  GlobalSettings to disable its own Save Settings button. */
  validateBuilderAgent: () => {
    const a = get().builderAgent;
    const gs = a?.globalSettings || {};
    const errors = {};
    if (!String(gs.agentName || a?.name || '').trim()) errors.agentName = 'Agent Name is required';
    if (!String(gs.useCaseName || '').trim()) errors.useCaseName = 'Use Case is required';
    return { valid: Object.keys(errors).length === 0, errors };
  },

  setBuilderSelectedNode: (nodeId) => set({ builderSelectedNode: nodeId, builderActiveTransition: null }),
  builderActiveTransition: null,
  setBuilderActiveTransition: (idx) => set({ builderActiveTransition: idx }),

  fetchAgentConfig: async (agentId) => {
    set({ builderConfigLoading: true });
    const { data, error } = await supabase
      .from('agent_config')
      .select('*')
      .eq('agent_id', agentId)
      .maybeSingle();

    if (error) {
      console.warn('agent_config fetch failed:', error.message);
      set({ builderConfig: null, builderConfigLoading: false });
    } else {
      set({ builderConfig: data, builderConfigLoading: false });
    }
  },

  saveAgentConfig: async (agentId, configData) => {
    track('builder.agent_config_saved', { agentId });
    const row = {
      agent_id: agentId,
      agent_role: configData.agentRole,
      use_case_name: configData.useCaseName,
      description: configData.description,
      system_prompt: configData.systemPrompt,
      tone_of_voice: configData.toneOfVoice,
      voice: configData.voice,
      empathy_level: configData.empathyLevel,
      speaking_pace: configData.speakingPace,
      languages: configData.languages,
      adaptations: configData.adaptations,
      selected_policies: configData.selectedPolicies,
      population_type: configData.populationType,
      selected_worklist: configData.selectedWorklist || null,
      modality: configData.modality,
      phone: configData.phone,
      email: configData.email,
      office_hours: configData.officeHours,
      goal_ids: configData.goalIds,
    };

    const { data, error } = await supabase
      .from('agent_config')
      .upsert({ ...row }, { onConflict: 'agent_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('agent_config save failed:', error.message);
    } else {
      set({ builderConfig: data });
    }
    // Also update agent name on the agents table if changed
    if (configData.agentName) {
      const agent = get().builderAgent;
      if (agent && agent.name !== configData.agentName) {
        await get().updateAgent(agentId, { name: configData.agentName, use_case: configData.useCaseName });
      }
    }
    return !error;
  },

  fetchFlow: async (agentId, prompt) => {
    set({ builderFlowLoading: true });

    // Generate flow from prompt or use defaults
    const generated = prompt ? generateFlowFromPrompt(prompt) : null;

    const defaultNodes = generated?.nodes || [
      { id: 'start', type: 'startNode', position: { x: 200, y: 300 }, data: { label: 'Starts Here' } },
      { id: 'n1', type: 'conversationNode', position: { x: 380, y: 240 }, data: { label: 'Introduction & Patient Verification', prompt: 'Hello, this is the Fold Health care support assistant calling as part of your Transitions of Care follow-up program.\n\nI\'m reaching out because you were recently discharged from the hospital, and we want to make sure you\'re recovering safely.\n\nIs now a good time to talk for about 5 minutes?', nodeType: 'conversation', verified: true, transitions: [{ condition: 'If yes', target: 'Identity Verification' }, { condition: 'If no', target: 'Reschedule Node' }], guardrails: 'Do not share any patient data with the caller.' } },
      { id: 'n2', type: 'conversationNode', position: { x: 600, y: 100 }, data: { label: 'Identity Verification Node', prompt: 'To make sure I\'m speaking with the right person, could you please confirm your full name and date of birth?', nodeType: 'conversation', verified: true, transitions: [{ condition: 'Verified', target: 'Discharge Confirmation' }, { condition: 'Not verified', target: 'Transfer to Staff' }] } },
      { id: 'n3', type: 'conversationNode', position: { x: 550, y: 500 }, data: { label: 'Reschedule Node', prompt: 'No problem. When would be a better time for us to call you back?', nodeType: 'conversation', transitions: [{ condition: 'Save callback time', target: 'End' }] } },
      { id: 'end', type: 'endNode', position: { x: 900, y: 300 }, data: { label: 'End' } },
    ];
    const defaultEdges = generated?.edges || [
      { id: 'e-start-n1', source: 'start', target: 'n1', type: 'smoothstep', animated: true },
      { id: 'e-n1-n2', source: 'n1', target: 'n2', sourceHandle: 't-0', type: 'smoothstep' },
      { id: 'e-n1-n3', source: 'n1', target: 'n3', sourceHandle: 't-1', type: 'smoothstep' },
      { id: 'e-n3-end', source: 'n3', target: 'end', sourceHandle: 't-0', type: 'smoothstep' },
    ];

    try {
      const { data, error } = await supabase
        .from('agent_flows')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_current', true)
        .single();

      if (error || !data) {
        // Try to create a new flow in the DB
        const { data: newFlow, error: insertErr } = await supabase.from('agent_flows').insert({
          agent_id: agentId,
          version: '1.0',
          nodes: defaultNodes,
          edges: defaultEdges,
          is_current: true,
        }).select().single();

        if (insertErr) {
          // DB table may not exist yet - use local flow
          console.warn('agent_flows table not ready, using local flow:', insertErr.message);
          set({
            builderFlow: { id: 'local', nodes: defaultNodes, edges: defaultEdges, viewport: { x: 0, y: 0, zoom: 1 }, version: '1.0', agent_id: agentId },
            builderFlowLoading: false,
          });
          return;
        }

        set({
          builderFlow: newFlow || { id: 'local', nodes: defaultNodes, edges: defaultEdges, viewport: { x: 0, y: 0, zoom: 1 }, version: '1.0' },
          builderFlowLoading: false,
        });
      } else {
        set({ builderFlow: data, builderFlowLoading: false });
      }

      // Fetch all versions
      const { data: versions } = await supabase
        .from('agent_flows')
        .select('id, version, created_at, is_current')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (versions) set({ builderVersions: versions });
    } catch (err) {
      console.warn('Flow fetch error, using defaults:', err);
      set({
        builderFlow: { id: 'local', nodes: defaultNodes, edges: defaultEdges, viewport: { x: 0, y: 0, zoom: 1 }, version: '1.0' },
        builderFlowLoading: false,
      });
    }
  },

  saveFlow: async (nodes, edges, viewport) => {
    const { builderFlow, builderAgent } = get();
    if (!builderFlow || !builderAgent) return;
    track('builder.flow_saved', { agentId: builderAgent.id, flowId: builderFlow.id });

    const updates = { nodes, edges, viewport, updated_at: new Date().toISOString() };
    set(s => ({ builderFlow: { ...s.builderFlow, ...updates } }));

    await supabase.from('agent_flows').update(updates).eq('id', builderFlow.id);
    return true;
  },

  createFlowVersion: async (nodes, edges, viewport) => {
    const { builderFlow, builderAgent } = get();
    if (!builderFlow || !builderAgent) return;
    track('builder.flow_version_created', { agentId: builderAgent.id, versionId: builderFlow.id });

    // Mark old as not current
    await supabase.from('agent_flows').update({ is_current: false }).eq('id', builderFlow.id);

    // Parse version
    const parts = (builderFlow.version || '1.0').split('.');
    const newVersion = parts[0] + '.' + (parseInt(parts[1] || 0) + 1);

    const { data: newFlow } = await supabase.from('agent_flows').insert({
      agent_id: builderAgent.id,
      version: newVersion,
      nodes,
      edges,
      viewport,
      is_current: true,
    }).select().single();

    if (newFlow) {
      set({ builderFlow: newFlow });
      // Refresh versions list
      const { data: versions } = await supabase
        .from('agent_flows')
        .select('id, version, created_at, is_current')
        .eq('agent_id', builderAgent.id)
        .order('created_at', { ascending: false });
      if (versions) set({ builderVersions: versions });

      // Also update agent version
      await supabase.from('agents').update({ version: newVersion }).eq('id', builderAgent.id);
    }
    return newVersion;
  },

  switchFlowVersion: async (flowId) => {
    const { builderAgent } = get();
    if (!builderAgent) return;
    track('builder.flow_version_switched', { agentId: builderAgent.id, versionId: flowId });

    // Unset current
    await supabase.from('agent_flows').update({ is_current: false }).eq('agent_id', builderAgent.id).eq('is_current', true);
    // Set new current
    await supabase.from('agent_flows').update({ is_current: true }).eq('id', flowId);
    // Re-fetch
    get().fetchFlow(builderAgent.id);
  },

  updateNodeData: (nodeId, dataUpdates) => {
    set(s => {
      if (!s.builderFlow) return {};
      const nodes = s.builderFlow.nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdates } } : n
      );
      return { builderFlow: { ...s.builderFlow, nodes } };
    });
  },

  setCurrentPage: (page) => set({ currentPage: page }),
  setPerPage: (pp) => {
    track('worklist.page_size_changed', { size: pp });
    set({ perPage: pp, currentPage: 1 });
  },
  setSearchQuery: (q) => {
    const prev = get().searchQuery;
    if (q && q !== prev) track('worklist.search_executed', { queryLength: q.length });
    else if (!q && prev) track('worklist.search_cleared');
    set({ searchQuery: q, currentPage: 1 });
  },

  selectPatient: (id) => {
    track('worklist.row_selected', { patientId: id });
    set(s => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter(x => x !== id)
        : [...s.selectedIds, id]
    }));
  },
  selectAll: (ids) => {
    track('worklist.row_select_all', { count: Array.isArray(ids) ? ids.length : 0 });
    set({ selectedIds: ids });
  },
  clearSelected: () => {
    track('worklist.row_select_cleared');
    set({ selectedIds: [] });
  },

  // ─── HCC Worklist (Supabase-backed) ───
  // ── HEDIS worklist — local state for now, no Supabase backing yet ───────
  caregapActivity: CAREGAP_ACTIVITY_MOCK,
  caregapActivityLoaded: false,
  // Hydrate the activity feeds from Supabase. Rows exist per member; when the
  // table is empty or unreachable we keep the local mock so the drawer still
  // renders a realistic feed. `caregapActivityLoaded` gates the drawer's
  // skeleton so it shows once on cold load and never sticks.
  fetchCaregapActivity: async () => {
    if (get().caregapActivityLoaded) return;
    const { data, error } = await supabase
      .from('caregap_activity')
      .select('*')
      .order('at', { ascending: false });
    if (error || !data?.length) {
      if (error) console.warn('fetchCaregapActivity — keeping local mock:', error.message);
      set({ caregapActivityLoaded: true });
      return;
    }
    const byMember = {};
    for (const row of data) {
      (byMember[row.member_id] ??= []).push(caregapRowToEntry(row));
    }
    set({ caregapActivity: byMember, caregapActivityLoaded: true });
  },
  // Status updates applied to the local HEDIS mock data via setHedisMembers.
  hedisMembers: [],
  hedisLoading: false,
  setHedisMembers: (members) => set({ hedisMembers: members }),
  fetchHedisMembers: async () => {
    set({ hedisLoading: true });
    const { data, error } = await supabase
      .from('hedis_members')
      .select('*')
      .order('start_date', { ascending: false });
    if (error || !data?.length) {
      if (error) console.warn('fetchHedisMembers — falling back to local mock:', error.message);
      const { HEDIS_MEMBERS } = await import('../features/hedis-worklist/data/mock');
      set({ hedisMembers: HEDIS_MEMBERS, hedisLoading: false });
      return;
    }
    set({
      hedisMembers: data.map(r => ({
        id:              r.id,
        in:              r.initials,
        name:            r.name,
        gender:          r.gender,
        age:             r.age,
        memberId:        r.member_id,
        language:        r.language || 'en',
        gaps:            typeof r.gaps === 'string' ? JSON.parse(r.gaps) : (r.gaps || []),
        assignee:        r.assignee,
        assigneeInitials: r.assignee_initials,
        startDate:       r.start_date,
        advIllness:      r.adv_illness ?? 0,
        frailty:         r.frailty ?? 0,
        riskLevel:       r.risk_level,
        tasks:           r.tasks,
        outreachDots:    typeof r.outreach_dots === 'string' ? JSON.parse(r.outreach_dots) : (r.outreach_dots || ['pending', 'pending', 'pending']),
        outreachDate:    r.outreach_date,
        memberStatus:    r.member_status || 'Active',
        phone:           r.phone,
        dob:             r.dob,
        ipa:             r.ipa,
        hpCode:          r.hp_code,
        zip:             r.zip,
        city:            r.city,
        state:           r.state,
      })),
      hedisLoading: false,
    });
  },

  apcmPatients: [],
  apcmPatientsLoading: false,
  fetchApcmPatients: async () => {
    set({ apcmPatientsLoading: true });
    const { data, error } = await supabase
      .from('apcm_patients')
      .select('*')
      .order('name', { ascending: true });
    if (error || !data?.length) {
      if (error) console.warn('fetchApcmPatients — falling back to local mock:', error.message);
      const { APCM_PATIENTS } = await import('../features/apcm-billing/data/mock');
      set({ apcmPatients: APCM_PATIENTS, apcmPatientsLoading: false });
      return;
    }
    set({
      apcmPatients: data.map(r => ({
        id:                          r.id,
        name:                        r.name,
        memberId:                    r.member_id,
        language:                    r.language || 'en',
        ehrId:                       r.ehr_id,
        billingMonth:                r.billing_month,
        dateOfService:               r.date_of_service,
        isQmb:                       r.is_qmb,
        chronicConditionCount:       r.chronic_condition_count,
        cptCode:                     r.cpt_code,
        icdCodes:                    typeof r.icd_codes === 'string' ? JSON.parse(r.icd_codes) : (r.icd_codes || []),
        lastEncounterDate:           r.last_encounter_date,
        reasons:                     typeof r.reasons === 'string' ? JSON.parse(r.reasons) : (r.reasons || []),
        renderingProvider:           r.rendering_provider,
        renderingProviderInitials:   r.rendering_provider_initials,
        comment:                     r.comment || '',
        tab:                         r.tab,
        billingStatus:               r.billing_status,
        programId:                   r.program_id,
      })),
      apcmPatientsLoading: false,
    });
  },

  // ─── CCM Worklist (shared list) ─────────────────────────────────────────
  ccmWorklistMembers: [],
  ccmWorklistLoading: false,
  fetchCcmWorklistMembers: async () => {
    set({ ccmWorklistLoading: true });
    const { data, error } = await supabase
      .from('ccm_worklist_members')
      .select('*')
      .order('name', { ascending: true });
    if (error || !data?.length) {
      if (error) console.warn('fetchCcmWorklistMembers — falling back:', error.message);
      const { CCM_WORKLIST_MEMBERS } = await import('../features/ccm-worklist/data/mock');
      set({ ccmWorklistMembers: CCM_WORKLIST_MEMBERS, ccmWorklistLoading: false });
      return;
    }
    set({
      ccmWorklistMembers: data.map(r => ({
        id:                  r.id,
        initials:            r.initials,
        name:                r.name,
        gender:              r.gender,
        age:                 r.age,
        memberId:            r.member_id,
        language:            r.language || 'en',
        status:              r.status,
        nextActionDue:       r.next_action_due,
        nextActionOverdue:   !!r.next_action_overdue,
        outreachStatus:      r.outreach_status,
        outreachDate:        r.outreach_date,
        assigneeId:          r.assignee_id,
        assigneeName:        r.assignee_name,
        assigneeInitials:    r.assignee_initials,
        startDate:           r.start_date,
        lastAdmission:       r.last_admission,
        riskLevel:           r.risk_level,
        taskCount:           r.task_count ?? 0,
        carePlanStatus:      r.care_plan_status,
        billableSeconds:     r.billable_seconds ?? 0,
        unloggedSeconds:     r.unlogged_seconds ?? 0,
        dob:                 r.dob,
        utrFlag:             r.utr_flag || 'No',
        utrAgeDays:          r.utr_age_days ?? 0,
        programDueDate:      r.program_due_date,
        lastOutreachOutcome: r.last_outreach_outcome,
        assignmentDate:      r.assignment_date,
        ipa:                 r.ipa,
        hpCode:              r.hp_code,
        memberStatus:        r.member_status || 'Active',
        patientId:           r.patient_id,
      })),
      ccmWorklistLoading: false,
    });
  },

  // ─── SNP worklist ──────────────────────────────────────────────────────
  snpWorklistMembers: [],
  snpWorklistLoading: false,
  fetchSnpWorklistMembers: async () => {
    set({ snpWorklistLoading: true });
    const { data, error } = await supabase
      .from('snp_worklist_members')
      .select('*')
      .order('name', { ascending: true });
    if (error || !data?.length) {
      if (error) console.warn('fetchSnpWorklistMembers — falling back:', error.message);
      const { SNP_WORKLIST_MEMBERS } = await import('../features/snp-worklist/data/mock');
      set({ snpWorklistMembers: SNP_WORKLIST_MEMBERS, snpWorklistLoading: false });
      return;
    }
    set({
      snpWorklistMembers: data.map(r => ({
        id:               r.id,
        initials:         r.initials,
        name:             r.name,
        gender:           r.gender,
        age:              r.age,
        memberId:         r.member_id,
        language:         r.language || 'en',
        programSubStatus: r.program_sub_status,
        carePlanStatus:   r.care_plan_status,
        nextActionDue:    r.next_action_due,
        outreach:         r.outreach || null,
        assigneeId:       r.assignee_id,
        assigneeName:     r.assignee_name,
        assigneeInitials: r.assignee_initials,
        triggerDate:      r.trigger_date,
        lastAdmission:    r.last_admission,
        trigger:          r.trigger,
        riskIq:           r.risk_iq || 'Undetermined',
        tags:             r.tags || [],
        tagsMore:         r.tags_more ?? 0,
        taskCount:        r.task_count ?? 0,
        patientId:        r.patient_id,
      })),
      snpWorklistLoading: false,
    });
  },

  // ─── CCM Billing ───────────────────────────────────────────────────────
  // Keyed by patientId — the Billing Review step only ever needs one
  // patient's data at a time, so we avoid loading everything up front.
  ccmBillingPeriodsByPatient: {},
  ccmBillableActivitiesByPatient: {},
  ccmBillingLoadingByPatient: {},

  fetchCcmBilling: async (patientId) => {
    if (!patientId) return;
    set(s => ({ ccmBillingLoadingByPatient: { ...s.ccmBillingLoadingByPatient, [patientId]: true } }));

    const [periodsRes, activitiesRes] = await Promise.all([
      supabase.from('ccm_billing_periods').select('*').eq('patient_id', patientId).order('year_month', { ascending: false }),
      supabase.from('ccm_billable_activities').select('*').eq('patient_id', patientId).order('occurred_at', { ascending: false }),
    ]);

    const periodsError = periodsRes.error;
    const activitiesError = activitiesRes.error;
    const periodsData = periodsRes.data;
    const activitiesData = activitiesRes.data;

    // Fall back to local mock if either fetch fails or returns 0 rows — same
    // pattern apcmPatients uses so the UI still renders while migration is
    // pending on a fresh env.
    if (periodsError || activitiesError || !periodsData?.length) {
      if (periodsError) console.warn('fetchCcmBilling: periods →', periodsError.message);
      if (activitiesError) console.warn('fetchCcmBilling: activities →', activitiesError.message);
      const { CCM_BILLING_PERIODS, CCM_BILLABLE_ACTIVITIES } = await import('../features/patient/data/ccmBillingMock');
      // Clone the reference mock (patient 'p1') for whichever patient is on
      // screen so the UI has something to render before the migration lands.
      // Once real rows exist for this patient the Supabase path above takes
      // over and this block never runs.
      const periods = CCM_BILLING_PERIODS.map(p => ({ ...p, patientId }));
      const activities = CCM_BILLABLE_ACTIVITIES.map(a => ({ ...a, patientId }));
      set(s => ({
        ccmBillingPeriodsByPatient: { ...s.ccmBillingPeriodsByPatient, [patientId]: periods },
        ccmBillableActivitiesByPatient: { ...s.ccmBillableActivitiesByPatient, [patientId]: activities },
        ccmBillingLoadingByPatient: { ...s.ccmBillingLoadingByPatient, [patientId]: false },
      }));
      return;
    }

    const periods = periodsData.map(r => ({
      id:               r.id,
      patientId:        r.patient_id,
      programId:        r.program_id,
      yearMonth:        r.year_month,
      complexity:       r.complexity,
      requiredMinutes:  r.required_minutes,
      billStatus:       r.bill_status,
      claimStatus:      r.claim_status,
      generatedAt:      r.generated_at,
      sentAt:           r.sent_at,
    }));
    const activities = (activitiesData || []).map(r => ({
      id:               r.id,
      periodId:         r.period_id,
      patientId:        r.patient_id,
      activityType:     r.activity_type,
      description:      r.description || '',
      durationSeconds:  r.duration_seconds ?? 0,
      loggedBy:         r.logged_by,
      loggedByInitials: r.logged_by_initials,
      occurredAt:       r.occurred_at,
      isUnlogged:       !!r.is_unlogged,
    }));

    set(s => ({
      ccmBillingPeriodsByPatient: { ...s.ccmBillingPeriodsByPatient, [patientId]: periods },
      ccmBillableActivitiesByPatient: { ...s.ccmBillableActivitiesByPatient, [patientId]: activities },
      ccmBillingLoadingByPatient: { ...s.ccmBillingLoadingByPatient, [patientId]: false },
    }));
  },

  // Historical billing reports (one per closed month). Read-only from the
  // UI's perspective for now; a future "Generate Bill" flow would insert
  // rows here from the current-month period.
  ccmBillingReportsByPatient: {},
  fetchCcmBillingReports: async (patientId) => {
    if (!patientId) return;
    const { data, error } = await supabase
      .from('ccm_billing_reports')
      .select('*')
      .eq('patient_id', patientId)
      .order('generated_at', { ascending: false });

    if (error || !data?.length) {
      if (error) console.warn('fetchCcmBillingReports — falling back:', error.message);
      const { CCM_BILLING_REPORTS } = await import('../features/patient/data/ccmBillingMock');
      // Clone the reference mock for the on-screen patient so the History
      // tab has something to render before Alok runs the migration.
      const reports = CCM_BILLING_REPORTS.map(r => ({ ...r, patientId }));
      set(s => ({
        ccmBillingReportsByPatient: { ...s.ccmBillingReportsByPatient, [patientId]: reports },
      }));
      return;
    }

    const reports = data.map(r => ({
      id:                     r.id,
      reportNumber:           r.report_number,
      patientId:              r.patient_id,
      periodId:               r.period_id,
      yearMonth:              r.year_month,
      generatedAt:            r.generated_at,
      estBillingAmount:       Number(r.est_billing_amount),
      totalSeconds:           r.total_seconds ?? 0,
      integratedEhr:          r.integrated_ehr,
      providerName:           r.provider_name,
      providerInitials:       r.provider_initials,
      medicalDecisionMaking:  r.medical_decision_making,
      cptCodes:               typeof r.cpt_codes === 'string' ? JSON.parse(r.cpt_codes) : (r.cpt_codes || []),
    }));

    set(s => ({
      ccmBillingReportsByPatient: { ...s.ccmBillingReportsByPatient, [patientId]: reports },
    }));
  },

  // Optimistic add — inserts locally, then persists. The row must already
  // include a client id (`act-<uuid>`), periodId, patientId, activityType,
  // durationSeconds, occurredAt. Called by the timer widget on Stop and by
  // the unlogged-time drawer when classifying entries.
  addCcmBillableActivity: async (activity) => {
    const { patientId } = activity;
    set(s => {
      const prev = s.ccmBillableActivitiesByPatient[patientId] || [];
      return {
        ccmBillableActivitiesByPatient: {
          ...s.ccmBillableActivitiesByPatient,
          [patientId]: [activity, ...prev],
        },
      };
    });
    const row = {
      id:                 activity.id,
      period_id:          activity.periodId,
      patient_id:         activity.patientId,
      activity_type:      activity.activityType,
      description:        activity.description || '',
      duration_seconds:   activity.durationSeconds ?? 0,
      logged_by:          activity.loggedBy ?? null,
      logged_by_initials: activity.loggedByInitials ?? null,
      occurred_at:        activity.occurredAt,
      is_unlogged:        !!activity.isUnlogged,
    };
    const { error } = await supabase.from('ccm_billable_activities').insert(row);
    if (error) console.warn('addCcmBillableActivity — insert failed:', error.message);
  },

  updateGapStatus: (memberId, gapCode, nextStatus) => {
    track('hedis.gap_status_updated', { memberId, gapCode, status: nextStatus });
    set(s => ({
      hedisMembers: (s.hedisMembers || []).map(m =>
        m.id !== memberId ? m : {
          ...m,
          gaps: (m.gaps || []).map(g => g.code === gapCode ? { ...g, status: nextStatus } : g),
        }
      ),
    }));
  },
  updateGapAssignee: (memberId, gapCode, nextAssignee) => {
    track('hedis.gap_assignee_updated', { memberId, gapCode, assignee: nextAssignee });
    // Snapshot the previous assignee before we overwrite it so the activity
    // entry can show a `from → to` avatar transition.
    const s0 = get();
    const prevMember = (s0.hedisMembers || []).find(m => m.id === memberId);
    const prevGap    = prevMember?.gaps?.find(g => g.code === gapCode);
    const prevName   = prevGap?.assignee || null;
    const initialsOf = (n) => (String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '');
    const entry = {
      id: `assign-${Date.now()}`,
      at: new Date().toISOString(),
      actor: get().currentActorName(),
      t: 'assignee_change',
      title: 'Assignee Changed',
      fromAssignee: prevName ? { initials: initialsOf(prevName), name: prevName } : null,
      toAssignee:   nextAssignee ? { initials: initialsOf(nextAssignee), name: nextAssignee } : null,
    };
    set(s => ({
      hedisMembers: (s.hedisMembers || []).map(m =>
        m.id !== memberId ? m : {
          ...m,
          gaps: (m.gaps || []).map(g => g.code === gapCode ? { ...g, assignee: nextAssignee } : g),
        }
      ),
      caregapActivity: {
        ...s.caregapActivity,
        [memberId]: [entry, ...(s.caregapActivity[memberId] || [])],
      },
    }));
    persistCaregapActivityInsert(memberId, entry);
  },
  bulkUpdateGapStatuses: (memberId, updates) => {
    // updates: { [gapCode]: nextStatus }
    track('hedis.gap_status_bulk_updated', { memberId, count: Object.keys(updates || {}).length });
    set(s => ({
      hedisMembers: (s.hedisMembers || []).map(m =>
        m.id !== memberId ? m : {
          ...m,
          gaps: (m.gaps || []).map(g => updates[g.code] ? { ...g, status: updates[g.code] } : g),
        }
      ),
    }));
  },
  logCareGapActivity: (memberId, entry) => {
    const full = { id: Date.now(), at: new Date().toISOString(), ...entry };
    set(s => ({
      caregapActivity: {
        ...s.caregapActivity,
        [memberId]: [full, ...(s.caregapActivity[memberId] || [])],
      },
    }));
    persistCaregapActivityInsert(memberId, full);
  },
  // Push a real consolidated sign-off task into the existing `tasks` slice so
  // TasksView surfaces it (one task per patient per Submit-for-Review batch).
  // Gap codes ride in `task.labels` to satisfy the Gaps-column filter (AC-8).
  createCareGapSignOffTask: ({ hedisMemberId, gapCodes, state, pdf } = {}) => {
    track('hedis.signoff_task_created', { memberId: hedisMemberId });
    const member = get().hedisMembers.find(m => m.id === hedisMemberId);
    if (!member || !gapCodes || gapCodes.length === 0) return null;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const id = `tk-hedis-${hedisMemberId}-${Date.now()}`;
    const task = {
      id,
      name: 'Care Gap Review: Clinical Note',
      description: `Sign off on consolidated note for ${member.name} covering ${gapCodes.length} care gap${gapCodes.length === 1 ? '' : 's'}.`,
      status: 'pending',
      priority: 'medium',
      member: member.name,
      assigned_to: null,
      pool: 'HEDIS Sign-Off',
      labels: [...gapCodes],
      due_date: dueDate.toISOString().slice(0, 10),
      created_by: 'Care Manager',
      meta: `HEDIS Sign-Off · ${state || member.state || 'Unknown state'}`,
      hedisMemberId,
      hedisGapCodes: [...gapCodes],
      state: state || member.state,
      created_at: new Date().toISOString(),
      attachments: pdf ? 1 : 0,
      consolidatedPdf: pdf || null,
    };
    set(s => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  // Replace the consolidated PDF on an existing sign-off task (reviewer edited
  // the note). Atomically logs a "Clinical note updated" activity entry so the
  // history is visible from the patient drawer.
  updateSignOffTaskPdf: (taskId, pdf, actor = 'NP') => {
    track('hedis.signoff_task_pdf_attached', { taskId });
    const task = get().tasks.find(t => t.id === taskId);
    if (!task || !pdf) return false;
    set(s => ({
      tasks: s.tasks.map(t => (
        t.id === taskId
          ? { ...t, consolidatedPdf: pdf, attachments: 1, updated_at: new Date().toISOString() }
          : t
      )),
    }));
    if (task.hedisMemberId) {
      get().logCareGapActivity(task.hedisMemberId, {
        title: 'Clinical note updated',
        detail: `Reviewer edited the consolidated note for ${task.hedisGapCodes?.join(', ')}`,
        actor,
        icon: 'solar:pen-new-square-linear',
        gapCodes: task.hedisGapCodes,
        attachment: pdf,
      });
    }
    return true;
  },

  // NP marks the sign-off task complete → every gap in the task transitions to
  // Completed atomically (AC-13), the task moves to status=completed, and an
  // activity entry is appended for the patient's history.
  completeCareGapSignOffTask: (taskId, actor = 'NP') => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task || !task.hedisMemberId) return false;
    set(s => ({
      tasks: s.tasks.map(t => (t.id === taskId ? { ...t, status: 'completed' } : t)),
    }));
    const updates = Object.fromEntries((task.hedisGapCodes || []).map(c => [c, 'Completed']));
    get().bulkUpdateGapStatuses(task.hedisMemberId, updates);
    get().logCareGapActivity(task.hedisMemberId, {
      title: 'Task completed by NP',
      detail: `Gaps closed: ${(task.hedisGapCodes || []).join(', ')}`,
      actor,
      icon: 'solar:check-circle-linear',
      gapCodes: task.hedisGapCodes,
    });
    return true;
  },

  hccMembers: [],
  hccMembersLoading: false,
  hccMembersDidFetch: false,
  fetchHccMembers: async () => {
    // Single-fire per session — SubNav and HccWorklistTable both call this
    // on mount, and re-mounts across page navigation would otherwise re-run
    // the whole hcc_members select every route change. The store already
    // holds the result; no need to re-fetch.
    if (useAppStore.getState().hccMembersDidFetch) return;
    set({ hccMembersDidFetch: true });
    // Local helpers scoped to this action — stamp the WS1/WS8 grouping
    // fields onto each worklist row deterministically so the demo is
    // stable across reloads. Real backends would materialize these at
    // ingest time instead.
    const _hash = (s) => { let h = 0; const str = String(s || ''); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff; return Math.abs(h); };
    const _mdyToDate = (s) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '')); return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null; };
    const _parseDueOffsetDays = (due) => {
      const s = String(due || '');
      const num = parseInt(s.match(/(\d+)/)?.[1] || '0', 10);
      if (/week/i.test(s)) return num * 7;
      if (/(\d+)D\b/i.test(s) || /Days?/i.test(s)) return num;
      if (/Today/i.test(s)) return 0;
      return 30;
    };
    const _slaTargetIso = (createDate, dueStr) => {
      const created = _mdyToDate(createDate);
      if (!created) return null;
      const days = _parseDueOffsetDays(dueStr);
      const overdue = /Overdue/i.test(String(dueStr || ''));
      const offDays = overdue ? -days : days;
      return new Date(created.getTime() + offDays * 86400000).toISOString();
    };
    const _createdIso = (createDate) => (_mdyToDate(createDate) || new Date()).toISOString();
    // Assign visitType, arrivalOrder, sourceDocumentIds deterministically.
    // ~30% AWV, ~60% doc-first, and doc-first rows sharing a patient name
    // cluster into the same source-document bucket so mini-sweep groups
    // materialize naturally on load.
    // No DOS or Created Date may be in the future — a service can't have
    // happened, and a record can't have been created, after today. (Due
    // labels are left as-is; a due date is a deadline and may be future.)
    const _pad2 = (n) => String(n).padStart(2, '0');
    const _fmtMDY = (d) => `${_pad2(d.getMonth() + 1)}/${_pad2(d.getDate())}/${d.getFullYear()}`;
    const _toPastDate = (mdy) => {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(mdy || '').trim());
      if (!m) return mdy;
      const mm = +m[1], dd = +m[2];
      let yyyy = +m[3];
      while (new Date(yyyy, mm - 1, dd) > new Date()) yyyy -= 1;
      return `${_pad2(mm)}/${_pad2(dd)}/${yyyy}`;
    };
    // Canonical Visit Type list — same set as the Visit Type filter options
    // in filters.js. Assigned deterministically from the member's name so it
    // stays stable across reloads (and matches whichever the filter picks).
    const CANONICAL_VT_LIST = [
      'AWV - Annual Wellness Visit',
      'IPPE - Initial Preventive Physical Exam',
      'Annual Physical Exam',
      'New Patient Office Visit',
      'Established Patient Office Visit',
      'Telehealth Visit',
      'Specialist Visit / Consult',
      'ER Visit',
      'Inpatient Visit / Admission',
      'Observation Visit',
      'Skilled Nursing Facility Visit',
      'Home Visit',
      'Hospice Visit',
      'Lab/Imaging Order',
      'Transitional Care Management (TCM) Visit',
      'Chronic Care Management (CCM)',
    ];
    // Clinical Place-of-Service code + description per Visit Type. Real CMS
    // POS codes — a healthcare pro would immediately flag a Telehealth visit
    // billed as POS 11 (Office). This map is the single source of truth so
    // the DOS-level cells, filter buckets and per-DOS drill-downs all agree.
    const POS_BY_VT = {
      'AWV - Annual Wellness Visit':               { code: '11', desc: 'Office' },
      'IPPE - Initial Preventive Physical Exam':   { code: '11', desc: 'Office' },
      'Annual Physical Exam':                       { code: '11', desc: 'Office' },
      'New Patient Office Visit':                   { code: '11', desc: 'Office' },
      'Established Patient Office Visit':           { code: '11', desc: 'Office' },
      'Telehealth Visit':                           { code: '02', desc: 'Telehealth (Other)' },
      'Specialist Visit / Consult':                 { code: '22', desc: 'On-Campus OP Hospital' },
      'ER Visit':                                   { code: '23', desc: 'ER — Hospital' },
      'Inpatient Visit / Admission':                { code: '21', desc: 'Inpatient Hospital' },
      'Observation Visit':                          { code: '22', desc: 'On-Campus OP Hospital' },
      'Skilled Nursing Facility Visit':             { code: '31', desc: 'SNF' },
      'Home Visit':                                 { code: '12', desc: 'Home' },
      'Hospice Visit':                              { code: '34', desc: 'Hospice' },
      'Lab/Imaging Order':                          { code: '81', desc: 'Independent Lab' },
      'Transitional Care Management (TCM) Visit':   { code: '11', desc: 'Office' },
      'Chronic Care Management (CCM)':              { code: '11', desc: 'Office' },
    };
    // Specialty-appropriate provider pools per Visit Type — an ER encounter
    // should be attributed to an emergency physician, hospice care to a
    // palliative-care lead, etc. Pool size ≥2 so multiple records don't all
    // share one name.
    const PROVIDER_POOL_BY_VT = {
      'AWV - Annual Wellness Visit':               ['Dr. Sarah Chen (Family Medicine)',   'Dr. Priya Ramesh (Internal Medicine)',   'Dr. James Okafor (Family Medicine)'],
      'IPPE - Initial Preventive Physical Exam':   ['Dr. Priya Ramesh (Internal Medicine)','Dr. Sarah Chen (Family Medicine)',       'Dr. Nadia Rahman (Family Medicine)'],
      'Annual Physical Exam':                       ['Dr. James Okafor (Family Medicine)', 'Dr. Nadia Rahman (Family Medicine)',     'Dr. Priya Ramesh (Internal Medicine)'],
      'New Patient Office Visit':                   ['Dr. Sarah Chen (Family Medicine)',   'Dr. Nadia Rahman (Family Medicine)'],
      'Established Patient Office Visit':           ['Dr. Priya Ramesh (Internal Medicine)','Dr. James Okafor (Family Medicine)'],
      'Telehealth Visit':                           ['Dr. Elena Vasquez (Internal Medicine)','Dr. Sarah Chen (Family Medicine)'],
      'Specialist Visit / Consult':                 ['Dr. Rohit Cheng (Cardiology)',       'Dr. Anita Fielding (Endocrinology)',     'Dr. Miguel Alarcón (Nephrology)'],
      'ER Visit':                                   ['Dr. Marcus Kim (Emergency Medicine)','Dr. Elena Morris (Emergency Medicine)',   'Dr. Tomás Herrera (Emergency Medicine)'],
      'Inpatient Visit / Admission':                ['Dr. Rachel Osei (Hospitalist)',      'Dr. David Park (Hospitalist)'],
      'Observation Visit':                          ['Dr. Rachel Osei (Hospitalist)',      'Dr. David Park (Hospitalist)'],
      'Skilled Nursing Facility Visit':             ['Dr. Karen Mills (Geriatrics)',       'Dr. Robert Ng (Geriatrics)'],
      'Home Visit':                                 ['Dr. Indigo Bolen (Home Health)',     'Dr. Aisha Mehta (Home Health)'],
      'Hospice Visit':                              ['Dr. Amit Gupta (Palliative Care)',   'Dr. Yasmin Sadiq (Hospice/Palliative)'],
      'Lab/Imaging Order':                          ['Dr. Priya Ramesh (Internal Medicine)','Dr. James Okafor (Family Medicine)'],
      'Transitional Care Management (TCM) Visit':   ['Dr. Sarah Chen (Family Medicine)',   'Dr. Priya Ramesh (Internal Medicine)'],
      'Chronic Care Management (CCM)':              ['Dr. Sarah Chen (Family Medicine)',   'Dr. Nadia Rahman (Family Medicine)'],
    };
    // Clamp Created Date to the range [today-35d, today] so every row shows a
    // due-date detail and no record is overdue by more than ~3 weeks past the
    // 14-day SLA window. Deterministic per row id so the mix is stable across
    // reloads. All resulting dates land in 2026.
    const _clampCreatedDate = (row) => {
      const today = new Date();
      const seed = _hash(String(row.id || row.name || '') + '|created');
      const span = 35;                              // days back from today
      const offset = seed % (span + 1);             // 0..span
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      return _fmtMDY(d);
    };
    // Synthesize a plausible past DOS "MM/DD/YYYY" some months before the
    // record's Created Date (typical follow-up interval).
    const _synthPastDos = (createdMDY, seed) => {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(createdMDY || '');
      const base = m ? new Date(+m[3], +m[1]-1, +m[2]) : new Date();
      const daysBack = 60 + (seed % 120);            // 60..179 days earlier
      const d = new Date(base); d.setDate(d.getDate() - daysBack);
      return _fmtMDY(d);
    };
    const normalizeWorklistRow = (row0) => {
      // Spawned rows carry real user-entered data (Created date = when the
      // user saved, dos_list = exactly what they picked). Skip the demo-
      // stabilization (clamp created date, synth extra DOS) that only
      // makes sense for seeded mock patients.
      const isSpawned = row0?.is_spawned === true || row0?.isSpawned === true;
      const row = {
        ...row0,
        // Every record's Created Date is normalized to the SLA-relevant range
        // (max ~3 weeks overdue); the year is always the current one (2026).
        date: isSpawned ? (row0.date || _clampCreatedDate(row0)) : _clampCreatedDate(row0),
        dos: _toPastDate(row0.dos),
        dos_list: Array.isArray(row0.dos_list)
          ? row0.dos_list.map(d => (d && d.date) ? { ...d, date: _toPastDate(d.date) } : d)
          : row0.dos_list,
      };
      const nameSeed = _hash(row.name || '');
      // Every record picks a canonical Visit Type from the full list. Deter-
      // ministic per record so the assignment is stable across reloads. This
      // overrides any legacy shorthand (e.g. plain "AWV" or "HCC") the source
      // data may carry.
      const visitType = CANONICAL_VT_LIST[
        _hash(String(row.id || row.name || '') + '|vt') % CANONICAL_VT_LIST.length
      ];
      // arrivalOrder is per-patient so every row for the same patient
      // shares a source-document bucket in mini-sweep mode.
      const arrivalOrder = row.arrivalOrder || ((nameSeed % 10) < 6 ? 'doc-first' : 'claim-first');
      // Doc bucket keys off the patient's name + create-date YEAR so
      // multiple rows for the same patient in the same intake year
      // cluster into one mini-sweep. Later years spawn a new doc.
      const year = /(\d{4})/.exec(row.date || '')?.[1] || '';
      const sourceDocumentIds = row.sourceDocumentIds || (
        arrivalOrder === 'doc-first' ? [`seed-doc-${_hash((row.name || '') + '|' + year)}`] : []
      );
      const createdAt = row.createdAt || _createdIso(row.date);
      const slaTargetAt = row.slaTargetAt || _slaTargetIso(row.date, row.due);
      // Per-DOS enrichment (Figma 4680:138476): each dos_list entry carries
      // its own visit type / provider / POS / open-ICD count so an expanded
      // mini-sweep shows realistic distinct visits. Entry 0 mirrors the
      // record's own fields (collapsed row stays consistent with the
      // record-level columns); entries 1+ vary through fixed pools.
      // Sub-visits inside an expanded record pull from the same canonical VT
      // list so filter options and per-DOS Visit Type labels agree.
      const VT_POOL = CANONICAL_VT_LIST;
      const PROV_POOL = [
        { name: 'Dr. Marcus Osei',  pos: '21', posDesc: 'Inpatient Hospital' },
        { name: 'Dr. Aisha Mehta',  pos: '20', posDesc: 'Urgent Care Facility' },
        { name: 'Dr. Indigo Bolen', pos: '12', posDesc: 'Home' },
        { name: 'Dr. Karen Mills',  pos: '34', posDesc: 'Hospice' },
      ];
      // Every record must have ≥2 DOS entries — if we only have one, synthesize
      // a second earlier past encounter. Deterministic per record so the mix
      // stays stable across reloads. Spawned rows keep their real dos_list.
      const inputDosList = Array.isArray(row.dos_list) ? row.dos_list : [];
      const paddedDosList = (isSpawned || inputDosList.length >= 2)
        ? inputDosList
        : [
            ...inputDosList,
            {
              date: _synthPastDos(inputDosList[0]?.date || row.dos || row.date, nameSeed + 1),
              label: 'Due Today',
              labelColor: 'var(--status-warning)',
            },
          ];
      // Row-level POS + provider must match the Visit Type — no more "Telehealth
      // visit at POS 11 (Office)" or "ER visit attributed to a family-medicine
      // doctor". Deterministic per record so the mix stays stable across reloads.
      const rowPos = POS_BY_VT[visitType] || { code: '11', desc: 'Office' };
      const providerPool = PROVIDER_POOL_BY_VT[visitType] || ['Dr. Priya Ramesh (Internal Medicine)'];
      const rowProvider = providerPool[_hash(String(row.id || row.name || '') + '|prov') % providerPool.length];

      const dos_list = paddedDosList.map((d, idx) => {
        if (idx === 0) {
          // Entry 0 mirrors the record-level fields so the collapsed row is
          // internally consistent (VT, POS, provider all agree).
          return {
            ...d,
            vt: visitType,
            provider: rowProvider,
            pos: rowPos.code,
            posDesc: rowPos.desc,
            open: d?.open ?? row.open ?? 0,
          };
        }
        // Sub-visits: pick a different VT deterministically, then honor its
        // own POS + specialty pool. Ensures per-DOS drill-downs stay clinical.
        const eh = _hash((row.name || '') + (d?.date || '') + idx);
        const subVt = VT_POOL[eh % VT_POOL.length];
        const subPos = POS_BY_VT[subVt] || { code: '11', desc: 'Office' };
        const subPool = PROVIDER_POOL_BY_VT[subVt] || ['Dr. Priya Ramesh (Internal Medicine)'];
        return {
          ...d,
          vt: subVt,
          provider: subPool[eh % subPool.length],
          pos: subPos.code,
          posDesc: subPos.desc,
          open: d?.open ?? (1 + (eh % 12)),
        };
      });
      // Enforce the sequential workflow invariant on the ROW itself. Support →
      // Coder → QA → Compliance. If seeded data (mock or DB) has a later role
      // resolved while an earlier role is still in-flight, coerce it to a
      // legal state:
      //   - a later role terminal (Completed) past an untouched Support/Coder
      //     is impossible, so demote the later role to 'Assign';
      //   - Skipped is only valid for QA/Compliance when a still-later role has
      //     resolved (mirrors autoSkipEarlierRoles); apply that backfill too.
      const NON_TERMINAL = new Set(['Assign', 'New', 'Awaiting', 'In Progress',
        'Insufficient', 'Returned', 'Record Requested', 'Record Received']);
      const TERMINAL = new Set(['Completed', 'Skipped', 'Reject', 'Rejected', 'Billing Ready']);
      const enforce = (chain) => {
        const s = [...chain];
        // Pass 1: a later terminal can't sit past a non-terminal earlier role.
        for (let i = 1; i < s.length; i++) {
          if (TERMINAL.has(s[i]) && s[i] !== 'Skipped') {
            for (let j = 0; j < i; j++) {
              if (NON_TERMINAL.has(s[j]) || !s[j]) { s[i] = 'Assign'; break; }
            }
          }
        }
        // Pass 2: if a still-later role has resolved past an untouched QA
        // (idx 2) or Compliance (idx 3), the skipped role gets 'Skipped'.
        for (let i = 2; i < s.length; i++) {
          if (NON_TERMINAL.has(s[i]) || !s[i] || s[i] === 'Assign') {
            const laterResolved = s.slice(i + 1).some(x => TERMINAL.has(x));
            if (laterResolved) s[i] = 'Skipped';
          }
        }
        return s;
      };
      const [supS2, cdrS2, r1s2, r2s2] = enforce([row.supS, row.cdrS, row.r1s, row.r2s]);
      // Sync row-level fields with the canonical VT-driven values so the
      // Provider/POS columns in the collapsed row match too.
      return {
        ...row,
        vt: visitType,
        visitType,
        rp: rowProvider,
        pos: rowPos.code,
        posDesc: rowPos.desc,
        arrivalOrder,
        sourceDocumentIds,
        createdAt,
        slaTargetAt,
        dos_list,
        supS: supS2, cdrS: cdrS2, r1s: r1s2, r2s: r2s2,
      };
    };
    // WS3 — port AWV mock rows into the unified worklist shape so the
    // Visit Type filter has real rows to surface. AWV rows don't carry a
    // rendering provider, open-ICD count or POS, so we synthesize them
    // deterministically — these are mandatory at record creation and must
    // never render empty on the worklist.
    const AWV_PROVIDER_POOL = [
      'Dr. Alan Morse', 'Dr. Mallory Hayes', 'Dr. Susan Park', 'Dr. Calvin Reed',
      'Dr. Eamon', 'Dr. Nancy Wu', 'Dr. Jesse Flynn', 'Dr. Reed MacLeod',
    ];
    const portAwvRow = (a, i, n) => ({
      id: a.id || `awv-${i}`,
      memberId: a.memberId,
      in: a.in,
      name: a.name,
      g: a.g,
      age: a.age,
      cv: null, tv: null,
      dos_list: [{ date: a.due, label: a.dueLabel, labelColor: a.dueCol }],
      dos: a.due,
      visits: null,
      ch: null,
      docStatus: [],
      open: a.open || (3 + (i % 12)),           // mandatory — never zero
      // AWV rows carry no created date — synthesize a recent-past spread
      // (matching the HCC SLA window) so Created Date is never in the future.
      date: _fmtMDY(new Date(2026, 6, 9 - Math.round((i * 35) / Math.max((n || 1) - 1, 1)))),
      due: a.dueLabel,
      dueCol: a.dueCol,
      sup: a.assignee, supS: a.status,
      cdr: null, cdrS: 'Assign',
      r1: null, r1s: 'Assign',
      r2: null, r2s: 'Assign',
      rp: a.rp || AWV_PROVIDER_POOL[i % AWV_PROVIDER_POOL.length], // mandatory
      vt: a.vt || 'AWV',                         // mandatory
      raf: null, ri: null, ru: null,
      ipa: null, hp: null, pcp: null,
      dec: a.dec, coh: null,
      rl: a.rl, ad: a.ad, fr: a.fr,
      language: 'en',
      pos: '11', posDesc: 'Office',              // AWV → Office; mandatory
      visitType: 'AWV',
    });
    const finalize = async (baseRows) => {
      const all = baseRows;
      // Count rows per patient name so patients with 2+ rows get force-
      // routed to doc-first (they need to cluster into a mini-sweep).
      const nameCounts = all.reduce((acc, r) => { acc[r.name] = (acc[r.name] || 0) + 1; return acc; }, {});
      return all.map(row => normalizeWorklistRow({
        ...row,
        arrivalOrder: row.arrivalOrder || (nameCounts[row.name] > 1 ? 'doc-first' : undefined),
      }));
    };

    set({ hccMembersLoading: true });
    // Reads the compatibility view that rebuilds the pre-normalization JSON
    // shape (dos_list / doc_status) on top of the new normalized child tables
    // (hcc_member_visits / hcc_member_documents). See
    // supabase/hcc_schema_v2_types_and_normalization.sql.
    const { data, error } = await supabase
      .from('hcc_members_v2')
      .select('*')
      // SLA default: oldest Created Date first (closest to breaching the window).
      .order('create_date', { ascending: true });
    if (error) {
      // Phase 2f — Supabase error: fall back to the full local mock so the
      // worklist still has rows. Logs the error so we don't silently swap
      // backends without noticing.
      console.warn('fetchHccMembers error — falling back to local mock:', error.message);
      const { HCC_MEMBERS } = await import('../features/hcc/data/mock');
      set({ hccMembers: await finalize(HCC_MEMBERS), hccMembersLoading: false });
      return;
    }
    // Empty result set: same fallback.
    if (!data || data.length === 0) {
      const { HCC_MEMBERS } = await import('../features/hcc/data/mock');
      set({ hccMembers: await finalize(HCC_MEMBERS), hccMembersLoading: false });
      return;
    }
    const POS_MAP = { 'Walk-in': { code: '11', desc: 'Office' }, Telehealth: { code: '02', desc: 'Telehealth' } };
    // Phase 2f — when Supabase rows are missing prototype-shape fields
    // (dos_list, docStatus, cv/tv), fall back to the local rich mock keyed
    // by name. This keeps the DiagPanel's DosSelector + Snapshot tiles
    // populated even when the backend hasn't seeded that data yet.
    const { HCC_MEMBER_BY_NAME } = await import('../features/hcc/data/mock');
    // Schema v2 (see supabase/hcc_schema_v2_types_and_normalization.sql) now
    // stores real Postgres types. PostgREST hands NUMERIC columns back as
    // strings (to preserve precision) and DATE columns as 'YYYY-MM-DD'. The
    // rest of the app still expects the legacy string shapes (raf as string
    // ok, age as "67y 3m", dates as MM/DD/YYYY because they're used as lookup
    // keys in hccDosAssignments), so we adapt at the store boundary.
    const _isoToMdy = (iso) => {
      if (!iso) return null;
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
      return m ? `${m[2]}/${m[3]}/${m[1]}` : String(iso);
    };
    const _ageFromDob = (dob) => {
      if (!dob) return null;
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob));
      if (!m) return null;
      const birth = new Date(+m[1], +m[2] - 1, +m[3]);
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      let months = now.getMonth() - birth.getMonth();
      if (now.getDate() < birth.getDate()) months -= 1;
      if (months < 0) { years -= 1; months += 12; }
      return `${years}y ${months}m`;
    };
    const _num = (v) => (v == null || v === '' ? null : Number(v));
    const members = (data || []).map(row => {
      const mock = HCC_MEMBER_BY_NAME[row.name] || {};
      const dosList = (row.dos_list && row.dos_list.length) ? row.dos_list : (mock.dos_list || []);
      // Provider, Visit Type / POS and the Open-ICD count are mandatory at
      // record creation, so a worklist row must never render them empty. Fall
      // back to the local mock (by name), then to a sensible default.
      const visitType = row.visit_type || mock.vt || 'Walk-in';
      const pos = POS_MAP[visitType] || { code: '11', desc: 'Office' };
      const openIcds = row.open_icds || mock.open || 6;
      const provider = row.rendering_provider || mock.rp || 'Dr. Alan Morse';
      return {
        id: row.id,
        memberId: row.member_id,
        in: row.initials,
        name: row.name,
        g: row.gender,
        // Age is derived from date_of_birth for display. dob is exposed too so
        // callers that want to compute a birthday, sort by DOB, or run their
        // own age math can do it without re-parsing the display string.
        dob: row.date_of_birth || null,
        age: _ageFromDob(row.date_of_birth),
        cv: row.current_visit ?? mock.cv ?? null,
        tv: row.total_visits  ?? mock.tv ?? null,
        dos_list: dosList,
        dos: dosList[(row.current_visit ?? mock.cv) ? (row.current_visit ?? mock.cv) - 1 : 0]?.date,
        visits: (row.current_visit ?? mock.cv) && (row.total_visits ?? mock.tv)
          ? `${row.current_visit ?? mock.cv} of ${row.total_visits ?? mock.tv} Visits`
          : null,
        ch: row.chart_count ?? mock.ch ?? null,
        docStatus: (row.doc_status && row.doc_status.length) ? row.doc_status : (mock.docStatus || []),
        open: openIcds,
        // create_date arrives as ISO 'YYYY-MM-DD'; downstream normalizeWorklistRow
        // and the hccDosAssignments map both key off MM/DD/YYYY, so convert once
        // here at the boundary.
        date: _isoToMdy(row.create_date),
        due: row.due_label,
        dueCol: row.due_color,
        sup: row.support_name, supS: row.support_status,
        cdr: row.coder_name, cdrS: row.coder_status,
        r1: row.reviewer1_name, r1s: row.reviewer1_status,
        r2: row.reviewer2_name, r2s: row.reviewer2_status,
        rp: provider,
        vt: visitType,
        // NUMERIC columns come back as strings from PostgREST; coerce to real
        // numbers so the table sort compares numerically without regex fallback.
        raf: _num(row.raf_score),
        ri: _num(row.raf_impact),
        ru: row.risk_utilization,
        ipa: row.ipa,
        hp: row.health_plan,
        pcp: row.pcp,
        dec: row.decile,       // INTEGER — already a JS number
        coh: row.cohort,
        rl: row.risk_level,
        ad: row.advillness,    // INTEGER
        fr: row.frailty,       // INTEGER
        language: row.language || 'en',
        pos: pos.code,
        posDesc: pos.desc,
        // Persisted flag for rows spawned client-side via addHccGapNewRow.
        // The DiagPanel uses it to skip the name-keyed mock ICD fallback
        // (which would leak the source patient's ICDs into the new row).
        isSpawned: row.is_spawned === true,
        // v3 filter-backing fields — contact, gap-count/last-activity, and
        // per-role Assigned/Completion timestamps. All arrive via the
        // hcc_members_v2 view; timestamps come back as ISO strings.
        city:  row.city,
        state: row.state,
        tin:   row.tin,
        hccG:  row.hcc_gap_count ?? null,
        gaps:  row.hcc_gap_count ?? null,          // "No. Of Gaps" mirrors the count
        lgaD:  row.last_gap_activity || null,       // "MM/DD/YYYY" ISO date
        supAD: row.support_assigned_at    || null,
        supCD: row.support_completed_at   || null,
        cdrAD: row.coder_assigned_at      || null,
        cdrCD: row.coder_completed_at     || null,
        r1AD:  row.reviewer1_assigned_at  || null,
        r1CD:  row.reviewer1_completed_at || null,
        r2AD:  row.reviewer2_assigned_at  || null,
        r2CD:  row.reviewer2_completed_at || null,
      };
    });
    set({ hccMembers: await finalize(members), hccMembersLoading: false });
  },

  // HCC Diagnosis Gaps (fetched per member from Supabase)
  hccDiagnosisGaps: [],
  hccDiagnosisGapsLoading: false,
  fetchHccDiagnosisGaps: async (memberId, memberName) => {
    // Clear the previous member's rows immediately — otherwise the panel
    // flashes (and can act on) stale cross-member data while the new
    // member's fetch is in flight.
    set({ hccDiagnosisGaps: [], hccDiagnosisGapsLoading: true });
    // Scope by member_id (per-row identity) so sibling rows of the same
    // patient don't share gaps. Migration backfilled member_id for every
    // pre-existing gap, so the id filter is authoritative; the name path
    // is only for callers that pass an id-less lookup.
    let q = supabase
      .from('hcc_diagnosis_gaps')
      .select('*')
      .order('created_at', { ascending: true });
    if (memberId) {
      q = q.eq('member_id', memberId);
    } else if (memberName) {
      q = q.eq('member_name', memberName);
    }
    const { data, error } = await q;
    if (error) {
      console.error('fetchHccDiagnosisGaps error:', error.message);
      set({ hccDiagnosisGaps: [], hccDiagnosisGapsLoading: false });
      return;
    }
    const gaps = (data || []).map(row => {
      // `kind` is the canonical identity — Associated | Manual | Suspect |
      // Recapture. `type` and `isLinked` are legacy shadows kept in sync for
      // components that still read them.
      const kind = row.kind
        || (row.type === 'Manual'    ? 'Manual'
          : row.type === 'Recapture' ? 'Recapture'
          : row.type === 'Suspect'   ? 'Suspect'
          : row.is_linked === false  ? 'Suspect'
          : 'Associated');
      return {
        id: row.id,
        code: row.code,
        desc: row.description,
        hcc: row.hcc_category,
        status: row.status,
        kind,
        type: kind === 'Associated' ? null : kind,
        docs: row.docs_count,
        cmts: row.comments_count,
        notes: row.notes_count,
        raf: row.raf_weight,
        last: row.last_activity,
        by: hccNormalizeReviewerLabel(row.last_activity_by),
        dismissReason: row.dismiss_reason,
        isLinked: kind !== 'Suspect' && kind !== 'Recapture' ? true : row.is_linked,
        dos: row.dos || undefined,
      };
    });
    set({ hccDiagnosisGaps: gaps, hccDiagnosisGapsLoading: false });
    // Hydrate per-DOS action state for the same member. Kept in the
    // same fetch chain so the DiagPanel's ICD cards render with any
    // saved accepts/rejects/missed/deferred/dismissals + removed DOSs
    // from previous sessions.
    try {
      const { data: dosData } = await supabase
        .from('hcc_gap_dos_actions')
        .select('*')
        .eq('member_name', memberName);
      const nextActions = {};
      const nextMeta = {};
      const nextDeleted = [];
      for (const r of (dosData || [])) {
        const key = `${r.code}|${r.dos}`;
        if (r.removed) nextDeleted.push(key);
        if (r.action) nextActions[key] = r.action;
        if (r.dismiss_reason || r.dismiss_note) {
          nextMeta[key] = { reason: r.dismiss_reason || '', note: r.dismiss_note || '' };
        }
      }
      set({
        hccGapDosActions: nextActions,
        hccGapDosMeta: nextMeta,
        hccGapDosDeleted: nextDeleted,
      });
    } catch (err) {
      console.warn('fetch hcc_gap_dos_actions failed:', err?.message || err);
    }
    // Once the fetch is settled, promote any mock-only "HCC Not Linked"
    // suggestions that already have evidence into hcc_diagnosis_gaps. This
    // keeps unlinked ICDs like I10 from staying purely client-side once
    // there's a claim or document behind them.
    get().backfillMockNotLinkedGaps(memberId, memberName);
  },

  // Promote every mock "HCC Not Linked" ICD for a member that has evidence
  // (any linked document OR claim) into hcc_diagnosis_gaps. Skips codes
  // already persisted for this member. Fire-and-forget batch insert with an
  // optimistic append so the panel switches from mock-fallback to DB-backed
  // rows immediately.
  //
  // "Evidence" = mock.docs > 0 OR mock.cmts > 0 — the seed data uses those
  // counters to record how many documents / claim mentions back the code,
  // which matches the OR semantics agreed for this feature.
  // Per-session guard so React StrictMode's double-invoke of the DiagPanel
  // fetch effect doesn't insert the same rows twice. Reset never — a page
  // reload gets a fresh module and a fresh Set, which is the right window.
  _hccNotLinkedBackfilled: new Set(),
  backfillMockNotLinkedGaps: async (memberId, memberName) => {
    if (!memberId || !memberName) return;
    const seen = get()._hccNotLinkedBackfilled;
    if (seen.has(memberId)) return;
    seen.add(memberId);
    const { getNotLinkedForMember } = await import('../features/hcc/data/icds');
    const mock = getNotLinkedForMember(memberName) || [];
    if (!mock.length) return;
    const s = get();
    // Dedupe against every gap already scoped to this member, regardless of
    // is_linked — the DB carries a UNIQUE (member_name, code) constraint
    // (see hcc_diag_kind_migration.sql), so promoting a code that's already
    // present as a Linked gap would fail the insert. Skip it either way.
    const existing = new Set(
      (s.hccDiagnosisGaps || []).map(g => g.code)
    );
    const eligible = mock.filter(m =>
      !existing.has(m.code) && ((m.docs ?? 0) > 0 || (m.cmts ?? 0) > 0)
    );
    if (!eligible.length) return;
    const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${memberId}-${Math.random().toString(36).slice(2, 10)}`;
    const rows = eligible.map(m => {
      const kind = m.type === 'Recapture' ? 'Recapture' : 'Suspect';
      return {
        id: newId(),
        member_id: memberId,
        member_name: memberName,
        code: m.code,
        description: m.desc,
        hcc_category: m.hcc || '',
        status: m.status || 'New',
        kind,
        type: kind,
        docs_count: m.docs ?? 0,
        comments_count: m.cmts ?? 0,
        notes_count: m.notes ?? 0,
        raf_weight: m.raf ?? 0,
        is_linked: false,
      };
    });
    // Optimistic append — mirrors fetchHccDiagnosisGaps's row-shape so
    // downstream memos see the promoted rows immediately.
    set(state => ({
      hccDiagnosisGaps: [
        ...state.hccDiagnosisGaps,
        ...rows.map(r => ({
          id: r.id, code: r.code, desc: r.description, hcc: r.hcc_category,
          status: r.status, kind: r.kind, type: r.type,
          docs: r.docs_count, cmts: r.comments_count, notes: r.notes_count,
          raf: r.raf_weight, last: null, by: null,
          dismissReason: null, isLinked: false,
        })),
      ],
    }));
    // ON CONFLICT (member_name, code) DO NOTHING — the constraint is
    // patient-level while gap fetches are scoped per worklist row
    // (member_id), so a code promoted from one of the patient's rows is
    // invisible to the in-memory dedupe when a sibling row promotes it
    // again. That re-promotion must be a silent no-op, not an error toast.
    const { error } = await supabase
      .from('hcc_diagnosis_gaps')
      .upsert(rows, { onConflict: 'member_name,code', ignoreDuplicates: true });
    if (error) reportPersistFailure(`backfillMockNotLinkedGaps(${memberName})`, error);
  },

  // Per-member Activity Log entries (DiagPanel Timeline tab)
  //
  // Ported from data/activity.js — mixed event types, each carrying its
  // full JSON payload so new event types can land without a schema
  // change. Consumers (LeftWorkspace rawActivity memo) call
  // getActivityFromDb which returns the member's rows, else the seeded
  // '_default' rows, else the JS mock.
  hccGapActivity: {},              // { memberName: [entry, ...] }
  hccGapActivityDidFetch: false,
  fetchHccGapActivity: async () => {
    if (get().hccGapActivityDidFetch) return;
    try {
      const { data, error } = await supabase
        .from('hcc_gap_activity')
        .select('*')
        .order('member_name', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const map = {};
      for (const r of (data || [])) {
        if (!map[r.member_name]) map[r.member_name] = [];
        map[r.member_name].push(r.entry);
      }
      set({ hccGapActivity: map, hccGapActivityDidFetch: true });
    } catch (err) {
      console.warn('fetchHccGapActivity error — components will fall back to mock:', err?.message || err);
      set({ hccGapActivityDidFetch: true });
    }
  },

  // Per-member sweep-ICD spread (DiagPanel cardIcds DOS grouping)
  //
  // hcc_gap_sweep holds ICDs with a JSONB `dos_entries` payload showing
  // per-DOS status/RAF/claim. Consumers (DiagPanel.jsx cardIcds memo)
  // read via getSweepIcdsFromDb which returns the member's rows, or
  // the seeded '_default' fallback, or the JS mock.
  hccGapSweep: {},                 // { memberName: [{ code, desc, hcc, type, dos_entries, docs, cmts, notes, last, by }] }
  hccGapSweepDidFetch: false,
  fetchHccGapSweep: async () => {
    if (get().hccGapSweepDidFetch) return;
    try {
      const { data, error } = await supabase
        .from('hcc_gap_sweep')
        .select('*')
        .order('member_name', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const map = {};
      for (const r of (data || [])) {
        if (!map[r.member_name]) map[r.member_name] = [];
        map[r.member_name].push({
          code: r.code,
          desc: r.description,
          hcc: r.hcc,
          type: r.type,
          dos_entries: r.dos_entries || [],
          docs: r.docs,
          cmts: r.cmts,
          notes: r.notes,
          last: r.last_activity,
          by: r.last_activity_by,
        });
      }
      set({ hccGapSweep: map, hccGapSweepDidFetch: true });
    } catch (err) {
      console.warn('fetchHccGapSweep error — components will fall back to mock:', err?.message || err);
      set({ hccGapSweepDidFetch: true });
    }
  },

  // Platform users — the "everyone with a profile" roster used by
  // people-pickers across the app (HCC Assignee filter, bulk Change
  // Assignees dialog, etc.). Reads full_name from the profiles table;
  // the JS mock in features/hcc/systemUsers.js remains as fallback so
  // filter option lists never render empty on cold load.
  platformUsers: [],           // [{ id, name, initials }]
  platformUsersDidFetch: false,
  // In-flight promise cache. Many components (RoleAssigneePicker,
  // CommentComposer, mention menus, DiagPanel, ChartDetailDrawer) each
  // fire fetchPlatformUsers() from their own useEffect. Without this
  // cache, all of those callers hit Supabase in parallel — the network
  // tab shows 30+ /profiles round-trips totaling 7s+ on first load.
  // First caller kicks off the request; every subsequent caller during
  // the flight awaits the same promise.
  _platformUsersPromise: null,
  fetchPlatformUsers: async () => {
    const s0 = get();
    if (s0.platformUsersDidFetch) return;
    if (s0._platformUsersPromise) return s0._platformUsersPromise;
    const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, email, clinical_roles')
        .order('full_name', { ascending: true });
      if (error) throw error;
      // Dedupe by name — profiles occasionally carries the same full_name
      // across multiple auth accounts (mail2… vs. .health, etc.), and
      // downstream people-pickers key their rows by name. UNION the
      // clinical_roles across duplicates: keeping the first-seen row
      // silently dropped anyone whose only role-carrying profile row
      // wasn't first in the sort, which surfaces as "user missing from
      // the role dropdown" even though admin set the role in Settings.
      const byName = new Map();
      for (const r of (data || [])) {
        const name = (r.full_name?.trim()
          || [r.first_name, r.last_name].filter(Boolean).join(' ').trim()
          || r.email?.split('@')[0]
          || '').trim();
        if (!name) continue;
        const roles = r.clinical_roles || [];
        const existing = byName.get(name);
        if (existing) {
          const merged = Array.from(new Set([...existing.clinicalRoles, ...roles]));
          byName.set(name, { ...existing, clinicalRoles: merged });
          continue;
        }
        const initials = name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
        byName.set(name, { id: r.id, name, initials, clinicalRoles: roles });
      }
      const rows = [...byName.values()];
      set({ platformUsers: rows, platformUsersDidFetch: true });
    } catch (err) {
      console.warn('fetchPlatformUsers error — pickers will fall back to systemUsers mock:', err?.message || err);
      set({ platformUsersDidFetch: true });
    } finally {
      set({ _platformUsersPromise: null });
    }
    })();
    set({ _platformUsersPromise: promise });
    return promise;
  },

  // Per-member RAF-Impact breakdown (worklist RAF tooltip)
  //
  // hcc_member_raf holds one row per (member, HCC) contribution to the
  // member's total RAF score. Fetched once and cached in a keyed map;
  // getRafBreakdownFromDb falls back to the JS mock when a member has
  // no rows.
  hccMemberRaf: {},                // { memberName: [{ hcc, name, impact }] }
  hccMemberRafDidFetch: false,
  fetchHccMemberRaf: async () => {
    if (get().hccMemberRafDidFetch) return;
    try {
      const { data, error } = await supabase
        .from('hcc_member_raf')
        .select('*')
        .order('member_name', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const map = {};
      for (const r of (data || [])) {
        const key = r.member_name;
        if (!map[key]) map[key] = [];
        map[key].push({ hcc: r.hcc, name: r.hcc_name, impact: Number(r.impact) });
      }
      set({ hccMemberRaf: map, hccMemberRafDidFetch: true });
    } catch (err) {
      console.warn('fetchHccMemberRaf error — components will fall back to mock:', err?.message || err);
      set({ hccMemberRafDidFetch: true });
    }
  },

  // Per-ICD confidence / evidence-factor / MEAT-note lookup
  //
  // hcc_gap_confidence is org-scoped (identical for every patient in Phase 2)
  // so a single fetch at panel mount hydrates every drill-down on the record.
  // Consumers (IcdRow) hit `getIcdConfidence(code)` which falls back to the
  // JS defaults in data/confidence.js when the code isn't seeded.
  hccGapConfidence: {},        // { code: { score, status, evidence, factors, meatNote } }
  hccGapConfidenceDidFetch: false,
  fetchHccGapConfidence: async () => {
    if (get().hccGapConfidenceDidFetch) return;
    try {
      const { data, error } = await supabase.from('hcc_gap_confidence').select('*');
      if (error) throw error;
      const map = {};
      for (const r of (data || [])) {
        map[r.code] = {
          score: r.score,
          status: r.status,
          evidence: r.evidence || [],
          factors: r.factors,
          meatNote: r.meat_note,
        };
      }
      set({ hccGapConfidence: map, hccGapConfidenceDidFetch: true });
    } catch (err) {
      console.warn('fetchHccGapConfidence error — components will fall back to mock:', err?.message || err);
      set({ hccGapConfidenceDidFetch: true });
    }
  },

  // Diagnosis-panel ancillary tabs (Comments / Documents / Notes / History)
  //
  // The four hcc_diag_* tables are org-scoped in Phase 2 — every drawer
  // shows the same content — so a single fire-and-forget fetch on first
  // panel open is enough. Store keeps a `didFetch` flag so we don't
  // re-round-trip on every open. Empty results fall back to the local
  // src/features/hcc/data/ancillary.js constants (kept as a safety net
  // while the seed rolls out to every environment).
  hccDiagComments: [],
  hccDiagDocumentsList: [],
  hccDiagNotes: [],
  hccDiagHistoryEntries: [],
  hccDiagAncillaryLoading: false,
  hccDiagAncillaryDidFetch: false,
  fetchHccDiagAncillary: async () => {
    if (get().hccDiagAncillaryDidFetch || get().hccDiagAncillaryLoading) return;
    set({ hccDiagAncillaryLoading: true });
    try {
      const [comments, documents, notes, history] = await Promise.all([
        supabase.from('hcc_diag_comments').select('*').order('created_at', { ascending: true }),
        supabase.from('hcc_diag_documents').select('*').order('created_at', { ascending: true }),
        supabase.from('hcc_diag_notes').select('*').order('created_at', { ascending: true }),
        supabase.from('hcc_diag_history').select('*').order('created_at', { ascending: true }),
      ]);
      set({
        hccDiagComments: (comments?.data || []).map(r => ({
          id: r.id, author: r.author, role: r.role, date: r.date, time: r.time,
          edited: r.edited, body: r.body,
          // Optional ICD/DOS scope — added later; DB rows seeded before the
          // column existed simply won't have these keys.
          icd: r.icd ?? null, dos: r.dos ?? null,
          // Status-change linkage — populated when the comment was
          // required for a workflow transition (e.g. Records Requested).
          statusFrom: r.status_from ?? null,
          statusTo:   r.status_to   ?? null,
        })),
        hccDiagDocumentsList: (documents?.data || []).map(r => ({
          id: r.id, name: r.name, ext: r.ext, type: r.doc_type,
          uploadedBy: r.uploaded_by, role: r.role, date: r.date, time: r.time,
          status: r.status,
        })),
        hccDiagNotes: (notes?.data || []).map(r => ({
          id: r.id, title: r.title, author: r.author, role: r.role,
          date: r.date, time: r.time, signed: r.signed, body: r.body,
        })),
        hccDiagHistoryEntries: (history?.data || []).map(r => ({
          id: r.id, dos: r.dos, hccCode: r.hcc_code, hccName: r.hcc_name,
          reviewedAt: r.reviewed_at, by: r.reviewed_by, role: r.role,
          claims: r.claims, icdStatus: r.icd_status,
        })),
        hccDiagAncillaryLoading: false,
        hccDiagAncillaryDidFetch: true,
      });
    } catch (err) {
      console.warn('fetchHccDiagAncillary error — components will fall back to local mock:', err?.message || err);
      set({ hccDiagAncillaryLoading: false, hccDiagAncillaryDidFetch: true });
    }
  },

  // Optimistic accept/dismiss of an ICD inside the DiagPanel. Updates the
  // local gap list immediately so the UI reflects the new state; the server
  // round-trip is a TODO (Phase 3).
  acceptHccGap: (code) => {
    const s0 = get();
    const memberName = s0.hccMembers.find(m => m.id === s0.diagPanelMemberId)?.name;
    set(s => ({
      hccDiagnosisGaps: s.hccDiagnosisGaps.map(g =>
        g.code === code ? { ...g, status: 'Accepted' } : g
      ),
    }));
    persistHccGapUpdate(code, memberName, { status: 'Accepted' });
    // ICD-level log entry → carries icds:[code] so it shows in both the
    // ICD-scoped log AND the DOS-level (global) log.
    get().addActivityEntry({
      t: 'accept', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
      icds: [code],
      headline: `Accepted ICD ${code}`,
      from: 'Open', to: 'Accepted',
    });
  },
  dismissHccGap: (code, reason) => {
    const s0 = get();
    const memberName = s0.hccMembers.find(m => m.id === s0.diagPanelMemberId)?.name;
    set(s => ({
      hccDiagnosisGaps: s.hccDiagnosisGaps.map(g =>
        g.code === code ? { ...g, status: 'Dismissed', dismissReason: reason ?? g.dismissReason } : g
      ),
    }));
    persistHccGapUpdate(code, memberName, { status: 'Dismissed', dismiss_reason: reason || null });
    get().addActivityEntry({
      t: 'dismiss', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
      icds: [code],
      headline: `Dismissed ICD ${code}${reason ? ` — ${reason}` : ''}`,
      from: 'Open', to: 'Dismissed',
    });
  },
  reopenHccGap: (code) => {
    const s0 = get();
    const memberName = s0.hccMembers.find(m => m.id === s0.diagPanelMemberId)?.name;
    set(s => ({
      hccDiagnosisGaps: s.hccDiagnosisGaps.map(g =>
        g.code === code ? { ...g, status: 'New', dismissReason: null } : g
      ),
    }));
    persistHccGapUpdate(code, memberName, { status: 'New', dismiss_reason: null });
    get().addActivityEntry({
      t: 'status_hcc', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
      icds: [code],
      headline: `Reopened ICD ${code}`,
      from: 'Dismissed', to: 'Open',
    });
  },

  // Per-(ICD × DOS) coder decisions for the redesigned DiagPanel cards
  // (see docs/features/hcc-coding-workflow.md §3). Keyed `${code}|${dos}`
  // per open member; accept/reject/missed/deferred layer on top of the
  // code-level gap status above. Passing the same action twice toggles it
  // off (undo).
  hccGapDosActions: {},
  // Dismiss reason + note per (code × DOS) — populated by dismissHccGapDos,
  // surfaced by the "Dismiss Reason" link on a dismissed row.
  hccGapDosMeta: {},
  // Shared: on the first ICD action by the current role (Coder / QA /
  // Compliance), auto-bump that role's DOS status from New / Assign →
  // In Progress. Called by both setHccGapDosAction and dismissHccGapDos so
  // *every* ICD action path (accept, missed, deferred, dismiss-with-reason)
  // triggers the same worklist transition. Support triages docs, not ICDs,
  // so it stays out of this path.
  _maybeAutoBumpInProgress: (memberId, dos) => {
    const s0 = get();
    if (!memberId) return;
    const ROLE_TO_ENGINE = { Coder: 'coder', QA: 'reviewer', Compliance: 'reviewer2' };
    const STATUS_FIELD  = { coder: 'cdrS', reviewer: 'r1s', reviewer2: 'r2s' };
    const engineRole = ROLE_TO_ENGINE[s0.hccUserRole];
    if (!engineRole) return;
    const member = s0.hccMembers.find(m => m.id === memberId);
    const cur = member?.[STATUS_FIELD[engineRole]];
    if (cur !== 'New' && cur !== 'Assign') return;
    queueMicrotask(() => {
      get().hccSetRoleStatus(memberId, dos, engineRole, 'In Progress');
    });
  },
  setHccGapDosAction: (code, dos, action) => {
    const s0 = get();
    const key = `${code}|${dos}`;
    const prev = s0.hccGapDosActions[key];
    const next = prev === action ? null : action;
    const memberId = s0.diagPanelMemberId;
    const memberName = s0.hccMembers.find(m => m.id === memberId)?.name;
    set(s => {
      const meta = { ...s.hccGapDosMeta };
      if (!next) delete meta[key]; // undo also clears any dismiss reason
      return { hccGapDosActions: { ...s.hccGapDosActions, [key]: next }, hccGapDosMeta: meta };
    });
    if (next) get()._maybeAutoBumpInProgress(memberId, dos);
    // Persist: toggle-off deletes the row; a fresh action upserts it.
    if (!next) {
      persistHccGapDosActionDelete(memberName, code, dos);
    } else {
      persistHccGapDosAction(memberName, code, dos, {
        action: next,
        dismiss_reason: null,
        dismiss_note: null,
      });
    }
    if (!next) return;
    const labels = {
      accepted: 'Accepted', rejected: 'Rejected',
      missed: 'Marked missed opportunity for', deferred: 'Deferred',
    };
    get().addActivityEntry({
      t: action === 'accepted' ? 'accept' : action === 'rejected' ? 'dismiss' : 'status_hcc',
      by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
      icds: [code],
      headline: `${labels[action]} ICD ${code} on DOS ${dos}`,
      from: 'Open', to: labels[action].split(' ')[0],
    });
  },
  // Dismiss a (code × DOS) with a reason + optional note (Figma dismiss
  // form). Sets the action to 'rejected' and records the reason.
  dismissHccGapDos: (code, dos, reason, note) => {
    const s0 = get();
    const key = `${code}|${dos}`;
    const memberId = s0.diagPanelMemberId;
    const memberName = s0.hccMembers.find(m => m.id === memberId)?.name;
    set(s => ({
      hccGapDosActions: { ...s.hccGapDosActions, [key]: 'rejected' },
      hccGapDosMeta: { ...s.hccGapDosMeta, [key]: { reason, note: note || '' } },
    }));
    get()._maybeAutoBumpInProgress(memberId, dos);
    persistHccGapDosAction(memberName, code, dos, {
      action: 'rejected',
      dismiss_reason: reason || null,
      dismiss_note: note || null,
    });
    get().addActivityEntry({
      t: 'dismiss', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
      icds: [code],
      headline: `Dismissed ICD ${code} on DOS ${dos} — ${reason}`,
      from: 'Open', to: 'Dismissed',
    });
  },

  // Set by addHccGap and consumed by IcdRow — when the code matches, the row
  // pulses a primary-300 border briefly and scrolls into view so the user
  // sees where their manual add landed in the current list of ICDs. Auto-
  // clears via a timer so the animation only fires once per add.
  hccJustAddedCode: null,
  clearHccJustAdded: () => set({ hccJustAddedCode: null }),

  // Manual DOSs the coder removed from an ICD card. Keyed as `${code}|${dos}`
  // so both the card's entry filter and the DOS action bookkeeping know to
  // ignore the row. Only manual DOS entries are removable — real seeded DOSs
  // are the record's source of truth and shouldn't be silently dropped.
  hccGapDosDeleted: [],
  removeIcdDos: (code, dos) => {
    const s0 = get();
    const k = `${code}|${dos}`;
    const memberName = s0.hccMembers.find(m => m.id === s0.diagPanelMemberId)?.name;
    set(s => ({
      hccGapDosDeleted: s.hccGapDosDeleted.includes(k)
        ? s.hccGapDosDeleted
        : [...s.hccGapDosDeleted, k],
    }));
    // Also drop any per-row action / dismiss metadata so the row can't leak
    // back in via other lists.
    set(s => {
      const nextActions = { ...s.hccGapDosActions };
      const nextMeta = { ...s.hccGapDosMeta };
      delete nextActions[k];
      delete nextMeta[k];
      return { hccGapDosActions: nextActions, hccGapDosMeta: nextMeta };
    });
    // Persist the tombstone so the removed DOS stays hidden after reload.
    // action/reason/note are wiped in the same upsert to keep the row
    // shape consistent with the local state above.
    persistHccGapDosAction(memberName, code, dos, {
      action: null,
      dismiss_reason: null,
      dismiss_note: null,
      removed: true,
    });
    get().addActivityEntry({
      t: 'status_hcc', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
      icds: [code],
      headline: `Removed DOS ${dos} from ${code}`,
      from: 'Manual', to: 'Removed',
    });
  },

  // Delete an entire manually-added ICD (type === 'Manual'). Removes the gap
  // from hccDiagnosisGaps + wipes any per-DOS actions/meta scoped to it.
  deleteHccGap: (code) => {
    const s0 = get();
    const gap = s0.hccDiagnosisGaps.find(g => g.code === code);
    if (!gap || gap.type !== 'Manual') return;
    const memberName = s0.hccMembers.find(m => m.id === s0.diagPanelMemberId)?.name;
    set(s => ({
      hccDiagnosisGaps: s.hccDiagnosisGaps.filter(g => g.code !== code),
    }));
    persistHccGapDelete(code, memberName);
    persistHccGapDosActionDeleteAll(memberName, code);
    set(s => {
      const nextActions = { ...s.hccGapDosActions };
      const nextMeta = { ...s.hccGapDosMeta };
      for (const k of Object.keys(nextActions)) {
        if (k.startsWith(`${code}|`)) delete nextActions[k];
      }
      for (const k of Object.keys(nextMeta)) {
        if (k.startsWith(`${code}|`)) delete nextMeta[k];
      }
      return {
        hccGapDosActions: nextActions,
        hccGapDosMeta: nextMeta,
        hccGapDosDeleted: s.hccGapDosDeleted.filter(k => !k.startsWith(`${code}|`)),
      };
    });
    get().addActivityEntry({
      t: 'status_hcc', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
      icds: [code],
      headline: `Deleted manually-added ICD ${code}`,
      from: gap.status || 'New', to: 'Deleted',
    });
  },

  // Coder manually adds a code the pipeline missed (chip: "Manually Added").
  // Fed by the shared IcdSearch (WHO ICD-11 lookup).
  addHccGap: ({ code, desc, hcc }) => {
    const s0 = get();
    if (s0.hccDiagnosisGaps.some(g => g.code === code)) return;
    const currentMember = s0.hccMembers.find(m => m.id === s0.diagPanelMemberId);
    const memberName = currentMember?.name;
    const memberId = currentMember?.id;
    const id = `manual-${code}`;
    set(s => ({
      hccDiagnosisGaps: [
        ...s.hccDiagnosisGaps,
        {
          id, code, desc, hcc: hcc || '', status: 'New',
          kind: 'Manual', type: 'Manual',
          docs: 0, cmts: 0, notes: 0, raf: 0,
          last: null, by: null, dismissReason: null, isLinked: true,
        },
      ],
      hccJustAddedCode: code,
    }));
    // Persist the new gap into Supabase so it survives reload. Scope by
    // member_id AND member_name — member_id is the per-row identity so
    // sibling rows for the same patient don't share gaps; member_name is
    // kept for legacy fallback in fetchHccDiagnosisGaps.
    if (memberName) {
      persistHccGapInsert({
        id, member_id: memberId, member_name: memberName, code,
        description: desc, hcc_category: hcc || '',
        status: 'New', type: 'Manual', kind: 'Manual',
        docs_count: 0, comments_count: 0, notes_count: 0, raf_weight: 0,
        is_linked: true,
      });
    }
    // Auto-clear the flash flag after the animation finishes. Kept inside the
    // action (not in the component) so any place that re-renders the ICD row
    // during the window sees the same flash state.
    setTimeout(() => {
      if (get().hccJustAddedCode === code) set({ hccJustAddedCode: null });
    }, 2200);
    get().addActivityEntry({
      t: 'status_hcc', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
      icds: [code],
      headline: `Manually added ICD ${code}`,
      from: '—', to: 'Open',
    });
  },

  // ─── New-row-from-new-DOS notice ──────────────────────────────────────
  // When a New Diagnosis Gap is saved with a DOS that doesn't exist on the
  // current member's dos_list, the store spawns a duplicate hccMembers row
  // (same patient, new encounter). The source drawer surfaces an alert
  // badge pointing at the new row; this slice carries the payload.
  //   sourceMemberId → { newMemberId, dos, code, kind: 'new-row' | 'existing-row' }
  hccNewRowNotice: {},
  dismissNewRowNotice: (sourceMemberId) => set(s => {
    if (!s.hccNewRowNotice[sourceMemberId]) return s;
    const next = { ...s.hccNewRowNotice };
    delete next[sourceMemberId];
    return { hccNewRowNotice: next };
  }),

  // Gaps attached to spawned rows live here (never in hccDiagnosisGaps).
  // The reason: hccDiagnosisGaps is refetched from Supabase whenever a
  // drawer opens (scoped by member_name), and that fetch would overwrite
  // any client-side insert. Keeping spawned gaps in their own slice lets
  // them survive drawer navigation and prevents them from leaking into
  // the source row (which shares member_name with the spawned row).
  //   memberId → gap[]
  hccSpawnedGaps: {},

  // Adds an ICD gap AND spawns a new hccMembers row for a new DOS on the
  // same patient. The new row lands at the top of the worklist and carries
  // its own workflow state (all roles → Assign). Client-side only for this
  // iteration; the hcc_members insert is left as a TODO (see notes at
  // handleSave in NewDiagGapPanel).
  addHccGapNewRow: ({ sourceMemberId, code, desc, hcc, dos, provider, pos, visitType }) => {
    const s0 = get();
    const source = s0.hccMembers.find(m => m.id === sourceMemberId);
    if (!source) return null;
    // Duplicate the row with a fresh id + fresh workflow state. Keep the
    // patient-identity fields (name/memberId/initials/etc.) so shared ICD
    // mock data + team routing keep working.
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `hcc-new-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayMdy = `${mm}/${dd}/${today.getFullYear()}`;
    const posDesc = source.dos_list?.find(d => d.pos === pos)?.posDesc
      || source.posDesc
      || '';
    const newRow = {
      ...source,
      id: newId,
      date: todayMdy,
      createdAt: today.toISOString(),
      dos: dos,
      dos_list: [{
        date: dos,
        label: 'Manually Added',
        labelColor: 'var(--neutral-300)',
        vt: visitType || source.vt,
        provider: provider || source.rp,
        pos: pos || source.pos,
        posDesc,
        open: 1,
      }],
      vt: visitType || source.vt,
      visitType: visitType || source.visitType,
      rp: provider || source.rp,
      pos: pos || source.pos,
      posDesc,
      // Reset workflow — a brand-new encounter always starts fresh.
      supS: 'Assign', cdrS: 'Assign', r1s: 'Assign', r2s: 'Assign',
      open: 1,
      // Marker so the DiagPanel doesn't fall back to the name-keyed mock
      // ICD list (which would leak the source row's ICDs). Spawned rows
      // read from hccSpawnedGaps[id] exclusively.
      isSpawned: true,
    };
    const spawnedGap = {
      id: `manual-${code}-${newId}`,
      code, desc, hcc: hcc || '', status: 'New',
      kind: 'Manual', type: 'Manual',
      docs: 0, cmts: 0, notes: 0, raf: 0,
      last: null, by: null, dismissReason: null, isLinked: true,
      dos,
    };
    set(s => ({
      hccMembers: [newRow, ...s.hccMembers],
      hccSpawnedGaps: {
        ...s.hccSpawnedGaps,
        [newId]: [spawnedGap],
      },
      hccMembersTotal: (s.hccMembersTotal || s.hccMembers.length) + 1,
      hccNewRowNotice: {
        ...s.hccNewRowNotice,
        [sourceMemberId]: { newMemberId: newId, dos, code, kind: 'new-row' },
      },
    }));
    // Persist both the new row and its ICD so the whole thing survives a
    // reload. Fire-and-forget — in-memory state is authoritative for the
    // current session; the DB catches up asynchronously.
    persistHccMemberInsert(newRow);
    persistHccGapInsert({
      id: spawnedGap.id, member_id: newId, member_name: newRow.name,
      code, description: desc, hcc_category: hcc || '',
      status: 'New', type: 'Manual', kind: 'Manual',
      docs_count: 0, comments_count: 0, notes_count: 0, raf_weight: 0,
      is_linked: true, dos,
    });
    return newId;
  },

  // Add a gap to an EXISTING sibling row (same patient, different Created
  // date) — used when the user picks a DOS from another created-date group
  // in the NewDiagGapPanel dropdown. Avoids spawning a duplicate row for a
  // DOS that already lives on another row.
  addHccGapToRow: ({ sourceMemberId, targetMemberId, code, desc, hcc, dos, provider, pos, visitType }) => {
    const s0 = get();
    const target = s0.hccMembers.find(m => m.id === targetMemberId);
    if (!target) return null;
    const spawnedGap = {
      id: `manual-${code}-${targetMemberId}`,
      code, desc, hcc: hcc || '', status: 'New',
      kind: 'Manual', type: 'Manual',
      docs: 0, cmts: 0, notes: 0, raf: 0,
      last: null, by: null, dismissReason: null, isLinked: true,
      dos,
    };
    set(s => ({
      hccSpawnedGaps: {
        ...s.hccSpawnedGaps,
        [targetMemberId]: [...(s.hccSpawnedGaps[targetMemberId] || []), spawnedGap],
      },
      hccNewRowNotice: {
        ...s.hccNewRowNotice,
        [sourceMemberId]: { newMemberId: targetMemberId, dos, code, kind: 'existing-row', createdDate: target.date, provider, pos, visitType },
      },
    }));
    // Persist the gap scoped to the target row (not the source), so on
    // reload it re-appears in the target row's drawer only.
    persistHccGapInsert({
      id: spawnedGap.id, member_id: targetMemberId, member_name: target.name,
      code, description: desc, hcc_category: hcc || '',
      status: 'New', type: 'Manual', kind: 'Manual',
      docs_count: 0, comments_count: 0, notes_count: 0, raf_weight: 0,
      is_linked: true, dos,
    });
    return targetMemberId;
  },

  // ─── AWV (Annual Wellness Visit) worklist ─────────────────────────────
  // Mock-driven worklist mirroring the HCC pattern: members + filter chip
  // state + selection set. Toolbar (Search/Filter/Export/History) and the
  // bulk-bar wire into the same shared components.
  awvMembers: (() => {
    try {
      // Synchronous import via top-level static would be cleaner, but the
      // store file already lazy-loads other mocks to keep the initial
      // bundle small. We pre-seed with an empty array and the worklist's
      // first render kicks off the fetch.
      return [];
    } catch { return []; }
  })(),
  awvMembersLoading: false,
  fetchAwvMembers: async () => {
    if (useAppStore.getState().awvMembers.length > 0) return;
    set({ awvMembersLoading: true });

    const { data, error } = await supabase
      .from('awv_members')
      .select('*')
      .order('create_date', { ascending: true });

    if (error || !data || data.length === 0) {
      console.warn('fetchAwvMembers error or empty — falling back to local mock:', error?.message);
      const { AWV_MEMBERS } = await import('../features/awv-worklist/data/mock');
      set({ awvMembers: AWV_MEMBERS, awvMembersLoading: false });
      return;
    }

    const mappedMembers = data.map(m => ({
      id: m.id,
      memberId: m.member_id,
      name: m.name,
      in: m.initials,
      g: m.gender,
      age: m.age,
      outreach: m.outreach,
      task: m.tasks,
      due: m.create_date,
      dueLabel: m.due_label,
      dueCol: m.due_color,
      assignee: m.support_name,
      assigneeIn: m.support_name ? m.support_name.replace(/[^a-zA-Z ]/g, '').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : null,
      progSubStatus: m.support_status,
      progName: m.cohort,
      ri: m.risk_level,
      dec: m.decile,
      ad: String(m.advillness || 0),
      fr: String(m.frailty || 0),
    }));

    set({ awvMembers: mappedMembers, awvMembersLoading: false });
  },
  // Multi-value filters keyed by column. Empty array on a key = no filter.
  awvFilters: {},
  setAwvFilter: (k, vals) => set(s => {
    const next = { ...s.awvFilters };
    if (!vals || vals.length === 0) delete next[k];
    else next[k] = vals;
    return { awvFilters: next };
  }),
  clearAwvFilters: () => set({ awvFilters: {} }),
  // Bulk-select state.
  selectedAwvIds: [],
  selectAwvMember: (id) => set(s => ({
    selectedAwvIds: s.selectedAwvIds.includes(id)
      ? s.selectedAwvIds.filter(x => x !== id)
      : [...s.selectedAwvIds, id],
  })),
  selectAllAwv: (ids) => set({ selectedAwvIds: ids }),
  clearAwvSelected: () => set({ selectedAwvIds: [] }),
  updateAwvMemberStatus: async (id, newStatus) => {
    // Optimistic update locally
    set(s => {
      const next = [...s.awvMembers];
      const i = next.findIndex(m => m.id === id);
      if (i > -1) {
        next[i] = { ...next[i], progSubStatus: newStatus };
      }
      return { awvMembers: next };
    });

    // Fire-and-forget DB update
    const { error } = await supabase
      .from('awv_members')
      .update({ support_status: newStatus })
      .eq('id', id);

    if (error) {
      console.warn('Failed to update AWV status:', error.message);
    }
  },

  selectedHccIds: [],
  selectHccMember: (id) => {
    track('hcc.member_selected', { memberId: id });
    set(s => ({
      selectedHccIds: s.selectedHccIds.includes(id)
        ? s.selectedHccIds.filter(x => x !== id)
        : [...s.selectedHccIds, id]
    }));
  },
  selectAllHcc: (ids) => set({ selectedHccIds: ids }),
  clearHccSelected: () => set({ selectedHccIds: [] }),

  // ─── HCC worklist sub-header state ───
  // (list title is no longer stored — the tab bar derives it from
  //  activeSubnavList so it always matches the SubNav worklist name)
  hccDueDateFilter: null, // null | 'Overdue' | 'Due Today' | 'Due This Week' | 'Due Next Week' | 'Due More Than 2 Weeks'
  setHccDueDateFilter: (cat) => set({ hccDueDateFilter: cat, currentPage: 1 }),

  // ─── HCC worklist filter state ───
  // hccFilters: { [filterKey]: string[] } — empty object = no filters applied.
  // Hydrated from the active saved filter so a reload keeps the applied view.
  hccFilters: hydrateListFilters('HCC'),
  setHccFilter: (k, vals) => {
    track('hcc.filter_applied', { filterKey: k, filterValue: Array.isArray(vals) ? vals.join(',') : vals });
    set(s => {
      const next = { ...s.hccFilters };
      if (!vals || !vals.length) delete next[k];
      else next[k] = vals;
      // Changing a filter detaches us from any "applied saved filter" highlight
      // and jumps back to page 1 in the same atomic set() — the previous
      // useEffect-in-HccWorklistTable pattern raced with the user's own
      // pagination clicks (see docs comment there).
      return { hccFilters: next, hccActiveSavedId: null, activeSavedIdByList: detachSaved(s.activeSavedIdByList, 'HCC'), currentPage: 1 };
    });
  },
  clearHccFilters: () => {
    track('hcc.filters_cleared_all');
    set(s => ({ hccFilters: {}, hccActiveSavedId: null, activeSavedIdByList: detachSaved(s.activeSavedIdByList, 'HCC'), currentPage: 1 }));
  },

  // Which filter chip keys appear in the chip row. The MoreFiltersPopover
  // toggles entries in this set. Initialized to the primary keys on first read.
  hccVisibleFilterKeys: null, // null → auto-fit one row from PRIMARY (FilterChipBar)
  toggleHccVisibleFilter: (k) => set(s => {
    const current = s.hccVisibleFilterKeys
      ? new Set(s.hccVisibleFilterKeys)
      : new Set(['my','rl','coh','g','open','chart','supS','cdrS','r1s','dec']);
    if (current.has(k)) current.delete(k); else current.add(k);
    return { hccVisibleFilterKeys: [...current] };
  }),
  // Explicit setter — FilterChipBar computes the next visible set from the
  // current *effective* (auto-fit) set so toggling from More Filters is
  // consistent whether or not the user has customized before.
  setHccVisibleFilterKeys: (list) => set({ hccVisibleFilterKeys: [...list] }),
  clearHccVisibleFilters: () => set({ hccVisibleFilterKeys: [] }),

  // ─── HEDIS worklist filter state ───
  // Same shape as hccFilters — `{ [filterKey]: string[] }`. The store's
  // save/apply flow already routes HEDIS via LIST_FILTER_KEY['HEDIS']. Hydrated
  // from the active saved filter so a reload keeps the applied view.
  hedisFilters: hydrateListFilters('HEDIS'),
  setHedisFilter: (k, vals) => {
    track('hedis.filter_applied', { filterKey: k, filterValue: Array.isArray(vals) ? vals.join(',') : vals });
    set(s => {
      const next = { ...s.hedisFilters };
      if (!vals || !vals.length) delete next[k];
      else next[k] = vals;
      return {
        hedisFilters: next,
        activeSavedIdByList: detachSaved(s.activeSavedIdByList, 'HEDIS'),
        currentPage: 1,
      };
    });
  },
  clearHedisFilters: () => {
    track('hedis.filters_cleared_all');
    set(s => ({
      hedisFilters: {},
      activeSavedIdByList: detachSaved(s.activeSavedIdByList, 'HEDIS'),
      currentPage: 1,
    }));
  },
  hedisVisibleFilterKeys: null,
  setHedisVisibleFilterKeys: (keys) => set({ hedisVisibleFilterKeys: [...keys] }),
  clearHedisVisibleFilters: () => set({ hedisVisibleFilterKeys: [] }),
  // HEDIS-specific save/apply wrappers, matching the HCC ones so the shared
  // FilterChipBar and SavedFiltersChip only need to know a list-scoped verb.
  saveHedisFilter: (name) => useAppStore.getState().saveSavedFilter('HEDIS', name),
  renameHedisSavedFilter: (id, name) => useAppStore.getState().renameSavedFilter('HEDIS', id, name),
  deleteHedisSavedFilter: (id) => useAppStore.getState().deleteSavedFilter('HEDIS', id),
  applyHedisSavedFilter: (id) => useAppStore.getState().applySavedFilter('HEDIS', id),

  // Saved filter sets, keyed by shared-list label (HCC, TOC, SNP, AWV,
  // HEDIS, High Utilizers, DM). Each entry: { id, name, filters }. Persisted
  // to localStorage so users keep their saved views across reloads.
  //
  // The per-list filter STATE lives elsewhere (hccFilters for HCC,
  // activeFilters for TOC and other generic lists). LIST_FILTER_KEY below
  // tells the store which slice to read/write for each list.
  savedFiltersByList: readSavedFiltersByList(),
  activeSavedIdByList: readActiveSavedIdByList(),
  // saveSavedFilter(list, name): read the current filter slice for `list`
  // and store it under savedFiltersByList[list] as a named view.
  saveSavedFilter: (list, name) => {
    track('list.filter_saved', { list });
    set(s => {
      const trimmed = (name || '').trim();
      if (!trimmed || !list) return {};
      const key = LIST_FILTER_KEY[list] || 'activeFilters';
      const snapshot = { ...(s[key] || {}) };
      const id = `sf-${Date.now()}`;
      const cur = s.savedFiltersByList[list] || [];
      const nextSaved = { ...s.savedFiltersByList, [list]: [...cur, { id, name: trimmed, filters: snapshot }] };
      const nextActive = { ...s.activeSavedIdByList, [list]: id };
      try { localStorage.setItem('savedFiltersByList', JSON.stringify(nextSaved)); } catch {/* */}
      try { localStorage.setItem('activeSavedIdByList', JSON.stringify(nextActive)); } catch {/* */}
      return { savedFiltersByList: nextSaved, activeSavedIdByList: nextActive };
    });
  },
  renameSavedFilter: (list, id, name) => {
    track('list.saved_filter_renamed', { list, filterId: id });
    set(s => {
      const cur = s.savedFiltersByList[list] || [];
      const nextList = cur.map(f => f.id === id ? { ...f, name: (name || '').trim() || f.name } : f);
      const nextSaved = { ...s.savedFiltersByList, [list]: nextList };
      try { localStorage.setItem('savedFiltersByList', JSON.stringify(nextSaved)); } catch {/* */}
      return { savedFiltersByList: nextSaved };
    });
  },
  deleteSavedFilter: (list, id) => {
    track('list.saved_filter_deleted', { list, filterId: id });
    set(s => {
      const cur = s.savedFiltersByList[list] || [];
      const nextList = cur.filter(f => f.id !== id);
      const nextSaved = { ...s.savedFiltersByList, [list]: nextList };
      const wasActive = s.activeSavedIdByList[list] === id;
      const nextActive = { ...s.activeSavedIdByList };
      if (wasActive) delete nextActive[list];
      const key = LIST_FILTER_KEY[list] || 'activeFilters';
      try { localStorage.setItem('savedFiltersByList', JSON.stringify(nextSaved)); } catch {/* */}
      try { localStorage.setItem('activeSavedIdByList', JSON.stringify(nextActive)); } catch {/* */}
      return {
        savedFiltersByList: nextSaved,
        activeSavedIdByList: nextActive,
        ...(wasActive ? { [key]: {} } : {}),
      };
    });
  },
  applySavedFilter: (list, id) => {
    track('list.saved_filter_applied', { list, filterId: id });
    set(s => {
      const f = (s.savedFiltersByList[list] || []).find(x => x.id === id);
      if (!f) return {};
      const key = LIST_FILTER_KEY[list] || 'activeFilters';
      const nextActive = { ...s.activeSavedIdByList, [list]: id };
      try { localStorage.setItem('activeSavedIdByList', JSON.stringify(nextActive)); } catch {/* */}
      return { [key]: { ...f.filters }, activeSavedIdByList: nextActive };
    });
  },

  // Thin HCC-specific aliases so the existing FilterChipBar's "Save Filter"
  // button and any other HCC-only callers keep working without rewrites.
  // (Getters on the state object are not reactive in Zustand — components
  // that need to subscribe should read `savedFiltersByList.HCC` directly.)
  saveHccFilter: (name) => useAppStore.getState().saveSavedFilter('HCC', name),
  renameHccSavedFilter: (id, name) => useAppStore.getState().renameSavedFilter('HCC', id, name),
  deleteHccSavedFilter: (id) => useAppStore.getState().deleteSavedFilter('HCC', id),
  applyHccSavedFilter: (id) => useAppStore.getState().applySavedFilter('HCC', id),

  // Column visibility — array of column keys that are hidden. Sticky Member/Actions
  // columns are not toggleable so they never appear here. Persisted to
  // localStorage so the user's column config survives reload (matches the
  // savedFiltersByList / activeSavedIdByList pattern already used in this store).
  hccHiddenCols: _readJson('hccHiddenCols', []),
  toggleHccColumn: (k) => {
    track('hcc.column_toggled', { column: k });
    set(s => {
      const next = new Set(s.hccHiddenCols);
      if (next.has(k)) next.delete(k); else next.add(k);
      const arr = [...next];
      try { localStorage.setItem('hccHiddenCols', JSON.stringify(arr)); } catch {/* */}
      return { hccHiddenCols: arr };
    });
  },
  clearHccHiddenCols: () => {
    try { localStorage.setItem('hccHiddenCols', JSON.stringify([])); } catch {/* */}
    set({ hccHiddenCols: [] });
  },

  // Column ordering — array of column keys in the user's preferred order.
  // Empty array means "use HCC_COLUMNS default order". Drag-to-reorder in the
  // Show Columns popover writes here; HccWorklistTable + ColumnConfigPopover
  // apply this order via `orderColumns(HCC_COLUMNS, hccColumnOrder)`. Also
  // persisted to localStorage.
  hccColumnOrder: _readJson('hccColumnOrder', []),
  reorderHccColumns: (fromKey, toKey) => set(s => {
    if (!fromKey || !toKey || fromKey === toKey) return {};
    track('hcc.columns_reordered', { from: fromKey, to: toKey });
    // Seed the order from the static default the first time we move anything.
    const base = s.hccColumnOrder.length
      ? [...s.hccColumnOrder]
      : (s._hccDefaultColumnKeys || []);
    if (!base.length) return {};
    const from = base.indexOf(fromKey);
    const to = base.indexOf(toKey);
    if (from < 0 || to < 0) return {};
    base.splice(to, 0, base.splice(from, 1)[0]);
    try { localStorage.setItem('hccColumnOrder', JSON.stringify(base)); } catch {/* */}
    return { hccColumnOrder: base };
  }),
  // Stash the default key order once at app boot so reorderHccColumns can seed
  // itself without importing columns.js (avoids a circular dep).
  _hccDefaultColumnKeys: [],
  setHccDefaultColumnKeys: (keys) => set(s => (
    s._hccDefaultColumnKeys.length ? {} : { _hccDefaultColumnKeys: keys }
  )),
  clearHccColumnOrder: () => {
    try { localStorage.setItem('hccColumnOrder', JSON.stringify([])); } catch {/* */}
    set({ hccColumnOrder: [] });
  },

  // ─── HCC DOS-level assignment engine ─────────────────────────────────
  // Per-(patient, DOS) assignment state keyed as `${patientId}::${dosDate}`.
  // The shape is defined in features/hcc/assignment/dosState.js. Lifecycle
  // transitions live in features/hcc/assignment/lifecycle.js — this slice
  // just stores the result and exposes thin wrappers per AC.
  hccDosAssignments: {},
  // Reject metadata keyed by dosKey(patientId, dos, provider, pos). Set by
  // DiagPanel's Reject confirmation dialog; read by the read-only banner
  // ("Rejected by X — reasons — note") that pins to the top of the ICD
  // list once a record has been terminally rejected.
  hccRejectInfo: {},
  setHccRejectInfo: (key, info) => set(s => ({
    hccRejectInfo: { ...s.hccRejectInfo, [key]: info },
  })),
  // Client-level config — sampling rates can be overridden per client.
  hccConfig: {
    astrana: true,
    samplingRates: { ...DEFAULT_SAMPLING_RATES },
    slaCloseDays: 7,
  },

  // Look up the DOS-state record. Lazy-hydrates from the legacy member fields
  // the first time a (patient, DOS) is read so the worklist's existing display
  // values don't disappear.
  getHccDosState: (patientId, dosDate, renderingProvider, pos) => {
    const key = hccDosKey(patientId, dosDate, renderingProvider, pos);
    const map = useAppStore.getState().hccDosAssignments;
    if (map[key]) return map[key];
    const patient = useAppStore.getState().hccMembers.find(m => m.id === patientId);
    if (!patient) return null;
    const idx = (patient.dos_list || []).findIndex(d => d.date === dosDate);
    const hydrated = hydrateFromMember(patient, dosDate, idx < 0 ? 0 : idx, renderingProvider, pos);
    set(s => ({ hccDosAssignments: { ...s.hccDosAssignments, [key]: hydrated } }));
    return hydrated;
  },

  // Initialize Support assignment for every DOS on a patient (AC-1).
  initializeHccPatient: (patientId) => set(s => {
    const patient = s.hccMembers.find(m => m.id === patientId);
    if (!patient) return {};
    const { nextMap } = hccLifecycle.initializePatient(s.hccDosAssignments, patient, {
      astrana: s.hccConfig.astrana,
      slaCloseDays: s.hccConfig.slaCloseDays,
    });
    return { hccDosAssignments: nextMap };
  }),

  // Generic dispatcher — `kind` corresponds to a lifecycle.js export. Each
  // call rebuilds `hccDosAssignments` immutably. UI components use the named
  // wrappers below; this is the single chokepoint for the engine.
  //
  // Diffs the engine's new dosState against the previous one to detect role
  // status changes, then patches the matching legacy member field
  // (supS/cdrS/r1s/r2s) AND persists the change to Supabase so the
  // worklist row survives reload. This is the single source of persistence
  // for every AC transition — convenience wrappers below don't need to know
  // about it.
  transitionHccDos: (patientId, dosDate, kind, payload = {}) => {
    let statusChanges = [];
    let assigneeChanges = [];
    set(s => {
      const fn = hccLifecycle[kind];
      if (typeof fn !== 'function') {
        console.warn(`transitionHccDos: unknown kind "${kind}"`);
        return {};
      }
      const patient = s.hccMembers.find(m => m.id === patientId);
      if (!patient) return {};
      const dos = (patient.dos_list || []).find(d => d.date === dosDate) || { date: dosDate };
      const actor = payload.actor || 'current-user';
      let result;
      switch (kind) {
        case 'markInsufficient':
        case 'rejectDos':
          result = fn(s.hccDosAssignments, patient, dos, actor, payload.reason);
          break;
        case 'returnDos':
          result = fn(s.hccDosAssignments, patient, dos, payload.fromRole, actor, payload.reason);
          break;
        case 'reassignRole':
          result = fn(s.hccDosAssignments, patient, dos, payload.role, payload.staffId, actor, payload.reason);
          break;
        case 'completeReviewer2':
          // Takes the full config (not just samplingRates) — completeReviewer2
          // also runs the Phase 0 (WR7) validateAsmReadinessConfig guard, which
          // reads config.minReviewsBeforeAsm alongside samplingRates.
          result = fn(s.hccDosAssignments, patient, dos, actor, s.hccConfig);
          break;
        default:
          result = fn(s.hccDosAssignments, patient, dos, actor);
      }
      // Diff role statuses between previous and new dosState. Each changed
      // role gets queued for legacy-field patch + Supabase write below.
      const compositeKey = hccDosKey(patientId, dosDate, dos.provider, dos.pos);
      const prev = s.hccDosAssignments?.[compositeKey] || {};
      const next = result.nextMap?.[compositeKey] || {};
      ['support', 'coder', 'reviewer', 'reviewer2'].forEach(role => {
        const ns = next[role]?.status;
        if (ns && ns !== prev[role]?.status) statusChanges.push({ role, status: ns });
        // Also diff the assignee. Engine cascades (e.g. completeSupport
        // auto-assigning a Coder) set an assignee on a role that previously
        // had none — the legacy name field must follow so the worklist
        // Support/Coder columns (which read member.sup/.cdr/.r1/.r2 directly)
        // reflect the new owner, not just the status.
        const na = next[role]?.assignee;
        if (na && na !== prev[role]?.assignee) {
          // Resolve display name: Astrana roster first (seed data uses
          // Astrana staff ids), then platform-users roster (manual
          // reassignments to Settings → Users profiles), then fall back
          // to the raw id so worklist cells never render empty.
          const platformName = (s.platformUsers || []).find(u => u.id === na)?.name;
          assigneeChanges.push({
            role,
            name: hccStaffById(na)?.name || platformName || na,
            staffId: na,
            fromStaffId: prev[role]?.assignee || null,
            fromName: hccStaffById(prev[role]?.assignee)?.name
              || (s.platformUsers || []).find(u => u.id === prev[role]?.assignee)?.name
              || prev[role]?.assignee
              || '—',
          });
        }
      });
      const statusFieldByRole = { support: 'supS', coder: 'cdrS', reviewer: 'r1s', reviewer2: 'r2s' };
      const nameFieldByRole   = { support: 'sup',  coder: 'cdr',  reviewer: 'r1',  reviewer2: 'r2'  };
      const nextMembers = (statusChanges.length || assigneeChanges.length)
        ? s.hccMembers.map(m => {
            if (m.id !== patientId) return m;
            const patched = { ...m };
            statusChanges.forEach(({ role, status }) => { patched[statusFieldByRole[role]] = status; });
            assigneeChanges.forEach(({ role, name }) => { patched[nameFieldByRole[role]] = name; });
            return patched;
          })
        : s.hccMembers;
      // DOS-level log entry — no `icds`, so it appears only in the global
      // (DOS-level) Activity Log, not in any ICD-scoped view. Deferred to a
      // microtask so the addActivityEntry side-effect doesn't run inside the
      // same set() call.
      queueMicrotask(() => {
        const transitionLabel = HCC_TRANSITION_LABEL[kind] || kind;
        useAppStore.getState().addActivityEntry({
          _memberId: patientId,
          t: 'status_dos',
          by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
          dos: dosDate,
          headline: `DOS ${dosDate} — ${transitionLabel}`,
        });
        // Emit one row per role whose status changed — including engine
        // cascades (e.g. Support Completed auto-flipping Coder to In
        // Progress). This is what surfaces the role-pill state changes on
        // the DiagPanel Activity tab.
        const ROLE_LABEL_C = { support: 'Support', coder: 'Coder', reviewer: 'Reviewer', reviewer2: 'Reviewer 2' };
        const prevMember = s.hccMembers.find(m => m.id === patientId);
        const prevStatusFieldByRole = { support: 'supS', coder: 'cdrS', reviewer: 'r1s', reviewer2: 'r2s' };
        statusChanges.forEach(({ role, status }) => {
          useAppStore.getState().addActivityEntry({
            _memberId: patientId,
            t: 'status_role',
            by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
            dos: dosDate,
            headline: `${ROLE_LABEL_C[role] || role} Status Changed`,
            from: prevMember?.[prevStatusFieldByRole[role]] || '—',
            to: status,
          });
        });
      });
      return { hccDosAssignments: result.nextMap, hccMembers: nextMembers };
    });
    // Fire-and-forget Supabase writes for every role whose status changed.
    // Also emit a role.status_changed entry into the activity feed so the
    // History drawer shows each transition (engine-driven cascades like
    // support→Completed triggering coder→In Progress produce one entry per
    // changed role).
    const ROLE_LABEL_T = { support: 'Support', coder: 'Coder', reviewer: 'Reviewer', reviewer2: 'Reviewer 2' };
    const patient = useAppStore.getState().hccMembers.find(m => m.id === patientId);
    statusChanges.forEach(({ role, status }) => {
      const assignedName = assigneeChanges.find(a => a.role === role)?.name;
      persistHccMemberRoleStatus(patientId, role, status, assignedName);
      useAppStore.getState().logHccActivity({
        eventName: 'role.status_changed',
        scope:     { patientId, dos: dosDate, source: 'manual' },
        payload:   {
          actor: payload.actor || 'You',
          roleLabel: ROLE_LABEL_T[role] || role,
          status,
          patientName: patient?.name,
          transitionKind: kind,
        },
      });
    });
    // Persist any assignee change that didn't ride along with a status change,
    // AND log it to the activity feed. Direct manual reassigns from
    // hccReassignRole log there themselves — skip the log here for kind ===
    // 'reassignRole' so the History drawer doesn't show duplicate entries.
    assigneeChanges
      .filter(a => !statusChanges.some(sc => sc.role === a.role))
      .forEach(({ role, name, fromName }) => {
        persistHccMemberRoleStatus(patientId, role, undefined, name);
        if (kind === 'reassignRole') return;
        useAppStore.getState().logHccActivity({
          eventName: 'assignee.changed',
          scope:     { patientId, dos: dosDate, source: 'cascade' },
          payload:   {
            actor: payload.actor || 'You',
            roleLabel: ROLE_LABEL_T[role] || role,
            fromName, toName: name,
            patientName: patient?.name,
            transitionKind: kind,
          },
        });
      });
    return { nextMap: useAppStore.getState().hccDosAssignments };
  },

  // Convenience wrappers — one per AC transition so consumers don't have to
  // remember string kinds. They forward to transitionHccDos above.
  hccMarkSupportInProgress: (pid, dos, actor) => {
    track('hcc.support_started', { memberId: pid });
    return useAppStore.getState().transitionHccDos(pid, dos, 'markSupportInProgress', { actor });
  },
  hccCompleteSupport: (pid, dos, actor) => {
    track('hcc.support_completed', { memberId: pid });
    return useAppStore.getState().transitionHccDos(pid, dos, 'completeSupport', { actor });
  },
  hccMarkInsufficient: (pid, dos, actor, reason) => {
    track('hcc.insufficient_marked', { memberId: pid, dosId: dos, reason });
    return useAppStore.getState().transitionHccDos(pid, dos, 'markInsufficient', { actor, reason });
  },
  hccRejectDos: (pid, dos, actor, reason) => {
    track('hcc.dos_rejected', { dosId: dos, reason });
    return useAppStore.getState().transitionHccDos(pid, dos, 'rejectDos', { actor, reason });
  },
  hccCompleteCoder: (pid, dos, actor) => {
    track('hcc.coder_completed', { memberId: pid });
    return useAppStore.getState().transitionHccDos(pid, dos, 'completeCoder', { actor });
  },
  hccRequestRecords: (pid, dos, actor) => {
    track('hcc.records_requested', { memberId: pid });
    return useAppStore.getState().transitionHccDos(pid, dos, 'requestRecords', { actor });
  },
  hccRecordsReceived: (pid, dos, actor) => {
    track('hcc.records_received', { memberId: pid });
    return useAppStore.getState().transitionHccDos(pid, dos, 'recordsReceived', { actor });
  },
  hccCompleteReviewer: (pid, dos, actor) => {
    track('hcc.review_completed', { memberId: pid, level: 'reviewer' });
    return useAppStore.getState().transitionHccDos(pid, dos, 'completeReviewer', { actor });
  },
  hccCompleteReviewer2: (pid, dos, actor) => {
    track('hcc.review_completed', { memberId: pid, level: 'reviewer2' });
    return useAppStore.getState().transitionHccDos(pid, dos, 'completeReviewer2', { actor });
  },
  hccReturnDos: (pid, dos, fromRole, actor, reason) => {
    track('hcc.dos_returned', { dosId: dos, toRole: fromRole });
    return useAppStore.getState().transitionHccDos(pid, dos, 'returnDos', { fromRole, actor, reason });
  },
  hccReassignRole: async (pid, dos, role, staffId, actor, reason, displayName) => {
    track('hcc.role_reassigned', { memberId: pid, fromRole: null, toRole: role });
    // Preconditions: the member has to exist in local state, the DOS has to
    // exist on it, and we need a display name (Astrana staff or the picker's
    // override). All checked BEFORE any mutation so a failed precondition
    // never leaves partial state behind. Return an outcome so the picker
    // can toast "assigned" vs "failed" instead of always showing success.
    //
    // `displayName` is an optional override used by the bulk dialog when
    // picking a user from the system pool (Account → Users + Astrana
    // staff). For Account-pool users not in the Astrana roster,
    // hccStaffById() returns null and the legacy field would never get
    // patched — the displayName override solves that.
    const fieldByRole = { support: 'sup', coder: 'cdr', reviewer: 'r1', reviewer2: 'r2' };
    const statusFieldByRole = { support: 'supS', coder: 'cdrS', reviewer: 'r1s', reviewer2: 'r2s' };
    const preMember = useAppStore.getState().hccMembers.find(m => m.id === pid);
    if (!preMember) return { ok: false, reason: 'member-not-found' };
    const staff = hccStaffById(staffId);
    const platformName = useAppStore.getState().platformUsers.find(u => u.id === staffId)?.name;
    const name = staff?.name || displayName || platformName;
    const f = fieldByRole[role];
    const sf = statusFieldByRole[role];
    if (!f || !name) return { ok: false, reason: 'unresolvable-assignee' };
    // Snapshot everything the optimistic patches touch, so a failed DB
    // write can roll ALL of it back — UI and DB must never disagree
    // (production users lost trust seeing an assignee that reverted on
    // the next reload).
    const fromName = preMember[f] || '—';
    const prevName = preMember[f] ?? null;
    const prevStatus = preMember[sf] ?? null;
    const patientName = preMember.name;
    const dosEntry = (preMember.dos_list || []).find(d => d.date === dos);
    const compositeKey = hccDosKey(pid, dos, dosEntry?.provider, dosEntry?.pos);
    const prevBucket = useAppStore.getState().hccDosAssignments?.[compositeKey];
    useAppStore.getState().transitionHccDos(pid, dos, 'reassignRole', { role, staffId, actor, reason });
    // Optimistic UI — ALL of it happens before the network write so every
    // surface (worklist RoleStatusCell reading member.sup/.cdr/.r1/.r2,
    // DiagPanel AssigneeAvatar reading hccDosAssignments) flips instantly:
    //  1. the member's legacy role field + status. Default status on
    //     assignment is role-dependent: Support starts at "Awaiting"
    //     (displays "Action Needed"), Coder / QA / Compliance at "New" —
    //     either takes the cell out of its "Assign" empty state.
    //  2. the engine bucket's status: reassignRole stamps the assignee but
    //     leaves status null, which makes resolveCurrentAssignee() still
    //     report the bucket as unassigned; force-stamp the assign status.
    const assignStatus = role === 'support' ? 'Awaiting' : 'New';
    set(s => {
      const next = {
        hccMembers: s.hccMembers.map(m =>
          m.id === pid ? { ...m, [f]: name, [sf]: assignStatus } : m,
        ),
      };
      const cur = s.hccDosAssignments?.[compositeKey];
      if (cur && cur[role]) {
        next.hccDosAssignments = {
          ...s.hccDosAssignments,
          [compositeKey]: {
            ...cur,
            [role]: { ...cur[role], status: assignStatus },
          },
        };
      }
      return next;
    });
    // Persist to Supabase so the reassignment survives reload. Awaited so
    // the caller can distinguish "written to DB" from "optimistic only" —
    // silent writes were masking RLS / missing-row failures in production
    // (user sees success toast, refresh reverts the assignment).
    const persist = await persistHccMemberRoleStatus(pid, role, assignStatus, name);
    if (persist?.error) {
      // Roll back every optimistic patch — the row returns to its last
      // saved state instead of showing an assignee the DB never accepted.
      set(s => {
        const nextAssignments = { ...s.hccDosAssignments };
        if (prevBucket === undefined) delete nextAssignments[compositeKey];
        else nextAssignments[compositeKey] = prevBucket;
        return {
          hccMembers: s.hccMembers.map(m =>
            m.id === pid ? { ...m, [f]: prevName, [sf]: prevStatus } : m,
          ),
          hccDosAssignments: nextAssignments,
        };
      });
      return { ok: false, reason: 'persistence-failed', detail: persist.error.message, name, previous: fromName };
    }
    // Log to the canonical activity feed for the History drawer — only
    // after the DB write landed, so failed writes don't leave phantom
    // "assignee changed" entries.
    const ROLE_LABEL = { support: 'Support', coder: 'Coder', reviewer: 'Reviewer', reviewer2: 'Reviewer 2' };
    useAppStore.getState().logHccActivity({
      eventName: 'assignee.changed',
      scope:     { patientId: pid, dos, source: 'manual' },
      payload:   {
        actor: actor || 'You',
        roleLabel: ROLE_LABEL[role] || role,
        fromName, toName: name,
        toStaffId: staffId,
        reason,
        patientName,
      },
    });
    return { ok: true, name, previous: fromName };
  },

  // Generic role-status patch — used by the DiagPanel status menu for
  // transitions the engine doesn't have a dedicated AC for (e.g. New →
  // In Progress on coder/reviewer roles, where the spec assumes work
  // starts implicitly on assignment). Patches BOTH the engine's dosState
  // bucket and the legacy member.{role}S field so worklist + DiagPanel
  // agree on the new status.
  hccSetRoleStatus: (pid, dos, role, status) => {
    const fieldByRole       = { support: 'sup',  coder: 'cdr',  reviewer: 'r1',  reviewer2: 'r2'  };
    const statusFieldByRole = { support: 'supS', coder: 'cdrS', reviewer: 'r1s', reviewer2: 'r2s' };
    const f  = fieldByRole[role];
    const sf = statusFieldByRole[role];
    if (!f || !sf) return;
    const member = useAppStore.getState().hccMembers.find(m => m.id === pid);
    const prevStatus = member?.[sf] || null;
    const dosEntry = (member?.dos_list || []).find(d => d.date === dos);
    const compositeKey = hccDosKey(pid, dos, dosEntry?.provider, dosEntry?.pos);
    set(s => {
      const next = { hccMembers: s.hccMembers.map(m =>
        m.id === pid ? { ...m, [sf]: status } : m,
      ) };
      const cur = s.hccDosAssignments?.[compositeKey];
      if (cur && cur[role]) {
        next.hccDosAssignments = {
          ...s.hccDosAssignments,
          [compositeKey]: { ...cur, [role]: { ...cur[role], status } },
        };
      }
      return next;
    });
    persistHccMemberRoleStatus(pid, role, status);
    const ROLE_LABEL_S = { support: 'Support', coder: 'Coder', reviewer: 'Reviewer', reviewer2: 'Reviewer 2' };
    const patient = useAppStore.getState().hccMembers.find(m => m.id === pid);
    const roleLabel = ROLE_LABEL_S[role] || role;
    useAppStore.getState().logHccActivity({
      eventName: 'role.status_changed',
      scope:     { patientId: pid, dos, source: 'manual' },
      payload:   {
        actor: 'You',
        roleLabel,
        status,
        patientName: patient?.name,
      },
    });
    // Mirror the change onto the DiagPanel Activity tab. Deferred to a
    // microtask so it runs after the set() above commits and the panel's
    // subscription sees the new status before rendering the new entry.
    queueMicrotask(() => {
      useAppStore.getState().addActivityEntry({
        _memberId: pid,
        t: 'status_role',
        by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
        dos,
        headline: `${roleLabel} Status Changed`,
        from: prevStatus || '—',
        to: status,
      });
    });
    track('hcc.role_status_set', { memberId: pid, role, status });
  },

  // Helpers exposed for the UI — resolve a staff id back to a display name.
  hccStaffName: (staffId) => (hccStaffById(staffId)?.name || staffId || ''),
  hccStaffInitials: (staffId) => (hccStaffById(staffId)?.initials || ''),

  // ─── All Patients (unified TOC + HCC view, Supabase-backed) ───
  allPatients: [],
  allPatientsLoading: false,
  fetchAllPatients: async () => {
    set({ allPatientsLoading: true });
    const { data, error } = await supabase
      .from('all_patients')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.warn('fetchAllPatients error (falling back to combined TOC+HCC):', error.message);
      set({ allPatients: [], allPatientsLoading: false });
      return;
    }
    const rows = (data || []).map(r => ({
      id: r.id,
      source: r.source,
      name: r.name,
      initials: r.initials,
      gender: r.gender,
      age: r.age,
      memberId: r.member_id,
      email: r.email,
      phone: r.phone,
      language: r.language || 'en',
      city: r.city,
      state: r.state,
      tags: r.tags || [],
      groupNumber: r.group_number,
      familyId: r.family_id,
      uniqueMemberId: r.unique_member_id,
      coverageType: r.coverage_type,
      planCode: r.plan_code,
      employeeSsn: r.employee_ssn,
      memberSsn: r.member_ssn,
      subscriberHireDate: r.subscriber_hire_date,
      location: r.location,
      tpa: r.tpa,
      chronicConditions: r.chronic_conditions || [],
      pcp: r.pcp,
      pcpInitials: r.pcp_initials,
      lastVisit: r.last_visit,
      activeCareProgram: r.active_care_program,
      ccmConsent: r.ccm_consent,
      apcmConsent: r.apcm_consent,
      assignee: r.assignee,
      assigneeInitials: r.assignee_initials,
    }));
    set({ allPatients: rows, allPatientsLoading: false });
  },

  selectedAllPatientsIds: [],
  selectAllPatient: (id) => set(s => ({
    selectedAllPatientsIds: s.selectedAllPatientsIds.includes(id)
      ? s.selectedAllPatientsIds.filter(x => x !== id)
      : [...s.selectedAllPatientsIds, id]
  })),
  selectAllAllPatients: (ids) => set({ selectedAllPatientsIds: ids }),
  clearAllPatientsSelected: () => set({ selectedAllPatientsIds: [] }),

  // HCC DiagPanel drawer (Phase 2: read-only)
  diagPanelOpen: false,
  diagPanelMemberId: null,
  diagActiveTab: 'Codes',
  diagDosFilter: null,      // null = first DOS (member.dos_list[0]); 'ALL' = sweep; else a date string
  diagViewMode: 'ICD',      // 'ICD' (flat sections, default) | 'HCC' (grouped)
  diagHighlightCode: null,
  // Status pill next to the DOS selector (current DOS's worklist status).
  diagDosStatus: 'New',
  setDiagDosStatus: (s) => set({ diagDosStatus: s }),
  // Snapshot-tile filter: 'Open' | 'Suspect' | 'Recapture' | 'Other' | null.
  diagSnapFilter: null,
  setDiagSnapFilter: (f) => set({ diagSnapFilter: f }),
  // Patient Gap Snapshot section collapsed/expanded.
  diagSnapOpen: true,
  setDiagSnapOpen: (open) => set({ diagSnapOpen: open }),
  // Left-workspace tab: null = drawer at 40vw with only the right pane;
  // any string = drawer expands to 70vw with the matching tab content.
  diagLeftPanel: null,   // 'activity' | 'comments' | 'documents' | 'notes' | 'claims' | 'newDiagGap' | null
  // When the Activity Log panel is opened from a specific ICD card (by
  // clicking the ICD code), this holds that code so the timeline filters to
  // entries touching it. null = DOS-level (all entries). Opening via the
  // toolbar Activity Log icon always resets this to null.
  diagActivityIcd: null,
  // Toolbar entry points reset the ICD scope (they're DOS-level actions).
  setDiagLeftPanel: (panel) => set({ diagLeftPanel: panel, diagActivityIcd: null, diagClaimDos: null, diagOpenDocId: null }),
  // Switching tabs WITHIN the left panel preserves the current scope
  // (DOS-level stays DOS-level; ICD-level stays scoped to its code).
  setDiagTab: (panel) => set({ diagLeftPanel: panel }),
  // Open the left Activity Log scoped to a single ICD code.
  openIcdActivityLog: (code) => set({ diagLeftPanel: 'activity', diagActivityIcd: code || null }),
  // Open any left panel tab scoped to a single ICD code (used by the per-card
  // Documents / Comments / Notes count buttons in IcdRow).
  openIcdPanel: (panel, code) => set({ diagLeftPanel: panel, diagActivityIcd: code || null }),
  clearDiagActivityIcd: () => set({ diagActivityIcd: null }),

  // Documents tab — currently-open doc in the preview. null = show the list.
  // Set by (a) DiagPanel Documents-toolbar click (first doc), (b) DOS-row
  // click in IcdDosCard (doc matching that DOS date), (c) manual selection
  // inside the Documents tab.
  diagOpenDocId: null,
  setDiagOpenDocId: (id) => set({ diagOpenDocId: id || null }),

  // When a DOS row's "Claim" link is clicked, open the Claims tab in the left
  // workspace and auto-expand that DOS's claim detail. Consumed once by the
  // ClaimsTab effect (which clears it), so re-clicking the same DOS re-opens.
  diagClaimDos: null,
  openHccClaimForDos: (dos) => set({ diagLeftPanel: 'claims', diagActivityIcd: null, diagClaimDos: dos || null }),
  clearDiagClaimDos: () => set({ diagClaimDos: null }),

  // Documents tab — inline uploader widget toggle. Replaces the old drawer
  // open for the in-drawer Upload button (Figma 278:162482).
  hccDocsUploaderOpen: false,
  toggleHccDocsUploader: () => set(s => ({ hccDocsUploaderOpen: !s.hccDocsUploaderOpen })),
  closeHccDocsUploader: () => set({ hccDocsUploaderOpen: false }),

  // Live-uploaded documents — appended to the static DOCUMENTS list in the
  // Documents tab so a newly-uploaded file appears at the top with status
  // 'pending'. Newest-first.
  hccUploadedDocs: [],
  recordHccUpload: (doc) => {
    set(s => ({ hccUploadedDocs: [doc, ...s.hccUploadedDocs] }));
    // Also mirror into hcc_diag_documents so the Documents tab shows the
    // upload across reloads / other reviewers.
    persistHccDiagDocument(doc);
    set(s => ({ hccDiagDocumentsList: [doc, ...(s.hccDiagDocumentsList || [])] }));
  },

  // Post a new comment to the DiagPanel Comments tab. Appends to the
  // store's hccDiagComments slice (so consumers see it) and persists to
  // Supabase for cross-session durability.
  addHccDiagComment: (row) => {
    if (!row?.id) return;
    set(s => ({ hccDiagComments: [row, ...(s.hccDiagComments || [])] }));
    persistHccDiagComment(row);
    // Timeline entry (Activity tab). The 1500ms dedup on addActivityEntry
    // absorbs UI callers that also log manually so we never double-post.
    useAppStore.getState().addActivityEntry({
      t: 'comment', by: row.author || 'You', role: row.role || (useAppStore.getState().hccUserRole || 'Coder'),
      icds: row.icd ? [row.icd] : undefined,
      headline: row.icd ? `Added a Comment for ${row.icd}` : 'Added a Comment',
      details: row.body ? [{ note: row.body }] : undefined,
    });
  },

  // Edit an existing comment's body. `edited: true` stamps the row so the
  // UI can render the "Edited" badge. Only the author's UI exposes this.
  updateHccDiagComment: (id, body) => {
    if (!id) return;
    const before = get().hccDiagComments?.find(c => c.id === id);
    set(s => ({
      hccDiagComments: (s.hccDiagComments || []).map(c =>
        c.id === id ? { ...c, body, edited: true } : c),
    }));
    persistHccDiagCommentUpdate({ id, body });
    useAppStore.getState().addActivityEntry({
      t: 'comment', by: before?.author || 'You', role: before?.role || (useAppStore.getState().hccUserRole || 'Coder'),
      icds: before?.icd ? [before.icd] : undefined,
      headline: before?.icd ? `Edited a Comment on ${before.icd}` : 'Edited a Comment',
      details: body ? [{ note: body }] : undefined,
    });
  },

  // Remove a comment. Author-only — the caller checks author identity.
  deleteHccDiagComment: (id) => {
    if (!id) return;
    const before = get().hccDiagComments?.find(c => c.id === id);
    set(s => ({
      hccDiagComments: (s.hccDiagComments || []).filter(c => c.id !== id),
    }));
    persistHccDiagCommentDelete(id);
    useAppStore.getState().addActivityEntry({
      t: 'comment', by: before?.author || 'You', role: before?.role || (useAppStore.getState().hccUserRole || 'Coder'),
      icds: before?.icd ? [before.icd] : undefined,
      headline: before?.icd ? `Deleted a Comment on ${before.icd}` : 'Deleted a Comment',
    });
  },

  // Post a new note to the DiagPanel Notes tab. Same pattern as
  // addHccDiagComment.
  addHccDiagNote: (row) => {
    if (!row?.id) return;
    set(s => ({ hccDiagNotes: [row, ...(s.hccDiagNotes || [])] }));
    persistHccDiagNote(row);
    useAppStore.getState().addActivityEntry({
      t: 'comment', by: row.author || 'You', role: row.role || (useAppStore.getState().hccUserRole || 'Coder'),
      icds: row.icd ? [row.icd] : undefined,
      headline: row.icd ? `Added a Note for ${row.icd}` : 'Added a Note',
      details: row.body ? [{ note: row.body }] : undefined,
    });
  },

  // ── HCC Care Team configuration ─────────────────────────────────────
  // Admin-managed teams for the Phase 2 auto-assignment workflow. The
  // ConfigureTeamDrawer (Settings → Member/Leads → Care Team) writes here
  // and the Care Team table reads from it. Newest-first.
  //
  // Team shape:
  //   {
  //     id, name, kind: 'hcc' | 'care-program' | 'hedis',
  //     teamType,            // 'Reviewer' / 'Coder' / 'SNP' / 'Assignee'…
  //     allocatedTins: [],   // team-level routing key (Phase 2 spec)
  //     createdAt, createdBy, lastModifiedAt, lastModifiedBy,
  //     members: [
  //       {
  //         userId, name, initials, roles,  // denormalized for table render
  //         capacityPct,                    // share of THIS team allocated to them
  //         assignTo: [{ dim: 'TIN'|'Vendor'|'Coder'|'Reviewer'|…, value, pct }],
  //       },
  //     ],
  //   }
  //
  // Seeded with the same five rows the Figma reference shows so the table
  // isn't empty on first load AND every row is editable (no static mock
  // fallback path needed in the panel).
  hccCareTeams: [
    {
      id: 'seed-rt1', name: 'QA Team', kind: 'hcc',          teamType: 'QA',
      allocatedTins: ['12-3456789'], createdAt: '02/21/2026', createdBy: 'Dina Morries',
      lastModifiedAt: '08/30/2024', lastModifiedBy: 'Richard Willson',
      members: [
        { userId: 'MA', name: 'M. Almeda',   initials: 'MA', roles: 'QA', capacityPct: 50, assignTo: [{ dim: 'Coder', value: 'DH', pct: 50 }] },
      ],
    },
    {
      id: 'seed-rt2', name: 'Coder Team', kind: 'hcc', teamType: 'Coder',
      allocatedTins: ['12-3456789', '98-7654321'], createdAt: '02/21/2026', createdBy: 'Dina Morries',
      lastModifiedAt: '08/30/2024', lastModifiedBy: 'Richard Willson',
      members: [
        { userId: 'DH', name: 'Deborah Hintz', initials: 'DH', roles: 'Coder', capacityPct: 60, assignTo: [{ dim: 'TIN', value: '12-3456789', pct: 60 }] },
        { userId: 'PP', name: 'P. Plourde',    initials: 'PP', roles: 'Coder', capacityPct: 40, assignTo: [{ dim: 'TIN', value: '98-7654321', pct: 30 }] },
      ],
    },
    {
      id: 'seed-rt3', name: 'SNP Team', kind: 'care-program', teamType: 'SNP',
      allocatedTins: [], createdAt: '02/21/2026', createdBy: 'Dina Morries',
      lastModifiedAt: '08/30/2024', lastModifiedBy: 'Richard Willson',
      members: [
        { userId: 'fallback-1', name: 'Michael Corleone', initials: 'MC', roles: 'Nurse', capacityPct: 60, assignTo: [] },
        { userId: 'fallback-2', name: 'Larry Sanders',    initials: 'LS', roles: 'Medical Assistant', capacityPct: 60, assignTo: [] },
      ],
    },
    {
      id: 'seed-rt4', name: 'TOC Team', kind: 'care-program', teamType: 'TCM',
      allocatedTins: [], createdAt: '02/21/2026', createdBy: 'Dina Morries',
      lastModifiedAt: '08/30/2024', lastModifiedBy: 'Richard Willson',
      members: [
        { userId: 'fallback-3', name: 'Tina Turner', initials: 'TT', roles: 'Admin/Practice Manager', capacityPct: 80, assignTo: [] },
      ],
    },
    {
      id: 'seed-rt5', name: 'Care Gap Team', kind: 'hedis', teamType: 'Assignee',
      allocatedTins: [], createdAt: '02/21/2026', createdBy: 'Dina Morries',
      lastModifiedAt: '08/30/2024', lastModifiedBy: 'Richard Willson',
      members: [
        { userId: 'fallback-4', name: 'Manny Grizwald', initials: 'MG', roles: 'Billing Specialist', capacityPct: 30, assignTo: [] },
        { userId: 'fallback-5', name: 'Bobby Brown',    initials: 'BB', roles: 'Front Desk Staff/Receptionist', capacityPct: 30, assignTo: [] },
      ],
    },
  ],
  // Load teams from Supabase. Keeps the seeded fallback when the table is
  // empty or errors (same SWR-style pattern the rest of the store uses).
  fetchHccCareTeams: async () => {
    const { data, error } = await supabase
      .from('care_teams')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data?.length) {
      set({ hccCareTeams: data.map(careTeamRowToJs) });
    }
  },
  // Mutations update local state optimistically, then persist to Supabase.
  addHccCareTeam: (team) => {
    set(s => ({ hccCareTeams: [team, ...s.hccCareTeams] }));
    supabase.from('care_teams').insert(careTeamJsToDb(team))
      .then(({ error }) => { if (error) console.error('addHccCareTeam:', error); });
  },
  updateHccCareTeam: (id, patch) => {
    set(s => ({
      hccCareTeams: s.hccCareTeams.map(t => t.id === id ? { ...t, ...patch } : t),
    }));
    const merged = get().hccCareTeams.find(t => t.id === id);
    if (merged) {
      supabase.from('care_teams').upsert(careTeamJsToDb(merged), { onConflict: 'id' })
        .then(({ error }) => { if (error) console.error('updateHccCareTeam:', error); });
    }
  },
  deleteHccCareTeam: (id) => {
    set(s => ({ hccCareTeams: s.hccCareTeams.filter(t => t.id !== id) }));
    supabase.from('care_teams').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteHccCareTeam:', error); });
  },

  // ── HCC Activity Log (live) ──────────────────────────────────────────
  // Live entries appended by user actions (accept, dismiss, post comment,
  // add note, upload document, status change). Merged with the mock ACTIVITY
  // dataset by the Activity Log tab so anything the user just did appears
  // at the top of the timeline.
  //
  // Shape: { [memberName]: Entry[] } where the newest entry is at index 0.
  // Entry contract — see src/features/hcc/data/activity.js for the legacy
  // shape; live entries additionally carry { id, ts } so they can be deduped
  // and sorted. `icds: [code]` means the entry is ICD-level and will appear
  // in BOTH the global DOS-level log AND any ICD-scoped log for that code.
  // No `icds` (or empty array) means DOS-level only.
  hccActivityLog: {},
  addActivityEntry: (entry) => set(s => {
    // Resolve target member: an explicit `_memberId` on the entry wins so
    // actions taken from surfaces where the DiagPanel isn't open (chart-
    // detail drawer opened straight off the worklist row, background
    // store-side logs) still land on the right timeline. Falls back to the
    // panel's currently-open member so all in-panel callers keep working.
    const memberId = entry?._memberId || s.diagPanelMemberId;
    if (!memberId) return {};
    const member = s.hccMembers.find(m => m.id === memberId);
    const memberKey = member?.name;
    if (!memberKey) return {};
    // Strip the resolver hint so it doesn't leak into the persisted entry.
    // eslint-disable-next-line no-unused-vars
    const { _memberId, ...cleanEntry } = entry || {};
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const hours = now.getHours();
    const time = `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
    // Resolve the effective DOS the same way DiagPanel does — fall back to
    // the first DOS in the member's list when no explicit filter is set.
    const effectiveDos = s.diagDosFilter || member?.dos_list?.[0]?.date || member?.dos || null;
    const filled = {
      id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: now.getTime(),
      date, time,
      dos: effectiveDos,
      ...cleanEntry,
    };
    const list = s.hccActivityLog[memberKey] || [];
    // Dedup guard — React StrictMode in dev double-invokes some store-set
    // pathways which would otherwise produce two identical entries per click.
    // Drop a new entry if the previous one has the same type + headline within
    // the last 1500ms.
    const last = list[0];
    if (last && last.t === filled.t && last.headline === filled.headline && (filled.ts - last.ts) < 1500) {
      return {};
    }
    return { hccActivityLog: { ...s.hccActivityLog, [memberKey]: [filled, ...list] } };
  }),

  // ─── HCC Activity Log (Supabase-backed, append-only) ─────────────────
  // Canonical event store described in docs/features/hcc-activity-log-spec.md.
  // Coexists with the legacy `hccActivityLog` map above while consumers
  // migrate — every mutation that wants to land in the worklist History
  // drawer calls logHccActivity().
  hccActivityFeed: buildSeedHccActivityFeed(),
  hccActivityFeedLoading: false,
  hccHistoryDrawerOpen: false,
  openHccHistoryDrawer: () => {
    set({ hccHistoryDrawerOpen: true });
    // Refresh on open so the drawer reflects any rows written by other
    // tabs / sessions. Fire-and-forget; the optimistic feed is already
    // visible while the request is in flight.
    useAppStore.getState().fetchHccActivityFeed();
  },
  closeHccHistoryDrawer: () => set({ hccHistoryDrawerOpen: false }),

  // ─── SFTP multi-document review ───────────────────────────────────
  // The SFTP ingest path lands multiple files in the background. Once
  // extraction completes we surface a single bell notification; clicking
  // it opens HccSftpReviewDrawer with a document switcher, a left-side
  // page preview, and a right-side encounter table per document.
  hccSftpBatches: [],        // [{ id, fileName, ocrTier, compliance, encounters, ingestedAt, status }]
  // These flags rehydrate from sessionStorage so refreshing while the
  // ICD Creation or Document Review surface is open restores that screen
  // (the underlying documents reload from Supabase via fetchHccDocuments).
  hccSftpReviewOpen: sessionStorage.getItem('hccSftpReviewOpen') === '1',
  hccSftpActiveBatchId: sessionStorage.getItem('hccSftpActiveBatchId') || null,
  // Inline review — when true, the Document Review renders INSIDE the ICD
  // Creation surface (same drawer, no second overlay). Standalone entry
  // points (bell notification, upload ribbon) keep the floating 700px
  // drawer and leave this false.
  hccReviewInline: sessionStorage.getItem('hccReviewInline') === '1',
  // ICD Creation screen — unified upload + manual + SFTP entry surface
  // (replaces the legacy 3-item popover anchored under the worklist's
  // Upload Document toolbar button).
  icdCreationOpen: sessionStorage.getItem('icdCreationOpen') === '1',
  // Batches created during the CURRENT ICD-Creation session so the right
  // panel's "Records" list only shows what this user just added — not
  // every historical batch from prior reloads.
  icdCreationSessionBatchIds: _readJson('icdCreationSessionBatchIds', []),
  openIcdCreation: () => {
    sessionStorage.setItem('icdCreationOpen', '1');
    sessionStorage.setItem('icdCreationSessionBatchIds', '[]');
    set({ icdCreationOpen: true, icdCreationSessionBatchIds: [] });
  },
  closeIcdCreation: () => {
    sessionStorage.setItem('icdCreationOpen', '0');
    sessionStorage.setItem('hccReviewInline', '0');
    sessionStorage.removeItem('hccReviewSourceBatchIds');
    set({ icdCreationOpen: false, hccReviewInline: false, hccReviewSourceBatchIds: null });
  },
  trackIcdCreationBatch: (batchId) => set(s => {
    const next = [...new Set([...(s.icdCreationSessionBatchIds || []), batchId])];
    sessionStorage.setItem('icdCreationSessionBatchIds', JSON.stringify(next));
    return { icdCreationSessionBatchIds: next };
  }),
  /**
   * Load persisted HCC documents from Supabase. Called once on app boot
   * so the SFTP review queue + compliance state survives reloads. The
   * table is shared org-wide (no per-user RLS) so any Support member
   * sees the same queue.
   */
  fetchHccDocuments: async () => {
    const { data, error } = await supabase
      .from('hcc_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchHccDocuments:', error);
      return;
    }
    if (data?.length) {
      set({ hccSftpBatches: data.map(hccDocumentRowToJs) });
    }
  },
  /**
   * Persist (insert-or-update) one document. Fire-and-forget — local
   * state already reflects the change before this completes.
   */
  persistHccDocument: (batch) => {
    if (!batch) return;
    supabase
      .from('hcc_documents')
      .upsert(hccDocumentJsToDb(batch), { onConflict: 'id' })
      .then(({ error }) => { if (error) console.error('persistHccDocument:', error); });
  },
  /**
   * Simulate SFTP picking up N files and running OCR on each. Each file
   * runs the same async mockOcr (8s) so the chip / banner animations
   * match the single-doc flow. When the last one lands we add a single
   * "N SFTP documents ready" notification.
   */
  simulateSftpIngest: async (fileNames = ['demo-single.pdf', 'demo-multi-patient.pdf', 'demo-same-patient-multi-dos.pdf']) => {
    const state = useAppStore.getState();
    const members = state.hccMembers || [];
    // Seed pending placeholders so the user can see "3 files in flight".
    const seeded = fileNames.map((name, i) => ({
      id: `sftp-${Date.now()}-${i}`,
      fileName: name,
      encounters: [],
      ingestedAt: new Date().toISOString(),
      status: 'pending',
    }));
    set(s => ({ hccSftpBatches: [...(s.hccSftpBatches || []), ...seeded] }));
    state.showToast?.(`SFTP — extracting ${fileNames.length} document${fileNames.length === 1 ? '' : 's'} in the background`);
    // Stamp intake events so the Documents tab can surface these
    // batches even while OCR is still in flight.
    seeded.forEach(entry => {
      useAppStore.getState().logHccActivity?.({
        eventName: 'sftp.file.detected',
        scope:     { batchId: entry.id, fileId: entry.fileName, source: 'sftp' },
        payload:   { actor: 'SFTP', fileName: entry.fileName },
      });
      useAppStore.getState().logHccActivity?.({
        eventName: 'batch.created',
        scope:     { batchId: entry.id, source: 'sftp' },
        payload:   { batchId: entry.id, fileCount: 1, fileName: entry.fileName, actor: 'SFTP' },
      });
      useAppStore.getState().logHccActivity?.({
        eventName: 'file.uploaded',
        scope:     { batchId: entry.id, fileId: entry.fileName, source: 'sftp' },
        payload:   { actor: 'SFTP', fileName: entry.fileName, pageCount: '—' },
      });
      useAppStore.getState().logHccActivity?.({
        eventName: 'ocr.started',
        scope:     { batchId: entry.id, fileId: entry.fileName, source: 'system' },
        payload:   { fileName: entry.fileName },
      });
    });
    // Process each file in parallel using the document pipeline (OCR +
    // OCR tier + 5-point compliance, in one pass per the Astrana spec).
    const { runDocumentPipeline } = await import('../features/hcc/upload/mockOcr');
    const persist = useAppStore.getState().persistHccDocument;
    const done = await Promise.all(seeded.map(async (entry) => {
      const synthFile = { name: entry.fileName, size: 0 };
      const { ocrTier, compliance, encounters } = await runDocumentPipeline(synthFile, members);
      const completed = { ...entry, encounters, ocrTier, compliance, status: 'done', source: 'sftp' };
      // Persist to Supabase so SFTP queue + compliance survive reloads.
      persist?.(completed);
      return completed;
    }));
    // Merge results back into the slice (preserve order).
    set(s => ({
      hccSftpBatches: (s.hccSftpBatches || []).map(b => done.find(d => d.id === b.id) || b),
    }));
    // Stamp ocr.completed per file so the Documents tab knows extraction landed.
    done.forEach(entry => {
      useAppStore.getState().logHccActivity?.({
        eventName: 'ocr.completed',
        scope:     { batchId: entry.id, fileId: entry.fileName, source: 'system' },
        payload:   {
          fileName: entry.fileName,
          encounterCount: entry.encounters.length,
          pageCount: Math.max(...entry.encounters.map(e => e.sourcePage || 1), 1),
        },
      });
    });
    // Notification + toast.
    const total = done.reduce((sum, b) => sum + (b.encounters?.length || 0), 0);
    useAppStore.getState().addNotification?.({
      type: 'hcc.sftp_extraction_complete',
      title: `${done.length} SFTP document${done.length === 1 ? '' : 's'} ready for review`,
      body: `${total} encounter${total === 1 ? '' : 's'} extracted across ${done.length} file${done.length === 1 ? '' : 's'}`,
      action: 'openSftpReview',
    });
    useAppStore.getState().showToast?.(`SFTP extraction complete — ${total} encounter${total === 1 ? '' : 's'} ready for review`);
  },
  /**
   * Queue a single uploaded document for background OCR.
   *
   * Unlike the legacy single-document flow (which set
   * `hccUploadSession` and blocked the drawer on a single file at a
   * time), this path lets the user fire-and-forget any number of
   * documents in parallel — each OCRs in the background and lands on
   * the same multi-doc review surface used by SFTP ingestion. The
   * picker stays open so the user can keep adding files.
   *
   * Fires a single bell notification when every queued document has
   * completed (debounced by the batch state machine).
   */
  queueHccDocumentForOcr: async (file, opts = {}) => {
    const { autoApply = true } = opts;
    const state = useAppStore.getState();
    const members = state.hccMembers || [];
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fileName = file?.name || 'Uploaded document';
    const entry = {
      id,
      fileName,
      encounters: [],
      ingestedAt: new Date().toISOString(),
      status: 'pending',
      source: 'manual',
    };
    set(s => ({ hccSftpBatches: [...(s.hccSftpBatches || []), entry] }));
    // Debounced: fires one combined toast per burst instead of one per file.
    _queueHccExtractToast(fileName);

    // Activity log: stamp the intake + OCR-start events so the History
    // drawer's Documents tab can surface this batch even while OCR is
    // still in flight.
    useAppStore.getState().logHccActivity?.({
      eventName: 'batch.created',
      scope:     { batchId: id, source: 'manual' },
      payload:   { batchId: id, fileCount: 1, fileName, actor: 'You' },
    });
    useAppStore.getState().logHccActivity?.({
      eventName: 'file.uploaded',
      scope:     { batchId: id, fileId: fileName, source: 'manual' },
      payload:   { actor: 'You', fileName, pageCount: '—' },
    });
    useAppStore.getState().logHccActivity?.({
      eventName: 'ocr.started',
      scope:     { batchId: id, fileId: fileName, source: 'system' },
      payload:   { fileName },
    });

    const { runDocumentPipeline } = await import('../features/hcc/upload/mockOcr');
    const { ocrTier, compliance, encounters } = await runDocumentPipeline(
      { name: fileName, size: file?.size || 0 },
      members,
    );
    // Mark this batch as done.
    set(s => ({
      hccSftpBatches: (s.hccSftpBatches || []).map(b => b.id === id
        ? { ...b, encounters, ocrTier, compliance, status: 'done' }
        : b),
    }));
    // Persist the completed document.
    const completed = useAppStore.getState().hccSftpBatches.find(b => b.id === id);
    useAppStore.getState().persistHccDocument?.(completed);

    // Auto-route: any encounter that's matched to a Fold member AND
    // has no field-level errors is high-confidence "ready" — apply it
    // straight to the worklist and tag _docStatus='added' so the
    // Document Review Pending tab only surfaces error/mismatch rows
    // (per spec A + K). Same path the user would have walked manually
    // by clicking Add to Worklist on each card.
    //
    // The ICD Creation review flow passes autoApply:false so EVERY record
    // stays pending — the reviewer decides per patient what to add.
    if (!autoApply) {
      useAppStore.getState().logHccActivity?.({
        eventName: 'ocr.completed',
        scope:     { batchId: id, fileId: fileName, source: 'system' },
        payload:   { fileName, encounterCount: encounters.length, autoApplied: 0, pendingForReview: encounters.length },
      });
      return id;
    }
    let autoApplied = 0;
    let pendingForReview = 0;
    const updated = encounters.map((enc) => {
      const ready = !!enc.patient?.matchedMemberId
        && (!enc.errors || enc.errors.length === 0);
      if (!ready) {
        pendingForReview += 1;
        return enc;
      }
      // Duplicate detection — same patient + DOS + provider + POS
      // already on the member's dos_list? Skip create and flag the
      // row so the reviewer sees the warning (spec L).
      const member = state.hccMembers.find(m => m.id === enc.patient.matchedMemberId);
      const isDup = !!member?.dos_list?.some(d =>
        d.date === enc.dos
        && (d.provider || '').toLowerCase() === (enc.provider || '').toLowerCase()
        && (d.pos || '') === (enc.pos || '')
      );
      if (isDup) {
        pendingForReview += 1;
        return { ...enc, _duplicateOfMemberId: enc.patient.matchedMemberId };
      }
      const r = useAppStore.getState().hccCreateOrMergeFromEncounter?.({ ...enc, _docName: fileName, _batchId: id });
      if (r?.kind === 'created' || r?.kind === 'updated') {
        autoApplied += 1;
        return { ...enc, _docStatus: 'added' };
      }
      pendingForReview += 1;
      return enc;
    });
    set(s => ({
      hccSftpBatches: (s.hccSftpBatches || []).map(b => b.id === id
        ? { ...b, encounters: updated, _autoApplied: autoApplied, _pendingForReview: pendingForReview }
        : b),
    }));

    // Stamp ocr.completed so the Documents tab can count encounters
    // extracted per document.
    useAppStore.getState().logHccActivity?.({
      eventName: 'ocr.completed',
      scope:     { batchId: id, fileId: fileName, source: 'system' },
      payload:   {
        fileName,
        encounterCount: encounters.length,
        autoApplied,
        pendingForReview,
        pageCount: Math.max(...encounters.map(e => e.sourcePage || 1), 1),
      },
    });

    // If every batch in the queue is now done, fire a single
    // consolidated notification using the auto/manual breakdown
    // (spec B). If pendingForReview is zero, surface that the user
    // doesn't have to open the doc.
    const after = useAppStore.getState().hccSftpBatches || [];
    const allDone = after.length > 0 && after.every(b => b.status === 'done');
    if (allDone) {
      const totalAuto    = after.reduce((s, b) => s + (b._autoApplied || 0), 0);
      const totalPending = after.reduce((s, b) => s + (b._pendingForReview || 0), 0);
      const total = totalAuto + totalPending;
      const docsCount = after.length;
      const body = totalPending === 0
        ? `${totalAuto} record${totalAuto === 1 ? '' : 's'} loaded automatically — no manual review needed.`
        : `${totalAuto} loaded automatically · ${totalPending} waiting for manual intervention.`;
      useAppStore.getState().addNotification?.({
        type: 'hcc.documents_ready',
        title: `${total} record${total === 1 ? '' : 's'} ready across ${docsCount} document${docsCount === 1 ? '' : 's'}`,
        body,
        action: 'openSftpReview',
      });
      useAppStore.getState().showToast?.(
        totalPending === 0
          ? `${totalAuto} record${totalAuto === 1 ? '' : 's'} loaded automatically`
          : `${totalAuto} auto · ${totalPending} waiting for review`
      );
    }
    return id;
  },

  // When set, the review drawer aggregates pending encounters across ALL
  // listed batches and paginates by patient across them (ICD Creation
  // "Review" flow). null → single-batch mode (SFTP bell-notification flow).
  hccReviewSourceBatchIds: _readJson('hccReviewSourceBatchIds', null),
  openHccSftpReview: () => set(s => {
    const activeId = s.hccSftpActiveBatchId
      || (s.hccSftpBatches || []).find(b => b.status === 'done')?.id
      || (s.hccSftpBatches || [])[0]?.id
      || null;
    sessionStorage.setItem('hccSftpReviewOpen', '1');
    sessionStorage.removeItem('hccReviewSourceBatchIds');
    if (activeId) sessionStorage.setItem('hccSftpActiveBatchId', activeId);
    return { hccSftpReviewOpen: true, hccReviewSourceBatchIds: null, hccSftpActiveBatchId: activeId };
  }),
  // Open review over a set of documents (aggregate mode). `focusBatchId`
  // (optional) is ordered first so the reviewer lands on the doc they
  // clicked Review on.
  openHccReviewForBatches: (batchIds, focusBatchId) => set(() => {
    const ordered = focusBatchId
      ? [focusBatchId, ...batchIds.filter(id => id !== focusBatchId)]
      : [...batchIds];
    const activeId = focusBatchId || ordered[0] || null;
    sessionStorage.setItem('hccSftpReviewOpen', '1');
    sessionStorage.setItem('hccReviewSourceBatchIds', JSON.stringify(ordered));
    if (activeId) sessionStorage.setItem('hccSftpActiveBatchId', activeId);
    return {
      hccSftpReviewOpen: true,
      hccReviewSourceBatchIds: ordered,
      hccSftpActiveBatchId: activeId,
    };
  }),
  closeHccSftpReview: () => {
    sessionStorage.setItem('hccSftpReviewOpen', '0');
    sessionStorage.removeItem('hccReviewSourceBatchIds');
    set({ hccSftpReviewOpen: false, hccReviewSourceBatchIds: null });
  },
  // Open review INLINE (inside the ICD Creation surface). Same aggregate
  // semantics as openHccReviewForBatches, but flags inline mode and does
  // NOT set hccSftpReviewOpen — so the global floating drawer stays closed
  // and the review renders in-place instead.
  openHccReviewInline: (batchIds, focusBatchId) => set(() => {
    const ordered = focusBatchId
      ? [focusBatchId, ...batchIds.filter(id => id !== focusBatchId)]
      : [...batchIds];
    const activeId = focusBatchId || ordered[0] || null;
    sessionStorage.setItem('hccReviewInline', '1');
    sessionStorage.setItem('hccReviewSourceBatchIds', JSON.stringify(ordered));
    if (activeId) sessionStorage.setItem('hccSftpActiveBatchId', activeId);
    return {
      hccReviewInline: true,
      hccReviewSourceBatchIds: ordered,
      hccSftpActiveBatchId: activeId,
    };
  }),
  // Exit inline review — returns to the ICD Creation categorized doc list
  // (leaves the ICD Creation screen itself open).
  closeHccReviewInline: () => {
    sessionStorage.setItem('hccReviewInline', '0');
    sessionStorage.removeItem('hccReviewSourceBatchIds');
    set({ hccReviewInline: false, hccReviewSourceBatchIds: null });
  },
  setHccSftpActiveBatchId: (id) => {
    if (id) sessionStorage.setItem('hccSftpActiveBatchId', id);
    set({ hccSftpActiveBatchId: id });
  },
  /**
   * Patch one encounter inside an SFTP batch — proxies to the same
   * shape patchHccUploadEncounter uses (idx + partial). Used by the
   * SFTP table cells when the user edits a field.
   */
  patchHccSftpEncounter: (batchId, idx, patch) => {
    set(s => ({
      hccSftpBatches: (s.hccSftpBatches || []).map(b => {
        if (b.id !== batchId) return b;
        const next = b.encounters.map((e, i) => i === idx ? {
          ...e,
          ...patch,
          patient: { ...e.patient, ...(patch.patient || {}) },
        } : e);
        return { ...b, encounters: next };
      }),
    }));
    // Persist so field edits (patient match, DOS, provider, POS, ICDs…)
    // survive reload.
    const updated = useAppStore.getState().hccSftpBatches.find(b => b.id === batchId);
    useAppStore.getState().persistHccDocument?.(updated);
  },
  removeHccSftpEncounter: (batchId, idx) => {
    set(s => ({
      hccSftpBatches: (s.hccSftpBatches || []).map(b => b.id === batchId
        ? { ...b, encounters: b.encounters.filter((_, i) => i !== idx) }
        : b),
    }));
    const updated = useAppStore.getState().hccSftpBatches.find(b => b.id === batchId);
    useAppStore.getState().persistHccDocument?.(updated);
  },
  /**
   * Mark a per-batch encounter as 'added' (sent to worklist) or
   * 'deleted' (dropped). Used by the Document Review drawer to drive
   * the Pending / Added / Deleted tab counts without losing the row.
   * Set status to null to reset back to pending.
   */
  setHccSftpEncounterStatus: (batchId, idx, status) => {
    set(s => ({
      hccSftpBatches: (s.hccSftpBatches || []).map(b => b.id === batchId
        ? { ...b, encounters: b.encounters.map((e, i) => i === idx
            ? { ...e, _docStatus: status }
            : e) }
        : b),
    }));
    const updated = useAppStore.getState().hccSftpBatches.find(b => b.id === batchId);
    useAppStore.getState().persistHccDocument?.(updated);
  },
  /**
   * Apply a Support manual decision to one compliance check on a
   * specific batch. Per spec, every manual pass AND every manual fail
   * carries a reason. Throws (via applyManualDecision) if reason missing.
   *
   *   batchId   — the hccSftpBatches[] id
   *   checkKey  — one of CHECK_KEYS (compliance.js)
   *   decision  — 'pass' | 'fail'
   *   reason    — { code?, freeText? }   (at least one required)
   *   actor     — display name; defaults to current user / 'Support'
   *
   * Stamps an activity-log event so the audit trail records WHO passed
   * what, WHEN, and WHY — distinct from AI auto-passes.
   */
  applyHccComplianceDecision: ({ batchId, checkKey, decision, reason, actor }) => {
    set(s => ({
      hccSftpBatches: (s.hccSftpBatches || []).map(b => {
        if (b.id !== batchId || !b.compliance) return b;
        const next = applyHccManualComplianceDecision(b.compliance[checkKey], {
          decision,
          actor: actor || 'Support',
          reason,
        });
        return { ...b, compliance: { ...b.compliance, [checkKey]: next } };
      }),
    }));
    // Persist the updated compliance to Supabase so the decision survives
    // a reload (HCC audits must be able to reconstruct who passed what,
    // when, and why).
    const updated = useAppStore.getState().hccSftpBatches.find(b => b.id === batchId);
    useAppStore.getState().persistHccDocument?.(updated);
    // Audit-trail event — names the actor so HCC submission audits can
    // tell AI auto-passes apart from Support overrides.
    useAppStore.getState().logHccActivity?.({
      eventName: decision === 'pass' ? 'compliance.passed' : 'compliance.failed',
      scope:     { batchId, source: 'support' },
      payload:   {
        check: checkKey,
        actor: actor || 'Support',
        reasonCode: reason?.code || null,
        reasonText: reason?.freeText || '',
      },
    });
  },
  /**
   * Drop an entire SFTP batch from the queue (called after Add to
   * Worklist completes, so the batch disappears from the switcher).
   */
  removeHccSftpBatch: (batchId) => {
    set(s => {
      const remaining = (s.hccSftpBatches || []).filter(b => b.id !== batchId);
      const nextActive = remaining.find(b => b.status === 'done')?.id
        || remaining[0]?.id
        || null;
      return {
        hccSftpBatches: remaining,
        hccSftpActiveBatchId: s.hccSftpActiveBatchId === batchId ? nextActive : s.hccSftpActiveBatchId,
        hccSftpReviewOpen: remaining.length > 0 ? s.hccSftpReviewOpen : false,
      };
    });
    // Drop the persisted row too.
    supabase.from('hcc_documents').delete().eq('id', batchId)
      .then(({ error }) => { if (error) console.error('removeHccSftpBatch:', error); });
  },
  /**
   * Re-open a previous upload's skipped records.
   *
   * Given a batch summary (filename + rejectedList from the activity
   * log), re-run the deterministic mock OCR synchronously to rebuild
   * the original encounter set, filter down to just the patients that
   * were skipped, and jump straight into the review phase. Skips the
   * 8-second extraction delay since the user has already seen this
   * document extract once.
   *
   * Real backend would persist the original encounter rows in the
   * batch record and load them directly — no re-extraction needed.
   */
  reopenHccSkippedReview: ({ batchId, fileName, rejectedList }) => {
    const state = useAppStore.getState();
    const members = state.hccMembers || [];
    const synthFile = { name: fileName || 'reopened.pdf', size: 0 };
    const all = extractEncountersSync(synthFile, members);
    const wanted = new Set(
      (rejectedList || []).map(r => `${(r.patientName || '').toLowerCase()}|${r.dos || ''}`)
    );
    const filtered = all.filter(enc => {
      const key = `${(enc.patient?.name || '').toLowerCase()}|${enc.dos || ''}`;
      return wanted.has(key);
    });
    set({
      hccUploadSession: {
        id: `reopen-${batchId}-${Date.now()}`,
        phase: 'review',
        file: synthFile,
        encounters: filtered,
        seededMemberId: null,
        reopenedFromBatchId: batchId,
      },
      hccUploadMinimized: false,
      hccHistoryDrawerOpen: false,
    });
    state.showToast?.(`Re-opened ${filtered.length} skipped record${filtered.length === 1 ? '' : 's'} from ${fileName}`);
    return filtered.length;
  },
  fetchHccActivityFeed: async (filters = {}) => {
    set({ hccActivityFeedLoading: true });
    let q = supabase.from('hcc_activity_log').select('*').order('ts', { ascending: false }).limit(500);
    if (filters.patientId) q = q.eq('patient_id', filters.patientId);
    if (filters.batchId)   q = q.eq('batch_id',   filters.batchId);
    if (filters.category)  q = q.eq('category',   filters.category);
    if (filters.since)     q = q.gte('ts',        filters.since);
    const { data, error } = await q;
    if (error) {
      // 404 (table missing) or RLS denial. Keep whatever optimistic entries
      // the session has already accumulated rather than clobbering them.
      console.warn('fetchHccActivityFeed error:', error.message);
      set({ hccActivityFeedLoading: false });
      return;
    }
    // Merge fetched rows with optimistic local rows. The `local-*` ids are
    // session-only; we keep them at the head until the next fetch confirms
    // them in the DB. If the fetch returns the same row (matched by
    // event_name + ts within 5s) it replaces the optimistic one.
    set(s => {
      const fetched = data || [];
      const fetchedKeys = new Set(fetched.map(r => `${r.event_name}::${r.ts}`));
      const surviving = s.hccActivityFeed.filter(r => {
        if (!String(r.id || '').startsWith('local-')) return false;
        const ts = new Date(r.ts).getTime();
        // drop optimistic rows that already appear in the fetched set
        return !fetched.some(f =>
          f.event_name === r.event_name &&
          Math.abs(new Date(f.ts).getTime() - ts) < 5000,
        );
      });
      const merged = [...surviving, ...fetched]
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      return { hccActivityFeed: merged, hccActivityFeedLoading: false };
    });
  },
  // logHccActivity({ eventName, scope, payload })
  // Optimistically prepends to hccActivityFeed, then fires the Supabase
  // insert. Producers don't await — the in-memory append is the UI's
  // source of truth for this session.
  logHccActivity: ({ eventName, scope = {}, payload = {} }) => {
    const row = buildHccActivityRow(eventName, scope, payload);
    // Stamp a client-side id + ts so the UI can render before the DB
    // round-trips. Supabase will assign its own id on insert; we don't
    // reconcile because reads always come back from the table on next fetch.
    const optimistic = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      ...row,
    };
    set(s => ({ hccActivityFeed: [optimistic, ...s.hccActivityFeed].slice(0, 500) }));
    persistHccActivityRow(row);
  },

  // Upload chart drawer — member object or null. Opened from ChartPopover's
  // "Upload New Chart" CTA and from the DiagPanel chart-upload action.
  hccUploadMember: null,
  // When set, UploadChartDrawer opens in edit mode: caption + docType are
  // prefilled from this doc, the file field is optional (unchanged if empty),
  // and submitting patches the existing chart row instead of appending a new
  // one. Cleared on drawer close.
  hccUploadEditDoc: null,
  openHccUploadDrawer: (member) => set({ hccUploadMember: member, hccUploadEditDoc: null }),
  openHccUploadDrawerForEdit: (member, doc) => set({ hccUploadMember: member, hccUploadEditDoc: doc }),
  closeHccUploadDrawer: () => set({ hccUploadMember: null, hccUploadEditDoc: null }),

  // Patch the caption + docType of an existing chart doc. Keeps the id, file,
  // pdf preview, and status intact so DOS/link references and the preview URL
  // still resolve.
  updateChartDocMeta: (memberId, docId, patch) => {
    if (!memberId || !docId || !patch) return;
    set(state => {
      const list = state.hccAddedCharts?.[memberId] || [];
      return {
        hccAddedCharts: {
          ...state.hccAddedCharts,
          [memberId]: list.map(d => d.id === docId ? { ...d, ...patch } : d),
        },
      };
    });
    // Persist the metadata change so the row survives reload.
    supabase
      .from('hcc_added_charts')
      .update({
        // Table columns mirror the makeUploadedChartDoc shape.
        name: patch.n || patch.caption,
        caption: patch.caption,
        doc_type: patch.t,
      })
      .eq('id', docId)
      .then(({ error }) => {
        if (error) console.warn(`updateChartDocMeta(${memberId}|${docId}) failed:`, error.message);
      });
  },

  // ─── Per-patient "Add DOS" drawer (Figma 4684:127213 / 4687:127406) ──
  // Opened from the worklist row Actions column. Holds the member whose
  // DOS we're adding; null when closed.
  hccAddDosMember: null,
  openHccAddDos: (member) => set({ hccAddDosMember: member }),
  closeHccAddDos: () => set({ hccAddDosMember: null }),

  // ─── HCC Document Upload + OCR Review (Individual Upload path) ──────
  // Session state for the multi-encounter PDF upload flow described in the
  // Jira ticket. Lives at app level — drawer is mounted once in AppLayout.
  //   phase: 'chooser' → ('single' | 'picker' | 'sftp')
  //   - chooser: pick a mode (single encounter / single multi-patient PDF / SFTP)
  //   - single:  manual single-encounter form (no OCR)
  //   - picker → processing → review: OCR-driven multi-encounter PDF flow
  //   - sftp:    informational — show external SFTP path + credentials link
  //   file:        The selected File object (PDF)
  //   encounters:  Array of OCR-extracted encounter sections (across all
  //                patients in the PDF). Each: { tempId, patient:{name,dob,
  //                matchedMemberId,matchConfidence}, dos, provider, pos,
  //                posDesc, icds:[{code,valid}], errors:[fieldName] }
  //   seededMemberId: When opened from an "Upload Document" action on a
  //                specific patient (AllPatientsRow / QuickView), this is
  //                that member's id. Bypasses the chooser → straight to picker
  //                so the patient-context flow stays unchanged.
  //   summary:     Set after confirm — { created, updated }
  hccUploadSession: null,
  startHccUpload: (seededMemberId = null) => set({
    hccUploadSession: {
      id: `up-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      // From the worklist toolbar (no seededMemberId) → show the chooser
      // first. From a patient row → skip directly to the existing OCR picker.
      phase: seededMemberId ? 'picker' : 'chooser',
      file: null,
      encounters: [],
      seededMemberId,
      summary: null,
    },
  }),
  // Used by the chooser cards to advance into a sub-flow.
  setHccUploadPhase: (phase) => set(s => s.hccUploadSession
    ? { hccUploadSession: { ...s.hccUploadSession, phase } }
    : {}),
  setHccUploadFile: (file) => {
    set(s => s.hccUploadSession
      ? { hccUploadSession: { ...s.hccUploadSession, file, phase: 'processing' } }
      : {});
    const session = useAppStore.getState().hccUploadSession;
    if (!session) return;
    // Emit batch + intake + OCR-started events so the History drawer
    // shows the start of the pipeline. One file = one batch for the
    // individual-upload path (SFTP batches will produce multiple files).
    const batchId = session.id;
    useAppStore.getState().logHccActivity({
      eventName: 'batch.created',
      scope:     { batchId, source: 'manual' },
      payload:   { batchId, fileCount: 1, actor: 'You' },
    });
    useAppStore.getState().logHccActivity({
      eventName: 'file.uploaded',
      scope:     { batchId, fileId: file?.name, source: 'manual' },
      payload:   { actor: 'You', fileName: file?.name || 'Uploaded file', pageCount: '—' },
    });
    useAppStore.getState().logHccActivity({
      eventName: 'ocr.started',
      scope:     { batchId, fileId: file?.name, source: 'system' },
      payload:   { fileName: file?.name || 'Uploaded file' },
    });
  },
  setHccUploadEncounters: (encounters) => {
    const session = useAppStore.getState().hccUploadSession;
    if (!session) return;
    // Unified Document Review surface — the legacy in-drawer review
    // table is gone. Adopt the OCR output as a new SFTP batch, run the
    // same auto-routing pipeline as the multi-doc queue, then open the
    // full-screen Document Review drawer. The legacy upload session is
    // cancelled below since it's no longer needed.
    const fileName = session.file?.name || 'Uploaded document';
    const batchId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const state = useAppStore.getState();
    const members = state.hccMembers || [];
    let autoApplied = 0;
    let pendingForReview = 0;
    const routed = encounters.map((enc) => {
      const ready = !!enc.patient?.matchedMemberId
        && (!enc.errors || enc.errors.length === 0);
      if (!ready) { pendingForReview += 1; return enc; }
      const member = members.find(m => m.id === enc.patient.matchedMemberId);
      const isDup = !!member?.dos_list?.some(d =>
        d.date === enc.dos
        && (d.provider || '').toLowerCase() === (enc.provider || '').toLowerCase()
        && (d.pos || '') === (enc.pos || '')
      );
      if (isDup) { pendingForReview += 1; return { ...enc, _duplicateOfMemberId: enc.patient.matchedMemberId }; }
      const r = useAppStore.getState().hccCreateOrMergeFromEncounter?.({ ...enc, _docName: fileName, _batchId: batchId });
      if (r?.kind === 'created' || r?.kind === 'updated') {
        autoApplied += 1;
        return { ...enc, _docStatus: 'added' };
      }
      pendingForReview += 1;
      return enc;
    });
    const newBatch = {
      id: batchId,
      fileName,
      encounters: routed,
      ingestedAt: new Date().toISOString(),
      status: 'done',
      source: 'manual',
      _autoApplied: autoApplied,
      _pendingForReview: pendingForReview,
      actorName: 'You',
    };
    set(s => ({
      hccSftpBatches: [...(s.hccSftpBatches || []), newBatch],
      hccSftpActiveBatchId: batchId,
      hccSftpReviewOpen: true,
      // Cancel the legacy session — Document Review now owns this flow.
      hccUploadSession: null,
    }));
    // Activity log — point at the new SFTP batch id since the legacy
    // session is gone now.
    useAppStore.getState().logHccActivity({
      eventName: 'ocr.completed',
      scope:     { batchId, fileId: fileName, source: 'system' },
      payload:   {
        fileName,
        encounterCount: encounters.length,
        autoApplied,
        pendingForReview,
        pageCount: '—',
      },
    });
    encounters.forEach(enc => {
      if (Array.isArray(enc.errors) && enc.errors.length > 0) {
        useAppStore.getState().logHccActivity({
          eventName: 'ocr.low_confidence',
          scope:     { batchId, fileId: fileName, source: 'system' },
          payload:   {
            patientName: enc.patient?.name || '(unmatched)',
            dos: enc.dos,
            confidencePct: enc.patient?.matchConfidence
              ? Math.round((enc.patient.matchConfidence || 0) * 100)
              : '—',
            thresholdPct: 95,
          },
        });
      }
    });
    // Extraction-complete notification mirrors the multi-doc queue
    // behavior — auto/pending breakdown, deep-link into the Document
    // Review drawer.
    const body = pendingForReview === 0
      ? `${autoApplied} record${autoApplied === 1 ? '' : 's'} loaded automatically — no manual review needed.`
      : `${autoApplied} loaded automatically · ${pendingForReview} waiting for manual intervention.`;
    useAppStore.getState().addNotification?.({
      type: 'hcc.extraction_complete',
      title: 'Document extracted',
      body,
      action: 'openSftpReview',
    });
    useAppStore.getState().showToast?.(
      pendingForReview === 0
        ? `${autoApplied} record${autoApplied === 1 ? '' : 's'} loaded automatically`
        : `${autoApplied} auto · ${pendingForReview} waiting for review`
    );
  },
  // Append more encounters from a second OCR pass (user clicks "Upload"
  // again during review). Preserves existing rows + their edits.
  appendHccUploadEncounters: (encounters) => set(s => s.hccUploadSession
    ? { hccUploadSession: {
        ...s.hccUploadSession,
        encounters: [...s.hccUploadSession.encounters, ...encounters],
      } }
    : {}),
  patchHccUploadEncounter: (idx, patch) => set(s => {
    if (!s.hccUploadSession) return {};
    const next = s.hccUploadSession.encounters.map((e, i) => i === idx ? { ...e, ...patch } : e);
    return { hccUploadSession: { ...s.hccUploadSession, encounters: next } };
  }),
  removeHccUploadEncounter: (idx) => set(s => {
    if (!s.hccUploadSession) return {};
    return {
      hccUploadSession: {
        ...s.hccUploadSession,
        encounters: s.hccUploadSession.encounters.filter((_, i) => i !== idx),
      },
    };
  }),
  // Manually add a blank encounter for an existing patient. Used in the
  // review phase when an OCR pass missed a DOS the user has a separate
  // document for — they get a fresh row pre-linked to the patient and
  // fill in DOS / provider / POS / ICDs / doc themselves.
  addHccUploadEncounter: (member) => set(s => {
    if (!s.hccUploadSession || !member) return {};
    const newEnc = {
      tempId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      patient: {
        name: member.name,
        dob: member.dob || '',
        matchedMemberId: member.id,
        matchConfidence: 100,
      },
      dos: '',
      provider: '',
      pos: '',
      posDesc: '',
      docType: 'Progress Note',
      icds: [],
      // Pre-stamp the same error keys the review pipeline expects so the
      // new row immediately reads as "needs attention" in the filter chips.
      errors: ['dos', 'provider', 'pos'],
      _manual: true,
    };
    return {
      hccUploadSession: {
        ...s.hccUploadSession,
        encounters: [...s.hccUploadSession.encounters, newEnc],
      },
    };
  }),
  cancelHccUpload: () => set({ hccUploadSession: null, hccUploadMinimized: false }),

  // ── Background-processing minimize/expand ────────────────────────
  // After picking a file, the user can close the drawer and continue
  // working — AI extraction keeps running in the background and a
  // floating chip (HccUploadProcessingHost) tracks progress + offers a
  // "Show Records" CTA when extraction completes. Mirrors the
  // population-groups pgSession / pgMinimized pattern.
  hccUploadMinimized: false,
  minimizeHccUpload: () => set({ hccUploadMinimized: true }),
  expandHccUpload: () => set({ hccUploadMinimized: false }),

  // Exact match by normalized name + DOB. AC-9 requires 100% confidence —
  // partial / probabilistic matching is forbidden (HIPAA). Returns the
  // member object or null.
  findHccMemberByNameAndDob: (name, dob) => {
    if (!name || !dob) return null;
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const target = norm(name);
    const targetDob = String(dob || '').trim();
    const found = useAppStore.getState().hccMembers.find(m => norm(m.name) === target && (m.dob || '').trim() === targetDob);
    return found || null;
  },

  // Atomic create-or-merge for a single OCR encounter. Returns
  //   { kind: 'created' | 'updated' | 'relatedNew', memberId, dosDate }
  // so the caller can aggregate a summary for the success toast.
  // Uniqueness key: memberId + dos + provider + pos.
  // - Active DOS (any role's status is New / Action Needed):
  //     merge net-new ICDs into the existing row, attach doc, log activity.
  // - Completed DOS (all roles terminal):
  //     create a new DOS entry with relatedDosId pointing at the original
  //     (and stamp the original's relatedDosIds with the new key).
  // - Missing DOS: bootstrap via initializeHccPatient, append docStatus,
  //     increment ch, attach doc + log.
  hccCreateOrMergeFromEncounter: (enc) => {
    const s = useAppStore.getState();
    const memberId = enc.patient?.matchedMemberId;
    if (!memberId) return { kind: 'skipped' };
    const member = s.hccMembers.find(m => m.id === memberId);
    if (!member) return { kind: 'skipped' };
    const docName = enc._docName || 'Uploaded Document.pdf';
    const docType = enc._docType || 'Progress Note';
    const icdCodes = (enc.icds || []).filter(i => i.valid !== false).map(i => i.code);
    const now = new Date();
    // WS1/WS8 — every upload-sourced row belongs to a mini-sweep. Stamp
    // the batch id onto `sourceDocumentIds` and force `arrivalOrder` to
    // 'doc-first' so the grouping engine buckets this row alongside its
    // siblings under the same document.
    const batchId = enc._batchId || `doc-${docName}`;
    const stampSourceDoc = (m) => ({
      ...m,
      arrivalOrder: 'doc-first',
      sourceDocumentIds: Array.from(new Set([...(m.sourceDocumentIds || []), batchId])),
      createdAt: m.createdAt || now.toISOString(),
    });
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;

    // Helper — append to per-member activity log without requiring the
    // DiagPanel to be open (the upload flow runs from a global drawer).
    const logActivity = (entry) => {
      const memberKey = member.name;
      const ts = now.getTime();
      const hours = now.getHours();
      const time = `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
      set(st => {
        const list = st.hccActivityLog[memberKey] || [];
        return {
          hccActivityLog: {
            ...st.hccActivityLog,
            [memberKey]: [{
              id: `up-${ts}-${Math.random().toString(36).slice(2,5)}`,
              ts, date: dateStr, time, dos: enc.dos,
              by: 'You', role: 'Support',
              ...entry,
            }, ...list],
          },
        };
      });
    };

    // Composite key: Patient ID + DOS + Rendering Provider + POS. The key
    // itself now disambiguates two DOS rows sharing a date but differing
    // provider/POS, so there's no need for a separate member-field compare.
    const dosKey = hccDosKey(memberId, enc.dos, enc.provider, enc.pos);
    const existingDosState = s.hccDosAssignments[dosKey];
    const existsByUniqueKey = !!existingDosState;

    const TERMINAL = new Set(['Completed', 'Reject', 'Insufficient']);
    const isAllTerminal = (state) => {
      if (!state) return false;
      return ['support', 'coder', 'reviewer', 'reviewer2'].every(r => TERMINAL.has(state[r]?.status));
    };

    // Branch 1: DOS row exists & all roles terminal → create new row with
    // relatedDosId. AC-6.
    if (existsByUniqueKey && isAllTerminal(existingDosState)) {
      // Append a new DOS to the member's dos_list (or update if already in)
      const newDosDate = enc.dos;
      const relatedKey = dosKey;
      // Bootstrap a fresh entry in dosState under a synthetic suffixed key
      // so the original Completed row stays untouched.
      const suffix = `__upload-${now.getTime()}`;
      const newKey = `${hccDosKey(memberId, newDosDate, enc.provider, enc.pos)}${suffix}`;
      set(st => ({
        hccMembers: st.hccMembers.map(m => m.id === memberId ? stampSourceDoc({
          ...m,
          dos_list: [...(m.dos_list || []), { date: newDosDate, label: 'From Upload (post-completion)', labelColor: 'var(--secondary-300)', provider: enc.provider, pos: enc.pos, posDesc: enc.posDesc }],
          docStatus: [...(m.docStatus || []), 'pending'],
          ch: (m.ch || 0) + 1,
          awaitingClaim: true,
        }) : m),
        hccDosAssignments: {
          ...st.hccDosAssignments,
          [newKey]: {
            patientId: memberId, dosDate: newDosDate,
            renderingProvider: enc.provider, pos: enc.pos,
            support:   { assignee: null, status: 'New', history: [] },
            coder:     { assignee: null, status: null, history: [] },
            reviewer:  { assignee: null, status: null, history: [] },
            reviewer2: { assignee: null, status: null, history: [] },
            sampling: { reviewer2: null },
            billingReady: false, asmGenerated: false,
            relatedDosId: relatedKey,
            awaitingClaim: true,
            uploadedDocs: [{ name: docName, type: docType, icds: icdCodes, uploadedAt: now.toISOString() }],
            activity: [],
          },
          [relatedKey]: {
            ...existingDosState,
            relatedDosIds: [...(existingDosState.relatedDosIds || []), newKey],
          },
        },
      }));
      logActivity({
        t: 'document-upload',
        headline: `New row created from upload (related DOS ${enc.dos} was completed)`,
        file: docName, fileType: docType, icds: icdCodes,
      });
      // Worklist History — encounter approved + related DOS spawned.
      useAppStore.getState().logHccActivity({
        eventName: 'encounter.approved',
        scope:     { patientId: memberId, dos: newDosDate, source: 'manual' },
        payload:   { actor: 'You', patientName: member.name, dos: newDosDate },
      });
      useAppStore.getState().logHccActivity({
        eventName: 'dedup.related_dos_created',
        scope:     { patientId: memberId, dos: newDosDate, source: 'manual' },
        payload:   {
          patientName: member.name,
          dos: newDosDate,
          reason: 'prior DOS already completed',
        },
      });
      persistHccMemberDetails(memberId);
      return { kind: 'relatedNew', memberId, dosDate: newDosDate };
    }

    // Branch 2: DOS row exists & active → merge net-new ICDs. AC-5.
    if (existsByUniqueKey) {
      const existingIcds = new Set((existingDosState.uploadedDocs || []).flatMap(d => d.icds || []));
      const netNew = icdCodes.filter(c => !existingIcds.has(c));
      set(st => ({
        hccMembers: st.hccMembers.map(m => m.id === memberId ? stampSourceDoc({
          ...m,
          docStatus: [...(m.docStatus || []), 'pending'],
          ch: (m.ch || 0) + 1,
        }) : m),
        hccDosAssignments: {
          ...st.hccDosAssignments,
          [dosKey]: {
            ...existingDosState,
            uploadedDocs: [
              ...(existingDosState.uploadedDocs || []),
              { name: docName, type: docType, icds: netNew, uploadedAt: now.toISOString() },
            ],
          },
        },
      }));
      logActivity({
        t: 'icds-merged-via-upload',
        headline: netNew.length > 0
          ? `${netNew.length} net-new ICD(s) merged from upload: ${netNew.join(', ')}`
          : 'Document attached to existing DOS (no net-new ICDs)',
        file: docName, fileType: docType, icds: netNew,
      });
      // Worklist History — DOS match found + (optional) net-new ICD merge.
      useAppStore.getState().logHccActivity({
        eventName: 'encounter.approved',
        scope:     { patientId: memberId, dos: enc.dos, source: 'manual' },
        payload:   { actor: 'You', patientName: member.name, dos: enc.dos },
      });
      useAppStore.getState().logHccActivity({
        eventName: 'worklist.row_merged',
        scope:     { patientId: memberId, dos: enc.dos, source: 'manual' },
        payload:   { patientName: member.name, dos: enc.dos },
      });
      useAppStore.getState().logHccActivity({
        eventName: 'dedup.dos_match_found',
        scope:     { patientId: memberId, dos: enc.dos, source: 'manual' },
        payload:   { patientName: member.name, dos: enc.dos },
      });
      netNew.forEach(icd => {
        useAppStore.getState().logHccActivity({
          eventName: 'dedup.icd_net_new_merged',
          scope:     { patientId: memberId, dos: enc.dos, icd, source: 'manual' },
          payload:   { icd, dos: enc.dos, patientName: member.name },
        });
      });
      persistHccMemberDetails(memberId);
      return { kind: 'updated', memberId, dosDate: enc.dos };
    }

    // Branch 3: DOS row missing → bootstrap via initializeHccPatient
    // (which creates engine state per DOS in dos_list), then attach doc.
    set(st => ({
      hccMembers: st.hccMembers.map(m => {
        if (m.id !== memberId) return m;
        const hadDos = m.dos_list?.some(d => d.date === enc.dos);
        return stampSourceDoc({
          ...m,
          dos_list: hadDos
            ? m.dos_list
            : [...(m.dos_list || []), { date: enc.dos, label: 'From Upload', labelColor: 'var(--secondary-300)', provider: enc.provider, pos: enc.pos, posDesc: enc.posDesc }],
          docStatus: [...(m.docStatus || []), 'pending'],
          ch: (m.ch || 0) + 1,
          tv: hadDos ? m.tv : (m.tv || 0) + 1,
          rp: m.rp || enc.provider,
          pos: m.pos || enc.pos,
          awaitingClaim: true,
        });
      }),
      hccDosAssignments: {
        ...st.hccDosAssignments,
        [dosKey]: {
          patientId: memberId, dosDate: enc.dos,
          renderingProvider: enc.provider, pos: enc.pos,
          support:   { assignee: null, status: 'New', history: [] },
          coder:     { assignee: null, status: null, history: [] },
          reviewer:  { assignee: null, status: null, history: [] },
          reviewer2: { assignee: null, status: null, history: [] },
          sampling: { reviewer2: null },
          billingReady: false, asmGenerated: false,
          awaitingClaim: true,
          uploadedDocs: [{ name: docName, type: docType, icds: icdCodes, uploadedAt: now.toISOString() }],
          activity: [],
        },
      },
    }));
    logActivity({
      t: 'document-upload',
      headline: `DOS ${enc.dos} created via document upload`,
      file: docName, fileType: docType, icds: icdCodes,
    });
    // Worklist History — encounter approved + new worklist row spawned.
    useAppStore.getState().logHccActivity({
      eventName: 'encounter.approved',
      scope:     { patientId: memberId, dos: enc.dos, source: 'manual' },
      payload:   { actor: 'You', patientName: member.name, dos: enc.dos },
    });
    useAppStore.getState().logHccActivity({
      eventName: 'worklist.row_created',
      scope:     { patientId: memberId, dos: enc.dos, source: 'manual' },
      payload:   { patientName: member.name, dos: enc.dos },
    });
    persistHccMemberDetails(memberId);
    return { kind: 'created', memberId, dosDate: enc.dos };
  },

  // Iterate every reviewed encounter through hccCreateOrMergeFromEncounter
  // and stash the summary on the session for the drawer's success toast.
  // confirmHccUpload({ acceptedIdxs? })
  // When `acceptedIdxs` is omitted, every encounter is applied (legacy
  // behavior matching the card layout). When provided, only the indices
  // in the set are applied; the rest emit `encounter.rejected` events and
  // are summarised in the resulting `batch.processing_completed` payload
  // under `acceptedList` / `rejectedList` so the History drawer can show
  // both lists in its details expander.
  confirmHccUpload: ({ acceptedIdxs } = {}) => {
    const s = useAppStore.getState();
    if (!s.hccUploadSession) return { created: 0, updated: 0, rejected: 0 };
    const batchId = s.hccUploadSession.id;
    const docName = s.hccUploadSession.file?.name || 'Uploaded Document.pdf';
    const accepted = acceptedIdxs ? new Set(acceptedIdxs) : null;
    const acceptedList = [];
    const rejectedList = [];
    let created = 0, updated = 0;
    s.hccUploadSession.encounters.forEach((enc, idx) => {
      const isAccepted = accepted ? accepted.has(idx) : true;
      const patientName = enc.patient?.name || '(unmatched)';
      if (isAccepted) {
        const result = s.hccCreateOrMergeFromEncounter({ ...enc, _docName: docName });
        if (result.kind === 'created' || result.kind === 'relatedNew') created++;
        else if (result.kind === 'updated') updated++;
        acceptedList.push({ patientName, dos: enc.dos, kind: result.kind });
      } else {
        rejectedList.push({ patientName, dos: enc.dos });
        useAppStore.getState().logHccActivity({
          eventName: 'encounter.rejected',
          scope:     { patientId: enc.patient?.matchedMemberId || null, dos: enc.dos, batchId, source: 'manual' },
          payload:   {
            actor: 'You',
            patientName,
            dos: enc.dos,
            reason: 'Not selected for bulk confirm',
          },
        });
      }
    });
    const rejected = rejectedList.length;
    track('hcc.upload_confirmed', { created, updated, rejected });
    // Summary event — payload includes both lists so the History drawer's
    // details expander shows accepted/rejected patients individually.
    useAppStore.getState().logHccActivity({
      eventName: 'batch.processing_completed',
      scope:     { batchId, source: 'manual' },
      payload:   {
        batchId,
        approvedCount: created + updated,
        rejectedCount: rejected,
        pendingCount: 0,
        acceptedList,
        rejectedList,
        actor: 'You',
      },
    });
    set({ hccUploadSession: null });
    return { created, updated, rejected };
  },

  // ─── Claim preview drawer ─────────────────────────────────────────
  // Opened by clicking a claim-sourced DOS date in the HCC worklist's DOS
  // column. Only claim-sourced DOSs (member.dosFromClaim !== false) are
  // clickable; manually-entered DOSs render in grey as static text.
  hccClaimPreview: { open: false, member: null, dosDate: null },
  openHccClaimPreview: (member, dosDate) =>
    set({ hccClaimPreview: { open: true, member, dosDate: dosDate || member?.dos || null } }),
  closeHccClaimPreview: () =>
    set({ hccClaimPreview: { open: false, member: null, dosDate: null } }),
  openDiagPanel: (id, opts = {}) => set({
    diagPanelOpen: true,
    diagPanelMemberId: id,
    diagActiveTab: 'Codes',
    // `initialDos` and `highlightCode` come from row popovers (Visits → open a
    // specific DOS, OpenICDs hover → scroll/highlight a specific code).
    diagDosFilter: opts.initialDos ?? null,
    diagHighlightCode: opts.highlightCode ?? null,
    diagDosStatus: opts.dosStatus ?? 'New',
    diagSnapFilter: null,
    diagSnapOpen: true,
    diagLeftPanel: opts.leftPanel ?? null,
    diagActivityIcd: opts.activityIcd ?? null,
    diagViewMode: 'ICD',
  }),
  closeDiagPanel: () => set({ diagPanelOpen: false, diagPanelMemberId: null, diagLeftPanel: null, diagActivityIcd: null, diagClaimDos: null, diagOpenDocId: null }),
  setDiagActiveTab: (tab) => set({ diagActiveTab: tab }),
  setDiagDosFilter: (dos) => set({ diagDosFilter: dos }),
  setDiagViewMode: (mode) => set({ diagViewMode: mode }),

  // Quick View drawer — opened by clicking a patient name in any worklist
  quickViewPatient: null,
  openQuickView: (patient) => set({ quickViewPatient: patient }),
  closeQuickView: () => set({ quickViewPatient: null }),

  openWorkflow: (patientId) => {
    const p = get().patients.find(x => x.id === patientId);
    if (!p) return;
    const stepStates = {
      s1: p.status === 'completed' ? 'done' : (p.status === 'oncall' ? 'active' : 'pending'),
      s2: (p.tocStatus === 'enrolled' || p.tocStatus === 'engaged') ? 'active' : 'pending',
      s3: 'pending',
      s4: (p.status === 'scheduled' || p.status === 'queued') ? 'active' : 'pending'
    };
    set({ workflowPatient: p, workflowStep: 0, stepStates });
  },
  closeWorkflow: () => set({ workflowPatient: null }),

  setStepState: (stepId, state) => set(s => ({
    stepStates: { ...s.stepStates, [stepId]: state }
  })),

  updatePatient: (id, updates) => {
    // Optimistic local update
    set(s => ({
      patients: s.patients.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
    // Persist to Supabase in background
    get().persistPatient(id, updates);
  },

  saveWorkflow: () => {
    const { workflowPatient, stepStates } = get();
    if (!workflowPatient) return;
    const allDone = ['s1','s2','s3','s4'].every(s => stepStates[s] === 'done');
    let updates = {};
    if (allDone) {
      updates = { status: 'completed', goals: workflowPatient.goals || { met: 3, total: 4 }, nextAction: '__MED_REVIEW__' };
    } else if (stepStates.s4 === 'done') {
      updates = { status: 'scheduled', nextAction: 'Follow-up appointment confirmed' };
    } else if (stepStates.s3 === 'done') {
      updates = { status: 'scheduled', nextAction: 'Schedule follow-up appointment' };
    } else if (stepStates.s2 === 'done') {
      updates = { nextAction: 'Complete medication reconciliation' };
    }
    // Optimistic local update
    set(s => ({
      patients: s.patients.map(p => p.id === workflowPatient.id ? { ...p, ...updates } : p),
      workflowPatient: null,
      toast: 'Workflow saved successfully'
    }));
    // Persist to Supabase
    if (Object.keys(updates).length > 0) {
      get().persistPatient(workflowPatient.id, updates);
    }
  },

  invokeAgent: (patientIds, agentName, agentRole) => {
    const MAX_CONCURRENT = 3;
    const state = get();
    let activeCount = state.patients.filter(p => p.status === 'oncall' && p.onCall).length;
    const updated = state.patients.map(p => {
      if (!patientIds.includes(p.id)) return p;
      const newP = { ...p, agentAssigned: agentName, agentRole };
      if (p.status !== 'completed' && p.status !== 'failed') {
        if (activeCount < MAX_CONCURRENT) {
          newP.status = 'oncall';
          newP.onCall = true;
          newP.callDuration = '00:00';
          newP.nextAction = 'Live outreach in progress';
          activeCount++;
        } else {
          newP.status = 'queued';
          newP.onCall = false;
          newP.nextAction = 'Queued — waiting for available line';
        }
      }
      return newP;
    });
    toast.success('TOC Agent Invoked Successfully');
    set({ patients: updated, selectedIds: [], showInvokeModal: false, queueTabDot: true });

    // Auto-navigate to the queue tab so users see their invoked patients
    const { setActiveTab } = get();
    setActiveTab('toc-queue');

    // Create call records for invoked patients and persist to Supabase
    for (const p of updated) {
      if (patientIds.includes(p.id)) {
        get().persistPatient(p.id, {
          agentAssigned: p.agentAssigned,
          agentRole: p.agentRole,
          status: p.status,
          onCall: p.onCall,
          callDuration: p.callDuration,
          nextAction: p.nextAction,
        });

        // Create an ongoing call record if patient went to oncall
        if (p.status === 'oncall') {
          // Find existing ongoing template from fallback data
          const existing = get().callDetails.find(c => c.patientId === p.id && c.callType === 'ongoing');
          const callId = 'cd-live-' + p.id + '-' + Date.now();
          get().createCallRecord({
            id: callId,
            patientId: p.id,
            callType: 'ongoing',
            agentName: agentName,
            startedAt: new Date().toLocaleString(),
            duration: '00:00',
            liveGoals: existing?.liveGoals || [
              { name: 'Patient Outreach', done: false, time: null },
              { name: 'Schedule ToC Appointment', done: false, time: null },
              { name: 'Medication Review', done: false, time: null },
            ],
            liveTranscript: existing?.liveTranscript || [],
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    get().startCallTimers();
  },

  abortAllAgents: () => {
    const state = get();
    // Stop all call timers
    if (state.callTimerRef) {
      clearInterval(state.callTimerRef);
    }
    const updated = state.patients.map(p => {
      if (!p.agentAssigned) return p;
      const newP = { ...p, agentAssigned: '', agentRole: '', onCall: false, status: p.status === 'oncall' || p.status === 'queued' ? 'scheduled' : p.status };
      return newP;
    });
    set({ patients: updated, callTimerRef: null, queueTabDot: false, toast: 'All agent runs aborted' });
    // Persist changes
    for (const p of updated) {
      if (p.agentAssigned === '') {
        get().persistPatient(p.id, { agentAssigned: '', agentRole: '', onCall: false, status: p.status });
      }
    }
    setTimeout(() => set(s => s.toast === 'All agent runs aborted' ? { toast: null } : {}), 2800);
  },

  startCallTimers: () => {
    const existing = get().callTimerRef;
    if (existing) return;
    const ref = setInterval(() => {
      const state = get();
      const anyActive = state.patients.some(p => p.status === 'oncall' && p.onCall);
      if (!anyActive) {
        clearInterval(ref);
        set({ callTimerRef: null });
        return;
      }
      set(s => ({
        patients: s.patients.map(p => {
          if (p.status !== 'oncall' || !p.onCall) return p;
          const secs = parseDuration(p.callDuration || '00:00') + 1;
          return { ...p, callDuration: formatDuration(secs) };
        })
      }));
      // Note: call duration ticks are NOT persisted every second (too noisy).
      // They get persisted when the call ends.
    }, 1000);
    set({ callTimerRef: ref });
  },

  openCallPopover: (patientId, btnRef) => set({ callPopoverPatient: patientId, callPopoverBtnRef: btnRef }),
  closeCallPopover: () => set({ callPopoverPatient: null, callPopoverBtnRef: null }),

  startActiveCall: (patientId) => {
    track('call.started', { patientId });
    const state = get();
    if (state.activeCallTimerRef) clearInterval(state.activeCallTimerRef);
    const updates = { status: 'oncall', onCall: true, callDuration: '00:00' };
    set(s => ({
      patients: s.patients.map(p => p.id === patientId ? { ...p, ...updates } : p),
      activeCallPatient: patientId,
      activeCallSeconds: 0,
      callPopoverPatient: null,
      callPopoverBtnRef: null
    }));
    get().persistPatient(patientId, updates);

    const ref = setInterval(() => {
      set(s => {
        const newSecs = s.activeCallSeconds + 1;
        const timeStr = formatDuration(newSecs);
        return {
          activeCallSeconds: newSecs,
          patients: s.patients.map(p => p.id === patientId ? { ...p, callDuration: timeStr } : p)
        };
      });
    }, 1000);
    set({ activeCallTimerRef: ref });
  },

  endActiveCall: () => {
    const { activeCallTimerRef, activeCallPatient, activeCallSeconds } = get();
    track('call.ended', { patientId: activeCallPatient, durationSec: activeCallSeconds });
    if (activeCallTimerRef) clearInterval(activeCallTimerRef);
    const updates = { status: 'scheduled', onCall: false, callDuration: formatDuration(activeCallSeconds) };
    set(s => ({
      patients: s.patients.map(p => p.id === activeCallPatient ? { ...p, ...updates } : p),
      activeCallPatient: null,
      activeCallSeconds: 0,
      activeCallTimerRef: null
    }));
    if (activeCallPatient) {
      get().persistPatient(activeCallPatient, updates);
    }
  },

  showToast: (msg) => {
    toast(msg);
  },

  openDetail: (patientId, callRow = null) => {
    const p = get().patients.find(x => x.id === patientId);
    if (p) {
      const patientCalls = get().callDetails.filter(c => c.patientId === patientId);
      set({ detailPatient: p, detailPatientCalls: patientCalls, activeCallRow: callRow });
    }
  },
  closeDetail: () => set({ detailPatient: null, detailPatientCalls: [], activeCallRow: null }),

  openLiveDrawer: (patientId) => set({ liveDrawerPatient: patientId }),
  closeLiveDrawer: () => set({ liveDrawerPatient: null }),

  setShowInvokeModal: (v) => set({ showInvokeModal: v }),
  setShowCreateNew: (v) => set({ showCreateNew: v }),
  setShowFilterBar: (v) => set({ showFilterBar: v }),
  clearQueueTabDot: () => set({ queueTabDot: false }),

  nextDate,

  // ─── Analytics Data Layer ───
  analyticsCache: {},
  analyticsLoading: {},
  analyticsError: {},
  analyticsPeriod: '2026-03',
  analyticsTenant: 'default',
  analyticsPersona: 'exec',
  analyticsPractice: 'all',
  analyticsOrg: 'aco',
  analyticsPeriodMode: 'ytd',
  analyticsQuarter: 'Q4-2025',
  analyticsView: 'executive',

  setAnalyticsView: (v) => { set({ analyticsView: v }); updateHash(get); },
  setAnalyticsPeriod: (p) => { set({ analyticsPeriod: p, analyticsCache: {} }); },
  setAnalyticsTenant: (t) => { set({ analyticsTenant: t, analyticsCache: {} }); },
  setAnalyticsPersona: (p) => { set({ analyticsPersona: p, analyticsCache: {} }); },
  setAnalyticsPractice: (p) => { set({ analyticsPractice: p, analyticsCache: {} }); },
  setAnalyticsOrg: (o) => { set({ analyticsOrg: o, analyticsCache: {} }); },
  setAnalyticsPeriodMode: (m) => { set({ analyticsPeriodMode: m, analyticsCache: {} }); },
  setAnalyticsQuarter: (q) => { set({ analyticsQuarter: q, analyticsCache: {} }); },
  invalidateAnalyticsCache: () => set({ analyticsCache: {} }),

  fetchAnalytics: async (cacheKey, queryFn) => {
    const cache = get().analyticsCache[cacheKey];
    if (cache && Date.now() - cache.fetchedAt < 5 * 60 * 1000) return cache.data;
    set(s => ({
      analyticsLoading: { ...s.analyticsLoading, [cacheKey]: true },
      analyticsError: { ...s.analyticsError, [cacheKey]: null },
    }));
    try {
      const data = await queryFn();
      set(s => ({
        analyticsCache: { ...s.analyticsCache, [cacheKey]: { data, fetchedAt: Date.now() } },
        analyticsLoading: { ...s.analyticsLoading, [cacheKey]: false },
      }));
      return data;
    } catch (err) {
      set(s => ({
        analyticsLoading: { ...s.analyticsLoading, [cacheKey]: false },
        analyticsError: { ...s.analyticsError, [cacheKey]: err.message },
      }));
      return null;
    }
  },

  fetchViewKpis: async (viewId) => {
    const { analyticsTenant: t, analyticsPeriod: p } = get();
    const key = `kpis:${viewId}:${p}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_kpis').select('*')
        .eq('tenant_id', t).eq('view_key', viewId).eq('period', p)
        .maybeSingle();
      if (error || !data) return { kpis: [], insight: null };
      return kpiRowToJs(data);
    });
  },

  fetchTimeSeries: async (seriesKeys) => {
    const { analyticsTenant: t, analyticsPeriod: p } = get();
    const key = `ts:${seriesKeys.join(',')}:${p}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_time_series').select('*')
        .eq('tenant_id', t).in('series_key', seriesKeys).eq('period', p);
      if (error || !data?.length) return {};
      return groupTimeSeries(data);
    });
  },

  fetchViewTable: async (viewId, tableKey) => {
    const { analyticsTenant: t, analyticsPeriod: p } = get();
    const key = `tbl:${tableKey}:${p}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_tables').select('*')
        .eq('tenant_id', t).eq('table_key', tableKey).eq('period', p)
        .maybeSingle();
      if (error || !data) return { columns: [], rows: [] };
      return tableRowToJs(data);
    });
  },

  fetchProgressBars: async (viewId, barKey) => {
    const { analyticsTenant: t, analyticsPeriod: p } = get();
    const key = `bar:${barKey}:${p}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_progress_bars').select('*')
        .eq('tenant_id', t).eq('bar_key', barKey).eq('period', p)
        .maybeSingle();
      if (error || !data) return [];
      return barRowToJs(data);
    });
  },

  fetchConfig: async (configKey) => {
    const { analyticsTenant: t } = get();
    const key = `cfg:${configKey}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_configs').select('*')
        .eq('tenant_id', t).eq('config_key', configKey)
        .maybeSingle();
      if (error || !data) return {};
      return configRowToJs(data);
    });
  },

  // ── Appointment Types ──
  appointmentTypes: [],
  fetchAppointmentTypes: async () => {
    const { data, error } = await supabase
      .from('appointment_types')
      .select('*')
      .order('name');
    if (!error && data) set({ appointmentTypes: data });
  },

  // ── Appointments ──
  appointments: [],
  appointmentsLoading: false,
  fetchAppointments: async () => {
    set({ appointmentsLoading: true });
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('date', { ascending: true });
    if (!error && data) set({ appointments: data });
    set({ appointmentsLoading: false });
  },

  createAppointment: async (appt) => {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appt)
      .select()
      .single();
    if (error) { console.error('Create appointment error:', error); return null; }
    // Refresh list
    get().fetchAppointments();
    return data;
  },

  updateAppointment: async (id, updates) => {
    const { error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id);
    if (error) { console.error('Update appointment error:', error); return false; }
    get().fetchAppointments();
    return true;
  },

  deleteAppointment: async (id) => {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);
    if (error) { console.error('Delete appointment error:', error); return false; }
    get().fetchAppointments();
    return true;
  },

  // ── Campaign ──
  // (helper hoisted below; declared at module scope via const mapper above the store)
  campaignTab: 'active',
  setCampaignTab: (tab) => { set({ campaignTab: tab }); updateHash(get); },
  campaigns: [],
  campaignsLoading: false,
  // Builder takeover. `campaignBuilderId` is the campaigns.id we're editing in
  // the New Campaign full-screen view. It coexists with `editingCampaignId`:
  // when both are set, the EmailBuilder shows on top; closing it returns to
  // the CampaignBuilder. `campaignBuilderSaving` is "draft-row creation" — the
  // brief moment between "user clicked New Campaign" and "draft row exists".
  campaignBuilderId: null,
  campaignBuilderSaving: false,

  // Open the New Campaign builder. If campaignOrNull is null, insert a fresh
  // draft row first so we have an id to PATCH against on every subsequent
  // field edit (no need for a separate "create" submit step).
  openCampaignBuilder: async (campaignOrNull) => {
    track('campaign.builder_opened', { campaignId: campaignOrNull?.id || null });
    if (campaignOrNull?.id) {
      set({ campaignBuilderId: campaignOrNull.id });
      updateHash(get);
      return campaignOrNull.id;
    }
    set({ campaignBuilderSaving: true });
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        name: 'Untitled Campaign',
        section: 'draft',
        channel: 'email',
        send_via: ['email'],
        start_mode: 'immediately',
        campaign_type: 'one_time',
      })
      .select('*')
      .single();
    set({ campaignBuilderSaving: false });
    if (error) {
      console.error('openCampaignBuilder insert error:', error);
      get().showToast('Could not create draft campaign');
      return null;
    }
    const fresh = campaignRowToJs(data);
    set(s => ({
      campaigns: [...s.campaigns, fresh],
      campaignBuilderId: fresh.id,
    }));
    updateHash(get);
    return fresh.id;
  },

  closeCampaignBuilder: () => {
    track('campaign.builder_closed');
    set({ campaignBuilderId: null });
    updateHash(get);
  },

  // Patch arbitrary fields on the campaign currently being built. Optimistic
  // local update + debounced Supabase PATCH so the UI feels instant and a
  // burst of edits collapses into one network call.
  updateCampaignFields: (patch) => {
    const id = get().campaignBuilderId;
    if (!id) return;
    track('campaign.fields_updated', { fields: Object.keys(patch || {}) });
    set(s => ({
      campaigns: s.campaigns.map(c => c.id === id ? { ...c, ...patch } : c),
    }));
    scheduleCampaignSave(id, async () => {
      const dbPatch = campaignPatchToDb(patch);
      if (Object.keys(dbPatch).length === 0) return;
      const { error } = await supabase
        .from('campaigns')
        .update(dbPatch)
        .eq('id', id);
      if (error) console.error('updateCampaignFields error:', error);
    });
  },

  // Run / activate the campaign. Flushes any pending debounced save first,
  // then flips section → 'running' and enabled → true.
  runCampaignNow: async () => {
    const id = get().campaignBuilderId;
    if (!id) return false;
    track('campaign.run_now', { campaignId: id });
    // Flush pending debounced save synchronously so we don't lose the latest
    // field edit racing with this request.
    const pending = _campaignSaveTimers.get(id);
    if (pending) { clearTimeout(pending); _campaignSaveTimers.delete(id); }
    const { error } = await supabase
      .from('campaigns')
      .update({ section: 'running', enabled: true })
      .eq('id', id);
    if (error) {
      console.error('runCampaignNow error:', error);
      get().showToast('Could not start campaign');
      return false;
    }
    set(s => ({
      campaigns: s.campaigns.map(c => c.id === id ? { ...c, section: 'running', enabled: true } : c),
    }));
    get().showToast('Campaign started');
    return true;
  },

  // Hand-off from the CampaignBuilder to the EmailBuilder for "Edit Template".
  // Reuses the existing email-builder takeover; closing it returns to the
  // CampaignBuilder because campaignBuilderId stays set.
  openEmailTemplateFromCampaign: () => {
    const id = get().campaignBuilderId;
    if (!id) return;
    track('email.template_opened_from_campaign', { campaignId: id });
    const campaign = get().campaigns.find(c => c.id === id);
    if (!campaign) return;
    get().openEmailBuilder(campaign);
  },
  fetchCampaigns: async () => {
    set({ campaignsLoading: true });
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('id', { ascending: true });
    if (error) {
      set({ campaignsLoading: false });
      return;
    }
    const campaigns = (data || []).map(campaignRowToJs);
    set({ campaigns, campaignsLoading: false });
  },

  fetchCampaignById: async (id) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return campaignRowToJs(data);
  },

  // ── Settings → Content → Emails (server-side paginated) ─────────────────────
  // Separate slice from `campaigns` so the Settings page can ask for a page
  // at a time without disturbing the bulk-loaded campaign worklist.
  contentEmails: [],
  contentEmailsTotal: 0,
  contentEmailsLoading: false,
  fetchContentEmails: async ({ page = 1, perPage = 10, search = '', status = 'all', force = false } = {}) => {
    // ── SWR-style cache ─────────────────────────────────────────────────────
    // Cache hit → paint cached rows immediately, no shimmer. If fresh
    // (< CONTENT_EMAILS_TTL_MS), skip the network entirely. If stale, still
    // serve the cached rows but kick off a background revalidation that
    // silently swaps in the new data when it lands. Cache is invalidated
    // by deleteCampaign / deleteCampaignsBulk / duplicateCampaign /
    // openContentEmailBuilder(null).
    const cacheKey = `${page}|${perPage}|${(search || '').toLowerCase().trim()}|${status || 'all'}`;
    const cached = _contentEmailsCache.get(cacheKey);
    const now = Date.now();

    if (cached) {
      set({
        contentEmails: cached.rows,
        contentEmailsTotal: cached.total,
        contentEmailsLoading: false,
      });
      // Fresh cache — done; no network request.
      if (!force && now - cached.fetchedAt < CONTENT_EMAILS_TTL_MS) {
        return;
      }
      // Stale cache — continue and revalidate in the background. We
      // intentionally don't toggle contentEmailsLoading because the user
      // already sees the cached rows; flickering a shimmer back in would
      // be worse than letting the swap happen invisibly.
    } else {
      set({ contentEmailsLoading: true });
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    // Slim column list — explicitly excludes `email_template` and
    // `color_variables`. Those JSONB columns can be 10-100KB per row and
    // we don't render them in the table at all. They're fetched on demand
    // when Preview / Edit is clicked via fetchCampaignById(id).
    //
    // Newest-edited first so freshly created or just-touched emails surface
    // at the top of the list. NULLs LAST keeps rows that predate the
    // updated_at trigger from hogging the top of the list.
    const LIST_COLUMNS = [
      'id', 'name', 'description', 'channel', 'section', 'audience', 'dynamic',
      'health', 'delivered', 'opened', 'start_date', 'duration', 'progress',
      'executes_in', 'enabled', 'audience_include', 'audience_exclude',
      'send_via', 'start_mode', 'start_at', 'end_date', 'campaign_type',
      'sender_name', 'send_from', 'subject_line', 'category', 'updated_at',
      'updated_by',
    ].join(', ');
    // The select also pulls the foreign-keyed profile (updated_by →
    // profiles.id) so the table can show "Last Updated By" without a second
    // round trip. If the migration that creates the FK hasn't been applied
    // yet, PostgREST returns PGRST200 — we fall back to a plain select so
    // the page still renders.
    const buildQuery = (select) => {
      let q = supabase
        .from('campaigns')
        .select(select, { count: 'exact' })
        .eq('channel', 'email')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });
      if (status && status !== 'all') q = q.eq('section', status);
      if (search?.trim()) {
        const s = search.trim().replace(/[%_]/g, '');
        q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%`);
      }
      return q.range(from, to);
    };

    let { data, error, count } = await buildQuery(
      `${LIST_COLUMNS}, updated_by_profile:profiles!updated_by(id, full_name)`,
    );

    // PGRST200 = "no foreign key relationship" — migration not applied yet.
    if (error?.code === 'PGRST200') {
      console.warn(
        '[fetchContentEmails] FK to profiles missing — run supabase/campaigns_category_updated_by_migration.sql. Falling back to plain select.',
      );
      ({ data, error, count } = await buildQuery(LIST_COLUMNS));
    }
    // 42703 = column does not exist (updated_at, category, etc. before migrations applied)
    if (error?.code === '42703') {
      console.warn(
        '[fetchContentEmails] Column missing (likely updated_at). Falling back to id ordering.',
      );
      const fb = supabase
        .from('campaigns')
        .select('*', { count: 'exact' })
        .eq('channel', 'email')
        .order('id', { ascending: false });
      ({ data, error, count } = await fb.range(from, to));
    }

    if (error) {
      console.error('fetchContentEmails error:', JSON.stringify(error, null, 2));
      set({ contentEmailsLoading: false });
      return;
    }
    const rows = (data || []).map(campaignRowToJs);
    const total = count || 0;
    // Store the freshly-revalidated data in the cache so the next visit at
    // this same key returns immediately.
    _contentEmailsCache.set(cacheKey, { rows, total, fetchedAt: Date.now() });
    set({
      contentEmails: rows,
      contentEmailsTotal: total,
      contentEmailsLoading: false,
    });
  },

  // Settings → Content → Emails opens the EmailBuilder directly (no campaign
  // builder takeover). Accepts either an existing email campaign or null to
  // mint a new draft + open it. The router uses activePage='settings' +
  // settingsNavItem='content' to keep the URL on the content path so closing
  // returns to #/settings/content/emails.
  openContentEmailBuilder: async (campaignOrNull) => {
    let campaign = campaignOrNull;
    // Slim-list optimisation: if we were passed a row from the list (no
    // emailTemplate because we excluded it from the list select), fetch the
    // full row now so the email builder gets the saved doc instead of a
    // generated initial document.
    if (campaign && campaign.id && campaign.emailTemplate === undefined) {
      const full = await get().fetchCampaignById(campaign.id);
      if (full) campaign = full;
    }
    if (!campaign) {
      set({ campaignBuilderSaving: true });
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          name: 'Untitled Email',
          section: 'draft',
          channel: 'email',
          send_via: ['email'],
          start_mode: 'immediately',
          campaign_type: 'one_time',
        })
        .select('*')
        .single();
      set({ campaignBuilderSaving: false });
      if (error) {
        console.error('openContentEmailBuilder insert error:', error);
        get().showToast?.('Could not create email');
        return null;
      }
      campaign = campaignRowToJs(data);
      set(s => ({ campaigns: [...s.campaigns, campaign] }));
      _invalidateContentEmailsCache();
    }
    // Clear any stale campaign-builder takeover so the URL routes through
    // settings/content and closeEmailBuilder lands back on the email list.
    set({ campaignBuilderId: null });
    get().openEmailBuilder(campaign);
    return campaign.id;
  },

  // Clone an existing campaign — copies every column except the primary key
  // and timestamps. New copy lands as a draft with a " (Copy)" suffix so it
  // never re-runs a live campaign by accident.
  duplicateCampaign: async (id) => {
    const { data: original, error: fetchErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !original) {
      console.error('duplicateCampaign fetch error:', fetchErr);
      get().showToast?.('Could not duplicate email');
      return null;
    }
    // eslint-disable-next-line no-unused-vars
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = original;
    const { data: copy, error: insertErr } = await supabase
      .from('campaigns')
      .insert({
        ...rest,
        name: `${rest.name || 'Untitled'} (Copy)`,
        section: 'draft',
        enabled: false,
      })
      .select('*')
      .single();
    if (insertErr) {
      console.error('duplicateCampaign insert error:', insertErr);
      get().showToast?.('Could not duplicate email');
      return null;
    }
    const fresh = campaignRowToJs(copy);
    set(s => ({ campaigns: [...s.campaigns, fresh] }));
    _invalidateContentEmailsCache();
    get().showToast?.('Email duplicated');
    return fresh;
  },

  // Delete many campaigns in one round trip. Used by the Content → Emails
  // bulk-select toolbar.
  deleteCampaignsBulk: async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    const { error } = await supabase.from('campaigns').delete().in('id', ids);
    if (error) {
      console.error('deleteCampaignsBulk error:', error);
      get().showToast?.('Could not delete selected emails');
      return false;
    }
    const idSet = new Set(ids);
    set(s => ({
      campaigns: s.campaigns.filter(c => !idSet.has(c.id)),
      contentEmails: s.contentEmails.filter(c => !idSet.has(c.id)),
      contentEmailsTotal: Math.max(0, s.contentEmailsTotal - ids.length),
    }));
    _invalidateContentEmailsCache();
    get().showToast?.(`${ids.length} email${ids.length === 1 ? '' : 's'} deleted`);
    return true;
  },

  deleteCampaign: async (id) => {
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) {
      console.error('deleteCampaign error:', error);
      get().showToast?.('Could not delete email');
      return false;
    }
    set(s => ({
      campaigns: s.campaigns.filter(c => c.id !== id),
      contentEmails: s.contentEmails.filter(c => c.id !== id),
      contentEmailsTotal: Math.max(0, s.contentEmailsTotal - 1),
    }));
    _invalidateContentEmailsCache();
    get().showToast?.('Email deleted');
    return true;
  },

  // ─── Settings → Content → Forms ──────────────────────────────────────────
  // Slim list of forms for the Content → Forms table. Mirrors the emails
  // pattern: server-side pagination + search + SWR cache. `editingFormId`
  // drives the full-screen FormBuilder takeover (see AppLayout + router).
  contentForms: [],
  contentFormsTotal: 0,
  contentFormsLoading: false,
  editingFormId: null,
  formBuilderForm: null,
  formBuilderSaving: false,
  // Active builder tab + Analytics sub-tab, mirrored into the URL hash so a
  // refresh restores the exact view. Set by the router (_pending*) on reload.
  formBuilderMode: 'edit',          // 'edit' | 'score' | 'preview' | 'analytics'
  formAnalyticsTab: 'insight',      // 'insight' | 'report' | 'responses'
  _pendingFormMode: null,           // set by router on refresh
  _pendingFormAnalyticsTab: null,   // set by router on refresh
  setFormBuilderMode: (mode) => { set({ formBuilderMode: mode }); updateHash(get); },
  setFormAnalyticsTab: (tab) => { set({ formAnalyticsTab: tab }); updateHash(get); },
  // Shareable form fill-view (#/f/{id}); the router sets formViewId on nav.
  formViewId: null,
  closeFormView: () => set({ formViewId: null }),

  fetchContentForms: async ({ page = 1, perPage = 10, search = '', status = 'all', force = false } = {}) => {
    const cacheKey = `${page}|${perPage}|${(search || '').toLowerCase().trim()}|${status || 'all'}`;
    const cached = _contentFormsCache.get(cacheKey);
    const now = Date.now();
    if (cached) {
      set({ contentForms: cached.rows, contentFormsTotal: cached.total, contentFormsLoading: false });
      if (!force && now - cached.fetchedAt < CONTENT_FORMS_TTL_MS) return;
    } else {
      set({ contentFormsLoading: true });
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const LIST_COLUMNS = [
      'id', 'name', 'description', 'category', 'status', 'response_count',
      'updated_at', 'updated_by',
    ].join(', ');
    const buildQuery = (select) => {
      let q = supabase
        .from('forms')
        .select(select, { count: 'exact' })
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });
      if (status && status !== 'all') q = q.eq('status', status);
      if (search?.trim()) {
        const term = search.trim().replace(/[%_]/g, '');
        q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
      }
      return q.range(from, to);
    };

    let { data, error, count } = await buildQuery(
      `${LIST_COLUMNS}, updated_by_profile:profiles!updated_by(id, full_name)`,
    );
    if (error?.code === 'PGRST200') {
      ({ data, error, count } = await buildQuery(LIST_COLUMNS));
    }
    // Table not created yet (42P01 / PGRST205) — degrade to an empty list so
    // the page still renders. The toolbar's "New Form" still opens the builder
    // against a local draft.
    if (error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703')) {
      console.warn('[fetchContentForms] forms table missing — run supabase/forms_migration.sql');
      _contentFormsCache.set(cacheKey, { rows: [], total: 0, fetchedAt: Date.now() });
      set({ contentForms: [], contentFormsTotal: 0, contentFormsLoading: false });
      return;
    }
    if (error) {
      console.error('fetchContentForms error:', JSON.stringify(error, null, 2));
      set({ contentFormsLoading: false });
      return;
    }
    const rows = (data || []).map(formRowToJs);
    const total = count || 0;
    _contentFormsCache.set(cacheKey, { rows, total, fetchedAt: Date.now() });
    set({ contentForms: rows, contentFormsTotal: total, contentFormsLoading: false });
  },

  fetchFormById: async (id) => {
    const { data, error } = await supabase
      .from('forms')
      .select('*, updated_by_profile:profiles!updated_by(id, full_name)')
      .eq('id', id)
      .single();
    if (error) {
      // Retry without the FK join if the relationship isn't set up.
      const retry = await supabase.from('forms').select('*').eq('id', id).single();
      if (retry.error) {
        console.error('fetchFormById error:', retry.error);
        return null;
      }
      return formRowToJs(retry.data);
    }
    return formRowToJs(data);
  },

  // Look up a single full form by its (case-insensitive) name — used to render a
  // named form (e.g. "HRA Assessment form") inside the program workflow.
  fetchFormByName: async (name) => {
    if (!name) return null;
    const { data, error } = await supabase
      .from('forms')
      .select('*')
      .ilike('name', name)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1);
    if (error || !data || !data.length) return null;
    return formRowToJs(data[0]);
  },

  // Resolve the current user's profiles.id to stamp as updated_by. The DB
  // trigger sets updated_by = COALESCE(auth.uid(), NEW.updated_by), so when
  // auth.uid() is null (e.g. no JWT) the client-supplied id is what sticks —
  // this is why we stamp it here rather than relying on the trigger alone.
  // Prefer the already-loaded profile, else fall back to the auth session.
  _resolveUpdatedBy: async () => {
    const cup = get().currentUserProfile;
    if (cup?.id) return cup.id;
    try {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id || null;
    } catch {
      return null;
    }
  },

  // Open the full-screen builder. Pass an existing form (or its id) to edit, or
  // null to mint a fresh draft. Falls back to an in-memory draft if the table
  // hasn't been created yet so the builder is still usable for design.
  openFormBuilder: async (formOrNull) => {
    let form = formOrNull;
    // Accept a bare id (number/string) as well as a form object.
    if (typeof form === 'number' || typeof form === 'string') {
      const fetched = await get().fetchFormById(isNaN(Number(form)) ? form : Number(form));
      if (!fetched) { get().showToast?.('Form not found'); return null; }
      form = fetched;
    } else if (form && form.id && form.schema === undefined) {
      const full = await get().fetchFormById(form.id);
      if (full) form = full;
    }
    if (!form) {
      set({ formBuilderSaving: true });
      const updatedBy = await get()._resolveUpdatedBy();
      const draft = {
        name: 'Untitled Form',
        status: 'draft',
        schema: { items: [] },
        scoring: { scores: [], criticalTriggers: [] },
        settings: { layout: 'sectioned' },
        ...(updatedBy ? { updated_by: updatedBy } : {}),
      };
      const { data, error } = await supabase.from('forms').insert(draft).select('*').single();
      set({ formBuilderSaving: false });
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          get().showToast?.('Run forms_migration.sql to save forms — editing locally for now');
          form = formRowToJs({ id: `local-${Date.now()}`, ...draft });
        } else {
          console.error('openFormBuilder insert error:', error);
          get().showToast?.('Could not create form');
          return null;
        }
      } else {
        form = formRowToJs(data);
        _invalidateContentFormsCache();
      }
    }
    // Always open on the Edit tab; a refresh into a specific tab is applied
    // afterward by the AppLayout hydration effect (from _pendingFormMode), which
    // avoids a stale pending value leaking into a later open-from-list.
    set({ editingFormId: form.id, formBuilderForm: form, formBuilderMode: 'edit', formAnalyticsTab: 'insight' });
    updateHash(get);
    return form.id;
  },

  closeFormBuilder: () => {
    set({ editingFormId: null, formBuilderForm: null, formBuilderMode: 'edit', formAnalyticsTab: 'insight' });
    updateHash(get);
  },

  // Best-effort autosave of an in-progress fill (drop-off tracking). Upserts one
  // row per (form_id, session_id); status stays 'in_progress' until submit.
  // Silently no-ops if the partial-progress migration hasn't been run.
  savePartialResponse: async (formId, { sessionId, answers, answeredCount = 0 } = {}) => {
    if (!formId || !sessionId || (typeof formId === 'string' && formId.startsWith('local-'))) return false;
    const createdBy = await get()._resolveUpdatedBy();
    const { error } = await supabase
      .from('form_responses')
      .upsert({
        form_id: formId,
        session_id: sessionId,
        answers,
        answered_count: answeredCount,
        status: 'in_progress',
        ...(createdBy ? { created_by: createdBy } : {}),
      }, { onConflict: 'form_id,session_id' });
    if (error) {
      // Missing column/index (migration not run) or RLS — don't break the fill.
      if (import.meta.env?.DEV) console.warn('savePartialResponse skipped:', error.message);
      return false;
    }
    return true;
  },

  // Persist a completed form submission. When a sessionId is present we upsert
  // the existing in-progress row to 'completed' (so it leaves the Pending list);
  // otherwise we insert a fresh completed row. The DB trigger keeps
  // forms.response_count in sync. `scores` is the engine snapshot at submit time.
  submitFormResponse: async (formId, answers, scores = {}, opts = {}) => {
    const { sessionId, answeredCount } = opts;
    const createdBy = await get()._resolveUpdatedBy();
    const base = {
      form_id: formId,
      answers,
      scores,
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(answeredCount != null ? { answered_count: answeredCount } : {}),
      ...(createdBy ? { created_by: createdBy } : {}),
    };
    let error;
    if (sessionId) {
      ({ error } = await supabase
        .from('form_responses')
        .upsert({ ...base, session_id: sessionId }, { onConflict: 'form_id,session_id' }));
      // Fall back to a plain insert if the unique index/columns don't exist yet.
      if (error) ({ error } = await supabase.from('form_responses').insert({ form_id: formId, answers, scores, ...(createdBy ? { created_by: createdBy } : {}) }));
    } else {
      ({ error } = await supabase.from('form_responses').insert(base));
      if (error) ({ error } = await supabase.from('form_responses').insert({ form_id: formId, answers, scores, ...(createdBy ? { created_by: createdBy } : {}) }));
    }
    if (error) {
      console.error('submitFormResponse error:', error);
      return false;
    }
    return true;
  },

  // All responses for a form (newest first), with the submitter's name when the
  // created_by → profiles FK resolves. Includes both completed submissions and
  // in-progress (Pending) fills; callers split on `status`.
  fetchFormResponses: async (formId) => {
    if (!formId || (typeof formId === 'string' && formId.startsWith('local-'))) return [];
    const sel = '*, created_by_profile:profiles!created_by(id, full_name)';
    let { data, error } = await supabase
      .from('form_responses').select(sel).eq('form_id', formId)
      .order('created_at', { ascending: false });
    if (error?.code === 'PGRST200') {
      ({ data, error } = await supabase
        .from('form_responses').select('*').eq('form_id', formId)
        .order('created_at', { ascending: false }));
    }
    if (error) {
      console.error('fetchFormResponses error:', error);
      return [];
    }
    return (data || []).map((r) => ({
      id: r.id,
      answers: r.answers || {},
      scores: r.scores || {},
      createdAt: r.created_at,
      submittedByName: r.created_by_profile?.full_name || null,
      // Pre-migration rows have no status column → treat as completed.
      status: r.status || 'completed',
      startedAt: r.started_at || r.created_at,
      completedAt: r.completed_at || null,
      answeredCount: r.answered_count ?? null,
    }));
  },

  // Persist a patch (name/category/status/schema/scoring/settings) for the
  // open form. Updates local state optimistically; for a local draft (no DB
  // row) it just updates state and reports the unsaved condition.
  saveForm: async (patch = {}, opts = {}) => {
    const current = get().formBuilderForm;
    if (!current) return false;
    const merged = { ...current, ...patch };
    set({ formBuilderForm: merged, formBuilderSaving: true });

    if (typeof current.id === 'string' && current.id.startsWith('local-')) {
      set({ formBuilderSaving: false });
      if (!opts.silent) get().showToast?.('Saved locally — run forms_migration.sql to persist');
      return false;
    }

    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.schema !== undefined) dbPatch.schema = patch.schema;
    if (patch.scoring !== undefined) dbPatch.scoring = patch.scoring;
    if (patch.settings !== undefined) dbPatch.settings = patch.settings;

    // Record who made the edit (see _resolveUpdatedBy).
    const updatedBy = await get()._resolveUpdatedBy();
    if (updatedBy) dbPatch.updated_by = updatedBy;

    const { data, error } = await supabase
      .from('forms')
      .update(dbPatch)
      .eq('id', current.id)
      .select('*')
      .single();
    set({ formBuilderSaving: false });
    if (error) {
      console.error('saveForm error:', error);
      get().showToast?.('Could not save form');
      return false;
    }
    _invalidateContentFormsCache();
    set({ formBuilderForm: formRowToJs(data) });
    if (!opts.silent) get().showToast?.('Form saved');
    return true;
  },

  duplicateForm: async (id) => {
    const { data: original, error: fetchErr } = await supabase.from('forms').select('*').eq('id', id).single();
    if (fetchErr || !original) {
      console.error('duplicateForm fetch error:', fetchErr);
      get().showToast?.('Could not duplicate form');
      return null;
    }
    // eslint-disable-next-line no-unused-vars
    const { id: _id, created_at: _c, updated_at: _u, response_count: _r, updated_by: _ub, ...rest } = original;
    const updatedBy = await get()._resolveUpdatedBy();
    const { data: copy, error: insertErr } = await supabase
      .from('forms')
      .insert({ ...rest, name: `${rest.name || 'Untitled'} (Copy)`, status: 'draft', response_count: 0, ...(updatedBy ? { updated_by: updatedBy } : {}) })
      .select('*')
      .single();
    if (insertErr) {
      console.error('duplicateForm insert error:', insertErr);
      get().showToast?.('Could not duplicate form');
      return null;
    }
    _invalidateContentFormsCache();
    get().showToast?.('Form duplicated');
    return formRowToJs(copy);
  },

  deleteForm: async (id) => {
    const { error } = await supabase.from('forms').delete().eq('id', id);
    if (error) {
      console.error('deleteForm error:', error);
      get().showToast?.('Could not delete form');
      return false;
    }
    set(s => ({
      contentForms: s.contentForms.filter(f => f.id !== id),
      contentFormsTotal: Math.max(0, s.contentFormsTotal - 1),
    }));
    _invalidateContentFormsCache();
    get().showToast?.('Form deleted');
    return true;
  },

  deleteFormsBulk: async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    const { error } = await supabase.from('forms').delete().in('id', ids);
    if (error) {
      console.error('deleteFormsBulk error:', error);
      get().showToast?.('Could not delete selected forms');
      return false;
    }
    const idSet = new Set(ids);
    set(s => ({
      contentForms: s.contentForms.filter(f => !idSet.has(f.id)),
      contentFormsTotal: Math.max(0, s.contentFormsTotal - ids.length),
    }));
    _invalidateContentFormsCache();
    get().showToast?.(`${ids.length} form${ids.length === 1 ? '' : 's'} deleted`);
    return true;
  },

  saveEmailTemplate: async () => {
    const s = get();
    if (!s.editingCampaignId || !s.emailDocument) return false;
    track('email.template_saved', { templateId: s.editingCampaignId });
    const { error } = await supabase
      .from('campaigns')
      .update({
        email_template: s.emailDocument,
        color_variables: s.colorVariables,
        updated_at: new Date().toISOString(),
      })
      .eq('id', s.editingCampaignId);
    if (error) {
      console.error('saveEmailTemplate error:', error);
      return false;
    }
    set(prev => ({
      campaigns: prev.campaigns.map(c =>
        c.id === s.editingCampaignId
          ? { ...c, emailTemplate: s.emailDocument, colorVariables: s.colorVariables }
          : c
      ),
    }));
    return true;
  },

  // Email builder takeover. editingCampaignId is the trigger; emailDocument is the
  // editable Reader-compatible document; selectedBlockId is what the right panel inspects.
  editingCampaignId: null,
  editingCampaignName: null,
  setEditingCampaignName: (name) => set({ editingCampaignName: name }),
  emailDocument: null,
  selectedBlockId: 'root',
  selectedColumnIdx: null,
  bulkSelectedIds: [],
  // When the user edits raw HTML in the Code tab, that string takes over the
  // preview canvas (rendered via an iframe). It can't round-trip back to the
  // JSON document, so it stays as an override until cleared.
  htmlPreviewOverride: null,
  setHtmlPreviewOverride: (html) => set({ htmlPreviewOverride: html }),
  setEmailDocument: (doc) => {
    get()._pushEmailHistory();
    set({ emailDocument: doc, htmlPreviewOverride: null });
  },

  // Pending HTML-import font substitution. When the parser surfaces font
  // families that aren't in the builder's Google Fonts catalogue, we hold
  // the parsed doc here and surface a dialog so the user can map each
  // unknown font to one we can load. The doc commits to emailDocument
  // only after the user confirms (or skips with the default mapping).
  pendingFontDoc: null,
  pendingUnknownFonts: [],
  openFontSubstitutionDialog: (doc, fonts) => set({ pendingFontDoc: doc, pendingUnknownFonts: fonts }),
  closeFontSubstitutionDialog: () => set({ pendingFontDoc: null, pendingUnknownFonts: [] }),

  // ── Undo / Redo for the email document ──
  // Snapshots the previous emailDocument before each mutation. Rapid edits
  // (color picker drag, resize drag) coalesce within a 400ms window so the
  // whole gesture counts as a single undo step.
  emailHistory: [],
  emailFuture: [],
  _lastEmailHistoryTime: 0,
  _pushEmailHistory: () => {
    const s = get();
    if (!s.emailDocument) return;
    const now = Date.now();
    const coalesce = now - s._lastEmailHistoryTime < 400 && s.emailHistory.length > 0;
    set(state => ({
      emailHistory: coalesce ? state.emailHistory : [...state.emailHistory.slice(-49), state.emailDocument],
      emailFuture: [],
      _lastEmailHistoryTime: now,
    }));
  },
  undoEmailEdit: () => set(s => {
    if (!s.emailDocument || s.emailHistory.length === 0) return {};
    track('email.undo');
    const prev = s.emailHistory[s.emailHistory.length - 1];
    return {
      emailHistory: s.emailHistory.slice(0, -1),
      emailFuture: [s.emailDocument, ...s.emailFuture].slice(0, 50),
      emailDocument: prev,
      _lastEmailHistoryTime: 0,
    };
  }),
  redoEmailEdit: () => set(s => {
    if (!s.emailDocument || s.emailFuture.length === 0) return {};
    track('email.redo');
    const next = s.emailFuture[0];
    return {
      emailFuture: s.emailFuture.slice(1),
      emailHistory: [...s.emailHistory.slice(-49), s.emailDocument],
      emailDocument: next,
      _lastEmailHistoryTime: 0,
    };
  }),

  // Named color variables — global "design tokens" for the open template.
  // Setting/picking a variable applies its hex; we don't persist a reference,
  // so updating a variable later does not retroactively change usages (matches
  // common email-design tool behaviour where colors are baked into the markup).
  colorVariables: [
    { name: 'Brand', hex: '#7C5CFA' },
    { name: 'Accent', hex: '#22C55E' },
    { name: 'Text', hex: '#3A485F' },
    { name: 'Muted', hex: '#7B8499' },
  ],
  addColorVariable: (variable) => set(s => ({ colorVariables: [...s.colorVariables, variable] })),
  updateColorVariable: (originalName, updates) => set(s => ({
    colorVariables: s.colorVariables.map(v => v.name === originalName ? { ...v, ...updates } : v),
  })),
  removeColorVariable: (name) => set(s => ({ colorVariables: s.colorVariables.filter(v => v.name !== name) })),

  // Recently used colors — capped MRU list shown above Variables in the
  // ColorPicker so users don't have to re-pick the same custom hex twice.
  // Hydrated from localStorage on boot; every commit re-saves the list.
  recentlyUsedColors: (() => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('eb_recent_colors');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch { return []; }
  })(),
  pushRecentColor: (hex) => set(s => {
    if (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex.trim())) return {};
    const upper = hex.trim().toUpperCase();
    const next = [upper, ...s.recentlyUsedColors.filter(c => c.toUpperCase() !== upper)].slice(0, 10);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('eb_recent_colors', JSON.stringify(next)); } catch {}
    return { recentlyUsedColors: next };
  }),

  // Swap the existing header/footer for a different preset. Replaces by role
  // marker stored on the block; falls back to first/last child by convention.
  replaceHeaderFooter: (role, presetTree) => {
    track('email.header_footer_replaced', { role });
    get()._pushEmailHistory();
    return set(s => {
      if (!s.emailDocument) return {};
    const doc = { ...s.emailDocument };
    const root = doc.root;
    const childrenIds = [...(root.data.childrenIds || [])];
    // Find existing block by role; if none, default to first child for header,
    // last child for footer.
    let existingId = childrenIds.find(id => doc[id]?.data?.role === role);
    if (!existingId) {
      existingId = role === 'header' ? childrenIds[0] : childrenIds[childrenIds.length - 1];
    }
    if (existingId) {
      // Remove the existing block tree (the root child + any descendants we know about)
      const toRemove = collectBlockTree(doc, existingId);
      toRemove.forEach(id => { delete doc[id]; });
      const idx = childrenIds.indexOf(existingId);
      childrenIds.splice(idx, 1, presetTree.rootId);
    } else {
      if (role === 'header') childrenIds.unshift(presetTree.rootId);
      else childrenIds.push(presetTree.rootId);
    }
    Object.assign(doc, presetTree.blocks);
    doc.root = { ...root, data: { ...root.data, childrenIds } };
      return { emailDocument: doc, selectedBlockId: presetTree.rootId };
    });
  },
  openEmailBuilder: (campaign) => {
    track('email.template_opened', { campaignId: campaign?.id });
    const saved = campaign.emailTemplate;
    const defaultVars = [
      { name: 'Brand', hex: '#7C5CFA' },
      { name: 'Accent', hex: '#22C55E' },
      { name: 'Text', hex: '#3A485F' },
      { name: 'Muted', hex: '#7B8499' },
    ];
    // Self-heal: campaigns saved before the customHtml-precedence fix carry
    // a stale `customHtml` field alongside a fully parsed block tree. The
    // canvas/export still prefer blocks (PreviewCanvas + patchEmailHtml
    // now check `!hasBlocks`), but stripping the dead field at load means
    // the next save persists a clean doc and customHtml retires over time.
    let doc = saved || makeInitialDocument(campaign);
    if (doc?.root?.data?.customHtml &&
        (doc.root?.data?.childrenIds?.length ?? 0) > 0) {
      const { customHtml: _stale, ...restData } = doc.root.data;
      doc = { ...doc, root: { ...doc.root, data: restData } };
    }
    set({
      editingCampaignId: campaign.id,
      editingCampaignName: campaign.name,
      emailDocument: doc,
      colorVariables: campaign.colorVariables || defaultVars,
      selectedBlockId: 'root',
      emailHistory: [],
      emailFuture: [],
      _lastEmailHistoryTime: 0,
    });
    // Fire-and-forget — the picker reads from customHeaderPresets /
    // customFooterPresets which both default to [], so the builder renders
    // immediately and gets populated when the fetch resolves.
    get().fetchCustomPresets();
    updateHash(get);
  },
  closeEmailBuilder: () => {
    track('email.template_closed');
    set({ editingCampaignId: null, editingCampaignName: null, emailDocument: null, selectedBlockId: 'root', selectedColumnIdx: null, bulkSelectedIds: [], htmlPreviewOverride: null, emailHistory: [], emailFuture: [], _lastEmailHistoryTime: 0 });
    updateHash(get);
  },

  // ── User-saved header/footer presets ──────────────────────────────────
  // Persisted in Supabase. Merged with the built-in HEADER_PRESETS /
  // FOOTER_PRESETS in the preset pickers so users see their saved templates
  // alongside the defaults. `tree` is the `{ rootId, blocks }` shape that
  // replaceHeaderFooter() consumes, re-IDed at apply time via cloneStoredTree.
  customHeaderPresets: [],
  customFooterPresets: [],

  fetchCustomPresets: async () => {
    const { data, error } = await supabase
      .from('email_header_footer_presets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      // Table not migrated yet → degrade silently rather than spamming errors.
      const msg = String(error.message || '');
      if (!msg.includes('does not exist') && !msg.includes('schema cache')) {
        console.error('fetchCustomPresets error:', error);
      }
      return;
    }
    const headers = [];
    const footers = [];
    for (const row of data || []) {
      const preset = {
        id: row.id,
        label: row.name,
        description: row.description || '',
        accent: row.accent || '#7C5CFA',
        tree: row.tree,
        isUserPreset: true,
      };
      if (row.role === 'header') headers.push(preset);
      else if (row.role === 'footer') footers.push(preset);
    }
    set({ customHeaderPresets: headers, customFooterPresets: footers });
  },

  saveCurrentAsPreset: async (role, { name, description }) => {
    const s = get();
    if (!s.emailDocument || (role !== 'header' && role !== 'footer')) return null;
    // Find the block in the doc carrying this role marker.
    const rootChildren = s.emailDocument.root?.data?.childrenIds || [];
    const rootId = rootChildren.find(id => s.emailDocument[id]?.data?.role === role);
    if (!rootId) {
      s.showToast(`No ${role} found in this template to save`);
      return null;
    }
    const tree = extractSubtree(s.emailDocument, rootId);
    const trimmedName = (name || '').trim() || `Custom ${role}`;
    const { data, error } = await supabase
      .from('email_header_footer_presets')
      .insert({
        role,
        name: trimmedName,
        description: (description || '').trim() || null,
        accent: '#7C5CFA',
        tree,
      })
      .select('*')
      .single();
    if (error) {
      const msg = String(error.message || '');
      if (msg.includes('does not exist') || msg.includes('schema cache')) {
        s.showToast('Run email_header_footer_presets migration to enable saving');
      } else {
        s.showToast(`Save failed — ${msg}`);
      }
      console.error('saveCurrentAsPreset error:', error);
      return null;
    }
    const fresh = {
      id: data.id,
      label: data.name,
      description: data.description || '',
      accent: data.accent || '#7C5CFA',
      tree: data.tree,
      isUserPreset: true,
    };
    set(prev => ({
      customHeaderPresets: role === 'header' ? [fresh, ...prev.customHeaderPresets] : prev.customHeaderPresets,
      customFooterPresets: role === 'footer' ? [fresh, ...prev.customFooterPresets] : prev.customFooterPresets,
    }));
    s.showToast(`Saved as ${role}: "${trimmedName}"`);
    return fresh;
  },

  // Rename / re-describe a saved preset. Only the metadata is updated —
  // the underlying tree stays the same so existing applies aren't affected.
  updateCustomPreset: async (id, role, { name, description }) => {
    const patch = {};
    if (typeof name === 'string') patch.name = name.trim();
    if (typeof description === 'string') patch.description = description.trim() || null;
    if (Object.keys(patch).length === 0) return false;
    const { error } = await supabase
      .from('email_header_footer_presets')
      .update(patch)
      .eq('id', id);
    if (error) {
      console.error('updateCustomPreset error:', error);
      get().showToast('Update failed');
      return false;
    }
    const apply = (list) => list.map(p => p.id === id ? { ...p, label: patch.name ?? p.label, description: patch.description ?? p.description } : p);
    set(prev => ({
      customHeaderPresets: role === 'header' ? apply(prev.customHeaderPresets) : prev.customHeaderPresets,
      customFooterPresets: role === 'footer' ? apply(prev.customFooterPresets) : prev.customFooterPresets,
    }));
    return true;
  },

  deleteCustomPreset: async (id, role) => {
    const { error } = await supabase
      .from('email_header_footer_presets')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('deleteCustomPreset error:', error);
      get().showToast('Delete failed');
      return false;
    }
    set(prev => ({
      customHeaderPresets: role === 'header'
        ? prev.customHeaderPresets.filter(p => p.id !== id)
        : prev.customHeaderPresets,
      customFooterPresets: role === 'footer'
        ? prev.customFooterPresets.filter(p => p.id !== id)
        : prev.customFooterPresets,
    }));
    return true;
  },

  // Apply a saved preset by re-IDing its stored tree and handing it to the
  // existing replaceHeaderFooter action. Built-in presets still go through
  // their preset.build(genId, name) entry point.
  applyCustomPreset: (role, preset) => {
    if (!preset?.tree) return;
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = cloneStoredTree(preset.tree, genId);
    if (tree) get().replaceHeaderFooter(role, tree);
  },
  setSelectedBlockId: (id) => set({ selectedBlockId: id, selectedColumnIdx: null, bulkSelectedIds: [] }),
  setSelectedColumnIdx: (idx) => set({ selectedColumnIdx: idx }),
  selectColumn: (blockId, colIdx) => set({ selectedBlockId: blockId, selectedColumnIdx: colIdx, bulkSelectedIds: [] }),
  setBulkSelectedIds: (ids) => set({ bulkSelectedIds: ids }),
  // Cmd/Shift-click on a block: build up a multi-selection from the
  // currently-selected single block + the clicked id. Re-clicking a block
  // already in the bulk set removes it. Single selection is cleared while
  // the bulk set is non-empty so the right panel switches to BulkDesignTab.
  toggleBulkSelected: (id) => set(s => {
    const current = new Set(s.bulkSelectedIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      // Seed with the existing single selection if there isn't already a
      // bulk list — gives the user "click A → cmd-click B" semantics.
      if (current.size === 0 && s.selectedBlockId && s.selectedBlockId !== id) {
        current.add(s.selectedBlockId);
      }
      current.add(id);
    }
    const ids = [...current];
    return { bulkSelectedIds: ids, selectedBlockId: ids.length === 1 ? ids[0] : null };
  }),
  updateBlock: (id, updater) => {
    const blockType = get().emailDocument?.[id]?.type || null;
    track('email.block_updated', { blockType });
    get()._pushEmailHistory();
    set(s => {
      if (!s.emailDocument || !s.emailDocument[id]) return {};
      const block = s.emailDocument[id];
      const next = typeof updater === 'function' ? updater(block) : updater;
      return { emailDocument: { ...s.emailDocument, [id]: next } };
    });
  },
  addBlock: (type) => {
    track('email.block_added', { blockType: type });
    get()._pushEmailHistory();
    return set(s => {
    if (!s.emailDocument) return {};
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = createBlockTree(type, genId);
    if (!tree) return {};
    const root = s.emailDocument.root;
    const bodyId = (root.data.childrenIds || []).find(id => s.emailDocument[id]?.data?.role === 'body');
    if (bodyId) {
      const body = s.emailDocument[bodyId];
      const props = { ...(body.data?.props || {}) };
      props.childrenIds = [...(props.childrenIds || []), tree.rootId];
      return {
        emailDocument: {
          ...s.emailDocument,
          [bodyId]: { ...body, data: { ...body.data, props } },
          ...tree.blocks,
        },
        selectedBlockId: tree.rootId,
      };
    }
    const updatedRoot = {
      ...root,
      data: { ...root.data, childrenIds: [...(root.data.childrenIds || []), tree.rootId] },
    };
    return {
      emailDocument: { ...s.emailDocument, root: updatedRoot, ...tree.blocks },
      selectedBlockId: tree.rootId,
    };
    });
  },
  // Move an existing block to a new parent slot.
  // target = { parentId, columnIdx?, index } where parentId is 'root' or a
  // block id (Container or ColumnsContainer). For ColumnsContainer parents,
  // columnIdx (0-2) chooses which column. Index is the insert position in
  // that children list.
  moveBlock: (blockId, target) => {
    const blockType = get().emailDocument?.[blockId]?.type || null;
    track('email.block_moved', { blockType, from: blockId, to: target?.parentId });
    get()._pushEmailHistory();
    return set(s => {
    if (!s.emailDocument || blockId === target.parentId) return {};
    const doc = { ...s.emailDocument };
    const map = buildParentMap(doc);
    const src = map[blockId];
    if (!src) return {};
    // Don't allow dropping a block into its own descendants.
    const subtree = collectBlockTree(doc, blockId);
    if (subtree.includes(target.parentId)) return {};

    const removeFrom = (parentId, columnIdx) => {
      if (parentId === 'root') {
        doc.root = { ...doc.root, data: { ...doc.root.data, childrenIds: doc.root.data.childrenIds.filter(id => id !== blockId) } };
      } else {
        const parent = doc[parentId];
        const data = { ...parent.data };
        const props = { ...(data.props || {}) };
        if (Array.isArray(props.childrenIds)) {
          props.childrenIds = props.childrenIds.filter(id => id !== blockId);
        } else if (Array.isArray(props.columns)) {
          const cols = props.columns.map((c, i) => i === columnIdx
            ? { ...c, childrenIds: (c.childrenIds || []).filter(id => id !== blockId) }
            : c
          );
          props.columns = cols;
        }
        data.props = props;
        doc[parentId] = { ...parent, data };
      }
    };

    const insertInto = (parentId, columnIdx, index) => {
      if (parentId === 'root') {
        const ids = [...doc.root.data.childrenIds];
        const clamped = Math.max(0, Math.min(index, ids.length));
        ids.splice(clamped, 0, blockId);
        doc.root = { ...doc.root, data: { ...doc.root.data, childrenIds: ids } };
      } else {
        const parent = doc[parentId];
        if (!parent) return;
        const data = { ...parent.data };
        const props = { ...(data.props || {}) };
        if (parent.type === 'ColumnsContainer') {
          const cols = (props.columns || []).map((c, i) => {
            if (i !== columnIdx) return c;
            const ids = [...(c.childrenIds || [])];
            const clamped = Math.max(0, Math.min(index, ids.length));
            ids.splice(clamped, 0, blockId);
            return { ...c, childrenIds: ids };
          });
          props.columns = cols;
        } else {
          const ids = [...(props.childrenIds || [])];
          const clamped = Math.max(0, Math.min(index, ids.length));
          ids.splice(clamped, 0, blockId);
          props.childrenIds = ids;
        }
        data.props = props;
        doc[parentId] = { ...parent, data };
      }
    };

    removeFrom(src.parentId, src.columnIdx);
    // After removal, the index inside the same parent shifts left if we removed
    // an earlier sibling. Adjust before inserting.
    let targetIndex = target.index;
    if (src.parentId === target.parentId && src.columnIdx === target.columnIdx && src.index < target.index) {
      targetIndex = target.index - 1;
    }
    insertInto(target.parentId, target.columnIdx, targetIndex);
    return { emailDocument: doc };
    });
  },

  // Drop a brand-new component (from the panel) at a specific spot.
  insertNewBlock: (type, target) => {
    get()._pushEmailHistory();
    return set(s => {
    if (!s.emailDocument) return {};
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = createBlockTree(type, genId);
    if (!tree) return {};
    const doc = { ...s.emailDocument, ...tree.blocks };
    if (target.parentId === 'root') {
      const ids = [...doc.root.data.childrenIds];
      const clamped = Math.max(0, Math.min(target.index, ids.length));
      ids.splice(clamped, 0, tree.rootId);
      doc.root = { ...doc.root, data: { ...doc.root.data, childrenIds: ids } };
    } else {
      const parent = doc[target.parentId];
      if (!parent) return {};
      const data = { ...parent.data };
      const props = { ...(data.props || {}) };
      if (parent.type === 'ColumnsContainer') {
        const cols = (props.columns || []).map((c, i) => {
          if (i !== target.columnIdx) return c;
          const ids = [...(c.childrenIds || [])];
          const clamped = Math.max(0, Math.min(target.index, ids.length));
          ids.splice(clamped, 0, tree.rootId);
          return { ...c, childrenIds: ids };
        });
        props.columns = cols;
      } else {
        const ids = [...(props.childrenIds || [])];
        const clamped = Math.max(0, Math.min(target.index, ids.length));
        ids.splice(clamped, 0, tree.rootId);
        props.childrenIds = ids;
      }
      data.props = props;
      doc[target.parentId] = { ...parent, data };
    }
    return { emailDocument: doc, selectedBlockId: tree.rootId };
    });
  },

  duplicateBlock: (id) => {
    get()._pushEmailHistory();
    return set(s => {
    if (!s.emailDocument || !s.emailDocument[id]) return {};
    const map = buildParentMap(s.emailDocument);
    const slot = map[id];
    if (!slot) return {};
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = cloneBlockTree(s.emailDocument, id, genId);
    if (!tree) return {};
    const doc = { ...s.emailDocument, ...tree.blocks };
    if (slot.parentId === 'root') {
      const ids = [...doc.root.data.childrenIds];
      ids.splice(slot.index + 1, 0, tree.rootId);
      doc.root = { ...doc.root, data: { ...doc.root.data, childrenIds: ids } };
    } else {
      const parent = doc[slot.parentId];
      const data = { ...parent.data };
      const props = { ...(data.props || {}) };
      if (parent.type === 'ColumnsContainer') {
        const cols = (props.columns || []).map((c, i) => {
          if (i !== slot.columnIdx) return c;
          const ids = [...(c.childrenIds || [])];
          ids.splice(slot.index + 1, 0, tree.rootId);
          return { ...c, childrenIds: ids };
        });
        props.columns = cols;
      } else {
        const ids = [...(props.childrenIds || [])];
        ids.splice(slot.index + 1, 0, tree.rootId);
        props.childrenIds = ids;
      }
      data.props = props;
      doc[slot.parentId] = { ...parent, data };
    }
    return { emailDocument: doc, selectedBlockId: tree.rootId };
    });
  },

  moveBlockUp: (id) => {
    const s = get();
    if (!s.emailDocument) return;
    const map = buildParentMap(s.emailDocument);
    const slot = map[id];
    if (!slot || slot.index === 0) return;
    s.moveBlock(id, { parentId: slot.parentId, columnIdx: slot.columnIdx, index: slot.index - 1 });
  },

  // Select the parent of the given block (root if no parent). Mirrors the
  // Shift+Enter keyboard shortcut so the block-toolbar button and the
  // keyboard surface a single behavior.
  selectParentBlock: (id) => {
    const s = get();
    if (!s.emailDocument || id === 'root') return;
    const map = buildParentMap(s.emailDocument);
    const parentId = map[id]?.parentId;
    if (parentId) s.setSelectedBlockId(parentId);
  },

  removeBlock: (id) => {
    const blockType = get().emailDocument?.[id]?.type || null;
    track('email.block_removed', { blockType });
    get()._pushEmailHistory();
    return set(s => {
      if (!s.emailDocument || id === 'root' || !s.emailDocument[id]) return {};
    const doc = { ...s.emailDocument };
    const map = buildParentMap(doc);
    const slot = map[id];
    const toRemove = collectBlockTree(doc, id);
    toRemove.forEach(bid => { delete doc[bid]; });
    if (slot && slot.parentId !== 'root') {
      const parent = doc[slot.parentId];
      if (parent) {
        const data = { ...parent.data };
        const props = { ...(data.props || {}) };
        if (slot.columnIdx != null && Array.isArray(props.columns)) {
          props.columns = props.columns.map((c, i) => i === slot.columnIdx
            ? { ...c, childrenIds: (c.childrenIds || []).filter(cid => cid !== id) }
            : c
          );
        } else if (Array.isArray(props.childrenIds)) {
          props.childrenIds = props.childrenIds.filter(cid => cid !== id);
        }
        data.props = props;
        doc[slot.parentId] = { ...parent, data };
      }
    } else {
      doc.root = {
        ...doc.root,
        data: { ...doc.root.data, childrenIds: (doc.root.data.childrenIds || []).filter(c => c !== id) },
      };
    }
    return {
      emailDocument: doc,
      selectedBlockId: s.selectedBlockId === id ? 'root' : s.selectedBlockId,
    };
    });
  },

  // ── Tasks ──
  tasks: [],
  tasksLoading: true,
  tasksTab: 'all',
  tasksFilters: {},
  showTasksFilterBar: true,
  tasksViewMode: 'list',

  setTasksTab: (tab) => set({ tasksTab: tab }),
  setTasksViewMode: (mode) => set({ tasksViewMode: mode }),
  toggleTasksFilterBar: () => set(s => ({ showTasksFilterBar: !s.showTasksFilterBar })),
  setTasksFilter: (key, value) => {
    const filters = { ...get().tasksFilters };
    if (value == null) delete filters[key];
    else filters[key] = value;
    set({ tasksFilters: filters });
  },
  clearTasksFilters: () => set({ tasksFilters: {} }),

  fetchTasks: async () => {
    set({ tasksLoading: true });
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Tasks fetch error:', error.message);
      const localHedisTasks = get().tasks.filter(t => t.hedisMemberId);
      set({ tasks: [...localHedisTasks], tasksLoading: false });
      return;
    }

    // Auto-mark overdue pending tasks as missed
    const now = (data || []).map(t => {
      if (t.status === 'pending' && isPastDate(t.due_date)) {
        return { ...t, status: 'missed', due_missed: true };
      }
      if (t.status === 'completed' && t.due_missed) {
        return { ...t, due_missed: false };
      }
      return t;
    });
    const overdueIds = (data || [])
      .filter((t, i) => now[i] !== t && now[i].status === 'missed')
      .map(t => t.id);
    if (overdueIds.length > 0) {
      await supabase.from('tasks')
        .update({ status: 'missed', due_missed: true, updated_at: new Date().toISOString() })
        .in('id', overdueIds);
    }

    // Preserve any locally-created HEDIS sign-off tasks (prototype only —
    // they aren't persisted to supabase yet). Without this, navigating to
    // Tasks after a Submit-for-Review would wipe them out.
    const localHedisTasks = get().tasks.filter(t => t.hedisMemberId && !now.some(n => n.id === t.id));
    set({ tasks: [...localHedisTasks, ...now], tasksLoading: false });
  },

  createTask: async (task) => {
    track('task.created', { taskId: task?.id, taskType: task?.type || null });
    const normalized = { ...task };
    if (normalized.status === 'pending' && isPastDate(normalized.due_date)) {
      normalized.status = 'missed';
      normalized.due_missed = true;
    } else if (normalized.status === 'missed') {
      normalized.due_missed = true;
    }
    if (normalized.status === 'completed' && !normalized.completed_at) {
      normalized.completed_at = new Date().toISOString();
    }
    const tempId = Date.now();
    const optimistic = { ...normalized, id: tempId };
    set(s => ({ tasks: [...s.tasks, optimistic] }));

    // Try insert with full schema; if fails due to missing column, retry with reduced payload
    let { data, error } = await supabase.from('tasks').insert(normalized).select().single();
    if (error && /column .* does not exist|schema cache/.test(error.message || '')) {
      const { parent_task_id, pool, mentions, completed_at, description, assigned_to_id, created_by_id, ...legacy } = normalized;
      ({ data, error } = await supabase.from('tasks').insert(legacy).select().single());
    }
    if (error) {
      console.error('Create task error:', error);
      set(s => ({ tasks: s.tasks.filter(t => t.id !== tempId) }));
      return null;
    }
    // Merge full payload back so UI keeps client-side fields even if DB ignored them
    const final = { ...normalized, ...data };
    set(s => ({ tasks: s.tasks.map(t => t.id === tempId ? final : t) }));
    get().logTaskAudit(final.id, 'created', { to: final.name });
    return final;
  },

  updateTask: async (id, updates) => {
    track('task.updated', { taskId: id });
    const prev = get().tasks.find(t => t.id === id);
    const merged = { ...(prev || {}), ...updates };
    const final = { ...updates };

    const overdue = isPastDate(merged.due_date);

    if ('status' in updates) {
      if (updates.status === 'completed') {
        final.due_missed = false;
        final.completed_at = new Date().toISOString();
      } else if (updates.status === 'missed') {
        final.due_missed = true;
        final.completed_at = null;
      } else if (updates.status === 'pending') {
        if (overdue) {
          final.status = 'missed';
          final.due_missed = true;
        } else {
          final.due_missed = false;
        }
        final.completed_at = null;
      }
    }
    if ('due_date' in updates && !('status' in updates) && merged.status !== 'completed') {
      if (overdue && merged.status !== 'missed') {
        final.status = 'missed';
        final.due_missed = true;
      } else if (!overdue && merged.status === 'missed') {
        final.status = 'pending';
        final.due_missed = false;
      }
    }

    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...final } : t) }));

    // Try DB update; gracefully retry without unknown columns
    let { error } = await supabase.from('tasks').update({ ...final, updated_at: new Date().toISOString() }).eq('id', id);
    if (error && /column .* does not exist|schema cache/.test(error.message || '')) {
      const { parent_task_id, pool, mentions, completed_at, description, assigned_to_id, created_by_id, ...legacy } = final;
      ({ error } = await supabase.from('tasks').update({ ...legacy, updated_at: new Date().toISOString() }).eq('id', id));
    }
    if (error) {
      console.warn('Update task error (optimistic update kept):', error.message);
    }

    // Audit logging
    if (prev) {
      Object.entries(updates).forEach(([key, val]) => {
        if (prev[key] === val) return;
        if (key === 'status') {
          get().logTaskAudit(id, 'status_changed', { field: 'status', from: prev.status, to: final.status });
        } else if (key === 'priority') {
          get().logTaskAudit(id, 'priority_changed', { field: 'priority', from: prev.priority, to: val });
        } else if (key === 'due_date') {
          get().logTaskAudit(id, 'due_date_changed', { field: 'due_date', from: prev.due_date || '(none)', to: val || '(none)' });
        } else if (key === 'assigned_to') {
          get().logTaskAudit(id, 'assignee_changed', { field: 'assigned_to', from: prev.assigned_to || '(unassigned)', to: val || '(unassigned)' });
        } else if (key === 'labels') {
          const oldL = prev.labels || []; const newL = val || [];
          const added = newL.filter(l => !oldL.includes(l));
          const removed = oldL.filter(l => !newL.includes(l));
          added.forEach(l => get().logTaskAudit(id, 'label_added', { field: 'labels', to: l }));
          removed.forEach(l => get().logTaskAudit(id, 'label_removed', { field: 'labels', from: l }));
        } else if (key === 'description' || key === 'meta') {
          get().logTaskAudit(id, 'description_changed', { field: 'description' });
        } else if (key === 'name') {
          get().logTaskAudit(id, 'renamed', { field: 'name', from: prev.name, to: val });
        }
      });
    }

    return true;
  },

  deleteTask: async (id) => {
    track('task.deleted', { taskId: id });
    const prev = get().tasks;
    // Cascade-delete subtasks locally too
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id && t.parent_task_id !== id) }));
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Delete task error:', error);
      set({ tasks: prev });
      return false;
    }
    get().logTaskAudit(id, 'deleted');
    return true;
  },

  // ── Task Profiles (assignees from Settings → Users / profiles table) ──
  taskProfiles: [],
  currentUserProfile: null,
  // Display name to stamp on things the signed-in user just did (activity
  // entries, audit lines). `currentUserProfile` only resolves once
  // fetchTaskProfiles has run against a real session, so fall back to the
  // same 'You' label the rest of the store uses in dev-bypass mode.
  currentActorName: () => get().currentUserProfile?.name || 'You',
  fetchTaskProfiles: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .order('full_name', { ascending: true });
    if (error || !data || data.length === 0) {
      set({ taskProfiles: [] });
      return;
    }
    const profiles = data.map(p => ({
      id: p.id,
      name: (p.full_name || p.email?.split('@')[0] || 'Unknown').trim(),
      email: p.email || '',
    }));
    let me = null;
    if (authUser) {
      me = profiles.find(p => p.id === authUser.id)
        || profiles.find(p => p.email && authUser.email && p.email.toLowerCase() === authUser.email.toLowerCase())
        || null;
      if (!me) {
        const meta = authUser.user_metadata || {};
        const meName = (meta.full_name || meta.first_name || authUser.email?.split('@')[0] || '').trim();
        if (meName) me = { id: authUser.id, name: meName, email: authUser.email || '' };
      }
    }
    set({ taskProfiles: profiles, currentUserProfile: me });
    // If the HCC worklist already applied a role-scoped default filter using a
    // dev-fallback (or nothing at all), backfill it once the real user profile
    // is known so the "logged-in user's queue" default actually takes effect.
    const cur = get();
    if (me?.name && cur.activeSubnavList === 'HCC' && cur.hccFilters) {
      const currentAsgn = cur.hccFilters.asgn;
      const needsUpdate = !currentAsgn || currentAsgn.length !== 1 || currentAsgn[0] !== me.name;
      if (needsUpdate) set({ hccFilters: { ...cur.hccFilters, asgn: [me.name] } });
    }
  },

  // ── Task Labels (custom labels stored in DB) ──
  taskLabels: [],
  fetchTaskLabels: async () => {
    const { data, error } = await supabase
      .from('task_labels')
      .select('name')
      .order('name', { ascending: true });
    if (error) {
      console.warn('task_labels fetch failed (run migration?):', error.message);
      set({ taskLabels: ['Hypertension', 'Exercise', 'Document Collection', 'Medication', 'Diabetes', 'Follow-up'] });
      return;
    }
    set({ taskLabels: (data || []).map(l => l.name) });
  },
  createTaskLabel: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    track('task.label_created', { label: trimmed });
    set(s => s.taskLabels.includes(trimmed) ? s : { taskLabels: [...s.taskLabels, trimmed].sort() });
    const { error } = await supabase.from('task_labels').insert({ name: trimmed });
    if (error && error.code !== '23505') {
      console.error('Create label error:', error.message);
    }
    return trimmed;
  },

  // ── Task Pools ──
  taskPools: [
    { name: 'Patient Outreach', description: 'Tasks queued for patient outreach team to claim' },
    { name: 'Care Management', description: 'Care management workflows awaiting clinical staff' },
    { name: 'Documentation', description: 'Chart review and documentation tasks' },
    { name: 'Follow-up', description: 'Post-visit follow-up tasks awaiting assignment' },
  ],
  fetchTaskPools: async () => {
    const { data, error } = await supabase.from('task_pools').select('name, description').order('name');
    if (!error && data && data.length > 0) {
      set({ taskPools: data });
    }
  },
  claimTask: async (taskId) => {
    track('task.claimed', { taskId });
    const me = get().currentUserProfile;
    const claimer = me?.name || 'Current User';
    const claimerId = me?.id || null;
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return false;
    set(s => ({ tasks: s.tasks.map(t => t.id === taskId
      ? { ...t, assigned_to: claimer, assigned_to_id: claimerId, pool: null }
      : t) }));
    const fullPayload = { assigned_to: claimer, assigned_to_id: claimerId, pool: null, updated_at: new Date().toISOString() };
    let { error } = await supabase.from('tasks').update(fullPayload).eq('id', taskId);
    if (error && /column .* does not exist|schema cache/.test(error.message || '')) {
      const { assigned_to_id, pool, ...legacy } = fullPayload;
      ({ error } = await supabase.from('tasks').update(legacy).eq('id', taskId));
    }
    if (error) console.warn('Claim task error:', error.message);
    get().logTaskAudit(taskId, 'claimed', { field: 'assigned_to', from: '(unassigned)', to: claimer });
    return true;
  },

  // ── Task Audit Log ──
  taskAuditLogs: {}, // keyed by task_id → array of log entries

  fetchTaskAuditLog: async (taskId) => {
    if (!taskId) return [];
    const { data, error } = await supabase
      .from('task_audit_log')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('task_audit_log fetch failed (run migration?):', error.message);
      return get().taskAuditLogs[taskId] || [];
    }
    set(s => ({ taskAuditLogs: { ...s.taskAuditLogs, [taskId]: data || [] } }));
    return data || [];
  },

  logTaskAudit: async (taskId, actionType, opts = {}) => {
    if (!taskId) return;
    const me = get().currentUserProfile;
    const entry = {
      task_id: taskId,
      user_name: me?.name || 'System',
      user_id: me?.id || null,
      action_type: actionType,
      field_name: opts.field || null,
      from_value: opts.from != null ? String(opts.from) : null,
      to_value: opts.to != null ? String(opts.to) : null,
      created_at: new Date().toISOString(),
    };
    set(s => {
      const existing = s.taskAuditLogs[taskId] || [];
      return { taskAuditLogs: { ...s.taskAuditLogs, [taskId]: [{ ...entry, id: `local-${Date.now()}-${Math.random()}` }, ...existing] } };
    });
    const { error } = await supabase.from('task_audit_log').insert(entry);
    if (error && error.code !== 'PGRST204') {
      // Silently swallow if table missing; warn otherwise
      if (!error.message?.includes('task_audit_log') && !error.message?.includes('schema cache')) {
        console.warn('Audit log persist failed:', error.message);
      }
    }
  },
}));

// Dev-only: expose the store on window so the preview harness can read /
// drive state without spinning up its own module instance. Vite serves the
// store under both `useAppStore.js` and `useAppStore.js?t=NNN`, which would
// otherwise create two independent stores; this lets the harness reach the
// same one the React tree uses.
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__APP_STORE__ = useAppStore;
}
