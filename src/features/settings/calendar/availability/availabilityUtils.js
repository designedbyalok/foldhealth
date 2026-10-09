// User availability: when each provider can be booked, as blocks of
// { location, timezone, repeat pattern, date range, hours per appointment
// type }. Stored one block per row in user_availability.
//
// Repeat pattern: plain blocks repeat weekly on chosen days. "Advanced
// cadence" opens up daily / weekly / monthly every N days, weeks or months;
// monthly picks weekdays and which occurrences of them (3rd Mon, last Fri).

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const ALL_TYPES = 'All appointment types';
// Occurrences of a weekday in a month. -1 is the last one, whether that's
// the 4th or the 5th.
export const WEEK_ORDINALS = [
  { value: 1, label: '1st' }, { value: 2, label: '2nd' }, { value: 3, label: '3rd' },
  { value: 4, label: '4th' }, { value: 5, label: '5th' }, { value: -1, label: 'Last' },
];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Last sorts after the numbered occurrences. */
export const sortOrdinals = (weeks) => [...weeks].sort((a, b) => (a === -1 ? 99 : a) - (b === -1 ? 99 : b));

export const RECURRENCES = [
  { value: 'daily', label: 'Daily', unit: 'days' },
  { value: 'weekly', label: 'Weekly', unit: 'weeks' },
  { value: 'monthly', label: 'Monthly', unit: 'months' },
];
export const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'Asia/Kolkata',
];

const pad = (n) => String(n).padStart(2, '0');
export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d) : null;
};

export function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${pad(m)} ${suffix}` : `${h12} ${suffix}`;
}

/** MM/DD/YYYY. */
export function formatDate(iso) {
  const d = parseDay(iso);
  if (!d) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

/** "10/08/2026 – 04/06/2027". */
export function formatRange(start, end) {
  if (!parseDay(start) || !parseDay(end)) return '';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** active | upcoming | expired, against today. */
export function blockStatus(block, today = isoDay(new Date())) {
  if (block.endDate && block.endDate < today) return 'expired';
  if (block.startDate && block.startDate > today) return 'upcoming';
  return 'active';
}

export const STATUS_LOOK = {
  active: { label: 'Active', tone: 'success' },
  upcoming: { label: 'Upcoming', tone: 'info' },
  expired: { label: 'Past', tone: 'grey' },
};

const listDays = (days = []) => {
  const sorted = [...days].sort();
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '0,6') return 'Weekends';
  if (sorted.length === 7) return 'Every day';
  return sorted.map(d => DAY_SHORT[d]).join(', ');
};

const every = (n, one, unit) => (n > 1 ? `Every ${n} ${unit}` : one);

/** "Weekly • Weekdays", "Every 2 weeks • Tue, Thu", "Monthly • 3rd Mon, Fri". */
export function cadenceText(block) {
  const n = Number(block.interval) || 1;
  if (block.repeat === 'daily') return every(n, 'Daily', 'days');
  const days = listDays(block.days);
  if (block.repeat === 'monthly') {
    const weeks = sortOrdinals(block.weeks || []).map(w => WEEK_ORDINALS.find(o => o.value === w)?.label).filter(Boolean);
    return `${every(n, 'Monthly', 'months')} • ${weeks.join(', ')} ${days}`;
  }
  return `${every(n, 'Weekly', 'weeks')} • ${days}`;
}

const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * The repeat pattern as one plain sentence, for under the cadence fields:
 * "Repeats every 2 weeks on Monday and Thursday.", "Repeats on the 1st and
 * last Friday of every month.", "Repeats every 3 days." '' until there's
 * enough picked to say.
 */
export function cadenceSentence(block) {
  const n = Number(block.interval) || 1;
  if (block.repeat === 'daily') return n > 1 ? `Repeats every ${n} days.` : 'Repeats every day.';
  const days = [...(block.days || [])].sort().map(d => DAY_LONG[d]);
  if (!days.length) return '';
  if (block.repeat === 'monthly') {
    const weeks = sortOrdinals(block.weeks || []).map(w => (w === -1 ? 'last' : WEEK_ORDINALS.find(o => o.value === w)?.label));
    if (!weeks.length) return '';
    return `Repeats on the ${andList(weeks)} ${andList(days)} of ${n > 1 ? `every ${n} months` : 'every month'}.`;
  }
  return `Repeats ${n > 1 ? `every ${n} weeks` : 'every week'} on ${andList(days)}.`;
}

/**
 * The dates a monthly block falls on in its first month (from the start
 * date, or this month), so "3rd Mon, Fri" can be checked against a calendar.
 * @returns {{ month: string, dates: string[] }} dates as ISO days
 */
export function monthlyPreview(block, today = isoDay(new Date())) {
  const from = parseDay(block.startDate) || parseDay(today);
  const y = from.getFullYear();
  const m = from.getMonth();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const weeks = block.weeks || [];
  const dates = [];
  for (let d = 1; d <= daysIn; d++) {
    const date = new Date(y, m, d);
    if (!(block.days || []).includes(date.getDay())) continue;
    const nth = Math.ceil(d / 7);
    const last = d + 7 > daysIn;
    if (weeks.includes(nth) || (last && weeks.includes(-1))) dates.push(isoDay(date));
  }
  const end = block.endDate || '9999-12-31';
  return { month: `${MONTHS[m]} ${y}`, dates: dates.filter(iso => iso >= isoDay(from) && iso <= end) };
}

/** "Thu Oct 15". */
export function shortDay(iso) {
  const d = parseDay(iso);
  return d ? `${DAY_SHORT[d.getDay()]} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}` : '';
}

export const slotText = (s) => `${formatTime(s.start)} – ${formatTime(s.end)}`;

/** One sentence describing a block, for the drawer's summary line. */
export function ruleSummary(block) {
  // Nothing to describe until the block says where or when.
  if (!block.location && !block.days?.length && block.repeat !== 'daily') return '';
  const parts = [];
  if (block.location) parts.push(block.location);
  if (block.repeat === 'daily') parts.push(cadenceText(block));
  else if (block.days?.length) parts.push(cadenceText(block).replace(' • ', ' on '));
  const hours = (block.slots || []).filter(s => s.start && s.end)
    .map(s => `${slotText(s)} (${s.appointmentType || ALL_TYPES})`);
  if (hours.length) parts.push(hours.join(', '));
  if (block.startDate && block.endDate) parts.push(formatRange(block.startDate, block.endDate));
  if (block.skipHolidays) parts.push('skips holidays');
  return parts.join(' • ');
}

/** Problems with a block, keyed by field, or {} when it can be saved. */
export function validateBlock(block) {
  const errors = {};
  if (!block.location) errors.location = 'Choose a location.';
  if (!block.timezone) errors.timezone = 'Choose a timezone.';
  if (block.repeat !== 'daily' && !block.days?.length) errors.days = 'Pick at least one day.';
  const n = block.interval == null ? 1 : Number(block.interval === '' ? NaN : block.interval);
  if (!Number.isInteger(n) || n < 1) errors.interval = 'Enter a whole number, 1 or more.';
  if (block.repeat === 'monthly' && !block.weeks?.length) errors.weeks = 'Pick at least one week of the month.';
  if (!block.startDate) errors.startDate = 'Add a start date.';
  if (!block.endDate) errors.endDate = 'Add an end date.';
  if (block.startDate && block.endDate && block.endDate < block.startDate) errors.endDate = 'Ends before it starts.';
  const slotErrors = (block.slots || []).map(s => {
    if (!s.appointmentType) return 'Choose an appointment type.';
    if (!s.start || !s.end) return 'Add a start and end time.';
    if (s.end <= s.start) return 'End time must be after the start time.';
    return null;
  });
  const sorted = (block.slots || []).map((s, i) => ({ ...s, i })).filter(s => s.start && s.end).sort((a, b) => a.start.localeCompare(b.start));
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k].start < sorted[k - 1].end && !slotErrors[sorted[k].i]) slotErrors[sorted[k].i] = 'Overlaps another time range.';
  }
  if (!block.slots?.length) errors.slots = 'Add at least one time range.';
  if (slotErrors.some(Boolean)) errors.slotErrors = slotErrors;
  return errors;
}

/** "Mon, Wed • 9 AM – 12 PM" for one clash between two blocks. */
export const conflictText = (c) => `${listDays(c.days)} • ${c.hours.map(slotText).join(', ')}`;

const later = (a, b) => (a > b ? a : b);
const earlier = (a, b) => (a < b ? a : b);

/**
 * For each block, the other blocks it double-books: a shared day, hours that
 * overlap, and date ranges that overlap from today on (a clash that's already
 * over doesn't matter). Location isn't considered, since one person can't be
 * in two places at once. Monthly blocks on different weeks of the month never
 * meet; blocks that repeat every N days or weeks are assumed to line up.
 *
 * Overlapping hours are merged ("1:30 PM – 4 PM", not "1:30–4, 2–4").
 *
 * @returns {{ index: number, days: number[], hours: {start, end}[], from: string, to: string }[][]}
 */
export function findConflicts(blocks, today = isoDay(new Date())) {
  return blocks.map((a, i) => blocks.flatMap((b, k) => {
    if (k === i) return [];
    const daysOf = (x) => (x.repeat === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : x.days || []);
    const days = daysOf(a).filter(d => daysOf(b).includes(d)).sort();
    if (!days.length) return [];
    if (a.repeat === 'monthly' && b.repeat === 'monthly'
      && !(a.weeks || []).some(w => (b.weeks || []).includes(w))) return [];
    const from = later(later(a.startDate || '', b.startDate || ''), today);
    const to = earlier(a.endDate || '9999-12-31', b.endDate || '9999-12-31');
    if (from > to) return [];
    const raw = [];
    (a.slots || []).forEach(sa => (b.slots || []).forEach(sb => {
      if (!sa.start || !sa.end || !sb.start || !sb.end) return;
      if (!(sa.start < sb.end && sb.start < sa.end)) return;
      raw.push({ start: later(sa.start, sb.start), end: earlier(sa.end, sb.end) });
    }));
    raw.sort((x, y) => x.start.localeCompare(y.start));
    const hours = [];
    raw.forEach(h => {
      const last = hours[hours.length - 1];
      if (last && h.start <= last.end) last.end = later(last.end, h.end);
      else hours.push({ ...h });
    });
    return hours.length ? [{ index: k, days, hours, from, to }] : [];
  }));
}

/** True when a block is still the untouched one a new drawer starts with. */
export const isBlankBlock = (b) => !b.id && !b.location && !b.timezone && !b.days?.length
  && !b.startDate && !b.endDate && (b.slots || []).every(s => !s.appointmentType && !s.start && !s.end);

// A new block starts empty: the user fills in where, when and which hours.
export const newSlot = () => ({ appointmentType: '', start: '', end: '' });

export function newBlock() {
  return {
    id: null,
    location: '',
    timezone: '',
    advanced: false,
    repeat: 'weekly',
    interval: 1,
    days: [],
    weeks: [],
    startDate: '',
    endDate: '',
    slots: [newSlot()],
    skipHolidays: true,
  };
}

/** Block ↔ user_availability row. */
export const blockToRow = (b) => ({
  id: b.id,
  user_id: b.userId || null,
  user_name: b.userName,
  user_email: b.userEmail || null,
  location: b.location,
  timezone: b.timezone,
  advanced: !!b.advanced,
  repeat: b.repeat,
  repeat_interval: Number(b.interval) || 1,
  days: b.days || [],
  weeks: b.weeks || [],
  start_date: b.startDate,
  end_date: b.endDate,
  slots: b.slots || [],
  skip_holidays: !!b.skipHolidays,
  updated_at: b.updatedAt || new Date().toISOString(),
});

export const rowToBlock = (r) => ({
  id: r.id,
  userId: r.user_id,
  userName: r.user_name,
  userEmail: r.user_email,
  location: r.location,
  timezone: r.timezone,
  // Rows from before advanced cadence: 'biweekly' was weekly every 2 weeks,
  // and anything but plain weekly needs the advanced options to show.
  advanced: !!r.advanced || (r.repeat && r.repeat !== 'weekly') || (r.repeat_interval || 1) > 1,
  repeat: r.repeat === 'biweekly' ? 'weekly' : (r.repeat || 'weekly'),
  interval: r.repeat === 'biweekly' ? 2 : (r.repeat_interval || 1),
  days: r.days || [],
  weeks: r.weeks || [],
  startDate: r.start_date,
  endDate: r.end_date,
  slots: Array.isArray(r.slots) ? r.slots : [],
  skipHolidays: r.skip_holidays !== false,
  updatedAt: r.updated_at,
});

/**
 * Sample availability for a few of the team, dated around `now` so active,
 * upcoming and expired all show. Used by `bun run seed` and, until the table
 * exists, by the store. Matched to users by name.
 */
export function sampleAvailability(now = new Date()) {
  const day = (offset) => { const d = new Date(now); d.setDate(d.getDate() + offset); return isoDay(d); };
  // repeat: 'weekly' | 'daily' | 'monthly', or [repeat, interval] for every N.
  const b = (id, userName, location, timezone, repeatSpec, days, weeks, start, end, slots) => {
    const [repeat, interval] = Array.isArray(repeatSpec) ? repeatSpec : [repeatSpec, 1];
    return {
      id, userId: null, userName, userEmail: null, location, timezone,
      advanced: repeat !== 'weekly' || interval > 1, repeat, interval, days, weeks,
      startDate: day(start), endDate: day(end), slots, skipHolidays: true, updatedAt: now.toISOString(),
    };
  };
  return [
    b('ua-sample-1', 'Alok Kumar', '7 Hills Department', 'America/New_York', 'weekly', [1, 2, 3, 4, 5], [], -30, 150,
      [{ appointmentType: ALL_TYPES, start: '09:00', end: '13:00' }, { appointmentType: ALL_TYPES, start: '14:00', end: '17:00' }]),
    b('ua-sample-2', 'Alok Kumar', 'Home Health Centre', 'America/New_York', 'monthly', [6], [1, 3], -10, 170,
      [{ appointmentType: 'Annual Wellness Visit', start: '10:00', end: '14:00' }]),
    b('ua-sample-3', 'Alok Kumar', 'Mary Health', 'America/New_York', 'weekly', [1, 3], [], -60, -5,
      [{ appointmentType: ALL_TYPES, start: '08:00', end: '12:00' }]),
    b('ua-sample-14', 'Alok Kumar', 'Mary Health', 'America/New_York', 'weekly', [2, 4], [], 5, 185,
      [{ appointmentType: 'Follow-up Appointment', start: '13:00', end: '17:00' }]),
    b('ua-sample-15', 'Alok Kumar', 'Sunrise Medical', 'America/Chicago', ['weekly', 2], [3], [], 20, 200,
      [{ appointmentType: 'Chronic Care Management Visit', start: '08:00', end: '11:00' }]),
    b('ua-sample-16', 'Alok Kumar', 'Palm Health Centre', 'America/New_York', ['monthly', 1], [5], [-1], 0, 180,
      [{ appointmentType: 'Annual Wellness Visit', start: '09:00', end: '12:00' }, { appointmentType: ALL_TYPES, start: '13:00', end: '15:00' }]),
    b('ua-sample-17', 'Alok Kumar', 'Home Health Centre', 'America/New_York', ['daily', 3], [], [], 45, 225,
      [{ appointmentType: ALL_TYPES, start: '18:00', end: '20:00' }]),
    b('ua-sample-4', 'Devanshi Sharma', 'Palm Health Centre', 'Asia/Kolkata', 'weekly', [1, 2, 3, 4], [], 0, 180,
      [{ appointmentType: ALL_TYPES, start: '09:00', end: '18:00' }]),
    b('ua-sample-5', 'Ketan Patni', 'Sunrise Medical', 'America/Chicago', ['weekly', 2], [2, 4], [], 14, 200,
      [{ appointmentType: 'Chronic Care Management Visit', start: '13:00', end: '16:30' }]),
    b('ua-sample-6', 'Abhijit Gupta', 'Mary Health', 'America/New_York', 'weekly', [1, 3, 5], [], -20, 160,
      [{ appointmentType: ALL_TYPES, start: '08:30', end: '12:30' }, { appointmentType: 'Follow-up Appointment', start: '13:30', end: '16:00' }]),
    b('ua-sample-7', 'Abhijit Gupta', 'Home Health Centre', 'America/New_York', ['monthly', 1], [2, 4], [-1], -5, 175,
      [{ appointmentType: 'Annual Wellness Visit', start: '09:00', end: '12:00' }]),
    b('ua-sample-8', 'Aditi Kalegaonkar', 'Palm Health Centre', 'Asia/Kolkata', 'daily', [], [], -15, 90,
      [{ appointmentType: ALL_TYPES, start: '10:00', end: '14:00' }]),
    b('ua-sample-9', 'Ajay Lakshman', 'Sunrise Medical', 'America/Chicago', 'weekly', [2, 3, 4], [], 7, 190,
      [{ appointmentType: ALL_TYPES, start: '11:00', end: '19:00' }]),
    b('ua-sample-10', 'Akanksha Singh', '7 Hills Department', 'America/New_York', ['weekly', 2], [1, 2, 3, 4, 5], [], -40, 140,
      [{ appointmentType: ALL_TYPES, start: '07:00', end: '11:00' }]),
    b('ua-sample-11', 'Akanksha Singh', '7 Hills Department', 'America/New_York', ['monthly', 2], [6], [3], 10, 200,
      [{ appointmentType: 'Chronic Care Management Visit', start: '09:00', end: '13:00' }]),
    b('ua-sample-12', 'Amar Jagtap', 'Mary Health', 'America/New_York', 'weekly', [1, 2, 3, 4], [], -90, -10,
      [{ appointmentType: ALL_TYPES, start: '09:00', end: '17:00' }]),
    b('ua-sample-13', 'Amar Jagtap', 'Palm Health Centre', 'America/Los_Angeles', ['daily', 2], [], [], 0, 120,
      [{ appointmentType: 'Follow-up Appointment', start: '12:00', end: '15:00' }]),
  ];
}
