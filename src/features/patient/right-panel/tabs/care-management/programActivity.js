import { activityEntries } from '../care-programs/care-plan/lib/carePlanHistory';

// Program Activity Log helpers — icon/token mapping + grouping of raw activity
// entries into month → day → (date × program) stacks or single rows.

/** Per activity-kind icon + token-based colors (no raw hex). */
export const ACTIVITY_ICON = {
  letter:    { icon: 'solar:letter-linear',         bg: 'var(--accent-light-cyan)',         color: 'var(--accent-cyan)' },
  document:  { icon: 'solar:document-add-linear',   bg: 'var(--accent-light-amber)',        color: 'var(--accent-amber)' },
  clipboard: { icon: 'solar:clipboard-text-linear', bg: 'var(--accent-light-persian-blue)', color: 'var(--accent-persian-blue)' },
  call:      { icon: 'solar:phone-calling-linear',  bg: 'var(--neutral-50)',                color: 'var(--neutral-300)' },
  sms:       { icon: 'custom:sms',                  bg: 'var(--accent-light-blue)',         color: 'var(--accent-blue)' },
  email:     { icon: 'solar:letter-linear',         bg: 'var(--accent-light-teal)',         color: 'var(--accent-teal)' },
  chat:      { icon: 'solar:chat-round-linear',     bg: 'var(--neutral-50)',                color: 'var(--neutral-300)' },
  virtual:   { icon: 'solar:videocamera-linear',    bg: 'var(--neutral-50)',                color: 'var(--neutral-300)' },
  inperson:  { icon: 'solar:user-linear',           bg: 'var(--neutral-50)',                color: 'var(--neutral-300)' },
  outreach:  { icon: 'solar:document-text-linear',  bg: 'var(--neutral-50)',                color: 'var(--neutral-300)' },
  status:    { icon: 'solar:user-id-linear',        bg: 'var(--accent-light-light-green)',  color: 'var(--accent-light-green)' },
  careplan:  { icon: 'custom:care-plan',            bg: 'var(--neutral-50)',                color: 'var(--neutral-300)' },
  note:      { icon: 'solar:notes-linear',          bg: 'var(--neutral-50)',                color: 'var(--neutral-300)' },
};

/** What each activity kind is called in the Activity Type filter. */
export const ACTIVITY_TYPE_LABEL = {
  letter: 'Letter',
  document: 'Document',
  clipboard: 'Assessment',
  call: 'Outreach',
  sms: 'Outreach',
  email: 'Outreach',
  chat: 'Outreach',
  virtual: 'Outreach',
  inperson: 'Outreach',
  outreach: 'Outreach',
  status: 'Status Change',
  careplan: 'Care Plan',
  note: 'Note',
};
export const activityTypeLabel = (kind) => ACTIVITY_TYPE_LABEL[kind] || 'Document';

const initialsOf = (name) => (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const PATIENT_PLAN_CODE = 'PATIENT';
const NOTE_ACTIONS = new Set(['note', 'note_deleted', 'note_cleared']);
const TONES = [
  [/not met|missed|off track|discontinued|cancel/i, 'error'],
  [/completed|achieved|\bmet\b|on track|resolved/i, 'success'],
  [/in progress|partial|pending|on hold/i, 'warning'],
];
const toneOf = (v) => TONES.find(([re]) => re.test(v || ''))?.[1] || 'neutral';


/**
 * A care plan's history as Program Activity Log entries. Everything a
 * signature makes official (goals, interventions, barriers and templates
 * coming and going, Edit-drawer changes) is one entry per signed version,
 * which opens that version's changes; what happens on the signed plan between
 * signatures (status, progress, assignee and schedule changes, notes, plan
 * events) is listed as it happened. Drafts not yet signed are left out, and
 * so are shares (sharing logs its own activity). `programs` resolves a
 * version's program id to its code. Patient-level plans belong to no program
 * and are left out.
 */
export function carePlanActivityEntries(audit = [], versions = [], programs = []) {
  const programById = new Map(programs.map(p => [String(p.id), p]));
  const base = (id, programCode, at, actor) => ({
    id,
    programCode,
    programName: `${programCode} Program Updates`,
    occurredAt: at,
    actorName: actor || '',
    actorInitials: initialsOf(actor),
    statusLabel: '',
    statusType: 'neutral',
    activityKind: 'careplan',
  });
  // Each program's plan is its own history: its notes run per plan, so the
  // History drawer's builder reads one program's rows at a time.
  const byProgram = new Map();
  for (const a of audit) {
    const code = a.programCode || programById.get(String(a.programId))?.code;
    if (!code || code === PATIENT_PLAN_CODE || a.action === 'shared') continue;
    if (!byProgram.has(code)) byProgram.set(code, []);
    // An item note's summary repeats "Note on"; the headline says it already.
    byProgram.get(code).push(NOTE_ACTIONS.has(a.action) ? { ...a, summary: (a.summary || '').replace(/^Note on /, '') } : a);
  }
  // Each activity happened on the version its plan was signed at, as the
  // Care Plan History tags it; before the first signature it was a draft.
  const versionsByCode = new Map();
  for (const v of versions) {
    const code = programById.get(String(v.programId))?.code;
    if (!code) continue;
    if (!versionsByCode.has(code)) versionsByCode.set(code, []);
    versionsByCode.get(code).push(v);
  }
  for (const list of versionsByCode.values()) list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const out = [];
  for (const [code, rows] of byProgram) {
    const signed = versionsByCode.get(code) || [];
    const current = signed[0]?.versionNumber ?? null;
    const newestFirst = [...rows].sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
    // The program each row was logged against, by audit row id.
    const programIdOf = new Map(rows.map(a => [`a-${a.id}`, a.programId]));
    for (const e of activityEntries(newestFirst, [], [])) {
      const row = base(`cp${e.id}`, code, e.at, e.actor);
      row.programId = programIdOf.get(e.id) ?? null;
      const on = signed.find(v => new Date(v.createdAt) <= new Date(e.at))?.versionNumber ?? null;
      row.planVersion = on;
      row.planVersionCurrent = on != null && on === current;
      row.title = e.headline;
      // The History entry itself, so the log draws it exactly as History does.
      row.history = e;
      if (e.type === 'care_note' || e.type === 'item_note') {
        row.activityKind = 'note';
      } else if (e.to) {
        row.statusLabel = e.to;
        row.statusType = e.type === 'status' ? toneOf(e.to) : 'neutral';
      }
      out.push(row);
    }
  }
  for (const v of versions) {
    const program = programById.get(String(v.programId));
    if (!program?.code || program.code === PATIENT_PLAN_CODE) continue;
    const row = base(`cpv-${v.id}`, program.code, v.createdAt, v.createdBy);
    row.title = 'Care Plan Signed';
    row.statusLabel = `Version ${v.versionNumber}`;
    row.statusType = 'success';
    row.programId = program.id;
    row.versionNumber = v.versionNumber;
    out.push(row);
  }
  return out;
}

/**
 * Narrow the log by the toolbar's filters. `range` is [] or
 * [startISO, endISO] (date-only, inclusive).
 */
export function filterProgramActivity(entries, { search = '', types = [], programs = [], actors = [], range = [] } = {}) {
  const q = search.trim().toLowerCase();
  const typeSet = new Set(types);
  const programSet = new Set(programs);
  const actorSet = new Set(actors);
  const start = range.length === 2 ? new Date(`${range[0]}T00:00:00`).getTime() : null;
  const end = range.length === 2 ? new Date(`${range[1]}T23:59:59.999`).getTime() : null;
  return entries.filter(e => {
    if (q && !`${e.programName} ${e.programCode} ${e.title} ${e.actorName} ${e.statusLabel}`.toLowerCase().includes(q)) return false;
    if (typeSet.size && !typeSet.has(activityTypeLabel(e.activityKind))) return false;
    if (programSet.size && !programSet.has(e.programCode)) return false;
    if (actorSet.size && !actorSet.has(e.actorName)) return false;
    if (start != null) {
      const t = new Date(e.occurredAt).getTime();
      if (t < start || t > end) return false;
    }
    return true;
  });
}
export const activityIcon = (kind) => ACTIVITY_ICON[kind] || ACTIVITY_ICON.document;

/** Inline status-label color by status type. */
export const STATUS_COLOR = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  error: 'var(--status-error)',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabel = (d) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const dateShort = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const timeLabel = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

function mapEntryItem(e, d) {
  return {
    id: e.id,
    occurredAt: d.getTime(),
    dateLabel: dateShort(d),
    time: timeLabel(d),
    actorName: e.actorName,
    actorRole: e.actorRole || '',
    title: e.title,
    history: e.history || null,
    planVersion: e.planVersion ?? null,
    planVersionCurrent: !!e.planVersionCurrent,
    programId: e.programId || null,
    versionNumber: e.versionNumber || null,
    statusLabel: e.statusLabel,
    statusType: e.statusType,
    activityKind: e.activityKind,
    programCode: e.programCode,
  };
}

/**
 * Group entries (pre-sorted newest-first) into months → days → per-program
 * stacks. Same calendar day + same program → one stacked group; same day +
 * different programs → separate entries so each program reads on its own.
 */
export function groupProgramActivity(entries) {
  const months = [];
  const monthByKey = new Map();
  const dayByKey = new Map();

  for (const e of entries) {
    const d = new Date(e.occurredAt);
    if (Number.isNaN(d.getTime())) continue;
    const mKey = monthLabel(d);
    let month = monthByKey.get(mKey);
    if (!month) {
      month = { key: mKey, label: mKey, days: [] };
      monthByKey.set(mKey, month);
      months.push(month);
    }

    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dayKey = `${mKey}|${dateKey}`;
    let day = dayByKey.get(dayKey);
    if (!day) {
      day = {
        key: dayKey,
        date: dateShort(d),
        day: DAYS[d.getDay()],
        sortKey: d.getTime(),
        entries: [],
      };
      dayByKey.set(dayKey, day);
      month.days.push(day);
    }

    const cKey = `${dayKey}|${e.programCode}`;
    let entry = day.entries.find(x => x.key === cKey);
    if (!entry) {
      entry = {
        key: cKey,
        programCode: e.programCode,
        programName: e.programName,
        items: [],
        users: new Map(),
        sortKey: d.getTime(),
      };
      day.entries.push(entry);
    }
    entry.items.push(mapEntryItem(e, d));
    // Everyone who touched the program that day, for the stacked avatars.
    if (e.actorName && !entry.users.has(e.actorName)) {
      entry.users.set(e.actorName, { id: e.actorName, name: e.actorName, initials: e.actorInitials || initialsOf(e.actorName) });
    }
    if (d.getTime() > entry.sortKey) entry.sortKey = d.getTime();
    if (d.getTime() > day.sortKey) day.sortKey = d.getTime();
  }

  for (const m of months) {
    m.days.sort((a, b) => b.sortKey - a.sortKey);
    for (const day of m.days) {
      day.entries.sort((a, b) => b.sortKey - a.sortKey);
      for (const entry of day.entries) {
        entry.users = [...entry.users.values()];
        entry.userCount = entry.users.length;
        entry.count = entry.items.length;
        entry.type = entry.count > 1 ? 'group' : 'single';
        entry.items.sort((a, b) => b.occurredAt - a.occurredAt);
        delete entry.sortKey;
      }
      delete day.sortKey;
    }
  }
  return months;
}
