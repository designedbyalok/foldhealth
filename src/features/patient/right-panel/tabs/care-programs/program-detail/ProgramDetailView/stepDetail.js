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
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addBusinessDays = (d, n) => {
  const x = new Date(d);
  for (let left = n; left > 0;) { x.setDate(x.getDate() + 1); if (x.getDay() % 6 !== 0) left -= 1; }
  return x;
};

// Transitions of care run on the discharge date (the enrollment's trigger):
// an interactive contact within 2 business days and a face-to-face follow-up
// within 7 days (TCM high complexity), with medications reconciled by then.
const TOC = /^TOC (IP|ED)$/;
const dischargeOf = ctx => (TOC.test(ctx.program?.code || '') ? parseLocalDate(ctx.program?.triggerDate) : null);
const STOPPED_MED = /stopped|discontinued|inactive/i;
const medWord = m => String(m.name || '').split(/\s+/)[0];

/**
 * One line on where an open step stands, read from the records behind it
 * (the same ctx as deriveStepStatus), and whether it's urgent. Nothing is
 * inferred beyond the records: a step with none says "Required" when it is
 * mandatory, and nothing otherwise.
 *
 * `ctx.dueOf(intervention)` gives an intervention's due date (the care plan
 * table's computeDueDate), for the Care Plan step's overdue count.
 *
 * `title` / `label` (optional) name what the step comes down to right now
 * (the task to do, "Interactive Contact") for a list of actions.
 *
 * @returns {{ text: string, urgent: boolean, title?: string, label?: string } | null}
 */
export function stepDetail(step, ctx) {
  // CCM calls its plan step "Care Plan Details".
  const name = step.name === 'Care Plan Details' ? 'Care Plan' : step.name || '';
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

  // The task to do next, by name: an overdue one first, then the soonest due.
  if (name === 'Program Related Task' || name === 'Tasks') {
    const open = (ctx.tasks || []).filter(t => !DONE_TASK.test(t.status || ''));
    if (!open.length) return required ? { text: 'Required', urgent: false } : null;
    const dueOfTask = t => parseLocalDate(String(t.due_date || '').replace(/-/g, '/'));
    const isOverdue = t => t.status === 'missed' || (dueOfTask(t) && dueOfTask(t) < today());
    const [first] = [...open].sort((a, b) => (isOverdue(b) - isOverdue(a)) || ((dueOfTask(a) || Infinity) - (dueOfTask(b) || Infinity)));
    const due = dueOfTask(first);
    const when = isOverdue(first) ? `Overdue${due ? `, due ${fmt(due)}` : ''}` : due ? `Due ${fmt(due)}` : 'Open';
    return {
      title: first.name,
      label: 'Program Task',
      text: `${when}${open.length > 1 ? ` • ${open.length - 1} more` : ''}`,
      // Overdue, or due by tomorrow.
      urgent: open.some(t => isOverdue(t) || (dueOfTask(t) && dueOfTask(t) <= addDays(today(), 1))),
    };
  }

  // Interactive contact after a discharge: due within 2 business days.
  if (name === 'Outreach' && dischargeOf(ctx)) {
    const due = addBusinessDays(dischargeOf(ctx), 2);
    return { title: 'Interactive Contact', text: `${due < today() ? 'Overdue, due' : 'Due'} ${fmt(due)} (2 business days after discharge)`, urgent: true };
  }

  if (name === 'Program Related Files' || name === 'Program Documents' || name === 'Documents') {
    return { text: 'No documents yet', urgent: false };
  }

  // Medications started since the discharge (or the enrollment) that the
  // reconciliation hasn't covered yet; urgent after a discharge.
  if (name === 'Medication Reconciliation' || name === 'Medication Review') {
    const discharge = dischargeOf(ctx);
    const since = discharge || parseLocalDate(ctx.program?.startDate);
    const added = since ? (ctx.medications || []).filter(m => !STOPPED_MED.test(m.status || '') && parseLocalDate(m.start) >= since) : [];
    if (!added.length) return { text: 'Not signed yet', urgent: false };
    const names = added.slice(0, 3).map(medWord).join(', ');
    return {
      title: discharge ? 'Medication Reconciliation' : undefined,
      text: `${added.length} new since ${discharge ? 'discharge' : 'enrollment'} ${fmt(since)}: ${names}${added.length > 3 ? ', …' : ''}`,
      urgent: !!discharge,
    };
  }

  if (/appointment/i.test(name)) {
    const wantIct = /ict/i.test(name);
    // After a discharge: the follow-up visit has to land within 7 days.
    const discharge = dischargeOf(ctx);
    if (discharge && !wantIct) {
      const by = addDays(discharge, 7);
      const next = (ctx.appointments || [])
        .filter(a => OPEN_APPT.test(a.status || '') || !a.status)
        .map(a => parseLocalDate(String(a.date || '').replace(/-/g, '/')))
        .filter(d => d && d >= today())
        .sort((a, b) => a - b)[0];
      if (next && next <= by) return { title: '7-Day Follow-Up Visit', text: `Scheduled ${fmt(next)}`, urgent: false };
      return {
        title: '7-Day Follow-Up Visit',
        text: next ? `Book by ${fmt(by)}; the ${fmt(next)} visit is after the 7-day window` : `Not booked; due by ${fmt(by)}`,
        urgent: true,
      };
    }
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
  // A program with no required steps (CCM) still has a next step: its first open one.
  const nextRequired = steps.some(s => s.mandatory)
    ? open.find(s => s.mandatory && s.status === STEP_STATUS.pending && !s.detail.urgent)
    : open.find(s => s.status === STEP_STATUS.pending && !s.detail.urgent);
  return open
    .filter(s => s.detail.urgent || s.status === STEP_STATUS.inProgress || s === nextRequired)
    .sort((a, b) => rank(a) - rank(b));
}
