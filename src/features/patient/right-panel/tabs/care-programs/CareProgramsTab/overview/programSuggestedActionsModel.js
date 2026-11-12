import { isProgramClosed } from '../../../../../data/programStatus';

/* Care program suggested actions: which suggestions are still open, and
   what each one's button does given the patient's programs right now. */

export const EVENT_KINDS = {
  adt: { label: 'ADT', icon: 'solar:hospital-linear' },
  efax: { label: 'eFax', icon: 'solar:printer-linear' },
  imaging: { label: 'Imaging', icon: 'solar:scanner-linear' },
  lab: { label: 'Lab', icon: 'solar:test-tube-linear' },
};

// A program's steps with sections opened up (kept here so the model needs no store).
const flatSteps = list => (list || []).flatMap(s => (s.type === 'section' ? s.children : [s]));
const mdyMs = d => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d || ''); return m ? new Date(+m[3], +m[1] - 1, +m[2]).getTime() : 0; };
const openProgram = (programs, code) => programs.find(p => p.code === code && !isProgramClosed(p.status)) || null;

/**
 * Open suggestions, newest event first. An enroll suggestion for a program
 * the patient is now in is `resolved` (done, nothing left to do).
 */
export function openSuggestions(rows, programs = []) {
  return rows
    .filter(r => (r.status || 'open') === 'open')
    .map(r => ({ ...r, resolved: r.action?.type === 'enroll' && !!openProgram(programs, r.action.code) }))
    .sort((a, b) => mdyMs(b.occurredAt) - mdyMs(a.occurredAt));
}

/**
 * The button: its label, and why it can't run yet when the program it needs
 * isn't open. `stepsOf(code)` lists a program's steps (stepsFor in the app).
 */
export function suggestionAction(r, programs = [], stepsOf = () => []) {
  const a = r.action || { type: 'review' };
  if (a.type === 'enroll') return { kind: 'enroll', label: `Enroll in ${a.code}` };
  if (a.type === 'task') return { kind: 'task', label: 'Create Task' };
  if (a.type === 'step') {
    const program = openProgram(programs, a.code);
    const step = program ? flatSteps(stepsOf(a.code)).find(s => s.name === a.step) : null;
    if (!program || !step) return { kind: 'step', label: `Open ${a.step}`, disabled: true, hint: `${a.code} isn't open for this patient` };
    return { kind: 'step', label: `Open ${a.step}`, program, stepId: step.id };
  }
  return { kind: 'review', label: 'Mark Reviewed' };
}
