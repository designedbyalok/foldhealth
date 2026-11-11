import { parseLocalDate } from '../../../../../../../lib/localDate';
import { carePlanFocusItems } from '../../care-plan/lib/carePlanFocus';
import { carePlanAwaitingSignature } from '../../care-plan/lib/carePlanSignState';
import { STEP_STATUS } from './stepStatus';

const DONE_TASK = /^(completed|done|closed)$/i;
const OPEN_APPT = /^(scheduled|booked|pending|confirmed|rescheduled)$/i;
const NOUN = { goal: ['goal', 'goals'], intervention: ['intervention', 'interventions'], barrier: ['barrier', 'barriers'] };
const ISSUE = { goal: 'off target', intervention: 'overdue', barrier: 'with nothing addressing it' };

const fmt = d => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

/**
 * One line on where an open step stands, read from the records behind it
 * (the same ctx as deriveStepStatus), and whether it's urgent. Nothing is
 * inferred beyond the records: a step with none says "Required" when it is
 * mandatory, and nothing otherwise.
 *
 * `ctx.dueOf(intervention)` gives an intervention's due date (the care plan
 * table's computeDueDate), for the Care Plan step's overdue count.
 *
 * @returns {{ text: string, urgent: boolean } | null}
 */
export function stepDetail(step, ctx) {
  const name = step.name || '';
  const required = !!step.mandatory;

  if (name === 'Care Plan') {
    const cp = ctx.carePlan;
    const count = (cp?.goals || []).length + (cp?.interventions || []).length + (cp?.barriers || []).length;
    if (!cp?.plan || !count) return { text: 'No care plan yet', urgent: false };
    if (carePlanAwaitingSignature(cp)) return { text: `Awaiting ${cp.plan.awaitingSigner || 'the provider'}'s signature`, urgent: false };
    const attention = carePlanFocusItems({
      goals: cp.goals, interventions: cp.interventions, barriers: cp.barriers,
      measurements: cp.measurements || [], dueOf: ctx.dueOf || (() => ({})),
    });
    const parts = ['goal', 'intervention', 'barrier'].map(kind => {
      const n = attention.filter(a => a.kind === kind).length;
      return n ? `${n} ${NOUN[kind][n === 1 ? 0 : 1]} ${ISSUE[kind]}` : null;
    }).filter(Boolean);
    if (parts.length) return { text: parts.join(' • '), urgent: true };
    return { text: cp.plan.signedAt ? 'Changed since it was signed' : 'Not signed yet', urgent: false };
  }

  if (name === 'Program Related Task' || name === 'Tasks') {
    const open = (ctx.tasks || []).filter(t => !DONE_TASK.test(t.status || ''));
    if (!open.length) return required ? { text: 'Required', urgent: false } : null;
    const overdue = open.filter(t => t.status === 'missed' || (parseLocalDate(t.due_date) && parseLocalDate(t.due_date) < today())).length;
    return { text: `${open.length} open${overdue ? ` • ${overdue} overdue` : ''}`, urgent: overdue > 0 };
  }

  if (name === 'Program Related Files' || name === 'Program Documents' || name === 'Documents') {
    return { text: 'No documents yet', urgent: false };
  }

  if (name === 'Medication Reconciliation' || name === 'Medication Review') {
    return { text: 'Not signed yet', urgent: false };
  }

  if (/appointment/i.test(name)) {
    const wantIct = /ict/i.test(name);
    const dates = (ctx.appointments || [])
      .filter(a => (!wantIct || /ict|interdisciplinary/i.test(`${a.appointment_type_name || ''} ${a.title || ''}`)) && (OPEN_APPT.test(a.status || '') || !a.status))
      .map(a => parseLocalDate(a.date))
      .filter(Boolean)
      .sort((a, b) => a - b);
    const next = dates.find(d => d >= today());
    if (next) return { text: `Scheduled ${fmt(next)}`, urgent: false };
    // Still marked scheduled, but its date has passed.
    const last = dates[dates.length - 1];
    if (last) return { text: `${fmt(last)} not marked done`, urgent: false };
    return { text: 'None scheduled', urgent: false };
  }

  return required ? { text: 'Required', urgent: false } : null;
}

/**
 * Do Next for one enrollment: what needs doing next, not the whole checklist.
 * Its open steps (pending or in progress) that are urgent or already under
 * way, plus the next required step in the program's order. Urgent first,
 * then the next required step, then the rest. `steps` is the flat step list
 * in order, with status from deriveStepStatus.
 */
export function openStepsWithDetail(steps, ctx) {
  const rank = s => (s.detail.urgent ? 0 : s.mandatory && s.status === STEP_STATUS.pending ? 1 : 2);
  const open = steps
    .filter(s => s.status === STEP_STATUS.pending || s.status === STEP_STATUS.inProgress)
    .map(s => ({ ...s, detail: stepDetail(s, ctx) }))
    .filter(s => s.detail);
  const nextRequired = open.find(s => s.mandatory && s.status === STEP_STATUS.pending && !s.detail.urgent);
  return open
    .filter(s => s.detail.urgent || s.status === STEP_STATUS.inProgress || s === nextRequired)
    .sort((a, b) => rank(a) - rank(b));
}
