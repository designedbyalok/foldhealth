import { isClosedStatus } from './gbiStatus';
import { goalMeasurements } from './goalMetrics';
import { barrierGoalIdsOf } from './carePlanGoalCascade';
import { fmtCarePlanDate, isPastDue } from '../tables/carePlanTableModel';

const SEVERITY = { danger: 0, warning: 1 };

/**
 * "Look at These First" in the care plan side panel: what needs attention,
 * read only from the plan itself, most urgent first.
 *
 * - A review that is due or overdue (from useReviewCadence).
 * - An open goal whose latest reading is unfavorable.
 * - An open intervention past its due date (the same date the table shows).
 * - An open barrier with no open intervention on any of its goals.
 *   Interventions belong to goals, not barriers, so this is the closest
 *   honest reading of "nothing is addressing it".
 *
 * `dueOf(intervention)` returns its due date as `{ iso, formatted }`, the
 * table's computeDueDate with the paired task, so both agree on "overdue".
 *
 * Each entry: { key, kind, item?, severity, title, text }.
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
    });
  }

  const openByGoal = new Set(interventions.filter(i => i.goalId && !isClosedStatus(i.status)).map(i => String(i.goalId)));
  for (const b of barriers) {
    if (isClosedStatus(b.status)) continue;
    const goalIds = barrierGoalIdsOf(b).map(String);
    if (goalIds.some(id => openByGoal.has(id))) continue;
    out.push({
      key: `barrier:${b.id}`,
      kind: 'barrier',
      item: b,
      severity: 'warning',
      title: `${b.title} has nothing addressing it`,
      text: goalIds.length ? 'None of its goals has an open intervention.' : 'It is not linked to a goal.',
    });
  }

  return out.sort((a, b) => SEVERITY[a.severity] - SEVERITY[b.severity]);
}
