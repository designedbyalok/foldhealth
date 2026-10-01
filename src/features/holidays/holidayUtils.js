/**
 * Holiday configurations: a named holiday at one or more practice
 * locations, from a start to an end date and time, with an optional auto
 * reply. A record is { id, name, startAt, endAt, locations: string[],
 * autoReplyMessage, createdBy, createdAt, updatedAt } (ISO dates).
 * Status works like Out of Office: Upcoming, Ongoing or Past.
 */
import { oooStatus, sameName } from '../ooo/oooUtils';

export const HOLIDAY_ICON = 'solar:confetti-minimalistic-linear';
export const HOLIDAY_NAME_MAX = 150;

const toMs = (v) => (v instanceof Date ? v.getTime() : new Date(v).getTime());

export const holidayStatus = (h, now) => oooStatus(h, now);
/** Past holidays are read-only: no edit, duplicate or delete. */
export const isPastHoliday = (h, now) => holidayStatus(h, now) === 'Past';

/** Holidays at any of these locations. */
export function holidaysAt(holidays, locations) {
  const want = (locations || []).filter(Boolean);
  if (!want.length) return [];
  return (holidays || []).filter(h => (h.locations || []).some(l => want.some(w => sameName(l, w))));
}

/** Holidays that touch the calendar year. */
export function holidaysInYear(holidays, year) {
  const from = new Date(year, 0, 1).getTime();
  const to = new Date(year + 1, 0, 1).getTime();
  return (holidays || []).filter(h => toMs(h.startAt) < to && toMs(h.endAt) > from);
}

/** Every year a holiday touches, plus this one, newest first. */
export function holidayYears(holidays, now = new Date()) {
  const years = new Set([now.getFullYear()]);
  (holidays || []).forEach((h) => {
    for (let y = new Date(h.startAt).getFullYear(); y <= new Date(h.endAt).getFullYear(); y += 1) years.add(y);
  });
  return [...years].sort((a, b) => b - a);
}

/** Soonest first. */
export const sortHolidays = (holidays) => [...(holidays || [])].sort((a, b) => toMs(a.startAt) - toMs(b.startAt));

/**
 * Form problems, keyed by field. Holidays can't be set in the past (Figma
 * December-2025 840:13167); editing one that's under way keeps its start.
 */
export function validateHoliday(values, { now = new Date(), original = null } = {}) {
  const errors = {};
  if (!String(values.name || '').trim()) errors.name = 'Enter a holiday name.';
  const s = values.startAt ? toMs(values.startAt) : NaN;
  const e = values.endAt ? toMs(values.endAt) : NaN;
  const keepsStart = original && toMs(original.startAt) <= toMs(now) && s === toMs(original.startAt);
  if (Number.isNaN(s)) errors.startAt = 'Pick a start date and time.';
  else if (!keepsStart && s < toMs(now)) errors.startAt = 'Please select a start date in future.';
  if (Number.isNaN(e)) errors.endAt = 'Pick an end date and time.';
  else if (e <= toMs(now)) errors.endAt = 'Please select an end date in future.';
  else if (!Number.isNaN(s) && e <= s) errors.endAt = 'End must be after the start.';
  if (!(values.locations || []).length) errors.locations = 'Pick at least one location.';
  return errors;
}

/** Holidays at the locations this person works at (from their profile). */
export function holidaysForUser(holidays, users, name) {
  const u = (users || []).find(x => sameName(x.name, name));
  return holidaysAt(holidays, u?.locations || []);
}

/** The holiday covering any of [from, to), if any. */
export const holidayDuring = (holidays, from, to) =>
  (holidays || []).find(h => from < toMs(h.endAt) && to > toMs(h.startAt)) || null;
