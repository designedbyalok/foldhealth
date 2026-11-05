import { formatGoalTarget } from '../../../../../../settings/care-plan-library/lib/goalFormat';
import { gbiStatusMeta } from '../../care-plan/lib/gbiStatus';
import { isEmptyDash } from '../../../../../../../lib/emptyDash';

/**
 * The care program report (Figma CCM-Story 11211:479858 – 14254:106259) as
 * data: which sections print, and what each holds, for the steps switched on
 * and the date range picked. Pure, so the drawer and the PDF agree and it
 * can be tested on its own.
 *
 * A section is `{ key, title, blocks }`. Blocks:
 *   { type: 'fields', rows: [{ label, value, tone?, full? }] }   two columns of "Label : Value"; `full` spans both
 *   { type: 'subtitle', text }   a sub-heading inside a section
 *   { type: 'cards', items: [{ label, value, pct?, tone }] }  progress tiles
 *   { type: 'table', columns: [{ title, width }], rows: [[cell]] }  width: share of the row
 *       a cell is a string or { text, sub?, tone? }
 *   { type: 'empty', text }
 * tone: 'success' | 'warning' | 'error' | 'muted'
 */

export const OVERVIEW_KEY = 'overview';

const OUTREACH_KINDS = new Set(['call', 'sms', 'email', 'chat', 'virtual', 'inperson', 'outreach']);
const ASSESSMENT_STEPS = new Set(['HRA', 'BRCSI Assessment', 'SNP Assessment', 'Post IP Assessment', 'Post Visit Checklist', 'Post-Visit']);

/** What a step prints as, from its name (the same rules the step view uses). */
export function stepKind(step) {
  const name = step?.name || '';
  if (step?.kind === 'billing') return 'billing';
  if (name === 'Outreach') return 'outreach';
  if (name === 'Letters') return 'letters';
  if (name === 'Care Plan' || name === 'Care Plan Details') return 'carePlan';
  if (/appointment/i.test(name)) return 'appointment';
  if (name === 'Open Care Gaps' || name === 'Care Gaps') return 'careGaps';
  if (name === 'Medication Reconciliation' || name === 'Medication Review') return 'medication';
  if (name === 'Program Related Task' || name === 'Task') return 'tasks';
  if (name === 'Program Related Files' || name === 'Program Documents' || name === 'Documents') return 'files';
  if (name === 'Referral Review') return 'referral';
  if (name === 'Open Diagnosis Gaps') return 'diagnosisGaps';
  if (ASSESSMENT_STEPS.has(name)) return 'assessment';
  return 'step';
}

// ── Dates ──
const pad = n => String(n).padStart(2, '0');
export const fmtDate = d => (d ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}` : '');
const fmtTime = d => `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
export const fmtDateTime = d => (d ? `${fmtDate(d)}, ${fmtTime(d)}` : '');

/**
 * A date from any of the shapes the app stores: ISO timestamps,
 * YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY, or "MM/DD/YYYY, 11:45 AM".
 */
export function toDate(value) {
  if (value == null || value === '' || isEmptyDash(value)) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(s);
  if (m) {
    const y = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    return new Date(y, Number(m[1]) - 1, Number(m[2]));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when `value` falls in the range (whole days, inclusive). Undated values count as in. */
export function inRange(value, range) {
  const d = toDate(value);
  if (!d || !range) return true;
  const t = d.getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export const RANGE_PRESETS = [
  { value: 'enrollment', label: 'Since enrollment' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
];

/**
 * `{ start, end, label }` for a preset (or `custom`, from `[startISO, endISO]`).
 * "Since enrollment" starts on the program's start date, else a year back.
 */
export function resolveRange(preset, { custom = [], enrolledOn, today = new Date() } = {}) {
  const end = endOfDay(today);
  let start;
  if (preset === 'custom' && custom.length === 2) {
    start = startOfDay(toDate(custom[0]));
    const customEnd = endOfDay(toDate(custom[1]));
    return { start, end: customEnd, label: `${fmtDate(start)} - ${fmtDate(customEnd)}` };
  }
  if (preset === 'enrollment' || preset === 'custom') {
    const enrolled = toDate(enrolledOn);
    start = startOfDay(enrolled && enrolled <= today ? enrolled : new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()));
  } else {
    start = startOfDay(new Date(today.getTime() - Number(preset) * 86400000));
  }
  return { start, end, label: `${fmtDate(start)} - ${fmtDate(end)}` };
}

// ── Cells ──
const STATUS_TONE = [
  [/not met|missed|overdue|poor|declined|unable|stopped|discontinued|cancel/i, 'error'],
  [/completed|signed|met\b|achieved|excellent|good|active|reviewed|referred|resolved|done/i, 'success'],
  [/progress|pending|partial|average|moderate|scheduled|attempted|engaged|draft|open/i, 'warning'],
];
export const toneOf = v => STATUS_TONE.find(([re]) => re.test(v || ''))?.[1];
const status = v => ({ text: v || '-', tone: toneOf(v) });
// Care plan GBI statuses read from the shared vocabulary rather than the
// regex above, so Discontinued / Not Applicable stay neutral (they aren't
// failures) and On Hold isn't confused with a stopped item.
const GBI_REPORT_TONE = { success: 'success', warning: 'warning', error: 'error', secondary: 'muted', disabled: 'muted' };
const gbiTone = v => GBI_REPORT_TONE[gbiStatusMeta(v).tone];
const gbiStatus = v => ({ text: v || '-', tone: gbiTone(v) });
const orDash = v => (v == null || v === '' || isEmptyDash(v) ? '-' : String(v));
const titleCase = s => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const STEP_STATUS_LABEL = { completed: 'Completed', in_progress: 'In Progress', skipped: 'Skipped', pending: 'Not Started' };

/** The status line every step section opens with, and who reviewed it. */
function stepMeta(step, manual) {
  const rows = [{ label: 'Step Status', value: STEP_STATUS_LABEL[step.status] || 'Not Started', tone: toneOf(STEP_STATUS_LABEL[step.status]) }];
  const m = manual?.[step.id];
  if (m?.updatedBy || m?.updatedAt) {
    const by = [m.updatedBy, m.updatedAt ? `on ${fmtDate(toDate(m.updatedAt))}` : ''].filter(Boolean).join(' ');
    rows.push({ label: m.status === 'skipped' ? 'Skipped by' : 'Reviewed by', value: by });
  }
  return { type: 'fields', rows };
}

const table = (columns, rows, emptyText) => (rows.length ? { type: 'table', columns, rows } : { type: 'empty', text: emptyText });

/** Log entries written for this step (titles start with its name). */
const stepActivity = (activity, step) => activity.filter(a => (a.title || '').toLowerCase().startsWith(step.name.toLowerCase()));

function activityTable(entries, emptyText) {
  return table(
    [{ title: 'Date', width: 0.22 }, { title: 'Activity', width: 0.44 }, { title: 'Status', width: 0.16 }, { title: 'By', width: 0.18 }],
    entries.map(a => [fmtDateTime(toDate(a.occurredAt)), a.title, status(a.statusLabel || ''), orDash(a.actorName)]),
    emptyText,
  );
}

// ── Sections ──
function overviewSection({ program, data, progress }) {
  const goals = data.carePlan?.goals || [];
  const goalsPct = goals.length ? Math.round(goals.reduce((s, g) => s + (Number(g.progress) || 0), 0) / goals.length) : null;
  const tasks = data.tasks || [];
  const doneTasks = tasks.filter(t => t.status === 'completed').length;
  const taskPct = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : null;
  const plan = data.carePlan?.plan;
  const pctTone = p => (p == null ? 'muted' : p >= 70 ? 'success' : p >= 40 ? 'warning' : 'error');
  return {
    key: OVERVIEW_KEY,
    title: 'Program Overview & Status Tracking',
    blocks: [
      {
        type: 'fields',
        rows: [
          { label: 'Program Name', value: program.name },
          { label: 'Status', value: orDash(program.status), tone: toneOf(program.status) },
          { label: 'Complexity', value: orDash(program.acuity) },
          { label: 'Care Manager', value: orDash(program.assignee) },
          { label: 'Started on', value: orDash(program.startDate) },
          { label: 'Last Updated on', value: orDash(program.lastUpdated) },
          { label: 'Ended on', value: orDash(program.endDate) },
          { label: 'Primary Care Provider', value: orDash(program.pcp) },
        ],
      },
      {
        type: 'cards',
        items: [
          { label: 'Plan Progress', value: `${progress}%`, pct: progress, tone: pctTone(progress) },
          { label: 'Goals Progress', value: goalsPct == null ? 'No goals' : `${goalsPct}%`, pct: goalsPct, tone: pctTone(goalsPct) },
          { label: 'Task Adherence', value: taskPct == null ? 'No tasks' : `${doneTasks}/${tasks.length} done`, pct: taskPct, tone: pctTone(taskPct) },
          { label: 'Care Plan', value: plan?.signedAt ? `Signed ${fmtDate(toDate(plan.signedAt))}` : plan ? 'Draft' : 'Not started', tone: plan?.signedAt ? 'success' : plan ? 'warning' : 'muted' },
        ],
      },
    ],
  };
}

const SECTION_BUILDERS = {
  outreach(step, ctx) {
    const rows = ctx.activity.filter(a => OUTREACH_KINDS.has(a.activityKind) && inRange(a.occurredAt, ctx.range));
    return [table(
      [{ title: 'Outreach Attempt', width: 0.28 }, { title: 'Notes', width: 0.5 }, { title: 'Outcome', width: 0.22 }],
      rows.map((a, i) => [
        { text: `Outreach ${rows.length - i}`, sub: [fmtDateTime(toDate(a.occurredAt)), titleCase(a.activityKind), a.actorName].filter(Boolean).join('\n') },
        (a.title || '').replace(/^Outreach - /, ''),
        status(a.statusLabel || '-'),
      ]),
      'No outreach in this date range.',
    )];
  },
  letters(step, ctx) {
    const sent = (ctx.data.letters || [])
      .filter(l => (l.sentVia || []).length && inRange(l.lastSent, ctx.range))
      .map(l => [l.fileName, (l.sentVia || []).join(', '), orDash(l.lastSent), orDash(l.sentBy)]);
    const logged = ctx.activity
      .filter(a => a.activityKind === 'letter' && inRange(a.occurredAt, ctx.range))
      .map(a => [a.title.replace(/^Letter (Sent|Added): /, ''), a.statusLabel || '-', fmtDate(toDate(a.occurredAt)), orDash(a.actorName)]);
    return [table(
      [{ title: 'Letter', width: 0.4 }, { title: 'Sent Via / Status', width: 0.22 }, { title: 'Date', width: 0.18 }, { title: 'By', width: 0.2 }],
      [...logged, ...sent],
      'No letters sent in this date range.',
    )];
  },
  carePlan(step, ctx) {
    const cp = ctx.data.carePlan;
    if (!cp?.plan) return [{ type: 'empty', text: 'No care plan has been started for this program.' }];
    const existed = item => !item.createdAt || toDate(item.createdAt) <= ctx.range.end;
    const goals = (cp.goals || []).filter(existed);
    const goalById = new Map(goals.map(g => [g.id, g]));
    const interventions = (cp.interventions || []).filter(existed);
    const barriers = (cp.barriers || []).filter(existed);
    const { plan } = cp;
    return [
      {
        type: 'fields',
        rows: [
          { label: 'Created by', value: orDash(plan.createdBy) },
          { label: 'Created on', value: fmtDate(toDate(plan.createdDate)) || '-' },
          { label: 'Signed by', value: plan.signedBy ? `${plan.signedBy} on ${fmtDate(toDate(plan.signedAt))}` : 'Not signed', tone: plan.signedAt ? 'success' : 'warning' },
          { label: 'Conditions', value: (plan.conditions || []).map(c => c.label).join(' | ') || '-', full: true },
        ],
      },
      { type: 'subtitle', text: 'Goals' },
      table(
        [{ title: 'Goal', width: 0.36 }, { title: 'Target', width: 0.22 }, { title: 'Current Value', width: 0.18 }, { title: 'Status', width: 0.24 }],
        goals.map(g => [
          { text: g.title, sub: g.category || '' },
          formatGoalTarget(g) || '-',
          g.currentValue ? { text: g.currentValue, sub: g.trend && g.trend !== '-' ? titleCase(g.trend) : '' } : '-',
          { text: `${Math.round(Number(g.progress) || 0)}% | ${g.status}`, tone: gbiTone(g.status) },
        ]),
        'No goals on the care plan.',
      ),
      { type: 'subtitle', text: 'Interventions' },
      table(
        [{ title: 'Intervention', width: 0.44 }, { title: 'Goal', width: 0.24 }, { title: 'Adherence', width: 0.14 }, { title: 'Status', width: 0.18 }],
        interventions.map(i => [
          { text: i.title, sub: titleCase(i.kind) },
          goalById.get(i.goalId)?.title || '-',
          orDash(i.adherence),
          gbiStatus(i.status),
        ]),
        'No interventions on the care plan.',
      ),
      { type: 'subtitle', text: 'Barriers' },
      table(
        [{ title: 'Barrier', width: 0.6 }, { title: 'Priority', width: 0.18 }, { title: 'Status', width: 0.22 }],
        barriers.map(b => [{ text: b.title, sub: b.description || '' }, titleCase(b.priority), gbiStatus(b.status)]),
        'No barriers on the care plan.',
      ),
    ];
  },
  appointment(step, ctx) {
    const ictOnly = /\bICT\b/.test(step.name);
    const rows = (ctx.data.appointments || [])
      .filter(a => inRange(a.date, ctx.range) && (!ictOnly || /\bICT\b/i.test(a.appointment_type_name || a.title || '')))
      .map(a => [
        { text: a.appointment_type_name || a.title || 'Appointment', sub: a.reason_for_visit || a.subtitle || '' },
        [orDash(a.date), a.time_start || a.time || ''].filter(Boolean).join(' '),
        orDash(a.primary_user || a.assignee),
        status(titleCase(a.status || 'Scheduled')),
      ]);
    return [table(
      [{ title: 'Appointment', width: 0.4 }, { title: 'Date & Time', width: 0.2 }, { title: 'Provider', width: 0.22 }, { title: 'Status', width: 0.18 }],
      rows,
      'No appointments in this date range.',
    )];
  },
  careGaps(step, ctx) {
    const rows = (ctx.data.careGaps || []).flatMap(sec => sec.items.map(g => [g.title, sec.title, status(g.status)]));
    return [table([{ title: 'Care Gap', width: 0.6 }, { title: 'Category', width: 0.22 }, { title: 'Status', width: 0.18 }], rows, 'No open care gaps.')];
  },
  medication(step, ctx) {
    const { start, end } = ctx.range;
    const meds = (ctx.data.medications || []).filter((m) => {
      const s = toDate(m.start);
      const e = toDate(m.stop);
      return (!s || s <= end) && (!e || e >= start);
    });
    const p = ctx.program;
    return [
      { type: 'fields', rows: [{ label: 'Reconciliation', value: p.medReconSignedBy ? `Signed by ${p.medReconSignedBy}${p.medReconSignedRole ? ` (${p.medReconSignedRole})` : ''} on ${orDash(p.medReconSignedAt)}` : 'Not signed', tone: p.medReconSignedBy ? 'success' : 'warning' }] },
      table(
        [{ title: 'Medication', width: 0.32 }, { title: 'Duration', width: 0.22 }, { title: 'Dosage', width: 0.28 }, { title: 'Status', width: 0.18 }],
        meds.map(m => [m.name, [orDash(m.start), m.stop ? orDash(m.stop) : 'Ongoing'].join(' - '), orDash(m.sig), status(m.status)]),
        'No medications in this date range.',
      ),
    ];
  },
  tasks(step, ctx) {
    const rows = (ctx.data.tasks || [])
      .filter(t => inRange(t.created_at, ctx.range) || inRange(t.due_date, ctx.range))
      .map(t => [t.name || t.title || 'Task', orDash(t.assigned_to), orDash(fmtDate(toDate(t.due_date))), status(titleCase(t.status))]);
    return [table([{ title: 'Task', width: 0.44 }, { title: 'Assignee', width: 0.22 }, { title: 'Due', width: 0.16 }, { title: 'Status', width: 0.18 }], rows, 'No tasks in this date range.')];
  },
  files(step, ctx) {
    const rows = (ctx.data.documents || [])
      .filter(d => inRange(d.createdAt || d.updatedDate, ctx.range))
      .map(d => [d.name, orDash(d.type), orDash(d.updatedBy), orDash(d.updatedDate || fmtDate(toDate(d.createdAt)))]);
    return [table([{ title: 'File', width: 0.42 }, { title: 'Type', width: 0.2 }, { title: 'Uploaded By', width: 0.2 }, { title: 'Date', width: 0.18 }], rows, 'No files added in this date range.')];
  },
  referral(step, ctx) {
    const rows = (ctx.data.referrals || [])
      .filter(r => inRange(r.createdOn, ctx.range))
      .map(r => [
        { text: r.referredByName, sub: r.referredByRole ? `(${r.referredByRole})` : '' },
        { text: r.referredToName, sub: r.referredToRole ? `(${r.referredToRole})` : '' },
        r.createdOn,
        status(r.status),
      ]);
    return [table([{ title: 'Refer By', width: 0.28 }, { title: 'Refer To', width: 0.28 }, { title: 'Created On', width: 0.22 }, { title: 'Status', width: 0.22 }], rows, 'No referrals in this date range.')];
  },
  diagnosisGaps(step, ctx) {
    const rows = (ctx.data.diagnosisGaps || []).map(i => [i.code, i.desc || '-', i.hcc ? `HCC ${i.hcc}` : '-']);
    return [table([{ title: 'ICD Code', width: 0.16 }, { title: 'Description', width: 0.66 }, { title: 'HCC', width: 0.18 }], rows, 'No open diagnosis gaps.')];
  },
  billing(step, ctx) {
    const acts = (ctx.data.billing || []).filter(a => inRange(a.occurredAt, ctx.range));
    const minutes = s => Math.round((Number(s) || 0) / 60);
    const total = acts.reduce((s, a) => s + minutes(a.durationSeconds), 0);
    return [
      table(
        [{ title: 'Date', width: 0.16 }, { title: 'Activity', width: 0.46 }, { title: 'Minutes', width: 0.14 }, { title: 'Logged By', width: 0.24 }],
        acts.map(a => [fmtDate(toDate(a.occurredAt)), { text: titleCase(a.activityType), sub: a.description || '' }, String(minutes(a.durationSeconds)), orDash(a.loggedBy)]),
        'No billable time in this date range.',
      ),
      ...(acts.length ? [{ type: 'fields', rows: [{ label: 'Total Time', value: `${total} minutes` }] }] : []),
    ];
  },
};

/**
 * @param {object} input
 * @param {object} input.program   – the enrollment (status, dates, assignee, med recon sign-off)
 * @param {object} input.patient   – { name, dob, age, gender, memberId, pcp, insurance }
 * @param {object[]} input.steps   – flat steps with derived `status`, plus `section` (its group's name)
 * @param {object} input.manual    – { [stepId]: { status, updatedBy, updatedAt } }
 * @param {{ start: Date, end: Date }} input.range
 * @param {Set<string>} input.enabled – step ids (and OVERVIEW_KEY) switched on
 * @param {number} input.progress  – program progress, 0–100
 * @param {object} input.data      – activity, carePlan, tasks, documents, appointments,
 *   medications, letters, careGaps, referrals, diagnosisGaps, billing
 */
export function buildProgramReport({ program, patient, steps, manual, range, enabled, progress, data }) {
  const activity = (data.activity || []).filter(a => !a.programCode || a.programCode === program.code);
  const ctx = { program, range, data, activity };
  const sections = [];
  if (enabled.has(OVERVIEW_KEY)) sections.push(overviewSection({ program, data, progress }));
  steps.forEach((step) => {
    if (!enabled.has(step.id)) return;
    const kind = stepKind(step);
    const build = SECTION_BUILDERS[kind];
    const own = stepActivity(activity, step).filter(a => inRange(a.occurredAt, range));
    const blocks = [stepMeta(step, manual)];
    if (build) blocks.push(...build(step, ctx));
    // Steps without records of their own print what was logged against them.
    if (!build || kind === 'assessment' || kind === 'step') blocks.push(activityTable(own, 'No activity logged for this step in this date range.'));
    sections.push({ key: step.id, title: step.section ? `${step.section}: ${step.name}` : step.name, blocks });
  });
  const patientRows = [
    { label: 'Patient Name', value: orDash(patient?.name) },
    { label: 'Date Of Birth', value: [patient?.dob, patient?.age ? `(${/^\d+$/.test(String(patient.age)) ? `${patient.age}Y` : patient.age})` : ''].filter(Boolean).join(' ') || '-' },
    { label: 'Gender', value: orDash(patient?.gender) },
    { label: 'Fold ID', value: patient?.memberId ? `#${patient.memberId}` : '-' },
    { label: 'Primary Care Provider', value: orDash(patient?.pcp) },
    { label: 'Insurance', value: orDash(patient?.insurance) },
  ];
  return { patientRows, sections };
}
