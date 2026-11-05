import { recordsFor, recordsOnDate, sameName } from '../../ooo/oooUtils';
import { apptSpan } from '../../ooo/reassignUtils';
import { ALL_TYPES, blockStatus } from '../../settings/calendar/availability/availabilityUtils';
import { segmentsFor, windowsOn } from '../openSlots';

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const minutesOf = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
const holidayCheck = (holidays) => iso => recordsOnDate(holidays, iso).length > 0;

// Appointments store wall-clock times at their location ("10:00 am", no
// zone), so availability is read the same way: its hours as written, not
// converted into the viewer's zone (9 AM ET stays 9 AM, even viewed from IST).
const wallClock = s => ({ ...s, timezone: undefined });

// Availability can be kept for some appointment types ("Lab Results
// Discussion" only); an appointment can only use the hours open to its type.
const forType = (segs, type) => (!type ? segs : segs
  .map(s => ({ ...s, slots: (s.slots || []).filter(sl => !sl.appointmentType || sl.appointmentType === ALL_TYPES || sameName(sl.appointmentType, type)) }))
  .filter(s => s.slots.length));

/**
 * Where the provider can see these appointments: the locations of their
 * availability that runs, for at least one appointment's type, on that
 * appointment's day.
 *
 * @returns {string[]} location names, sorted
 */
export function providerLocations({ segments, provider, appointments, holidays }) {
  const isHoliday = holidayCheck(holidays);
  const found = new Set();
  const mine = segmentsFor(segments, provider).filter(s => s.location);
  (appointments || []).forEach((a) => {
    const { start } = apptSpan(a);
    if (!Number.isFinite(start)) return;
    mine.forEach((s) => {
      if (!found.has(s.location) && windowsOn(forType([wallClock(s)], a.appointment_type_name), isoOf(start), isHoliday).length) found.add(s.location);
    });
  });
  return [...found].sort((a, b) => a.localeCompare(b));
}

/**
 * Every location the provider has current or upcoming availability at, any
 * date (open to `type`, when given): where an appointment can be moved when
 * it can't keep its own day.
 *
 * @returns {string[]} location names, sorted
 */
export function providerAllLocations({ segments, provider, type }) {
  const found = new Set(forType(segmentsFor(segments, provider), type)
    .filter(s => s.location && blockStatus(s) !== 'expired')
    .map(s => s.location));
  return [...found].sort((a, b) => a.localeCompare(b));
}

/** The provider's availability segments at `location` (open to `type`, when given), in wall-clock hours. */
export const segmentsAt = (segments, provider, location, type) => forType(segmentsFor(segments, provider)
  .filter(s => sameName(s.location, location))
  .map(wallClock), type);

/**
 * Whether the provider's availability at `location`, open to the
 * appointment's type, covers its whole current time.
 */
export function availableAt({ segments, provider, location, appt, holidays }) {
  const { start, end } = apptSpan(appt);
  if (!Number.isFinite(start)) return true;
  const from = minutesOf(start);
  const to = from + (end - start) / 60000;
  return windowsOn(segmentsAt(segments, provider, location, appt.appointment_type_name), isoOf(start), holidayCheck(holidays))
    .some(([a, b]) => from >= a && to <= b);
}

/** The provider's out of office record over the appointment's current time, if any. */
export function awayDuring({ oooRecords, provider, appt }) {
  const { start, end } = apptSpan(appt);
  if (!Number.isFinite(start)) return null;
  return recordsFor(oooRecords, provider).find(r => start < new Date(r.endAt).getTime() && end > new Date(r.startAt).getTime()) || null;
}
