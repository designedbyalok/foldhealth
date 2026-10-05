/* Status + date rules shared by the care-plan GBI tables, their drawers and
   the Comprehensive Care Plan, so every surface reads a plan item the same. */

/** Only a Met item leaves the active list; Not Met stays visible so a failed
 *  goal or unresolved barrier can't be overlooked. */
export const isCompletedStatus = (status) => status === 'Met';
const OUTCOME_STATUSES = new Set(['Met', 'Not Met']);

// Stored plan dates are date-only ("2026-12-14"). `new Date()` reads those as
// UTC midnight, which renders a day early west of UTC, so parse them locally.
export function parseCarePlanDate(v) {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n) => String(n).padStart(2, '0');

/** MM/DD/YYYY, or null when there's no real date. */
export function fmtCarePlanDate(v) {
  const d = parseCarePlanDate(v);
  return d ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}` : null;
}

/** YYYY-MM-DD for DatePickerPopover; null when there's no real date. */
export function toPickerValue(v) {
  const d = parseCarePlanDate(v);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;
}

/** Past its date and not yet resolved either way (Met / Not Met). */
export function isPastDue(v, status) {
  const d = parseCarePlanDate(v);
  if (!d || OUTCOME_STATUSES.has(status)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}
