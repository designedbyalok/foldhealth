// Date-only values ("2026-10-11": Postgres `date` columns, picker output,
// text fields holding a calendar day) are not instants. `new Date()` reads a
// bare YYYY-MM-DD as UTC midnight, so every browser west of UTC shows the
// previous day. Parse those as local midnight instead; anything else (real
// timestamps, Date objects, MM/DD/YYYY) goes through `new Date()` unchanged.

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A Date for `value`, or null when it's empty or unparseable. */
export function parseLocalDate(value) {
  if (value == null || value === '') return null;
  const m = DATE_ONLY_RE.exec(String(value).trim());
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Epoch ms for `value` (see parseLocalDate), or NaN. */
export function localDateMs(value) {
  return parseLocalDate(value)?.getTime() ?? NaN;
}

/** Today at local midnight. */
export function todayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** `d` at local midnight. */
export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** YYYY-MM-DD for a Date, in local time (the inverse of parseLocalDate). */
export function isoFromLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** A new Date `n` calendar days after `d` (DST-safe: steps the date, not 24h). */
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Same calendar day, ignoring the time. */
export function sameDay(a, b) {
  return !!a && !!b && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** Days in a month; `month` is 0-based. */
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** MM/DD/YYYY for an ISO date string, or '' when it isn't one. */
export function mdyFromIso(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return (y && m && d) ? `${m}/${d}/${y}` : '';
}

/** YYYY-MM-DD for a typed MM/DD/YYYY, or null when it isn't a valid day. */
export function isoFromMdy(mdy) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(mdy || '');
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const month = Number(mm), day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
