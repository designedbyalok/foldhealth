import { apptPerson, personKey } from '../../ooo/oooUtils';
import { apptSpan } from '../../ooo/reassignUtils';
import { displayAppointmentStatus } from '../../../components/ScheduleDrawer/scheduleDrawerConstants';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * The days the List view covers (ISO, inclusive): the day, the Monday–Sunday
 * week (schedule-x's week) or the calendar month around `selectedDate`.
 */
export function periodRange(view, selectedDate) {
  const [y, m, d] = selectedDate.split('-').map(Number);
  if (view === 'day') return { from: selectedDate, to: selectedDate };
  if (view === 'month-grid') return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  const day = new Date(y, m - 1, d);
  const monday = new Date(y, m - 1, d - ((day.getDay() + 6) % 7));
  return { from: iso(monday), to: iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)) };
}

// "10-02-2026" → "2026-10-02".
export const apptIso = (a) => {
  const [mm, dd, yyyy] = String(a?.date || '').split('-');
  return yyyy ? `${yyyy}-${mm}-${dd}` : '';
};

export const inPeriod = (a, { from, to }) => {
  const day = apptIso(a);
  return !!day && day >= from && day <= to;
};

/** Minutes between start and end (30 when there's no end). */
export const durationMin = (a) => {
  const { start, end } = apptSpan(a);
  return Number.isNaN(start) ? 30 : Math.round((end - start) / 60000);
};

// Checked-in and checked-out visits have happened (or are happening): they
// can't be moved, reassigned or cancelled.
const LOCKED = {
  'Checked In': 'Checked in appointments can\'t be rescheduled, reassigned or cancelled',
  'Checked Out': 'Checked out appointments can\'t be rescheduled, reassigned or cancelled',
};
/** Why an appointment can't be selected for a bulk action, or null. */
export const lockedReason = (a) => LOCKED[a?.status] || null;

// The List view calls a scheduled (or older "Booked") appointment Booked.
export const statusLabel = (a) => {
  const label = displayAppointmentStatus(a?.status);
  return label === 'Scheduled' ? 'Booked' : label;
};

// What an appointment's status can be changed to, in the legacy order.
export const STATUS_OPTIONS = ['Proposed', 'Pending', 'Booked', 'Cancelled', 'No Show', 'Checked In', 'Checked Out', 'Declined'];

// What a picked status saves as: Booked is stored as "Scheduled", like new bookings.
export const statusValue = (label) => (label === 'Booked' ? 'Scheduled' : label);

// Why an appointment can't take `status` yet, or null. A patient can check
// in from the morning of the visit; No Show and Checked Out need it started.
export const statusBlockedReason = (a, status, now = Date.now()) => {
  const { start } = apptSpan(a);
  if (!start) return null;
  if (status === 'Checked In' && new Date(start).setHours(0, 0, 0, 0) > now) return 'Checked In is available from the day of the appointment';
  if ((status === 'No Show' || status === 'Checked Out') && start > now) return `${status} is available once the appointment has started`;
  return null;
};

const SORTERS = {
  date: (a, b) => apptSpan(a).start - apptSpan(b).start,
  member: (a, b) => String(a.patient_name || '').localeCompare(String(b.patient_name || '')),
  status: (a, b) => statusLabel(a).localeCompare(statusLabel(b)),
  type: (a, b) => String(a.appointment_type_name || '').localeCompare(String(b.appointment_type_name || '')),
};

/** Sorted copy; ties fall back to date and time. */
export function sortAppointments(list, key = 'date', dir = 'asc') {
  const by = SORTERS[key] || SORTERS.date;
  const sign = dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => sign * by(a, b) || SORTERS.date(a, b));
}

/**
 * Appointments by provider (primary user), providers A–Z, each keeping the
 * order it was given.
 */
export function groupByProvider(list) {
  const map = new Map();
  list.forEach((a) => {
    const who = apptPerson(a);
    const key = personKey(who) || 'Unassigned';
    if (!map.has(key)) map.set(key, { key, person: { ...who, name: who.name || 'Unassigned' }, appointments: [] });
    map.get(key).appointments.push(a);
  });
  return [...map.values()].sort((a, b) => a.person.name.localeCompare(b.person.name));
}

// "9:00 am" → "9:00 AM".
export const timeLabel = (t) => String(t || '').trim().toUpperCase();

// "9:00 am"–"9:30 am" → "9:00–9:30 AM"; across noon, "11:30 AM–12:15 PM".
export function timeRangeLabel(a) {
  const start = timeLabel(a?.time_start);
  const end = timeLabel(a?.time_end);
  if (!end) return start;
  const [sT, sM] = start.split(' ');
  const [eT, eM] = end.split(' ');
  return sM === eM ? `${sT}–${eT} ${eM}` : `${start}–${end}`;
}
// "10-02-2026" → "10/02/2026".
export const dateLabel = (d) => String(d || '').replace(/-/g, '/');

// A group session's type says so ("Group Diabetes Education"), as the
// calendar's month counts already read it.
export const isGroupAppointment = (a) => /group/i.test(a?.appointment_type_name || '');

/**
 * One provider's rows for the List view: each group session (same date, start
 * and type) folds into one row carrying its `members` (the appointments, one
 * per member); every other appointment stays its own row. Order is kept.
 */
export function sessionRows(appts) {
  const out = [];
  const sessions = new Map();
  appts.forEach((a) => {
    if (!isGroupAppointment(a)) { out.push(a); return; }
    const key = `${a.primary_user_id || a.primary_user}|${a.date}|${a.time_start}|${a.appointment_type_name}`;
    let row = sessions.get(key);
    if (!row) {
      row = { ...a, id: `group:${key}`, isGroup: true, members: [] };
      sessions.set(key, row);
      out.push(row);
    }
    row.members.push(a);
  });
  return out;
}
