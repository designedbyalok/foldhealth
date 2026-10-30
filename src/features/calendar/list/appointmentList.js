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

export const statusLabel = (a) => displayAppointmentStatus(a?.status);

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
