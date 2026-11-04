import { addDaysMdy, annotateClaims, confirmedFills, latestConfirmedFill as latestConfirmed, matchFill, parseMdy } from './pharmacyWorklist.utils';

// Fill events that ripple through a pharmacy member's record.
//
// Two kinds of fill live in each medication's refill history: claims (no
// `source`) and fills confirmed in Fold (`source` set: a pickup confirmed by
// call or verification, or a date entered by hand; older rows may come from a
// refill approval, which no longer sets a fill). Last
// Fill stays the claims date. Recent Fill is the latest confirmed fill.
//
// One shifted supply schedule (supplySchedule) drives each drug's next fill,
// the projected PDC and the projected fail date, so they always agree: an
// early refill starts when the prior supply runs out. Only claims that count
// (current version, paid, Part D, not reversed: see annotateClaims) are
// fills. A confirmed fill is not counted again once its claim matches, nor
// when its claim was reversed or billed to other coverage.

const earliest = (dates) => dates.reduce((min, d) => (!min || parseMdy(d) < parseMdy(min) ? d : min), null);
const later = (a, b) => (!b ? a : !a ? b : parseMdy(b) > parseMdy(a) ? b : a);
const DAY = 86_400_000;
// The measure threshold: 80% of the days from the first fill to Dec 31.
const PDC_TARGET = 0.8;
const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (t) => { const d = new Date(t); return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}/${d.getUTCFullYear()}`; };

// The latest fill on record, claims or confirmed. Automations only add a
// confirmed fill that is newer than this.
export const effectiveFill = (d) => later(d.lastFill, latestConfirmed(d)?.date);

// Counting claims plus confirmed fills still waiting for theirs (or never
// matched with no claim at all), oldest first. `claimsOnly` leaves out the
// confirmed fills, for outcomes only a claim can settle.
function countedFills(d, { claimsOnly } = {}) {
  const all = annotateClaims(d.refills);
  const claims = all.filter(c => c.counts && parseMdy(c.date) != null);
  const seen = new Set();
  const confirmed = claimsOnly ? [] : confirmedFills(d).filter(r => {
    const at = parseMdy(r.date);
    if (at == null || seen.has(at)) return false;
    seen.add(at);
    const { kind } = matchFill(r, all);
    return kind === 'pending' || kind === 'no-claim';
  });
  return [...claims, ...confirmed]
    .map(r => ({ at: parseMdy(r.date), ds: r.daysSupply || d.daysSupply }))
    .sort((a, b) => a.at - b.at);
}

// Supply intervals [start, end) with each refill shifted past the prior supply.
function supplySchedule(d, opts) {
  let supplyEnd = -Infinity;
  return countedFills(d, opts).map(f => {
    const start = Math.max(f.at, supplyEnd);
    supplyEnd = start + f.ds * DAY;
    return { start, end: supplyEnd };
  });
}

// Days of the measure year covered by the schedule of every drug in the
// measure, from the first fill of the year to Dec 31. A drug discontinued
// later still covered the days it was dispensed for.
// Coverage depends only on the measure's own data, and measures are replaced,
// never mutated, so it is cached per measure object (claims-only apart).
const coverageCache = new WeakMap();
function yearCoverage(x, opts) {
  const key = opts?.claimsOnly ? 'claims' : 'all';
  const cached = coverageCache.get(x);
  if (cached && key in cached) return cached[key];
  const result = computeYearCoverage(x, opts);
  coverageCache.set(x, { ...cached, [key]: result });
  return result;
}

function computeYearCoverage(x, opts) {
  const year = Number((x.failDate || '').slice(6)) || new Date().getFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31);
  const intervals = (x.medications || []).flatMap(d => supplySchedule(d, opts)).filter(i => i.end > yearStart && i.start <= yearEnd);
  if (!intervals.length) return null;
  const start = Math.max(yearStart, Math.min(...intervals.map(i => i.start)));
  const covered = new Set();
  for (const i of intervals) {
    for (let t = Math.max(i.start, start); t < Math.min(i.end, yearEnd + DAY); t += DAY) covered.add(t);
  }
  const coverEnd = Math.min(Math.max(...intervals.map(i => i.end)), yearEnd + DAY);
  return { start, yearEnd, covered, coverEnd, days: (yearEnd - start) / DAY + 1 };
}

// Projected PDC for the measure year.
export function projectedPdc(x, opts) {
  const c = yearCoverage(x, opts);
  return c ? Math.round((c.covered.size / c.days) * 100) : null;
}

const todayUtc = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };

// Days not covered so far this year, from the first fill to today.
export function daysMissed(x) {
  const c = yearCoverage(x);
  if (!c) return null;
  const today = Math.min(todayUtc(), c.yearEnd + DAY);
  if (today <= c.start) return 0;
  let covered = 0;
  for (const t of c.covered) if (t < today) covered += 1;
  return (today - c.start) / DAY - covered;
}

// PDC to date, so it keeps dropping on days the member goes without (a
// monthly or biweekly gap report would leave it frozen at its last number).
// With the plan's PDC and the report date (`pdcAsOf`): the plan's covered
// days at the report, plus the days covered since by claims and fills on
// record, over the days from the gap's start to today. Without a report date
// the plan's number stands (null here). With no plan PDC: the fills on
// record from the first fill of the year.
export function pdcToDate(x) {
  const c = yearCoverage(x);
  const today = Math.min(todayUtc(), (c?.yearEnd ?? Infinity) + DAY);
  if (x.pdc != null) {
    const asOf = parseMdy(x.pdcAsOf);
    const start = parseMdy(x.startDate) ?? c?.start;
    if (asOf == null || start == null || asOf <= start || today <= asOf) return null;
    let since = 0;
    if (c) for (const t of c.covered) if (t >= asOf && t < today) since += 1;
    const covered = (x.pdc / 100) * ((asOf - start) / DAY) + since;
    return Math.min(100, Math.round((covered / ((today - start) / DAY)) * 100));
  }
  if (!c) return null;
  const elapsed = (today - c.start) / DAY;
  if (elapsed <= 0) return null;
  let covered = 0;
  for (const t of c.covered) if (t < today) covered += 1;
  return Math.round((covered / elapsed) * 100);
}

// Medication possession ratio to date: days supply dispensed by counted
// claims since the drug's first fill of the year, over the days since then,
// capped at 100%. The gap shows its best-covered active drug, since any drug
// in the class covers the measure.
export function gapMpr(x) {
  const year = Number((x.failDate || '').slice(6)) || new Date().getFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const today = todayUtc();
  const values = (x.medications || []).filter(d => d.status !== 'Discontinued').map(d => {
    const fills = countedFills(d, { claimsOnly: true }).filter(f => f.at >= yearStart && f.at < today);
    if (!fills.length) return null;
    const supply = fills.reduce((sum, f) => sum + f.ds, 0);
    return Math.min(100, Math.round((supply / ((today - fills[0].at) / DAY)) * 100));
  }).filter(v => v != null);
  return values.length ? Math.max(...values) : null;
}

// Year-end PDC from counted claims alone if the member never refills: the
// Projected PDC (No Refill) column, and Met for Year at 80% or above.
export const claimsPdcNoRefill = (x) => projectedPdc(x, { claimsOnly: true });

// Projected absolute fail date: the last day the member can be without
// medication and still reach 80% if they never miss again. Null when the
// fills on record already reach 80% for the year.
export function projectedFailDate(x) {
  const c = yearCoverage(x);
  if (!c) return null;
  const allowedMiss = Math.floor(c.days * (1 - PDC_TARGET));
  const missedBeforeEnd = (c.coverEnd - c.start) / DAY - c.covered.size;
  const t = c.coverEnd + (allowedMiss - missedBeforeEnd) * DAY;
  return t > c.yearEnd ? null : fmt(t);
}

// Fills of the gap's usual days supply still needed to reach 80% by Dec 31.
export function fillsToStayCompliant(x) {
  const c = yearCoverage(x);
  if (!c) return null;
  const need = Math.ceil(c.days * PDC_TARGET) - c.covered.size;
  if (need <= 0) return 0;
  const ds = Math.max(0, ...(x.medications || []).filter(d => d.status !== 'Discontinued').map(d => d.daysSupply || 0));
  return ds ? Math.ceil(need / ds) : null;
}

// Re-derive everything that follows from the fills: each drug's Recent Fill
// and next fill, the gap's Next Fill Due (active drugs), and, once a drug
// has a confirmed fill, the projected PDC and fail date. Run after any fill,
// claim or medication change.
export function recomputeMeasure(x) {
  const medications = x.medications.map(d => {
    const recent = latestConfirmed(d);
    const schedule = supplySchedule(d);
    const nextFill = schedule.length ? fmt(schedule[schedule.length - 1].end) : addDaysMdy(d.lastFill, d.daysSupply);
    return {
      ...d,
      nextFill,
      recentFill: recent?.date || null,
      recentFillSource: recent ? { outcome: recent.source, date: recent.enteredOn || recent.date, manual: !!recent.manual } : null,
    };
  });
  const active = medications.filter(d => d.status !== 'Discontinued');
  const hasConfirmed = active.some(d => d.recentFill);
  const recalculated = earliest(active.map(d => d.nextFill));
  const next = { ...x, medications, nextFillDue: recalculated || x.nextFillDue, nextFillDueCalculated: !!recalculated || !!x.nextFillDueCalculated };
  // A fill confirmed in Fold moves PDC and the fail date; both stay
  // projected until its claim matches.
  return {
    ...next,
    pdcProjected: hasConfirmed ? projectedPdc(next) : null,
    failDateProjected: hasConfirmed ? projectedFailDate(next) : null,
  };
}

const fillRow = (d, date, source, extra = {}) => ({
  date, qty: d.qty, daysSupply: d.daysSupply,
  pharmacy: d.pharmacy?.name, prescriber: d.prescriber?.name,
  prescriberAddress: d.refills?.[0]?.prescriberAddress || '',
  source, ...extra,
});

// Add a confirmed fill to every active drug of the gap whose latest fill is
// older than `date`; drugs already filled on or after it are left alone.
function addConfirmedFill(x, date, source, changes) {
  const medications = x.medications.map(d => {
    if (d.status === 'Discontinued' || parseMdy(date) <= parseMdy(effectiveFill(d))) return d;
    changes?.push(`${x.code} ${d.name}: recent fill ${date}`);
    return { ...d, refills: [fillRow(d, date, source), ...(d.refills || [])] };
  });
  return recomputeMeasure({ ...x, medications });
}

// A date entered by hand replaces the drug's latest confirmed fill (or adds
// one); an empty date removes it. No newer-date check: the user may correct
// a fill to an earlier day.
export function withManualRecentFill(x, medId, date) {
  const enteredOn = fmt(Date.now());
  return recomputeMeasure({
    ...x,
    medications: x.medications.map(d => {
      if (d.id !== medId) return d;
      const latest = latestConfirmed(d);
      const others = (d.refills || []).filter(r => r !== latest);
      if (!date) return { ...d, refills: others };
      return { ...d, refills: [fillRow(d, date, latest?.source || 'Entered by hand', { manual: true, enteredOn }), ...others] };
    }),
  });
}

export function applyPickup(member, codes, date, source) {
  const changes = [];
  const measures = member.measures.map(x => (codes.includes(x.code)
    ? { ...addConfirmedFill(x, date, source, changes), pickupConfirmed: date, pendingPickupSince: null }
    : x));
  return { measures, changes };
}

export function applyPendingPickup(member, codes, date) {
  return member.measures.map(x => (codes.includes(x.code) ? { ...x, pendingPickupSince: date } : x));
}

// Outcome text → fill event. Covers the schema's pickup outcomes
// ("Confirmed medication pickup", "…pickup date") and "Pending: Pick up".
export function fillEventFor(outcome) {
  const o = (outcome || '').toLowerCase();
  if (o.includes('confirmed medication pickup')) return 'pickup';
  if (/pending(?: \u2014|:) pick up/.test(o)) return 'pending-pickup';
  return null;
}

// Outcomes that mean the medication was just picked up; the outreach date
// becomes the gap's Recent Fill Date (editable later in Medication Review).
// "Refill approval received" only logs the approval: nothing was dispensed,
// so it sets no fill date.
export function setsRecentFill(outcome) {
  return (outcome || '').toLowerCase().includes('confirmed medication pickup');
}

// Recent-fill outcomes ("Confirmed medication pickup"): add the confirmed
// fill to the listed gaps, newer dates only.
export function applyRecentFill(member, codes, date, outcome, changes) {
  return member.measures.map(x => (codes.includes(x.code) ? addConfirmedFill(x, date, outcome, changes) : x));
}
