const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Record dates come as text in several shapes ('9/21/2026', '2026-10-07',
 * '2019'). Shown as "Sep 21, 2026", or as given when it's only a year or
 * doesn't parse. Never through Date parsing, which shifts date-only values.
 */
export function recordDate(value) {
  const s = String(value || '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${MONTHS[+m[1] - 1]} ${+m[2]}, ${m[3]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
  return s;
}
