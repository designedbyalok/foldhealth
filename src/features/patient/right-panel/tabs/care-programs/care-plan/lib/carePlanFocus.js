import { isClosedStatus } from './gbiStatus';
import { goalMeasurements } from './goalMetrics';
import { barrierGoalIdsOf } from './carePlanGoalCascade';
import { fmtCarePlanDate, isPastDue } from '../tables/carePlanTableModel';

const SEVERITY = { danger: 0, warning: 1 };

/** The kinds, in the order a grouped list shows them, with their headings. */
export const FOCUS_GROUPS = [
  { kind: 'review', label: 'Care Plan Review' },
  { kind: 'goal', label: 'Off-Target Goals' },
  { kind: 'intervention', label: 'Overdue Interventions' },
  { kind: 'barrier', label: 'Unaddressed Barriers' },
];

/**
 * "Look at These First" in the care plan side panel: what needs attention,
 * read only from the plan itself, most urgent first.
 *
 * - A review that is due or overdue (from useReviewCadence).
 * - An open goal whose latest reading is unfavorable.
 * - An open intervention past its due date (the same date the table shows).
 * - An open barrier with no open intervention on any of its goals, and no
 *   open intervention aimed at it directly (an SDOH referral carries
 *   config.barrierId). Other interventions belong to goals, not barriers, so
 *   this is the closest honest reading of "nothing is addressing it".
 *
 * `dueOf(intervention)` returns its due date as `{ iso, formatted }`: the
 * table's computeDueDate, so a flagged row reads overdue in the table too.
 *
 * Each entry: { key, kind, item?, severity, title, text, name, reason }:
 * `title` / `text` read as a sentence; `name` (the item) and `reason` (why
 * it's listed) are the short form for a list grouped by kind (FOCUS_GROUPS).
 */
export function carePlanFocusItems({ goals = [], interventions = [], barriers = [], measurements = [], dueOf = () => ({}), review = null }) {
  const out = [];

  if (review?.status?.state === 'overdue' || review?.status?.state === 'due') {
    const late = review.status.daysOverdue;
    out.push({
      key: 'review',
      kind: 'review',
      severity: review.status.state === 'overdue' ? 'danger' : 'warning',
      title: review.status.state === 'overdue' ? `Care plan review overdue by ${late} ${late === 1 ? 'day' : 'days'}` : 'Care plan review due',
      text: review.lastReview ? `Last reviewed ${fmtCarePlanDate(review.lastReview)}.` : 'Not reviewed yet.',
      name: review.status.state === 'overdue' ? `Overdue by ${late} ${late === 1 ? 'day' : 'days'}` : 'Due now',
      reason: review.lastReview ? `Last reviewed ${fmtCarePlanDate(review.lastReview)}` : 'Not reviewed yet',
    });
  }

  for (const g of goals) {
    if (isClosedStatus(g.status)) continue;
    const rows = goalMeasurements(g.id, measurements);
    const latest = rows[rows.length - 1];
    if (!latest || latest.favorable !== false) continue;
    const value = [latest.value, latest.unit && !String(latest.value).includes(latest.unit) ? latest.unit : ''].filter(Boolean).join(' ');
    out.push({
      key: `goal:${g.id}`,
      kind: 'goal',
      item: g,
      severity: 'danger',
      title: `${g.title} is off target`,
      text: `Latest reading ${value}${latest.takenAt ? ` on ${fmtCarePlanDate(latest.takenAt)}` : ''}.`,
      name: g.title,
      reason: `Latest ${value}${latest.takenAt ? ` on ${fmtCarePlanDate(latest.takenAt)}` : ''}`,
    });
  }

  for (const i of interventions) {
    const due = dueOf(i) || {};
    if (!due.iso || !isPastDue(due.iso, i.status)) continue;
    out.push({
      key: `intervention:${i.id}`,
      kind: 'intervention',
      item: i,
      severity: 'danger',
      title: `${i.title} is overdue`,
      text: `Due ${due.formatted}.`,
      name: i.title,
      reason: `Due ${due.formatted}`,
    });
  }

  const open = interventions.filter(i => !isClosedStatus(i.status));
  const openByGoal = new Set(open.filter(i => i.goalId).map(i => String(i.goalId)));
  const openByBarrier = new Set(open.filter(i => i.config?.barrierId).map(i => String(i.config.barrierId)));
  for (const b of barriers) {
    if (isClosedStatus(b.status) || openByBarrier.has(String(b.id))) continue;
    const goalIds = barrierGoalIdsOf(b).map(String);
    if (goalIds.some(id => openByGoal.has(id))) continue;
    out.push({
      key: `barrier:${b.id}`,
      kind: 'barrier',
      item: b,
      severity: 'warning',
      title: `${b.title} has nothing addressing it`,
      text: goalIds.length ? 'None of its goals has an open intervention.' : 'It is not linked to a goal.',
      name: b.title,
      reason: goalIds.length ? 'Its goals have no open intervention' : 'Not linked to a goal',
    });
  }

  return out.sort((a, b) => SEVERITY[a.severity] - SEVERITY[b.severity]);
}
