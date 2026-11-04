/**
 * [fromYear, toYear] when a [startISO, endISO] range covers whole years
 * (Jan 1 to Dec 31), else null. A DateRangePopover with `years` saves a
 * year pick this way; chips use it to show "1950 – 1960".
 */
export function yearSpan(selected = []) {
  const a = /^(\d{4})-01-01$/.exec(selected?.[0] || '');
  const b = /^(\d{4})-12-31$/.exec(selected?.[1] || '');
  return a && b ? [Number(a[1]), Number(b[1])] : null;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * [[fromYear, fromMonth], [toYear, toMonth]] (months 1-12) when a
 * [startISO, endISO] range runs from the 1st of a month to the last day of
 * a month, else null. A DateRangePopover with `years` saves a Month & Year
 * pick this way.
 */
export function monthSpan(selected = []) {
  const a = /^(\d{4})-(\d{2})-01$/.exec(selected?.[0] || '');
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selected?.[1] || '');
  if (!a || !b) return null;
  const [ty, tm, td] = [Number(b[1]), Number(b[2]), Number(b[3])];
  if (td !== new Date(ty, tm, 0).getDate()) return null;
  return [[Number(a[1]), Number(a[2])], [ty, tm]];
}

const isoToMdY = (iso) => {
  const [y, m, d] = String(iso || '').split('-');
  return m && d ? `${m}/${d}/${y}` : iso;
};

/**
 * A DOB filter's chip text: "1950 – 1960", "1957", "Jan 1958 – Dec 1961",
 * "Apr 1958", or "01/10/1957 – 02/20/1957".
 */
export function dobRangeSummary(selected = []) {
  if (!selected || selected.length < 2) return undefined;
  const ys = yearSpan(selected);
  if (ys) return ys[0] === ys[1] ? String(ys[0]) : `${ys[0]} – ${ys[1]}`;
  const ms = monthSpan(selected);
  if (ms) {
    const [from, to] = ms.map(([y, m]) => `${MONTH_ABBR[m - 1]} ${y}`);
    return from === to ? from : `${from} – ${to}`;
  }
  return `${isoToMdY(selected[0])} – ${isoToMdY(selected[1])}`;
}

/**
 * Whether a member's birth date falls in a DOB filter's [startISO, endISO]
 * (inclusive). With no birth date it falls back to the age: born Jan 1 of
 * (this year − age), as HCC's DOB filter does. No range keeps everyone.
 */
export function dobInRange(dob, age, selected = []) {
  if (!selected || selected.length < 2) return true;
  const [sy, sm, sd] = String(selected[0]).split('-').map(Number);
  const [ey, em, ed] = String(selected[1]).split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
  let born = dob ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(dob) ? `${dob}T00:00:00` : dob) : null;
  if (!born || Number.isNaN(born.getTime())) {
    const years = parseInt(String(age ?? '').match(/(\d+)/)?.[1] || '', 10);
    if (!Number.isFinite(years)) return false;
    born = new Date(new Date().getFullYear() - years, 0, 1);
  }
  return born >= start && born <= end;
}
