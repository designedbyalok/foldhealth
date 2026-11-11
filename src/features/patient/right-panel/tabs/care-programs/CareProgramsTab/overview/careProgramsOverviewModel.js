import { openStepsWithDetail } from '../../program-detail/ProgramDetailView/stepDetail';
import { STEP_STATUS } from '../../program-detail/ProgramDetailView/stepStatus';
import { isExcludedStatus } from '../../care-plan/lib/gbiStatus';

// CCM calls its plan step "Care Plan Details"; the same step everywhere else.
const normName = n => (n === 'Care Plan Details' ? 'Care Plan' : n);
const ITEM_KIND = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier' };
const ITEM_SUB = { goal: 'Off target', intervention: 'Overdue', barrier: 'Nothing addressing it' };

/**
 * One enrollment, ready for the overview:
 *   { program, steps (flat, with status), ctx (deriveStepStatus ctx), carePlan, attention }
 * where `attention` is carePlanFocusItems (no review) for its care plan.
 */

/** Steps done (completed or skipped) out of all, and the step to do next. */
export function programProgress({ program, steps, ctx }) {
  const done = steps.filter(s => s.status === STEP_STATUS.completed || s.status === STEP_STATUS.skipped).length;
  const next = openStepsWithDetail(steps, ctx)[0] || null;
  return { program, done, total: steps.length, next };
}

/**
 * Next Best Actions: open program steps (urgent, under way, or the next
 * required one in each program) and the care plan items that need attention,
 * in one ordered list. A step that reads the same in several programs (an
 * Outreach that's Required in three) is one row tagged with each program.
 * Order: urgent first (urgent steps, overdue interventions), then goals off
 * target and barriers with nothing addressing them, then the rest; a care
 * plan item then moves to just after its program's Care Plan step, when that
 * step is listed, so related work stays together.
 *
 * Row: { key, kind: 'step'|'goal'|'intervention'|'barrier', title, programs: [program],
 *        refs: [{ program, step }] | ref: { program, item }, detail: { text, urgent },
 *        required, with?: 'Care Plan' }
 */
export function nextBestActions(entries) {
  const steps = new Map();
  entries.forEach((e, order) => {
    for (const s of openStepsWithDetail(e.steps, e.ctx)) {
      const name = normName(s.name);
      const k = `${name}|${s.detail.text}`;
      const row = steps.get(k) || { key: `step:${k}`, kind: 'step', title: name, programs: [], refs: [], detail: s.detail, required: false, order };
      row.programs.push(e.program);
      row.refs.push({ program: e.program, step: s });
      row.required = row.required || (!!s.mandatory && s.status === STEP_STATUS.pending);
      steps.set(k, row);
    }
  });
  const items = entries.flatMap((e, order) => (e.attention || []).filter(a => a.item).map(a => ({
    key: `${a.kind}:${e.program.id}:${a.item.id}`,
    kind: a.kind,
    title: a.item.title,
    sub: ITEM_SUB[a.kind],
    programs: [e.program],
    ref: { program: e.program, item: a.item },
    detail: { text: a.text, urgent: a.kind === 'intervention' },
    required: false,
    order,
  })));
  const bucket = r => (r.detail.urgent ? 0 : r.kind !== 'step' ? 1 : 2);
  const ranked = [...steps.values(), ...items].sort((a, b) => bucket(a) - bucket(b) || a.order - b.order);

  // Care plan items follow their program's Care Plan step.
  const out = [];
  const placed = new Set();
  for (const r of ranked) {
    if (placed.has(r)) continue;
    if (r.kind !== 'step' && ranked.some(x => x.kind === 'step' && x.title === 'Care Plan' && x.programs.includes(r.programs[0]))) continue;
    out.push(r);
    placed.add(r);
    if (r.kind === 'step' && r.title === 'Care Plan') {
      for (const it of ranked) {
        if (it.kind !== 'step' && !placed.has(it) && r.programs.includes(it.programs[0])) {
          out.push({ ...it, with: 'Care Plan' });
          placed.add(it);
        }
      }
    }
  }
  return out;
}

/**
 * Why Prioritized, from the records (no AI): a few short takeaways and a
 * paragraph. Takeaways: { text, tone: 'danger'|'warning' } for the urgent
 * actions, goals off target and a high acuity. The paragraph is segments
 * ({ text, bold? }): what's urgent (bold), the care plan's state, and where
 * each program stands.
 */
export function whyPrioritized(actions, { acuity, totals, progress = [], firstName } = {}) {
  const takeaways = [];
  const urgent = actions.filter(a => a.detail.urgent);
  for (const a of urgent.slice(0, 2)) {
    takeaways.push({ tone: 'danger', text: `${a.programs.map(p => p.code).join(', ')} ${a.title}: ${a.detail.text.replace(/\.$/, '')}` });
  }
  if (urgent.length > 2) takeaways.push({ tone: 'danger', text: `${urgent.length - 2} more urgent` });
  const offTarget = actions.filter(a => a.kind === 'goal').length;
  if (offTarget) takeaways.push({ tone: 'warning', text: `${offTarget} ${offTarget === 1 ? 'goal' : 'goals'} off target` });
  if (/high/i.test(acuity || '')) takeaways.push({ tone: 'warning', text: `${acuity} acuity` });

  const segments = [];
  if (urgent.length) {
    segments.push({ bold: true, text: `Urgent: ${urgent.map(a => `${a.programs.map(p => p.code).join(', ')} ${a.title} (${a.detail.text.replace(/\.$/, '')})`).join(', ')}.` });
  }
  if (totals && totals.goals + totals.interventions + totals.barriers) {
    const issues = [
      totals.issues.goal && `${totals.issues.goal} ${totals.issues.goal === 1 ? 'goal' : 'goals'} off target`,
      totals.issues.intervention && `${totals.issues.intervention} ${totals.issues.intervention === 1 ? 'intervention' : 'interventions'} overdue`,
      totals.issues.barrier && `${totals.issues.barrier} ${totals.issues.barrier === 1 ? 'barrier' : 'barriers'} without an intervention`,
    ].filter(Boolean);
    segments.push({ text: ` Goal progress is ${totals.avgProgress}% across ${totals.goals} ${totals.goals === 1 ? 'goal' : 'goals'}${issues.length ? `, with ${issues.join(', ')}` : ''}.` });
  }
  if (progress.length) {
    segments.push({ text: ` ${firstName || 'The patient'} is in ${progress.length} ${progress.length === 1 ? 'program' : 'programs'}: ${progress.map(p => `${p.program.code} ${p.done} of ${p.total} steps done`).join(', ')}.` });
  }
  return { takeaways, segments };
}

/** Goal / intervention / barrier counts and average goal progress across the plans, with attention per kind. */
export function combinedPlanTotals(entries) {
  const goals = entries.flatMap(e => e.carePlan?.goals || []);
  const judged = goals.filter(g => !isExcludedStatus(g.status));
  const attention = entries.flatMap(e => e.attention || []);
  const count = kind => attention.filter(a => a.kind === kind).length;
  return {
    goals: goals.length,
    interventions: entries.reduce((n, e) => n + (e.carePlan?.interventions || []).length, 0),
    barriers: entries.reduce((n, e) => n + (e.carePlan?.barriers || []).length, 0),
    avgProgress: judged.length ? Math.round(judged.reduce((n, g) => n + (Number(g.progress) || 0), 0) / judged.length) : 0,
    issues: { goal: count('goal'), intervention: count('intervention'), barrier: count('barrier') },
  };
}

const updatedMs = p => {
  const v = p.lastUpdated && p.lastUpdated !== '-' ? p.lastUpdated : p.startDate;
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};

/**
 * Program cards in the order to work them: most urgent actions first, then
 * most required steps still open, then most open actions, then the most
 * recently updated, then by name so the order never jitters. Returns the
 * indexes of `progress` (one per entry) in that order, with each program's
 * counts.
 */
export function programOrder(progress, actions) {
  const counts = progress.map(p => {
    const mine = actions.filter(a => a.programs.some(x => x.id === p.program.id));
    return {
      urgent: mine.filter(a => a.detail.urgent).length,
      required: mine.filter(a => a.required).length,
      open: mine.length,
    };
  });
  return progress
    .map((p, i) => ({ i, p, c: counts[i] }))
    .sort((a, b) => b.c.urgent - a.c.urgent
      || b.c.required - a.c.required
      || b.c.open - a.c.open
      || updatedMs(b.p.program) - updatedMs(a.p.program)
      || (a.p.program.name || '').localeCompare(b.p.program.name || ''))
    .map(({ i, c }) => ({ index: i, ...c }));
}

const CMP = { '<=': '≤', '>=': '≥', '<': '<', '>': '>', '=': '=' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listOf = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** "≤ 130/80 mmHg", "6.5–7 %", or '' when the goal has no target. */
export function goalTargetText(goal, unit = '') {
  if (!goal || goal.setTarget === false || !goal.targetValue) return '';
  const a = goal.targetValue;
  const b = goal.targetValue2;
  const body = goal.comparator === 'between' && b ? `${a}–${b}` : `${CMP[goal.comparator] || goal.comparator || ''} ${a}${b ? `/${b}` : ''}`;
  return [body.trim(), unit].filter(Boolean).join(' ');
}

const readingText = (r, unit) => (unit && !String(r.value).includes(unit) ? `${r.value} ${unit}` : String(r.value));

/**
 * The clinical Program Summary, from the records only (no AI):
 *   lead: who the patient is clinically (acuity, active chronic conditions)
 *         and how the monitored goals stand at their latest reading.
 *   readings: the latest reading of each open goal that has one, against its
 *         target; off target first. A goal tracked in several programs is one
 *         row. `met` is the clinician's call on the reading, else the target
 *         check, else null.
 *   concerns: overdue interventions and barriers nothing is addressing.
 *
 * `evaluate(goal, value)` judges a reading against the goal's target
 * (goalReadings.evaluateReading), passed in to keep this module pure.
 */
export function clinicalSummary(entries, { problems = [], acuity = '', firstName = '', evaluate = () => null } = {}) {
  const byGoal = new Map();
  const goalPrograms = new Map();
  const unreadKeys = new Set();
  for (const e of entries) {
    const plan = e.carePlan;
    if (!plan) continue;
    for (const g of plan.goals || []) {
      if (isExcludedStatus(g.status) || /^(Met|Not Met)$/.test(g.status || '')) continue;
      const rows = (plan.measurements || []).filter(m => m.goalId === g.id).sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt));
      const k = (g.title || '').toLowerCase();
      const progs = goalPrograms.get(k) || [];
      if (!progs.includes(e.program)) progs.push(e.program);
      goalPrograms.set(k, progs);
      if (!rows.length) {
        unreadKeys.add(k);
        continue;
      }
      const latest = rows[rows.length - 1];
      const prev = rows[rows.length - 2];
      const have = byGoal.get(k);
      if (have && new Date(latest.takenAt) <= new Date(have.takenAt)) continue;
      const unit = latest.unit || g.customUnit || '';
      const judged = typeof latest.favorable === 'boolean' ? latest.favorable : evaluate(g, latest.value);
      byGoal.set(k, {
        key: `reading:${k}`,
        title: g.measure && g.measure !== 'Others' ? g.measure : g.title,
        goal: g.title,
        value: readingText(latest, unit),
        prior: prev ? readingText(prev, prev.unit || unit) : '',
        takenAt: latest.takenAt,
        target: goalTargetText(g, unit),
        met: judged ?? null,
        programs: progs,
        ref: { program: e.program, item: g },
      });
    }
  }
  const unread = [...unreadKeys].filter(k => !byGoal.has(k)).length;
  const readings = [...byGoal.values()].sort((a, b) => (a.met === false ? 0 : 1) - (b.met === false ? 0 : 1) || new Date(b.takenAt) - new Date(a.takenAt));

  const concerns = [];
  for (const e of entries) {
    for (const a of e.attention || []) {
      if (!a.item || (a.kind !== 'intervention' && a.kind !== 'barrier')) continue;
      const k = `${a.kind}:${(a.item.title || '').toLowerCase()}`;
      const have = concerns.find(c => c.k === k);
      if (have) { if (!have.programs.includes(e.program)) have.programs.push(e.program); continue; }
      concerns.push({
        k,
        key: `${a.kind}:${e.program.id}:${a.item.id}`,
        kind: a.kind,
        label: a.kind === 'intervention' ? 'Overdue intervention' : 'Unaddressed barrier',
        title: a.item.title,
        text: a.kind === 'intervention' ? a.text.replace(/\.$/, '') : '',
        programs: [e.program],
        ref: { program: e.program, item: a.item },
      });
    }
  }
  concerns.sort((a, b) => (a.kind === 'intervention' ? 0 : 1) - (b.kind === 'intervention' ? 0 : 1));

  const chronic = problems.filter(p => /active/i.test(p.status || 'Active') && /chronic/i.test(p.type || '')).map(p => p.title);
  const who = firstName || 'The patient';
  const lead = [];
  lead.push(`${who}${/\S/.test(acuity) ? ` (${acuity} acuity)` : ''} ${chronic.length ? `has ${plural(chronic.length, 'active chronic condition')}: ${listOf(chronic)}.` : 'has no active chronic conditions on record.'}`);
  if (readings.length) {
    const off = readings.filter(r => r.met === false).length;
    const inRange = readings.filter(r => r.met === true).length;
    lead.push(`At the latest reading, ${inRange} of ${plural(readings.length, 'monitored goal')} ${inRange === 1 ? 'is' : 'are'} in range${off ? ` and ${off} ${off === 1 ? 'is' : 'are'} off target` : ''}.`);
  }
  if (unread) lead.push(`${plural(unread, 'open goal')} ${unread === 1 ? 'has' : 'have'} no readings yet.`);
  return { lead: lead.join(' '), readings, concerns };
}
