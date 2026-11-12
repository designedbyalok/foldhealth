// The "New view" of User Availability: how the redesigned list and week grid
// describe a block. Fields the blocks don't store yet (a name, ongoing end,
// primary vs covering location) are derived here so the ideas can be seen
// on today's data.

import { DAY_SHORT, ALL_TYPES, formatTime, isoDay, findConflicts } from './availabilityUtils';

const parse = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d) : null;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 8, 2026" */
export const longDate = (iso) => {
  const d = parse(iso);
  return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '';
};

/** "Oct 8, 2026 → Apr 6, 2027", or "→ Present" with no end date. */
export const dateSpan = (b) => `${longDate(b.startDate)} → ${b.endDate ? longDate(b.endDate) : 'Ongoing'}`;

/** "8:45 AM – 12 PM, 1 – 4 PM" */
export const hoursText = (b) => (b.slots || []).filter(s => s.start && s.end)
  .map(s => `${formatTime(s.start)} – ${formatTime(s.end)}`).join(', ');

/** The block's appointment types, each once. */
export const typesOf = (b) => [...new Set((b.slots || []).map(s => s.appointmentType || ALL_TYPES))];

/**
 * A provider's primary location: where most of their current availability
 * is. The rest are covering locations.
 */
export function primaryLocationOf(blocks = []) {
  const count = {};
  blocks.filter(b => b.status !== 'expired').forEach(b => { count[b.location] = (count[b.location] || 0) + 1; });
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || blocks[0]?.location || '';
}

/** Small markers for a segment: ongoing, monthly pattern, overlap. */
export function flagsOf(b, overlaps) {
  const flags = [];
  if (!b.endDate) flags.push({ key: 'ongoing', icon: 'solar:infinity-linear', label: 'Ongoing: no end date' });
  if (b.repeat === 'monthly') flags.push({ key: 'monthly', icon: 'solar:calendar-mark-linear', label: 'Monthly by week of the month' });
  if (overlaps) flags.push({ key: 'overlap', icon: 'solar:layers-minimalistic-linear', label: 'Overlaps another schedule (may double-book)', warn: true });
  return flags;
}

/**
 * The days a set of segments covers, for a location header: "Weekdays",
 * "Mon, Wed", or "Varies" when one repeats by month or every N.
 */
export function daysCovered(segments = []) {
  if (segments.some(s => s.repeat === 'monthly' || (Number(s.interval) || 1) > 1)) return 'Varies';
  const days = new Set(segments.flatMap(s => (s.repeat === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : s.days || [])));
  const sorted = [...days].sort();
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '0,6') return 'Weekends';
  if (sorted.length === 7) return 'Every day';
  return sorted.map(d => DAY_SHORT[d]).join(', ');
}

/** For each block of one user, whether it overlaps another of theirs. */
export function overlapIds(blocks = []) {
  const live = blocks.filter(b => b.status !== 'expired');
  const clashes = findConflicts(live);
  return new Set(live.filter((_, i) => clashes[i].length > 0).map(b => b.id));
}

/** Which occurrence of its weekday a date is (1–5), and whether it's the last. */
const weekOfMonth = (d) => {
  const n = Math.ceil(d.getDate() / 7);
  const last = d.getDate() + 7 > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { n, last };
};

/**
 * Whether a block has hours on `date`: in its date range, on one of its
 * days, and in step with "every N" (counted from its start date).
 */
export function occursOn(b, date) {
  const iso = isoDay(date);
  if (b.startDate && iso < b.startDate) return false;
  if (b.endDate && iso > b.endDate) return false;
  const start = parse(b.startDate) || date;
  const n = Number(b.interval) || 1;
  const days = Math.round((date - start) / 86400000);
  if (b.repeat === 'daily') return days % n === 0;
  if (!(b.days || []).includes(date.getDay())) return false;
  if (b.repeat === 'monthly') {
    const months = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
    if (months % n !== 0) return false;
    const { n: nth, last } = weekOfMonth(date);
    return (b.weeks || []).includes(nth) || (last && (b.weeks || []).includes(-1));
  }
  const weeks = Math.floor((days + start.getDay()) / 7);
  return weeks % n === 0;
}

/** The Monday that starts `d`'s week (weeks run Mon–Sun, as the Calendar's do). */
export const weekStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));

/** The seven days (Mon–Sun) of the week `offset` weeks from this one. */
export function weekDays(offset = 0, today = new Date()) {
  const mon = weekStart(today);
  return Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + offset * 7 + i));
}

/** "Sunday" */
export const dayHead = (d) => d.toLocaleDateString('en-US', { weekday: 'long' });

/** "Oct 12 – 18, 2026" */
export const weekLabel = (days) => {
  const a = days[0];
  const b = days[6];
  const sameMonth = a.getMonth() === b.getMonth();
  return `${MONTHS[a.getMonth()]} ${a.getDate()} – ${sameMonth ? '' : `${MONTHS[b.getMonth()]} `}${b.getDate()}, ${b.getFullYear()}`;
};

// One colour pair per location, from the accent ramps, so a location reads
// the same in every row of the week grid.
const TONES = ['blue', 'teal', 'purple', 'amber', 'pink', 'cyan', 'light-green', 'brown'];
export function locationTone(location, all = []) {
  const i = Math.max(0, all.indexOf(location)) % TONES.length;
  const t = TONES[i];
  return { background: `var(--accent-light-${t})`, color: `var(--accent-${t})` };
}
