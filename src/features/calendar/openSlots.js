import { apptPerson, recordsFor, recordsOnDate, samePerson } from '../ooo/oooUtils';
import { holidayDuring } from '../holidays/holidayUtils';
import { apptSpan } from '../ooo/reassignUtils';
import { blockStatus, isoDay, zonedInstant } from '../settings/calendar/availability/availabilityUtils';
import { occursOn } from '../settings/calendar/availability/newViewUtils';

// The calendar grid runs 00:00–23:00 (CalendarContent's dayBoundaries).
const DAY_MIN = 23 * 60;
// Someone with no availability of their own follows practice hours, the
// times the booking drawer offers (6 am–8 pm).
const PRACTICE_HOURS = [[6 * 60, 20 * 60]];
const STEP_MIN = 30;
// Same rule as booking from the grid.
const LEAD_MS = 15 * 60000;

/**
 * The user's bookable windows on the viewer's day `date`, merged, in minutes
 * from that day's midnight. Each slot's hours are in its own timezone, so a
 * slot on the day before or after (in its zone) can land on this day too;
 * holidays and repeat rules go by the slot's own date.
 */
export function windowsOn(segments, date, isHoliday) {
  const [y, m, d] = date.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d).getTime();
  const dayEnd = dayStart + DAY_MIN * 60000;
  const raw = [];
  [-1, 0, 1].forEach((shift) => {
    const slotDay = new Date(y, m - 1, d + shift);
    const iso = isoDay(slotDay);
    segments
      .filter(s => blockStatus(s) !== 'expired' && occursOn(s, slotDay) && !(isHoliday(iso) && s.skipHolidays))
      .forEach(s => (s.slots || []).filter(sl => sl.start && sl.end).forEach((sl) => {
        const a = Math.max(dayStart, zonedInstant(iso, sl.start, s.timezone));
        const b = Math.min(dayEnd, zonedInstant(iso, sl.end, s.timezone));
        if (b > a) raw.push([(a - dayStart) / 60000, (b - dayStart) / 60000]);
      }));
  });
  raw.sort((p, q) => p[0] - q[0]);
  const merged = [];
  raw.forEach(([a, b]) => {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  });
  return merged;
}

/** A person's own availability segments (by id, else by name). */
export const segmentsFor = (segments, who) => (segments || []).filter(s => (s.userId && who?.id && String(s.userId) === String(who.id))
  || String(s.userName || '').toLowerCase() === String(who?.name || '').toLowerCase());

// Minutes from midnight → "9:30 am", the format appointments store.
export function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/**
 * The start times a provider can be booked for on `date` (ISO), for an
 * appointment of `durationMin`: inside their availability (or practice
 * hours), not on a holiday at their locations, not while they're out of
 * office, not over another of their appointments or a span in `taken`, and
 * at least 15 minutes from now.
 *
 * @param {object}   opts
 * @param {string}   opts.date          – ISO day
 * @param {{ id, name }} opts.person
 * @param {number}   opts.durationMin
 * @param {object[]} opts.segments      – everyone's availability segments
 * @param {object[]} opts.holidays      – holidays at the provider's locations
 * @param {object[]} opts.oooRecords
 * @param {object[]} opts.appointments  – everyone's appointments
 * @param {Set}      [opts.ignoreIds]   – appointments being moved (their old time is free)
 * @param {{ start: number, end: number }[]} [opts.taken] – ms spans already picked
 * @returns {{ minutes: number, label: string }[]}
 */
export function openSlots({ date, person, durationMin, segments, holidays, oooRecords, appointments, ignoreIds, taken = [], now = Date.now() }) {
  if (!date || !person) return [];
  const [y, m, d] = date.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d).getTime();
  const mine = segmentsFor(segments, person);
  const windows = mine.length
    ? windowsOn(mine, date, iso => recordsOnDate(holidays, iso).length > 0)
    : PRACTICE_HOURS;
  const away = recordsFor(oooRecords, person);
  const busy = [
    ...(appointments || [])
      .filter(a => a.status !== 'Cancelled' && !ignoreIds?.has(a.id) && samePerson(apptPerson(a), person))
      .map(apptSpan),
    ...taken,
  ];
  const out = [];
  windows.forEach(([a, b]) => {
    for (let s = Math.ceil(a / STEP_MIN) * STEP_MIN; s + durationMin <= b; s += STEP_MIN) {
      const from = dayStart + s * 60000;
      const to = from + durationMin * 60000;
      if (from < now + LEAD_MS) continue;
      if (holidayDuring(holidays, from, to)) continue;
      if (away.some(r => from < new Date(r.endAt).getTime() && to > new Date(r.startAt).getTime())) continue;
      if (busy.some(x => from < x.end && to > x.start)) continue;
      out.push({ minutes: s, label: minutesToTime(s) });
    }
  });
  return out;
}

/**
 * Why `date` has no open slots for `person`, in words (e.g. a disabled day's
 * tooltip): out of office, a holiday, already past, or fully booked.
 */
export function noSlotsReason({ date, person, holidays, oooRecords, now = Date.now() }) {
  const [y, m, d] = date.split('-').map(Number);
  const from = new Date(y, m - 1, d).getTime();
  const to = from + 86400000;
  if (to <= now) return 'This day has passed';
  if (recordsFor(oooRecords, person).some(r => from < new Date(r.endAt).getTime() && to > new Date(r.startAt).getTime())) {
    return 'Provider is out of office on this date';
  }
  const holiday = holidayDuring(holidays, from, to);
  if (holiday) return `${holiday.name} (holiday)`;
  return 'No open slots on this day';
}
