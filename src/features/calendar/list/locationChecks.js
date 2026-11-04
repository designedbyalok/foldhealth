import { recordsOnDate, sameName } from '../../ooo/oooUtils';
import { apptSpan } from '../../ooo/reassignUtils';
import { blockStatus } from '../../settings/calendar/availability/availabilityUtils';
import { segmentsFor, windowsOn } from '../openSlots';

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const minutesOf = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
const holidayCheck = (holidays) => iso => recordsOnDate(holidays, iso).length > 0;

// Appointments store wall-clock times at their location ("10:00 am", no
// zone), so availability is read the same way: its hours as written, not
// converted into the viewer's zone (9 AM ET stays 9 AM, even viewed from IST).
const wallClock = s => ({ ...s, timezone: undefined });

/**
 * Where the provider can see these appointments: the locations of their
 * availability that runs on at least one of the appointments' days.
 *
 * @returns {string[]} location names, sorted
 */
export function providerLocations({ segments, provider, appointments, holidays }) {
  const isHoliday = holidayCheck(holidays);
  const days = [...new Set((appointments || []).map(a => apptSpan(a).start).filter(Number.isFinite).map(isoOf))];
  const found = new Set();
  segmentsFor(segments, provider).forEach((s) => {
    if (s.location && days.some(d => windowsOn([wallClock(s)], d, isHoliday).length)) found.add(s.location);
  });
  return [...found].sort((a, b) => a.localeCompare(b));
}

/**
 * Every location the provider has current or upcoming availability at, any
 * date: where an appointment can be moved when it can't keep its own day.
 *
 * @returns {string[]} location names, sorted
 */
export function providerAllLocations({ segments, provider }) {
  const found = new Set(segmentsFor(segments, provider)
    .filter(s => s.location && blockStatus(s) !== 'expired')
    .map(s => s.location));
  return [...found].sort((a, b) => a.localeCompare(b));
}

/** The provider's availability segments at `location`, in wall-clock hours. */
export const segmentsAt = (segments, provider, location) => segmentsFor(segments, provider)
  .filter(s => sameName(s.location, location))
  .map(wallClock);

/**
 * Whether the provider's availability at `location` covers the
 * appointment's whole current time.
 */
export function availableAt({ segments, provider, location, appt, holidays }) {
  const { start, end } = apptSpan(appt);
  if (!Number.isFinite(start)) return true;
  const from = minutesOf(start);
  const to = from + (end - start) / 60000;
  return windowsOn(segmentsAt(segments, provider, location), isoOf(start), holidayCheck(holidays))
    .some(([a, b]) => from >= a && to <= b);
}
