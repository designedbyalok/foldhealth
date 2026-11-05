import { isProgramClosed } from './programStatus';

// A program's enrollments ("instances"): CCM #1 closed, CCM #2 running. A
// program (or a CMP sub-program) can be enrolled again once every earlier
// instance has ended; SNP takes a new instance per trigger regardless.

const sameProgram = (p, code, subProgram) => p.code === code && (p.subProgram || null) === (subProgram || null);

/**
 * Whether `code` (+ `subProgram`) can be enrolled now, the instance number it
 * would get, and whether it counts as a re-enrollment (an earlier one ended).
 */
export function nextEnrollment(existing, code, subProgram = null, { triggerable = false } = {}) {
  const prior = (existing || []).filter(p => sameProgram(p, code, subProgram));
  const open = prior.some(p => !isProgramClosed(p.status));
  return {
    allowed: triggerable || !open,
    instance: prior.length + 1,
    reEnrolled: prior.length > 0 && prior.some(p => isProgramClosed(p.status)),
  };
}

/** MM/DD/YYYY `days` after `start` (MM/DD/YYYY), or null without a duration. */
export function plannedEndDate(start, days) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(start || ''));
  const n = Number(days);
  if (!m || !Number.isFinite(n) || n <= 0) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]) + n);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

/** "CCM #2" when the patient has more than one instance of it, else "CCM". */
export function instanceLabel(program, programs) {
  const count = (programs || []).filter(p => sameProgram(p, program.code, program.subProgram)).length;
  const n = program.instance || program.trigger || 1;
  return count > 1 || n > 1 ? `${program.code} #${n}` : program.code;
}

/** This program's earlier instances (not this one), newest first. */
export function previousInstances(program, programs) {
  return (programs || [])
    .filter(p => p.id !== program.id && sameProgram(p, program.code, program.subProgram))
    .sort((a, b) => (b.instance || b.trigger || 0) - (a.instance || a.trigger || 0));
}
