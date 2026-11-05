/**
 * Calendar-date helpers for clinical records (onset, administered, since,
 * start/stop). These are plain calendar days, not instants, so none of this
 * touches `Date` parsing or `toISOString`.
 *
 * That matters: `new Date('9/22/2026')` builds LOCAL midnight, and
 * `.toISOString()` then converts to UTC: which in any timezone east of
 * Greenwich lands on the previous day. Storing a display string and reparsing
 * it that way moved a date back one day on every edit. Parsing the digits
 * directly removes the timezone from the problem entirely.
 *
 * Storage format is ISO `YYYY-MM-DD`. Display format is `MM/DD/YYYY`. Reads
 * tolerate either, because rows written before this existed hold display
 * strings.
 */

const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const US_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

const pad = n => String(n).padStart(2, '0');

/** Today as a local ISO date, not `toISOString()`, which reports UTC. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Any stored or picked date → ISO `YYYY-MM-DD`, or `''` when unparseable.
 * Accepts ISO and `M/D/YYYY`; anything else is left for the caller to default.
 */
export function toIsoDate(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';

  const iso = ISO_RE.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  const us = US_RE.exec(s);
  if (us) {
    const [, m, d, y] = us;
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  return '';
}

/**
 * Any stored date → `MM/DD/YYYY` for display. Returns `''` for a missing
 * value and passes an unrecognised one through unchanged, so a legacy row
 * still shows whatever it holds rather than blanking out.
 */
export function formatClinicalDate(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const iso = toIsoDate(s);
  if (!iso) return s;
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

/** True when `value` is a calendar day after today, in the user's timezone. */
export function isFutureDate(value) {
  const iso = toIsoDate(value);
  return !!iso && iso > todayIso();
}

/**
 * A stored date as a coarse "how long ago" label ("Today", "20 Days Ago",
 * "6 Months Ago"), in the design's Title Case, counted in whole calendar days
 * so no timezone can move it.
 * Returns `''` for anything unparseable.
 */
export function formatDaysAgo(value) {
  const iso = toIsoDate(value);
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const [ty, tm, td] = todayIso().split('-').map(Number);
  const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days < 30) return `${days} ${days === 1 ? 'Day' : 'Days'} Ago`;
  // Months round (182 days is "6 months", not "5"); years floor, so a
  // record reads "1 year ago" until the second full year has passed.
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} ${months === 1 ? 'Month' : 'Months'} Ago`;
  const years = Math.max(1, Math.floor(days / 365.25));
  return `${years} ${years === 1 ? 'Year' : 'Years'} Ago`;
}
