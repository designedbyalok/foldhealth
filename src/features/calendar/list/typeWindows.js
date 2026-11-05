import { sameName } from '../../ooo/oooUtils';
import { apptSpan } from '../../ooo/reassignUtils';

// An appointment type's "Limit cancel or reschedule time": how long before
// the appointment patients can still cancel or reschedule it themselves, in
// minutes (none: up to the time of the appointment). Staff can still act
// inside it; the bulk drawers flag those appointments for review first.
export const WINDOW_FIELD = { cancel: 'cancel_window_minutes', reschedule: 'reschedule_window_minutes' };

// Until appointment_type_windows_migration.sql runs, types read the same
// windows it seeds.
export const DEFAULT_WINDOWS = {
  'Annual Wellness Visit': { cancel_window_minutes: 1440, reschedule_window_minutes: 1440 },
  'Follow-up Appointment': { cancel_window_minutes: 240, reschedule_window_minutes: 120 },
};

export const WINDOW_UNITS = [
  { value: 'minutes', label: 'Minutes', minutes: 1 },
  { value: 'hours', label: 'Hours', minutes: 60 },
  { value: 'days', label: 'Days', minutes: 1440 },
];

/** Minutes → the largest whole unit: 1440 → { count: 1, unit: 'days' }. */
export function splitWindow(minutes) {
  const m = Number(minutes) || 0;
  const unit = [...WINDOW_UNITS].reverse().find(u => m && m % u.minutes === 0) || WINDOW_UNITS[0];
  return { count: m ? m / unit.minutes : '', unit: unit.value };
}

export const joinWindow = (count, unit) => (Number(count) || 0) * (WINDOW_UNITS.find(u => u.value === unit)?.minutes || 1);

/** "24 hours", "1 day", "30 minutes". */
export function windowLabel(minutes) {
  const { count, unit } = splitWindow(minutes);
  return `${count} ${count === 1 ? unit.slice(0, -1) : unit}`;
}

/** The appointment's type, by id, else by name. */
export const typeOf = (types, a) => (types || []).find(t => (a.appointment_type_id && t.id === a.appointment_type_id) || sameName(t.name, a.appointment_type_name));

/** The type's window for `kind` ('cancel' | 'reschedule'), in minutes, or null. */
export function windowFor(types, a, kind) {
  const m = Number(typeOf(types, a)?.[WINDOW_FIELD[kind]]);
  return m > 0 ? m : null;
}

/**
 * Whether the appointment is inside its type's window: it hasn't started,
 * and starts sooner than the window allows patients to `kind` it.
 */
export function insideWindow(types, a, kind, now = Date.now()) {
  const m = windowFor(types, a, kind);
  if (!m) return false;
  const { start } = apptSpan(a);
  return Number.isFinite(start) && start > now && start - now < m * 60000;
}
