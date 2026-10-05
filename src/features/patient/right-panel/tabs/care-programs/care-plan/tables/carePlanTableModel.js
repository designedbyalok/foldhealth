/* Status + date rules shared by the care-plan GBI tables, their drawers and
   the Comprehensive Care Plan, so every surface reads a plan item the same. */

/** Only a Met item leaves the active list; Not Met stays visible so a failed
 *  goal or unresolved barrier can't be overlooked. */
export const isCompletedStatus = (status) => status === 'Met';
const OUTCOME_STATUSES = new Set(['Met', 'Not Met']);

import { parseLocalDate } from '../../../../../../../lib/localDate';

// Stored plan dates are date-only ("2026-12-14"); see src/lib/localDate.
export const parseCarePlanDate = parseLocalDate;

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

/**
 * Who owns an intervention. Only Internal Task is assigned to a staff
 * member; every other kind runs on the member, so its owner is BY DESIGN
 * the patient even when the row hasn't been backfilled yet.
 * `patients` is the plan's patient as a one-item list.
 */
export function interventionOwner(i, patients) {
  const isMemberTask = i?.kind !== 'internal-task';
  const memberRow = (patients || [])[0] || null;
  const rawName = i?.assignee?.name || '';
  const rawInitials = i?.assignee?.initials || '';
  const name = isMemberTask ? (memberRow?.name || rawName) : rawName;
  const initials = isMemberTask ? (memberRow?.initials || rawInitials) : rawInitials;
  return {
    isMemberTask,
    name,
    initials,
    // A member task is never truly unassigned — the patient owns it.
    unassigned: !isMemberTask && (!name || name === 'Unassigned'),
  };
}
