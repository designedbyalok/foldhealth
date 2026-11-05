// Slots come from patient_available_slots as absolute instants plus the
// provider block's timezone. They are shown in that timezone, the same
// wall-clock the visit is saved with and the staff calendar shows.

const parts = (instant, tz, opts) => Object.fromEntries(
  new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).formatToParts(new Date(instant))
    .map((p) => [p.type, p.value]),
);

/** 'YYYY-MM-DD' of the instant in `tz`. */
export function dayKey(instant, tz) {
  const p = parts(instant, tz, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "9:00 AM". */
export const timeLabel = (instant, tz) => new Intl.DateTimeFormat('en-US', {
  timeZone: tz, hour: 'numeric', minute: '2-digit',
}).format(new Date(instant));

/** "Thu", "29", "Oct" for a day key. */
export function dayParts(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    day: String(d),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
  };
}

/** "Eastern Time" style name for a zone, falling back to the zone id. */
export function zoneName(tz, on = new Date()) {
  try {
    return parts(on, tz, { timeZoneName: 'longGeneric' }).timeZoneName || tz;
  } catch {
    return tz;
  }
}

/**
 * Slots grouped by day in their own timezone, days and times ascending:
 * [{ key, slots: [...] }].
 */
export function groupByDay(slots) {
  const byDay = new Map();
  [...slots]
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .forEach((s) => {
      const key = dayKey(s.starts_at, s.timezone);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(s);
    });
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => ({ key, slots: list }));
}

/**
 * Appointments store date 'MM-DD-YYYY' and times like '2:30 pm'.
 * → { month: 'Oct', day: '29', weekday: 'Thu', time: '2:30 PM – 3:00 PM' }
 */
export function visitWhen({ date, time_start: start, time_end: end }) {
  const m = String(date || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const up = (t) => String(t || '').toUpperCase();
  const time = [up(start), up(end)].filter(Boolean).join(' – ');
  if (!m) return { month: '', day: '', weekday: '', time };
  const d = new Date(+m[3], +m[1] - 1, +m[2]);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day: String(+m[2]),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    time,
  };
}
