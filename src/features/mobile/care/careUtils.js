// Shared helpers for the mobile care program and care plan screens. Status
// vocabularies come from the desktop modules so both layouts agree.

import { GBI_STATUS_META } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/gbiStatus';
import { isPastDue, fmtCarePlanDate } from '../../patient/right-panel/tabs/care-programs/care-plan/tables/carePlanTableModel';
import { patientLevelProgram } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanMode';

// Program status → Badge tone (same grouping as programStatus.js colors).
const PROGRAM_TONE = {
  New: 'primary',
  'Re-enrolled': 'primary',
  Engaged: 'warning',
  Enrolled: 'warning',
  Attempted: 'warning',
  'Unable to Reach': 'danger',
  Active: 'success',
  Paused: 'info',
  Declined: 'neutral',
  Completed: 'neutral',
  Discontinued: 'neutral',
  Closed: 'neutral',
};
export const programTone = (status) => PROGRAM_TONE[status] || 'primary';

// GBI badge tone names (lib/gbiStatus) → Badge tones.
const GBI_TONE = { grey: 'neutral', warning: 'warning', info: 'info', success: 'success', error: 'danger', secondary: 'secondary', disabled: 'neutral' };
export const gbiTone = (status) => GBI_TONE[GBI_STATUS_META[status]?.tone] || 'neutral';

/** "Overdue" when the item's date has passed and it's still open (never while the plan is paused). */
export function gbiDisplayStatus(status, date, paused) {
  return !paused && isPastDue(date, status) ? 'Overdue' : status;
}

export const fmtDate = (v) => fmtCarePlanDate(v);

/** The program a care plan belongs to: an enrollment, or the patient-level plan. */
export function carePlanProgram(patientId, programId, programs = []) {
  const hit = programs.find(p => String(p.id) === String(programId));
  if (hit) return hit;
  const patientLevel = patientLevelProgram(patientId);
  return String(programId) === patientLevel.id ? patientLevel : null;
}

/** MM/DD/YYYY for today, the format program dates are stored in. */
export function todayMDY() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

const STEP_SCREEN_DESKTOP_ONLY = /^(medication reconciliation|medication review|billing review|open diagnosis gaps|letters|letters\/efax|pre-?visit|snapshot|referral review)$/i;

/**
 * Whether a step's own screen is only on desktop (forms, med rec, billing,
 * letters…). Reviewed / Skip still work on mobile for every step.
 */
export function stepIsDesktopOnly(step) {
  if (!step) return false;
  if (step.formId) return true;
  const screen = step.screen || step.name || '';
  return step.kind === 'billing' || STEP_SCREEN_DESKTOP_ONLY.test(screen);
}

export const isCarePlanStep = (step) => (step?.screen || step?.name) === 'Care Plan';
