// Care Plan History as one timeline, newest first, in the shape the shared
// ActivityLog renders:
//
//   • version  - a signature. Its rows are what the version changed in the
//                plan's structure and details (items added or removed, links,
//                templates, conditions, Edit-drawer fields), in audit-row
//                shape so the version card and the changes drawer read them
//                like any other audit trail. Versions with full snapshots are
//                diffed snapshot to snapshot, so an edit undone before signing
//                or a discarded draft never shows; older ones fall back to the
//                audit rows written between the two signatures.
//   • unsigned - the same, for the draft waiting to be signed.
//   • activity - progress on the signed plan, which needs no signature
//                (status, priority, progress, renames, assignee, schedule),
//                plus notes, readings and plan events. Each carries the version
//                that was current when it happened.

import { buildCarePlanSnapshot, diffCarePlanSnapshots, isFullSnapshot, uniqueById } from './carePlanDraft';
import { NOTE_ACTIONS } from './carePlanVersions';
import { templateTitles } from './carePlanAuditTemplates';

/** Activity types the History filter offers, in display order. */
export const HISTORY_TYPES = [
  { key: 'version', label: 'Signed versions' },
  { key: 'status', label: 'Status updates' },
  { key: 'priority', label: 'Priority updates' },
  { key: 'progress', label: 'Progress & adherence' },
  { key: 'title', label: 'Renames' },
  { key: 'assignment', label: 'Assignee & schedule' },
  { key: 'care_note', label: 'Care notes' },
  { key: 'item_note', label: 'Goal & item notes' },
  { key: 'value', label: 'Value entries' },
  { key: 'plan_event', label: 'Review, share & discard' },
];

const NOUN = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier' };
const SCHEDULE_DETAIL = /^(Due Date|Repeat|Repeat Count|Repeats Every|Repeat Unit|Repeat Ends|Repeat Ends Unit):/;
const PLAN_EVENT_ACTIONS = new Set(['review_requested', 'shared', 'discarded', 'restored']);

/** The activity type of an audit row that records live progress, else null. */
export function liveActivityType(row) {
  switch (row?.action) {
    case 'status_changed': return 'status';
    case 'priority_changed': return 'priority';
    case 'progress_changed': return 'progress';
    case 'assignee_changed': return 'assignment';
    case 'updated':
      if (/^Renamed from /.test(row.detail || '')) return 'title';
      if (SCHEDULE_DETAIL.test(row.detail || '')) return 'assignment';
      return null;
    default: return null;
  }
}

// Rows that describe the plan itself: what a signature makes official.
function isStructuralRow(row) {
  if (!row || liveActivityType(row)) return false;
  if (NOTE_ACTIONS.has(row.action) || PLAN_EVENT_ACTIONS.has(row.action)) return false;
  if (row.action === 'signed' || row.action === 'value_changed') return false;
  if (row.action === 'goal_linked' || row.action === 'goal_unlinked') return false; // goal_link_changed says it
  return true;
}

const ms = iso => (iso ? new Date(iso).getTime() : 0);
const inRange = (iso, from, to) => {
  const t = ms(iso);
  return t > from && t <= to;
};

// Audit action used for a changed field, so the changes drawer labels it.
const FIELD_ACTION = {
  category: 'category_changed', measure: 'measure_changed', target: 'target_changed',
  targetDate: 'target_date_changed', duration: 'duration_changed', frequency: 'frequency_changed',
  conditions: 'conditions_changed', kind: 'type_changed', goalId: 'goal_link_changed',
  goalIds: 'goal_link_changed', description: 'description_changed', subtitle: 'description_changed',
};

/**
 * Which template kept across two snapshots each goal, intervention and barrier
 * belongs to, by title, so an edit inside a template already on the plan can be
 * reported under that template. `type:title` → { id, name }.
 */
function templateOwners(before, after, templateDetail, templateName) {
  const owners = new Map();
  if (!before || !after || !templateDetail) return owners;
  const kept = new Set((before.appliedTemplateIds || []).map(String));
  for (const id of (after.appliedTemplateIds || []).map(String)) {
    if (!kept.has(id)) continue;
    // The after snapshot names what the template holds now, the before one
    // what it held, so removed items are still claimed.
    for (const snap of [after, before]) {
      const titles = templateTitles({ detail: templateDetail(id, snap) });
      for (const type of ['goal', 'intervention', 'barrier']) {
        for (const title of titles[type]) {
          const key = `${type}:${(title || '').trim().toLowerCase()}`;
          if (!owners.has(key)) owners.set(key, { id, name: templateName(id) });
        }
      }
    }
  }
  return owners;
}

/** A snapshot diff as audit-shaped rows, oldest first. */
function changeRows(changes, ctx) {
  const { audit, from, to, fallbackAt, fallbackActor, templateDetail, idPrefix, before, after, owners } = ctx;
  const ownerOf = c => owners?.get(`${c.entityType}:${(c.title || '').trim().toLowerCase()}`) || null;
  const who = (change, action) => {
    const hit = (audit || []).find(e => String(e.entityId) === String(change.entityId)
      && inRange(e.createdAt, from, to)
      && (action ? e.action === action : isStructuralRow(e)));
    return { createdAt: hit?.createdAt || fallbackAt, actor: hit?.actor || fallbackActor };
  };
  const rows = [];
  let n = 0;
  const push = row => rows.push({ id: `${idPrefix}-${n++}`, ...row });
  for (const c of changes) {
    if (c.entityType === 'template') {
      if (c.action === 'changed') {
        push({
          entityType: 'plan', entityId: c.entityId, action: 'updated', summary: `${c.title} template`,
          detail: `Priority: ${c.fields[0].from} → ${c.fields[0].to}`, template: { id: String(c.entityId), name: c.title }, ...who(c, null),
        });
      } else {
        push({
          entityType: 'template', entityId: c.entityId, action: c.action === 'added' ? 'created' : 'deleted',
          summary: c.title, detail: c.action === 'added' ? (templateDetail?.(c.entityId) || '') : '',
          scope: c.action === 'added' ? after : before, ...who(c, null),
        });
      }
      continue;
    }
    if (c.entityType === 'plan') {
      const f = c.fields[0];
      push({ entityType: 'plan', entityId: 'conditions', action: 'conditions_changed', summary: 'Conditions', detail: `${f.from || 'None'} → ${f.to || 'None'}`, ...who(c, null) });
      continue;
    }
    if (c.action === 'added' || c.action === 'removed') {
      const action = c.action === 'added' ? 'created' : 'deleted';
      // The item as it stood, and the snapshot it stood in, so the changes
      // drawer can show its details and links even once it's gone.
      const scope = c.action === 'added' ? after : before;
      const item = (scope?.[`${c.entityType}s`] || []).find(x => String(x.id) === String(c.entityId)) || null;
      push({ entityType: c.entityType, entityId: c.entityId, action, summary: c.title, detail: '', item, scope, template: ownerOf(c), ...who(c, action) });
      continue;
    }
    for (const f of c.fields) {
      push({
        entityType: c.entityType, entityId: c.entityId, action: FIELD_ACTION[f.key] || 'updated', summary: c.title,
        detail: f.from || f.to ? `${f.label}: ${f.from || 'None'} → ${f.to || 'None'}` : `${f.label} updated`,
        template: ownerOf(c), ...who(c, null),
      });
    }
  }
  return rows.sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
}

// "A → B", optionally prefixed "Label: ".
function parseArrow(detail) {
  const parts = (detail || '').split('→');
  if (parts.length !== 2) return null;
  return { from: parts[0].replace(/^[A-Za-z][^:]{0,39}:\s*/, '').trim(), to: parts[1].trim() };
}

const capitalize = v => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

// Values as people read them: an ISO date ("2026-10-11", with or without a
// time) as MM/DD/YYYY, and a blank ("—", "-") as None.
function displayValue(v) {
  const text = (v || '').trim();
  if (!text || text === '—' || text === '-') return 'None';
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  return iso ? `${iso[2]}/${iso[3]}/${iso[1]}` : text;
}

// Headlines read as one sentence, the way HCC's activity entries do:
// "Goal: A1c below 7% Status Changed to Met".
// Headlines lead with what happened and end with the item it happened to,
// e.g. "Status Changed to Met on Goal: A1c below 7%". `headlineAction` and
// `headlineSubject` carry the two parts so the item can read quieter.
function withHeadline(entry, action, subject) {
  return { ...entry, headline: `${action} ${subject}`, headlineAction: action, headlineSubject: subject };
}

function activityFromRow(row, type) {
  const noun = NOUN[row.entityType] || 'Plan';
  const title = row.summary || '';
  const base = { id: `a-${row.id}`, kind: 'activity', type, entityType: row.entityType, entityId: row.entityId ?? null, title, at: row.createdAt, actor: row.actor || '' };
  if (type === 'title') {
    const was = /^Renamed from "(.*)"$/.exec(row.detail || '')?.[1] || '';
    return withHeadline({ ...base, from: was, to: title }, 'Renamed', `${noun}: ${title}`);
  }
  const arrow = parseArrow(row.detail);
  let from = displayValue(arrow?.from);
  let to = displayValue(arrow?.to);
  if (type === 'priority') { from = capitalize(from); to = capitalize(to); }
  const label = /^([A-Za-z][^:]{0,39}):/.exec(row.detail || '')?.[1];
  const what = {
    status: 'Status',
    priority: 'Priority',
    progress: row.entityType === 'intervention' ? 'Adherence' : 'Progress',
    assignment: row.action === 'assignee_changed' ? 'Assignee' : (label || 'Schedule'),
  }[type];
  // Every change names the item it is for; the pills under it already say
  // what it moved from and to.
  return withHeadline({ ...base, from, to }, `${what} Changed for`, `${noun}: ${title}`);
}

/** Notes, readings, plan events and live progress, each its own entry. */
function activityEntries(audit, measurements, goals) {
  const goalTitle = id => (goals || []).find(g => String(g.id) === String(id))?.title || '';
  const out = [];
  const onPlanNote = e => e.entityType === 'plan' || (e.entityType === 'note' && !e.entityId);
  // A note is one running note per plan or item: written once, then updated
  // or removed. Walk each note's rows oldest first to tell which this is.
  const noteState = new Map(); // row id → { verb, previous }
  const current = new Map();   // note key → text it holds now
  for (const e of [...(audit || [])].filter(x => NOTE_ACTIONS.has(x.action)).reverse()) {
    const key = onPlanNote(e) ? 'plan' : `${e.entityType}:${e.entityId}`;
    const had = current.get(key);
    if (e.action === 'note') {
      noteState.set(e.id, { verb: had == null ? 'added' : 'updated', previous: had ?? '' });
      current.set(key, e.detail || '');
    } else {
      noteState.set(e.id, { verb: 'removed', previous: had ?? '' });
      current.delete(key);
    }
  }
  for (const e of audit || []) {
    const live = liveActivityType(e);
    if (live) { out.push(activityFromRow(e, live)); continue; }
    if (NOTE_ACTIONS.has(e.action)) {
      const { verb, previous } = noteState.get(e.id) || { verb: 'added', previous: '' };
      const onPlan = onPlanNote(e);
      const itemTitle = e.entityType === 'goal' ? goalTitle(e.entityId) || e.summary : e.summary;
      const VERB = { added: 'Added', updated: 'Updated', removed: 'Removed' }[verb];
      out.push({
        id: `a-${e.id}`, kind: 'activity', type: onPlan ? 'care_note' : 'item_note', entityType: onPlan ? 'plan' : e.entityType,
        entityId: onPlan ? null : (e.entityId ?? null),
        headline: onPlan
          ? `${VERB} ${verb === 'added' ? 'a' : 'the'} Care Plan Note`
          : `${VERB} ${verb === 'added' ? 'a' : 'the'} Note on ${NOUN[e.entityType] || 'Item'}: ${itemTitle}`,
        // The headline in two parts, so the item it is on can read quieter
        // than what happened.
        headlineAction: onPlan ? null : `${VERB} ${verb === 'added' ? 'a' : 'the'} Note on`,
        headlineSubject: onPlan ? null : `${NOUN[e.entityType] || 'Item'}: ${itemTitle}`,
        title: onPlan ? '' : itemTitle,
        // An update shows what replaced what; a removal, the note that went.
        body: verb === 'removed' ? '' : e.detail,
        previous: verb === 'added' ? '' : previous,
        at: e.createdAt, actor: e.actor || '',
      });
      continue;
    }
    if (PLAN_EVENT_ACTIONS.has(e.action)) {
      const headline = {
        review_requested: e.summary ? `Care Plan Sent for Review to ${e.summary}` : 'Care Plan Sent for Review',
        shared: e.summary || 'Care Plan Shared',
        discarded: 'Discarded Unsigned Changes',
        restored: e.summary || 'Loaded an Older Version Into the Draft',
      }[e.action];
      const detail = e.action === 'discarded' ? e.detail || '' : '';
      out.push({ id: `a-${e.id}`, kind: 'activity', type: 'plan_event', entityType: 'plan', headline, detail, at: e.createdAt, actor: e.actor || '' });
    }
  }
  // Readings come from the readings themselves; the audit row only says who.
  const byGoal = new Map();
  for (const m of [...(measurements || [])].sort((a, b) => ms(a.takenAt) - ms(b.takenAt))) {
    const list = byGoal.get(m.goalId) || [];
    const previous = list.at(-1);
    list.push(m);
    byGoal.set(m.goalId, list);
    const who = (audit || []).find(e => e.action === 'value_changed'
      && String(e.entityId) === String(m.goalId)
      && Math.abs(ms(e.createdAt) - ms(m.takenAt)) < 2 * 60 * 1000);
    out.push({
      id: `m-${m.id}`, kind: 'activity', type: 'value', entityType: 'goal', entityId: m.goalId, title: goalTitle(m.goalId),
      headline: `Value Entered on Goal: ${goalTitle(m.goalId)}`,
      headlineAction: 'Value Entered on', headlineSubject: `Goal: ${goalTitle(m.goalId)}`,
      value: [m.value, m.unit].filter(Boolean).join(' '), inTarget: m.favorable !== false,
      previous: previous ? [previous.value, previous.unit].filter(Boolean).join(' ') : '',
      at: m.takenAt, actor: who?.actor || '',
    });
  }
  return out;
}

function counts(snapshot) {
  const n = list => uniqueById(list).length;
  return {
    goals: n(snapshot?.goals),
    interventions: n(snapshot?.interventions),
    barriers: Array.isArray(snapshot?.barriers) ? n(snapshot.barriers) : null,
  };
}

/**
 * Every History entry, newest first. `versions` and `audit` are newest first,
 * as the store holds them. `templateDetail(templateId, snapshot)` describes a
 * template applied in a version, for its card.
 */
export function buildCarePlanHistory({ versions, audit, slice, templates, templateDetail }) {
  const list = versions || [];
  const now = Date.now() + 1;
  const templateName = id => (templates || []).find(t => String(t.id) === String(id))?.name || '';

  // signCarePlan writes the version row first and its audit rows (templates,
  // then "Signed (vN)") just after, so a version ends at its signed audit row.
  const signedRowAt = new Map();
  for (const e of audit || []) {
    const m = e.action === 'signed' && /\(v(\d+)\)/.exec(e.summary || '');
    if (m && !signedRowAt.has(Number(m[1]))) signedRowAt.set(Number(m[1]), ms(e.createdAt));
  }
  const endOf = v => Math.max(ms(v.createdAt), signedRowAt.get(v.versionNumber) || 0);
  const versionAt = (iso) => {
    const t = ms(iso);
    return list.find(v => endOf(v) <= t)?.versionNumber ?? null;
  };
  const structuralRows = (from, to) => [...(audit || [])]
    .filter(e => inRange(e.createdAt, from, to) && isStructuralRow(e))
    .reverse();

  const entries = [];
  const latest = list[0];
  const draft = slice?.plan ? buildCarePlanSnapshot(slice) : null;

  if (draft && !list.length) {
    const rows = structuralRows(0, now);
    entries.push({
      kind: 'unsigned', id: 'unsigned', neverSigned: true, nextVersion: 1, counts: counts(draft), rows,
      at: rows.at(-1)?.createdAt || slice.plan.createdDate || null, actor: rows.at(-1)?.actor || '',
    });
  } else if (draft && latest && slice.plan.signedAt) {
    const from = endOf(latest);
    const rows = isFullSnapshot(latest.snapshot)
      ? changeRows(diffCarePlanSnapshots(latest.snapshot, draft, { templateName }).changes, {
        audit, from, to: now, fallbackAt: null, fallbackActor: '',
        templateDetail: id => templateDetail?.(id, draft), idPrefix: 'u',
        before: latest.snapshot, after: draft,
        owners: templateOwners(latest.snapshot, draft, templateDetail, templateName),
      })
      : structuralRows(from, now);
    if (rows.length) {
      const last = [...rows].sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0];
      entries.push({
        kind: 'unsigned', id: 'unsigned', nextVersion: latest.versionNumber + 1, approximate: !isFullSnapshot(latest.snapshot),
        counts: counts(draft), rows, at: last?.createdAt || null, actor: last?.actor || '',
      });
    }
  }

  list.forEach((v, i) => {
    const prev = list[i + 1] || null;
    const start = prev ? endOf(prev) : 0;
    const end = endOf(v);
    const rows = prev && isFullSnapshot(prev.snapshot) && isFullSnapshot(v.snapshot)
      ? changeRows(diffCarePlanSnapshots(prev.snapshot, v.snapshot, { templateName }).changes, {
        audit, from: start, to: end, fallbackAt: v.createdAt, fallbackActor: v.createdBy || '',
        templateDetail: id => templateDetail?.(id, v.snapshot), idPrefix: `v${v.versionNumber}`,
        before: prev.snapshot, after: v.snapshot,
        owners: templateOwners(prev.snapshot, v.snapshot, templateDetail, templateName),
      })
      : structuralRows(start, end);
    const nextEnd = i === 0 ? now : endOf(list[i - 1]);
    const share = (audit || []).find(e => e.action === 'shared' && inRange(e.createdAt, end, nextEnd));
    entries.push({
      kind: 'version', id: `v${v.versionNumber}`, versionNumber: v.versionNumber, current: i === 0,
      at: v.createdAt, actor: v.createdBy || '', note: v.note || '', counts: counts(v.snapshot),
      rows, sharedTo: share?.summary || null,
    });
  });

  for (const e of activityEntries(audit, slice?.measurements, slice?.goals)) {
    entries.push({ ...e, version: versionAt(e.at) });
  }
  return entries.sort((a, b) => ms(b.at || new Date(now).toISOString()) - ms(a.at || new Date(now).toISOString()));
}

/** Entries the Activity type filter keeps; nothing picked keeps everything. */
export function filterHistoryEntries(entries, selected) {
  if (!selected?.size) return entries || [];
  return (entries || []).filter(e => selected.has(e.kind === 'activity' ? e.type : 'version'));
}
