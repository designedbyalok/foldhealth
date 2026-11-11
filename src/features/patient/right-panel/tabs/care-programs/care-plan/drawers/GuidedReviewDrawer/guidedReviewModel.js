import { isClosedStatus } from '../../lib/gbiStatus';
import { goalMeasurements } from '../../lib/goalMetrics';
import { evaluateReading } from '../../lib/goalReadings';
import { barrierGoalIdsOf } from '../../lib/carePlanGoalCascade';
import { fmtCarePlanDate, isPastDue, parseCarePlanDate } from '../../tables/carePlanTableModel';
import { formatGoalTarget } from '../../../../../../../settings/care-plan-library/lib/goalFormat';

/* The guided care plan review (care plan redesign prototype, item 7): one
   step per open goal with its barriers and interventions, then the
   interventions and barriers no goal covers, Suggested Actions, the
   patient's tasks, and Wrap Up. Every item keeps its current state until
   the reviewer picks something; picks are kept on the open review
   (care_plan_call_reviews.discussed) and applied to the plan at Wrap Up. */

// The first choice keeps the item as it is.
export const CHOICES = {
  goal: ['Continue', 'Met', 'Not Met', 'Discontinue'],
  barrier: ['Still a Barrier', 'Resolved', 'Not Applicable'],
  intervention: ['Continue', 'Done', 'Reschedule', 'Stop'],
};
const STATUS_FOR = {
  goal: { Met: 'Met', 'Not Met': 'Not Met', Discontinue: 'Discontinued' },
  barrier: { Resolved: 'Resolved', 'Not Applicable': 'Not Applicable' },
  intervention: { Done: 'Met', Stop: 'Discontinued' },
};
const CHANGE_LABEL = { Done: 'Completed', Stop: 'Stopped', Discontinue: 'Discontinued' };
const CHANGE_TONE = {
  Met: 'success', Resolved: 'success', Done: 'success',
  'Not Met': 'danger', Stop: 'danger',
  Discontinue: 'neutral', 'Not Applicable': 'neutral', Reschedule: 'warning',
};
export const NOTE_TAGS = ['Patient reported', 'Education given', 'Follow-up needed', 'Barrier found'];

const itemKey = (kind, id) => `${kind}:${id}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function lateDays(iso, status) {
  if (!iso || !isPastDue(iso, status)) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseCarePlanDate(iso);
  return due ? Math.max(1, Math.round((today - due) / 86400000)) : 0;
}

function readingText(m) {
  return [m.value, m.unit && !String(m.value).includes(m.unit) ? m.unit : ''].filter(Boolean).join(' ');
}
const metOf = (goal, m) => (typeof m.favorable === 'boolean' ? m.favorable : evaluateReading(goal, m.value));

function interventionRow(i, dueOf) {
  const due = dueOf(i) || {};
  const late = lateDays(due.iso, i.status);
  return {
    kind: 'intervention',
    key: itemKey('intervention', i.id),
    item: i,
    due,
    late,
    // Only what the record shows: an overdue intervention is worth moving.
    suggestion: late ? { choice: 'Reschedule', why: `${plural(late, 'day')} overdue` } : null,
  };
}

/**
 * The review's steps from the live plan. Open goals come first when they
 * need attention (an off-target reading, an overdue intervention, a barrier
 * nothing addresses), then the rest, in plan order.
 */
export function buildReviewSteps({ goals = [], interventions = [], barriers = [], measurements = [], dueOf = () => ({}) }) {
  const openInts = interventions.filter(i => !isClosedStatus(i.status));
  const openBars = barriers.filter(b => !isClosedStatus(b.status));
  const used = new Set();
  const barrierGoals = new Map(openBars.map(b => [b, new Set(barrierGoalIdsOf(b).map(String))]));

  const goalSteps = goals.filter(g => !isClosedStatus(g.status)).map((goal, order) => {
    const ints = openInts.filter(i => String(i.goalId) === String(goal.id)).map(i => interventionRow(i, dueOf));
    const bars = openBars.filter(b => barrierGoals.get(b).has(String(goal.id)));
    ints.forEach(r => used.add(r.key));
    bars.forEach(b => used.add(itemKey('barrier', b.id)));
    const addressed = new Set(ints.map(r => String(r.item.config?.barrierId || '')).filter(Boolean));
    // The goal's own open interventions count as working on its barriers, as Look at These First reads them.
    const barrierRows = bars.map(b => ({
      kind: 'barrier',
      key: itemKey('barrier', b.id),
      item: b,
      orphan: !ints.length && !addressed.has(String(b.id)),
    }));

    const rows = goalMeasurements(goal.id, measurements);
    const latest = rows[rows.length - 1] || null;
    const met = latest ? metOf(goal, latest) : null;
    const readings = rows.slice(-3).map(m => ({ id: m.id || m.takenAt, date: fmtCarePlanDate(m.takenAt) || '', value: readingText(m), met: metOf(goal, m) }));
    const overdue = ints.filter(r => r.late);
    const orphans = barrierRows.filter(r => r.orphan);

    const facts = [];
    if (latest) {
      const target = formatGoalTarget(goal);
      facts.push(`Latest reading ${readingText(latest)}${latest.takenAt ? ` on ${fmtCarePlanDate(latest.takenAt)}` : ''}${target ? `, against a target of ${target}` : ''}${met === false ? '. It is off target.' : met ? '. It is on target.' : '.'}`);
      if (rows.length >= 2) {
        const prev = rows[rows.length - 2];
        facts.push(`Previous reading ${readingText(prev)}${prev.takenAt ? ` on ${fmtCarePlanDate(prev.takenAt)}` : ''}.`);
      }
    } else {
      facts.push('No readings recorded for this goal yet.');
    }
    overdue.forEach(r => facts.push(`${r.item.title} is ${plural(r.late, 'day')} overdue.`));
    orphans.forEach(r => facts.push(`Nothing addresses the barrier "${r.item.title}".`));

    const attention = met === false ? { label: 'Off Target', tone: 'danger', rank: 0 }
      : overdue.length ? { label: `${overdue.length} Overdue`, tone: 'danger', rank: 0 }
        : orphans.length ? { label: 'Barrier Unaddressed', tone: 'warning', rank: 1 }
          : met ? { label: 'On Target', tone: 'success', rank: 2 }
            : { label: latest ? 'Check Reading' : 'No Reading', tone: 'neutral', rank: 2 };

    return {
      type: 'goal',
      key: itemKey('goal', goal.id),
      title: goal.title,
      goal,
      order,
      attention,
      target: formatGoalTarget(goal),
      readings,
      met,
      facts,
      barriers: barrierRows,
      interventions: ints,
    };
  }).sort((a, b) => a.attention.rank - b.attention.rank || a.order - b.order);

  const steps = [...goalSteps];
  const otherInts = openInts.map(i => interventionRow(i, dueOf)).filter(r => !used.has(r.key));
  const otherBars = openBars.filter(b => !used.has(itemKey('barrier', b.id)))
    .map(b => ({ kind: 'barrier', key: itemKey('barrier', b.id), item: b, orphan: false }));
  if (otherInts.length || otherBars.length) {
    const overdue = otherInts.filter(r => r.late).length;
    steps.push({
      type: 'other',
      key: 'other',
      title: 'Not Linked to a Goal',
      attention: overdue ? { label: `${overdue} Overdue`, tone: 'danger' } : { label: plural(otherInts.length + otherBars.length, 'Item'), tone: 'neutral' },
      barriers: otherBars,
      interventions: otherInts,
    });
  }
  steps.push({ type: 'actions', key: 'actions', title: 'Suggested Actions' });
  steps.push({ type: 'tasks', key: 'tasks', title: 'Pending Patient Tasks' });
  steps.push({ type: 'wrap', key: 'wrap', title: 'Wrap Up' });
  return steps;
}

/** Every item a step reviews, as `${kind}:${id}` keys (the goal's own first). */
export function stepItemKeys(step) {
  return [
    ...(step.type === 'goal' ? [step.key] : []),
    ...(step.barriers || []).map(r => r.key),
    ...(step.interventions || []).map(r => r.key),
  ];
}

/**
 * A plan step counts as reviewed once Confirm saved `confirmed` on its items.
 * Suggested Actions and the tasks have no plan items: `done` holds the ones
 * confirmed in this sitting.
 */
export function isStepConfirmed(step, entries = {}, done = new Set()) {
  if (step.type === 'goal') return !!entries[step.key]?.confirmed;
  if (step.type === 'other') return stepItemKeys(step).every(k => entries[k]?.confirmed);
  return done.has(step.key);
}

/** Where a resumed review picks up: the first plan step not reviewed yet. */
export function firstOpenStep(steps, entries = {}) {
  const i = steps.findIndex(s => (s.type === 'goal' || s.type === 'other') && !isStepConfirmed(s, entries));
  return i < 0 ? Math.max(0, steps.findIndex(s => s.type === 'actions')) : i;
}

/** The plan changes the picks add up to, in step order. A barrier on several goals counts once. */
export function reviewChanges(steps, entries = {}) {
  const out = [];
  const seen = new Set();
  for (const step of steps) {
    const rows = [
      ...(step.type === 'goal' ? [{ kind: 'goal', key: step.key, item: step.goal }] : []),
      ...(step.barriers || []),
      ...(step.interventions || []),
    ];
    for (const row of rows) {
      if (seen.has(row.key)) continue;
      seen.add(row.key);
      const pick = entries[row.key]?.decision;
      if (!pick || pick === CHOICES[row.kind][0]) continue;
      if (pick === 'Reschedule') {
        const dueDate = entries[row.key]?.dueDate;
        if (!dueDate) continue;
        out.push({ ...row, pick, dueDate, label: `Rescheduled to ${fmtCarePlanDate(dueDate)}`, tone: CHANGE_TONE.Reschedule });
        continue;
      }
      out.push({ ...row, pick, status: STATUS_FOR[row.kind][pick], label: CHANGE_LABEL[pick] || pick, tone: CHANGE_TONE[pick] || 'neutral' });
    }
  }
  return out;
}

/** Steps with items that were neither confirmed nor touched. */
export function skippedSteps(steps, entries = {}) {
  return steps.filter(s => (s.type === 'goal' || s.type === 'other')
    && !isStepConfirmed(s, entries)
    && !stepItemKeys(s).some(k => entries[k]?.decision));
}

const KIND_WORD = { goal: 'Goal', barrier: 'Barrier', intervention: 'Intervention' };

/** The review note Wrap Up starts from: what changed, what wasn't reviewed, the tags used. */
export function draftReviewNote({ firstName = '', changes = [], skipped = [], entries = {} }) {
  const parts = [`Care plan reviewed${firstName ? ` with ${firstName}` : ''}.`];
  parts.push(changes.length
    ? `${changes.map(c => `${KIND_WORD[c.kind]} "${c.item.title}": ${c.label}`).join('; ')}.`
    : 'No changes to the plan.');
  if (skipped.length) parts.push(`Not reviewed: ${skipped.map(s => s.title).join(', ')}.`);
  const tags = [...new Set(Object.values(entries).flatMap(e => (Array.isArray(e?.tags) ? e.tags : [])))];
  if (tags.length) parts.push(`Tags: ${tags.join(', ')}.`);
  return parts.join(' ');
}
