/* My Patients: the row facts the table and the adherence strip read. */

const DAY_MS = 86400000;

// Plan adherence bands (prototype): On Track 75 and above, At Risk 55 to 74,
// Off Track below 55.
export const ADHERENCE_BANDS = [
  { label: 'On Track', tone: 'success', min: 75 },
  { label: 'At Risk', tone: 'warning', min: 55 },
  { label: 'Off Track', tone: 'danger', min: 0 },
];
export const adherenceBand = score => ADHERENCE_BANDS.find(b => (Number(score) || 0) >= b.min);

const parseMdy = (mdy) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy || '');
  return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;
};
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

/** The care plan review: overdue once the program's cadence has passed. */
export function reviewState(lastReview, cadenceDays, today = new Date()) {
  const last = parseMdy(lastReview);
  if (!last) return { overdueDays: 0, label: 'Not reviewed' };
  const overdueDays = cadenceDays ? Math.max(0, daysBetween(last, today) - cadenceDays) : 0;
  return { overdueDays, label: overdueDays ? `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue` : 'Current' };
}

/** "8 / 20 min" this month, and whether the billable minimum is met. */
export function minutesState(row) {
  if (!row.minutesProgram || row.minutesTarget == null) return null;
  const logged = row.minutesLogged || 0;
  return {
    program: row.minutesProgram,
    text: `${logged} / ${row.minutesTarget} min`,
    pct: Math.min(100, Math.round((logged / row.minutesTarget) * 100)),
    met: logged >= row.minutesTarget,
  };
}

/** "Call · 3d ago" style text for the last touch. */
export function lastTouchText(row, today = new Date()) {
  const d = parseMdy(row.lastTouchDate);
  if (!d) return '-';
  const days = daysBetween(d, today);
  const ago = days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;
  return `${row.lastTouchChannel || 'Touch'} · ${ago}`;
}

/** How many rows fall in each adherence band, for the strip. */
export function bandCounts(rows) {
  const counts = Object.fromEntries(ADHERENCE_BANDS.map(b => [b.label, 0]));
  for (const r of rows) counts[adherenceBand(r.adherence).label] += 1;
  return counts;
}
