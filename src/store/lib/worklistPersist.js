import { supabase } from '../../lib/supabase';
import { addedChartToRow } from '../../lib/hccAddedChartsMapper';
import { reportPersistFailure } from './reportPersistFailure';

// Persist a per-(ICD × DOS) coder action to hcc_gap_dos_actions. The
// row key is deterministic (`${member}|${code}|${dos}`) so the same
// helper handles both first-write inserts and subsequent updates via
// upsert. Fire-and-forget, the store already updated optimistically.
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
// Clear a DOS-action row entirely: used when the user toggles the same
// action off (undo) or after a manual ICD is deleted (its DOS rows go
// with it).
function persistHccGapDosActionDelete(memberName, code, dos) {
  if (!memberName || !code || !dos) return;
  supabase
    .from('hcc_gap_dos_actions')
    .delete()
    .eq('id', dosActionRowKey(memberName, code, dos))
    .then(({ error }) => {
      // No .select() here: deleting a row that doesn't exist is a no-op,
      // not a failure (undo of an action never persisted).
      if (error) reportPersistFailure(`persistHccGapDosActionDelete(${code}|${dos})`, error);
    });
}
// Wipe every DOS-action row scoped to a deleted manual ICD, mirrors the
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

// Persist an ICD-level state change to hcc_diagnosis_gaps by code + member.
// The store mutates optimistically; this fire-and-forget round-trip keeps
// the DB in sync so the change survives reload. Scoped by (code, member_name)
// to prevent cross-tenant mutation when two tenants share an ICD code.
function persistHccGapUpdate(code, memberName, patch) {
  if (!code || !memberName) return;
  supabase.from('hcc_diagnosis_gaps').update(patch)
    .eq('code', code)
    .eq('member_name', memberName)
    .select('code')
    .then(({ data, error }) => {
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
// Fire-and-forget insert: the local state is already updated optimistically;
// a failed write is surfaced through the shared persist-failure toast.
function persistCaregapActivityInsert(memberId, entry) {
  if (!memberId || !entry?.id) return;
  supabase.from('caregap_activity').insert(caregapActivityToRow(memberId, entry)).then(({ error }) => {
    if (error) reportPersistFailure(`persistCaregapActivityInsert(${entry.id})`, error);
  });
}
// Write the member's whole gaps array back to hedis_members.gaps after a
// local gap mutation (status / assignee). Replace-whole mirrors the local
// shape: gap objects carry {code,status,assignee,…}. Fire-and-forget; the
// affected-rows check catches mock-fallback members that were never in the DB.
function persistHedisGaps(memberId, gaps) {
  if (!memberId) return;
  supabase
    .from('hedis_members')
    .update({ gaps: gaps || [] })
    .eq('id', memberId)
    .select('id')
    .then(({ data, error }) => {
      if (error) return reportPersistFailure(`persistHedisGaps(${memberId})`, error);
      if (!data || data.length === 0) reportPersistFailure(`persistHedisGaps(${memberId})`, { message: 'affected 0 rows (member not in Supabase: mock fallback?)' });
    });
}
// SNP worklist row updates: one helper for both mutation paths (status +
// assignee). Fire-and-forget; the local state is updated optimistically
// before we call this, and a failed write reports through the shared toast.
// The affected-rows sanity check catches an id that isn't in Supabase yet
// (e.g. the mock-fallback path where the store never fetched from the DB).
function persistSnpMemberUpdate(id, patch) {
  if (!id || !patch || Object.keys(patch).length === 0) return;
  supabase
    .from('snp_worklist_members')
    .update(patch)
    .eq('id', id)
    .select('id')
    .then(({ data, error }) => {
      if (error) return reportPersistFailure(`persistSnpMemberUpdate(${id})`, error);
      if (!data || data.length === 0) {
        reportPersistFailure(`persistSnpMemberUpdate(${id})`, { message: 'affected 0 rows' });
      }
    });
}

// The SNP program + care plan are the single source of truth for the worklist's
// Program Sub Status, Care Plan Status, and Assignee columns. These helpers
// derive the worklist labels from that source so the two never drift.
//
// Care Plan Status is derived from the plan row alone (cheap enough for the
// bulk worklist projection). A paused plan reads On Hold whether or not it was
// signed. "In Review", which needs the plan's audit log, stays a
// program-view-only distinction.
function snpCarePlanStatusLabel(plan) {
  if (!plan) return 'No Care Plan';
  if (plan.status === 'paused') return 'On Hold';
  return plan.signed_at ? 'Signed' : 'Draft';
}
// The pause behind an On Hold plan, in the carePlanPause shape (pauseSummary).
function snpCarePlanPause(plan) {
  if (plan?.status !== 'paused') return null;
  return {
    reason: plan.pause_reason || 'other',
    note: plan.pause_note || '',
    pausedOn: plan.paused_on || null,
    resumeOn: plan.resume_on || null,
    autoResume: !!plan.auto_resume,
  };
}
const snpInitialsFromName = (name) =>
  (name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
// A program assignee is a plain name string ("Unassigned" when none). Normalize
// it to the worklist's { name, initials } shape (null when unassigned).
function snpAssigneeFromProgram(assignee) {
  const name = assignee && assignee !== 'Unassigned' ? assignee : null;
  return { assigneeName: name, assigneeInitials: name ? snpInitialsFromName(name) : null };
}

// Overlay each worklist row with its SNP program + care plan status, so those
// three columns project the single source of truth. Two bulk queries keyed by
// patient_id / program_id; rows without a resolvable SNP program keep the
// snapshot they came in with. `programId` is stamped on so worklist-side edits
// know which program row to write back to.
async function projectSnpProgramState(rows) {
  const patientIds = [...new Set(rows.map(r => r.patientId).filter(Boolean))];
  if (!patientIds.length) return rows;
  const { data: progs, error: progErr } = await supabase
    .from('patient_care_programs')
    .select('id, patient_id, status, assignee, created_at')
    .eq('code', 'SNP')
    .in('patient_id', patientIds)
    .order('created_at', { ascending: true });
  if (progErr || !progs?.length) return rows;

  // Latest SNP enrollment per patient (rows are created_at-ascending, so the
  // last one seen wins).
  const progByPatient = new Map();
  progs.forEach(p => progByPatient.set(p.patient_id, p));
  const progIds = [...progByPatient.values()].map(p => p.id);

  const planByProgram = new Map();
  if (progIds.length) {
    const { data: plans } = await supabase
      .from('patient_care_plans')
      .select('program_id, signed_at, status, pause_reason, pause_note, paused_on, resume_on, auto_resume')
      .in('program_id', progIds);
    (plans || []).forEach(pl => planByProgram.set(pl.program_id, pl));
  }

  // Tasks created inside the SNP program, tallied per patient. `tasks` are
  // tagged by program_code (not a specific enrollment), so this is the count
  // for the patient's SNP program as a whole, what the Tasks column shows.
  const taskCountByPatient = new Map();
  const { data: taskRows } = await supabase
    .from('tasks')
    .select('patient_id')
    .eq('program_code', 'SNP')
    .in('patient_id', patientIds);
  (taskRows || []).forEach(t => {
    taskCountByPatient.set(t.patient_id, (taskCountByPatient.get(t.patient_id) || 0) + 1);
  });

  return rows.map(row => {
    const prog = row.patientId ? progByPatient.get(row.patientId) : null;
    if (!prog) return row;
    return {
      ...row,
      programId:        prog.id,
      programSubStatus: prog.status || row.programSubStatus,
      carePlanStatus:   snpCarePlanStatusLabel(planByProgram.get(prog.id)),
      carePlanPause:    snpCarePlanPause(planByProgram.get(prog.id)),
      taskCount:        taskCountByPatient.get(row.patientId) || 0,
      assigneeId:       null,
      assigneeRole:     null,
      ...snpAssigneeFromProgram(prog.assignee),
    };
  });
}

// Write a worklist-initiated status/assignee edit through to the SNP care
// program (the source of truth), and mirror it into a loaded program slice so
// an open program view reflects it immediately. `patch` keys (status, assignee)
// match both the in-memory program shape and the DB columns.
function writeSnpProgramField(get, set, member, patch) {
  const { programId, patientId } = member;
  if (!programId) return;
  const now = new Date();
  const stamp = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
  if (patientId && get().careProgramsByPatient[patientId]) {
    set(s => ({
      careProgramsByPatient: {
        ...s.careProgramsByPatient,
        [patientId]: (s.careProgramsByPatient[patientId] || []).map(p =>
          p.id === programId ? { ...p, ...patch, lastUpdated: stamp } : p,
        ),
      },
    }));
  }
  supabase.from('patient_care_programs')
    .update({ ...patch, last_updated: stamp })
    .eq('id', programId)
    .then(({ error }) => { if (error) reportPersistFailure(`writeSnpProgramField(${programId})`, error); });
}
function persistHccGapDelete(code, memberName) {
  if (!code) return;
  let q = supabase.from('hcc_diagnosis_gaps').delete().eq('code', code);
  if (memberName) q = q.eq('member_name', memberName);
  q.then(({ error }) => {
    // 0-row delete is fine (already gone / never persisted): don't flag it.
    if (error) reportPersistFailure(`persistHccGapDelete(${code})`, error);
  });
}

// Insert a spawned hcc_members row. Called from addHccGapNewRow when a
// New Diagnosis Gap picks a DOS that doesn't exist for the patient: the
// app materializes the encounter as its own worklist row so the DOS can
// carry its own workflow state, and this makes the row survive reload.
// Fire-and-forget; failures log a warning without rolling back the state
// change (the row still shows in-session).
//
// The app reads hcc_members plus its normalized child tables
// (hcc_member_visits / hcc_member_documents) and rebuilds the legacy
// fat-row shape in fetchHccMembers. The base table has no age,
// dos_list, or doc_status columns, writing those here failed outright
// (PGRST204), so spawned rows never persisted. Scalar fields go to
// hcc_members; DOS entries are seeded into hcc_member_visits.
function persistHccMemberInsert(m) {
  if (!m?.id) return;
  const dbRow = {
    id: m.id,
    // id and member_id are the same Fold ID now (unified identity scheme,
    // see supabase/patient_id_unification_migration.sql), not the source
    // patient's old payer id.
    member_id: m.id,
    name: m.name,
    initials: m.in,
    gender: m.g,
    current_visit: m.cv,
    total_visits: m.tv,
    visit_type: m.visitType || m.vt,
    rendering_provider: m.rp,
    open_icds: m.open,
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
    if (error) return reportPersistFailure(`persistHccMemberInsert(${m.id})`, error);
    // Seed the normalized DOS rows so fetchHccMembers rebuilds dos_list
    // after a reload.
    const visits = (m.dos_list || []).map((d, i) => ({
      member_id: m.id,
      dos_date: toPgDate(d.date),
      status_label: d.label ?? null,
      status_color: d.labelColor ?? null,
      visit_index: i,
    }));
    if (!visits.length) return;
    supabase.from('hcc_member_visits').insert(visits).then(({ error: vErr }) => {
      if (vErr) reportPersistFailure(`persistHccMemberInsert.visits(${m.id})`, vErr);
    });
  });
}

// Accepts 'YYYY-MM-DD' (what SelectNewDosPopover emits) or 'MM/DD/YYYY'
// (legacy in-memory dos entries) and returns a Postgres date literal.
function toPgDate(d) {
  const s = String(d || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// Persist a member's dos_list / docStatus / chart_count mutations to
// Supabase. hccCreateOrMergeFromEncounter appends new DOS rows and stamps
// other member-level metadata; without this write those mutations reverted
// on reload. Fire-and-forget.
//
// Reads assemble dos_list from hcc_member_visits and doc_status from
// hcc_member_documents (see fetchHccMembers): the base table has no such
// columns, so each shape is synced into its child table
// (replace-all per member; entries carry no identity beyond position).
//
// Operations are chained sequentially so a failure in one phase (e.g.
// insert after delete committed) is detected and surfaced via
// reportPersistFailure instead of silently orphaning the row.
function persistHccMemberDetails(memberId, member) {
  if (!memberId || !member) return;
  const m = member;

  // 1) Base row counters
  supabase
    .from('hcc_members')
    .update({ chart_count: m.ch ?? null, open_icds: m.open ?? null })
    .eq('id', memberId)
    .select('id')
    .then(({ data, error }) => {
      if (error) return reportPersistFailure(`persistHccMemberDetails(${memberId})`, error);
      if (!data || data.length === 0) {
        reportPersistFailure(`persistHccMemberDetails(${memberId})`, { message: 'affected 0 rows (spawned row never persisted?)' });
        return;
      }

      // 2) DOS list → hcc_member_visits (replace-all, sequential after base succeeds)
      supabase
        .from('hcc_member_visits')
        .delete()
        .eq('member_id', memberId)
        .then(({ error: delErr }) => {
          if (delErr) return reportPersistFailure(`persistHccMemberDetails.visits.delete(${memberId})`, delErr);
          const visits = (m.dos_list || []).map((d, i) => ({
            member_id: memberId,
            dos_date: toPgDate(d.date),
            status_label: d.label ?? null,
            status_color: d.labelColor ?? null,
            visit_index: i,
          }));
          if (!visits.length) return syncDocs();
          supabase.from('hcc_member_visits').insert(visits).then(({ error: insErr }) => {
            if (insErr) reportPersistFailure(`persistHccMemberDetails.visits.insert(${memberId})`, insErr);
            syncDocs();
          });
        });
    });

  // 3) Doc status → hcc_member_documents (replace-all).
  // Called after visits settle so any earlier failure is already surfaced.
  function syncDocs() {
    supabase
      .from('hcc_member_documents')
      .delete()
      .eq('member_id', memberId)
      .then(({ error }) => {
        if (error) return reportPersistFailure(`persistHccMemberDetails.docs.delete(${memberId})`, error);
        const docs = (m.docStatus || []).map((status, i) => ({
          member_id: memberId,
          doc_index: i,
          status,
        }));
        if (!docs.length) return;
        supabase.from('hcc_member_documents').insert(docs).then(({ error: insErr }) => {
          if (insErr) reportPersistFailure(`persistHccMemberDetails.docs.insert(${memberId})`, insErr);
        });
      });
  }
}

// Persist a single HCC role's status (and optionally name) to Supabase.
// Fire-and-forget: failures log a warning without rolling back the
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
// shape as makeActivityRow(): see src/features/hcc/activityLog.js.
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
// so a refresh (or another reviewer) sees the same content. Fire-and-forget,
// the composer already updated local state optimistically.
function persistHccDiagComment(row) {
  if (!row?.id) return;
  const base = {
    id: row.id,
    author: row.author,
    role: row.role,
    date: row.date,
    time: row.time,
    edited: !!row.edited,
    body: row.body,
    // Scope columns added in supabase/hcc_diag_comment_scope_migration.sql.
    icd: row.icd ?? null,
    dos: row.dos ?? null,
    // Status-transition context: added in
    // supabase/hcc_diag_comment_status_migration.sql. Set when a coder
    // flips a DOS to a status that requires a mandatory comment
    // (currently "Record Requested").
    status_from: row.statusFrom ?? null,
    status_to:   row.statusTo   ?? null,
  };
  // Authorship + mentions: hcc_diag_comment_author_migration.sql. The DB
  // trigger re-stamps author/author_id from the session; mention_ids drives
  // the recipient notifications. Only real profile ids reach the uuid[].
  const attribution = {
    author_id:   row.authorId ?? null,
    mention_ids: row.mentionIds?.length ? row.mentionIds : null,
  };
  const insert = (payload) => supabase.from('hcc_diag_comments').insert(payload);
  insert({ ...base, ...attribution, hcc_member_id: row.memberId ?? null })
    .then(({ error }) => {
      // On a database that hasn't run a later migration yet, retry without the
      // missing columns so the comment itself isn't lost.
      if (error && /author_id|mention_ids/.test(error.message || '')) {
        return insert({ ...base, hcc_member_id: row.memberId ?? null });
      }
      if (error && /hcc_member_id/.test(error.message || '')) return insert(base);
      return { error };
    })
    .then(({ error } = {}) => {
      if (error) reportPersistFailure(`persistHccDiagComment(${row.id})`, error);
    });
}

function persistHccDiagCommentUpdate(row) {
  if (!row?.id) return;
  const patch = { body: row.body, edited: true };
  // Replace the mention set only when the editor supplied one; an update of
  // mention_ids is what lets the DB trigger notify newly added people.
  if (Array.isArray(row.mentionIds)) patch.mention_ids = row.mentionIds.length ? row.mentionIds : null;
  supabase
    .from('hcc_diag_comments')
    .update(patch)
    .eq('id', row.id)
    .select('id')
    .then(({ data, error }) => {
      if (error) return reportPersistFailure(`persistHccDiagCommentUpdate(${row.id})`, error);
      // RLS scopes updates to the author, so 0 rows means "not yours" (or gone).
      if (!data || data.length === 0) reportPersistFailure(`persistHccDiagCommentUpdate(${row.id})`, { message: 'affected 0 rows (not the author, or comment removed)' });
    });
}

function persistHccDiagCommentDelete(id) {
  if (!id) return;
  supabase
    .from('hcc_diag_comments')
    .delete()
    .eq('id', id)
    .select('id')
    .then(({ data, error }) => {
      if (error) return reportPersistFailure(`persistHccDiagCommentDelete(${id})`, error);
      // An RLS-blocked delete is not an error, just 0 rows; surface it so the
      // optimistic removal doesn't silently reappear on reload.
      if (!data || data.length === 0) reportPersistFailure(`persistHccDiagCommentDelete(${id})`, { message: 'affected 0 rows (not the author, or already removed)' });
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

export {
  dosActionRowKey,
  persistHccGapDosAction,
  persistHccGapDosActionDelete,
  persistHccGapDosActionDeleteAll,
  persistHccGapUpdate,
  persistHccGapInsert,
  caregapActivityToRow,
  caregapRowToEntry,
  persistCaregapActivityInsert,
  persistHedisGaps,
  persistSnpMemberUpdate,
  projectSnpProgramState,
  writeSnpProgramField,
  snpCarePlanStatusLabel,
  persistHccGapDelete,
  persistHccMemberInsert,
  toPgDate,
  persistHccMemberDetails,
  persistHccMemberRoleStatus,
  persistHccActivityRow,
  snpAssigneeFromProgram,
  persistHccDiagComment,
  persistHccDiagCommentUpdate,
  persistHccDiagCommentDelete,
  persistHccDiagNote,
  persistHccDiagDocument,
};
