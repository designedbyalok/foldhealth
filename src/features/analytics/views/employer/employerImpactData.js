/**
 * Employer Impact Report: turns the rollup (rows of
 * `{ m: metric, s: series, b: bucket, mo: 'YYYY-MM', v: value }`) into what
 * each widget draws. Pure functions, so every chart's numbers are testable
 * without rendering anything.
 */
import { WEEKDAYS, HOURS } from './employerImpactConfig';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Months ──────────────────────────────────────────────────────────────

/** 'YYYY-MM' for a Date or ISO string, read in local calendar terms. */
export function toMonthKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 7);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

/** Every 'YYYY-MM' from `from` to `to`, inclusive. */
export function monthsBetween(from, to) {
  const out = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** 'YYYY-MM' shifted by `n` months. */
export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** The bucket a month falls in for the Time Frame: "Mar 26", "Q1 26", "2026". */
export function periodOf(key, timeFrame) {
  const [y, m] = key.split('-').map(Number);
  const yy = String(y).slice(2);
  if (timeFrame === 'Year') return String(y);
  if (timeFrame === 'Quarter') return `Q${Math.floor((m - 1) / 3) + 1} ${yy}`;
  return `${MONTH_NAMES[m - 1]} ${yy}`;
}

/**
 * The date range a Time Frame covers, ending at `end` ('YYYY-MM'):
 * Month is that month, Quarter the calendar quarter it falls in (Jul–Sep),
 * Year the 12 months ending with it (Oct–Sep).
 *
 * @returns {{ from: string, to: string }} month keys
 */
export function frameRange(timeFrame, end) {
  if (timeFrame === 'Year') return { from: addMonths(end, -11), to: end };
  if (timeFrame === 'Quarter') {
    const m = Number(end.slice(5, 7));
    const start = addMonths(end, -((m - 1) % 3));
    return { from: start, to: addMonths(start, 2) };
  }
  return { from: end, to: end };
}

/**
 * The date range a Time Frame covers from a picked start month: Month is
 * that month, Quarter the calendar quarter it falls in, Year the 12 months
 * from it (Jan → Dec).
 *
 * @returns {{ from: string, to: string }} month keys
 */
export function rangeFromStart(timeFrame, start) {
  if (timeFrame === 'Year') return { from: start, to: addMonths(start, 11) };
  return frameRange(timeFrame, start);
}

// ── Weeks ───────────────────────────────────────────────────────────────

/**
 * The Mondays ('YYYY-MM-DD') that fall in a month: the weeks that month
 * owns. A week starting on the 30th belongs to that month, not the next.
 */
export function mondaysOf(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const day = (8 - first.getUTCDay()) % 7; // days from the 1st to its first Monday
  const out = [];
  for (let d = new Date(Date.UTC(y, m - 1, 1 + day)); d.getUTCMonth() === m - 1; d.setUTCDate(d.getUTCDate() + 7)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Every week (its Monday) owned by the months `from` through `to`. */
export function weeksBetween(from, to) {
  return monthsBetween(from, to).flatMap(mondaysOf);
}

/** "Nov 2": a week, by its Monday. */
export function weekLabel(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}`;
}

/** "Mar 2026 - Sep 2026": the subtitle every card carries. */
export function rangeLabel(from, to) {
  const f = (k) => { const [y, m] = k.split('-').map(Number); return `${MONTH_NAMES[m - 1]} ${y}`; };
  return from === to ? f(from) : `${f(from)} - ${f(to)}`;
}

// ── Row index ───────────────────────────────────────────────────────────

/**
 * Index the rollup once per fetch: metric → series → bucket → month → value.
 * Every widget then reads the slice it needs without rescanning the list.
 */
export function indexRows(rows = []) {
  const idx = new Map();
  for (const r of rows) {
    if (!idx.has(r.m)) idx.set(r.m, new Map());
    const bySeries = idx.get(r.m);
    if (!bySeries.has(r.s)) bySeries.set(r.s, new Map());
    const byBucket = bySeries.get(r.s);
    const b = r.b ?? '';
    if (!byBucket.has(b)) byBucket.set(b, new Map());
    byBucket.get(b).set(r.mo, Number(r.v) || 0);
  }
  return idx;
}

const monthsOf = (idx, metric, series, bucket = '') =>
  idx.get(metric)?.get(series)?.get(bucket) || new Map();

/** The last month in `months` (in order) that has a value, or null. */
function latestValue(byMonth, months) {
  for (let i = months.length - 1; i >= 0; i -= 1) {
    if (byMonth.has(months[i])) return byMonth.get(months[i]);
  }
  return null;
}

function combine(byMonth, months, agg) {
  if (agg === 'latest') return latestValue(byMonth, months) ?? 0;
  let sum = 0;
  for (const mo of months) sum += byMonth.get(mo) || 0;
  return sum;
}

const round = (v) => Math.round(v * 10) / 10;

/**
 * The time axis: one period per week when the context carries weeks (Month
 * and Quarter), otherwise the months grouped by Time Frame. Each period
 * lists the keys it reads from the index it comes with.
 *
 * @returns {{ idx: Map, periods: { x: string, keys: string[] }[] }}
 */
function timePeriods(idx, { months, timeFrame = 'Month', weeks, weekIdx }) {
  if (weeks) return { idx: weekIdx || new Map(), periods: weeks.map(w => ({ x: weekLabel(w), keys: [w] })) };
  const periods = [];
  const byLabel = new Map();
  for (const mo of months) {
    const x = periodOf(mo, timeFrame);
    if (!byLabel.has(x)) { byLabel.set(x, { x, keys: [] }); periods.push(byLabel.get(x)); }
    byLabel.get(x).keys.push(mo);
  }
  return { idx, periods };
}

// ── Widgets ─────────────────────────────────────────────────────────────

/**
 * Bars and lines. For x 'month' the range splits into time periods (weeks
 * for Month and Quarter, months for Year; see timePeriods): a snapshot takes
 * the last value in each period, an event count sums it, and a period no
 * series has rows for (a week still to come) is null, a gap rather than a zero.
 * For weekday / hour / bucket the whole range folds into one value per
 * category.
 *
 * @returns {{ data: object[], hasData: boolean }}: `data` rows are
 *   `{ x, [seriesKey]: number|null, … }`; a `line` with `meanOf` adds its key too.
 */
export function buildSeriesData(idx, widget, ctx) {
  const { months } = ctx;
  const seriesKeys = widget.series.map(s => s.key);
  let hasData = false;

  const withLine = (row) => {
    if (widget.line?.meanOf) {
      const parts = widget.line.meanOf.map(k => row[k]).filter(v => v != null);
      row[widget.line.key] = parts.length ? round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
    }
    return row;
  };

  if (widget.x === 'month') {
    const time = timePeriods(idx, ctx);
    const data = time.periods.map(({ x, keys }) => {
      const byKey = seriesKeys.map(key => monthsOf(time.idx, widget.metric, key));
      // A period none of the series has rows for is still to come: a gap.
      const has = byKey.some(m => keys.some(k => m.has(k)));
      if (has) hasData = true;
      const row = { x };
      seriesKeys.forEach((key, i) => { row[key] = has ? combine(byKey[i], keys, widget.agg) : null; });
      return withLine(row);
    });
    return { data, hasData };
  }

  // Categorical x: the full range folds into each category.
  let categories;
  if (widget.x === 'weekday') categories = WEEKDAYS;
  else if (widget.x === 'hour') categories = HOURS;
  else if (widget.buckets) categories = widget.buckets;
  else {
    // Free-form buckets (medications, diagnoses): whatever the data holds.
    const seen = new Set();
    for (const key of seriesKeys) {
      for (const b of (idx.get(widget.metric)?.get(key)?.keys() || [])) seen.add(b);
    }
    categories = [...seen];
  }

  let data = categories.map((c) => {
    const row = { x: c };
    for (const key of seriesKeys) {
      const byMonth = monthsOf(idx, widget.metric, key, c);
      if (months.some(mo => byMonth.has(mo))) hasData = true;
      row[key] = combine(byMonth, months, widget.agg);
    }
    return withLine(row);
  });

  // Ranked lists show their top N, largest first; fixed categories keep order.
  if (widget.top) {
    const total = (r) => seriesKeys.reduce((a, k) => a + (r[k] || 0), 0);
    data = data.filter(r => total(r) > 0).sort((a, b) => total(b) - total(a)).slice(0, widget.top);
  }
  return { data, hasData };
}

/**
 * Window stat cards ("Not engaged in last 3 months: 12% • 1,408 / 12,000"),
 * as of the last month in the range. Series: `count` and `total`.
 */
export function buildStats(idx, stats, { months }) {
  return stats.windows.map((w) => {
    const count = latestValue(monthsOf(idx, stats.metric, 'count', w), months);
    const total = latestValue(monthsOf(idx, stats.metric, 'total', w), months);
    const hasData = count != null && total != null && total > 0;
    return {
      window: w,
      label: stats.label(w),
      count: count ?? 0,
      total: total ?? 0,
      pct: hasData ? Math.round((count / total) * 100) : 0,
      hasData,
    };
  });
}

/** Cost savings cards: traditional vs. our cost, summed over the range. */
export function buildSavings(idx, categories, metric, { months }) {
  return categories.map((c) => {
    const traditional = combine(monthsOf(idx, metric, 'traditional', c.key), months, 'sum');
    const ours = combine(monthsOf(idx, metric, 'ours', c.key), months, 'sum');
    return { ...c, traditional, ours, savings: traditional - ours, hasData: traditional > 0 || ours > 0 };
  });
}

/**
 * Cost Savings Comparison: every category's traditional cost against what
 * the employer paid here, which is the membership fees (the same figure as
 * Membership Revenue) plus the service cost of each category.
 */
export function buildSavingsSummary(idx, savings, { months }) {
  const traditional = savings.reduce((a, c) => a + c.traditional, 0);
  const service = savings.reduce((a, c) => a + c.ours, 0);
  const membership = combine(monthsOf(idx, 'membership_revenue', 'revenue'), months, 'sum');
  const ours = membership + service;
  return { traditional, membership, service, ours, savings: traditional - ours, hasData: traditional > 0 || ours > 0 };
}

/**
 * Duration of Visits: average = total minutes ÷ visits over the range; max
 * and min are the extremes across it. Returned as three bars.
 */
export function buildDuration(idx, metric, { months }) {
  const minutes = combine(monthsOf(idx, metric, 'total_minutes'), months, 'sum');
  const visits = combine(monthsOf(idx, metric, 'visits'), months, 'sum');
  const maxes = months.map(mo => monthsOf(idx, metric, 'max').get(mo)).filter(v => v != null);
  const mins = months.map(mo => monthsOf(idx, metric, 'min').get(mo)).filter(v => v != null);
  const hasData = visits > 0;
  return {
    hasData,
    data: hasData ? [
      { x: 'Average Duration', in_person: round(minutes / visits) },
      { x: 'Max Duration', in_person: Math.max(...maxes) },
      { x: 'Min Duration', in_person: Math.min(...mins) },
    ] : [],
  };
}

/**
 * Member Satisfaction for one survey: its response rate by period (% that
 * responded vs. didn't, of those sent), plus totals and the average score.
 * Totals come from the monthly rows; the periods follow timePeriods.
 */
export function buildSatisfaction(idx, metric, form, ctx) {
  const { months } = ctx;
  const sentBy = monthsOf(idx, metric, 'sent', form);
  const respondedBy = monthsOf(idx, metric, 'responded', form);
  const scoreBy = monthsOf(idx, metric, 'score_sum', form);

  const sent = combine(sentBy, months, 'sum');
  const responded = combine(respondedBy, months, 'sum');
  const scoreSum = combine(scoreBy, months, 'sum');

  const time = timePeriods(idx, ctx);
  const sentByPeriod = monthsOf(time.idx, metric, 'sent', form);
  const respondedByPeriod = monthsOf(time.idx, metric, 'responded', form);
  const data = time.periods.map(({ x, keys }) => {
    if (!keys.some(k => sentByPeriod.has(k))) return { x, responded: null, not_responded: null };
    const s = combine(sentByPeriod, keys, 'sum');
    const r = combine(respondedByPeriod, keys, 'sum');
    const pct = s > 0 ? round((r / s) * 100) : 0;
    return { x, responded: pct, not_responded: s > 0 ? round(100 - pct) : 0 };
  });

  return {
    hasData: sent > 0,
    sent,
    responded,
    notResponded: Math.max(0, sent - responded),
    averageScore: responded > 0 ? round(scoreSum / responded) : null,
    data,
  };
}

/** The surveys the satisfaction widget can pick from, most-sent first. */
export function surveyForms(idx, metric) {
  const sent = idx.get(metric)?.get('sent');
  if (!sent) return [];
  return [...sent.entries()]
    .map(([form, byMonth]) => [form, [...byMonth.values()].reduce((a, b) => a + b, 0)])
    .sort((a, b) => b[1] - a[1])
    .map(([form]) => form);
}

// ── Export ──────────────────────────────────────────────────────────────

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A widget's rows as CSV, headed by its category label and series labels. */
export function toCsv(rows, columns) {
  const head = columns.map(c => csvCell(c.label)).join(',');
  const body = rows.map(r => columns.map(c => csvCell(r[c.key])).join(','));
  return [head, ...body].join('\n');
}
