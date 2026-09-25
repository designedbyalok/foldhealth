import { describe, it, expect } from 'vitest';
import {
  monthsBetween, addMonths, periodOf, rangeLabel, indexRows,
  buildSeriesData, buildStats, buildSavings, buildDuration, buildSatisfaction, surveyForms, toCsv,
} from './employerImpactData';

const row = (m, s, mo, v, b = '') => ({ m, s, b, mo, v });

describe('months', () => {
  it('lists an inclusive range across a year boundary', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('shifts months both ways', () => {
    expect(addMonths('2026-01', -2)).toBe('2025-11');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
  });
  it('labels periods by time frame', () => {
    expect(periodOf('2026-05', 'Month')).toBe('May 26');
    expect(periodOf('2026-05', 'Quarter')).toBe('Q2 26');
    expect(periodOf('2026-05', 'Year')).toBe('2026');
    expect(rangeLabel('2026-03', '2026-09')).toBe('Mar 2026 - Sep 2026');
  });
});

describe('buildSeriesData', () => {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04'];
  const events = { metric: 'calls', x: 'month', agg: 'sum', series: [{ key: 'in' }, { key: 'out' }] };
  const snapshot = { metric: 'members', x: 'month', agg: 'latest', series: [{ key: 'n' }] };
  const idx = indexRows([
    row('calls', 'in', '2026-01', 10), row('calls', 'in', '2026-02', 20), row('calls', 'in', '2026-04', 5),
    row('calls', 'out', '2026-01', 1),
    row('members', 'n', '2026-01', 100), row('members', 'n', '2026-02', 110), row('members', 'n', '2026-03', 120),
  ]);

  it('gives one row per month, zero where a month has no rows', () => {
    const { data, hasData } = buildSeriesData(idx, events, { months, timeFrame: 'Month' });
    expect(hasData).toBe(true);
    expect(data.map(r => r.in)).toEqual([10, 20, 0, 5]);
    expect(data[0]).toMatchObject({ x: 'Jan 26', in: 10, out: 1 });
  });
  it('sums events within a quarter', () => {
    const { data } = buildSeriesData(idx, events, { months, timeFrame: 'Quarter' });
    expect(data).toEqual([{ x: 'Q1 26', in: 30, out: 1 }, { x: 'Q2 26', in: 5, out: 0 }]);
  });
  it('takes the last month of a quarter for a snapshot, not the sum', () => {
    const { data } = buildSeriesData(idx, snapshot, { months: months.slice(0, 3), timeFrame: 'Quarter' });
    expect(data).toEqual([{ x: 'Q1 26', n: 120 }]);
  });
  it('reports no data when the range has no rows', () => {
    expect(buildSeriesData(idx, events, { months: ['2025-06'] }).hasData).toBe(false);
  });
  it('computes the average line from the bars it sits on', () => {
    const w = { metric: 'eng', x: 'month', agg: 'sum', series: [{ key: 'a' }, { key: 'b' }], line: { key: 'avg', meanOf: ['a', 'b'] } };
    const i = indexRows([row('eng', 'a', '2026-01', 10), row('eng', 'b', '2026-01', 5)]);
    expect(buildSeriesData(i, w, { months: ['2026-01'] }).data[0].avg).toBe(7.5);
  });
  it('folds the range into categories and ranks a top list', () => {
    const w = { metric: 'meds', x: 'bucket', agg: 'sum', top: 2, series: [{ key: 'orders' }] };
    const i = indexRows([
      row('meds', 'orders', '2026-01', 5, 'A'), row('meds', 'orders', '2026-02', 5, 'A'),
      row('meds', 'orders', '2026-01', 30, 'B'), row('meds', 'orders', '2026-01', 1, 'C'),
    ]);
    expect(buildSeriesData(i, w, { months: ['2026-01', '2026-02'] }).data).toEqual([
      { x: 'B', orders: 30 }, { x: 'A', orders: 10 },
    ]);
  });
  it('keeps fixed categories in order, including empty ones', () => {
    const w = { metric: 'wd', x: 'weekday', agg: 'sum', series: [{ key: 'n' }] };
    const i = indexRows([row('wd', 'n', '2026-01', 4, 'Tue')]);
    const { data } = buildSeriesData(i, w, { months: ['2026-01'] });
    expect(data.map(r => r.x)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(data[2].n).toBe(4);
  });
});

describe('cards', () => {
  it('stat windows use the last month and compute a percentage', () => {
    const i = indexRows([
      row('ne', 'count', '2026-01', 50, '3'), row('ne', 'total', '2026-01', 500, '3'),
      row('ne', 'count', '2026-02', 60, '3'), row('ne', 'total', '2026-02', 500, '3'),
    ]);
    const [s] = buildStats(i, { metric: 'ne', windows: ['3'], label: w => w }, { months: ['2026-01', '2026-02'] });
    expect(s).toMatchObject({ count: 60, total: 500, pct: 12, hasData: true });
  });
  it('savings are computed and can be negative', () => {
    const i = indexRows([row('cs', 'traditional', '2026-01', 97000, 'img'), row('cs', 'ours', '2026-01', 100000, 'img')]);
    const [c] = buildSavings(i, [{ key: 'img' }], 'cs', { months: ['2026-01'] });
    expect(c.savings).toBe(-3000);
  });
  it('duration averages minutes over visits and keeps the extremes', () => {
    const i = indexRows([
      row('d', 'total_minutes', '2026-01', 300), row('d', 'visits', '2026-01', 10), row('d', 'max', '2026-01', 55), row('d', 'min', '2026-01', 12),
      row('d', 'total_minutes', '2026-02', 100), row('d', 'visits', '2026-02', 10), row('d', 'max', '2026-02', 70), row('d', 'min', '2026-02', 9),
    ]);
    const { data } = buildDuration(i, 'd', { months: ['2026-01', '2026-02'] });
    expect(data.map(r => r.in_person)).toEqual([20, 70, 9]);
  });
  it('satisfaction gives the response rate and average score', () => {
    const i = indexRows([
      row('sat', 'sent', '2026-01', 200, 'Quiz'), row('sat', 'responded', '2026-01', 150, 'Quiz'), row('sat', 'score_sum', '2026-01', 1200, 'Quiz'),
      row('sat', 'sent', '2026-01', 10, 'Other'),
    ]);
    expect(surveyForms(i, 'sat')).toEqual(['Quiz', 'Other']);
    const s = buildSatisfaction(i, 'sat', 'Quiz', { months: ['2026-01'] });
    expect(s).toMatchObject({ sent: 200, responded: 150, notResponded: 50, averageScore: 8 });
    expect(s.data[0]).toMatchObject({ responded: 75, not_responded: 25 });
  });
});

describe('toCsv', () => {
  it('quotes cells that contain commas or quotes', () => {
    const csv = toCsv([{ x: 'Public Transportation (bus, metro)', n: 3 }, { x: 'Say "hi"', n: 1 }],
      [{ key: 'x', label: 'Category' }, { key: 'n', label: 'Count' }]);
    expect(csv).toBe('Category,Count\n"Public Transportation (bus, metro)",3\n"Say ""hi""",1');
  });
});

describe('local fallback', () => {
  it('rolls up like the SQL function and narrows by filters', async () => {
    const { localEmployerImpactFilters, localEmployerImpactRollup } = await import('./employerImpactLocal');
    const f = localEmployerImpactFilters();
    expect(f.employers).toHaveLength(3);
    expect(f.firstMonth < f.lastMonth).toBe(true);
    const sum = (rs, m) => rs.filter(r => r.m === m).reduce((a, r) => a + r.v, 0);
    const all = localEmployerImpactRollup({ from: f.firstMonth, to: f.lastMonth });
    const one = localEmployerImpactRollup({ from: f.firstMonth, to: f.lastMonth, employer: f.employers[1].id });
    expect(sum(one, 'membership_revenue')).toBeGreaterThan(0);
    expect(sum(one, 'membership_revenue')).toBeLessThan(sum(all, 'membership_revenue'));
    const keys = all.map(r => `${r.m}|${r.s}|${r.b}|${r.mo}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('layout', () => {
  it('reconciles a saved layout with the current config', async () => {
    const { defaultLayout, normalizeLayout } = await import('./employerImpactLayout');
    const base = defaultLayout();
    const [first, second] = base.sections;
    const [w1, w2] = base.widgets[first];
    const saved = {
      sections: [second, 'gone', first],
      widgets: { [first]: [w2, 'gone', w1] },
      hidden: [w1, 'gone'],
    };
    const out = normalizeLayout(saved);
    expect(out.sections.slice(0, 2)).toEqual([second, first]);
    expect(out.sections).toHaveLength(base.sections.length);
    expect(out.widgets[first].slice(0, 2)).toEqual([w2, w1]);
    expect(out.widgets[first]).toHaveLength(base.widgets[first].length);
    expect(out.hidden).toEqual([w1]);
    expect(normalizeLayout(null)).toEqual(base);
  });
  it('By Location shows only Clinical Visits, even from a saved layout', async () => {
    const { defaultLayout, normalizeLayout } = await import('./employerImpactLayout');
    const patient = defaultLayout('patient');
    const visit = normalizeLayout(patient, 'visit');
    expect(patient.sections).toContain('costSavings');
    expect(visit.sections).toEqual(['clinicalVisits']);
    expect(visit.widgets.clinicalVisits).toEqual(patient.widgets.clinicalVisits);
    expect(visit.widgets.costSavings).toBeUndefined();
  });
});

describe('packSpans', () => {
  it('splits short rows equally, keeps full ones, and keeps order', async () => {
    const { packSpans } = await import('./employerImpactLayout');
    expect(packSpans([2, 4, 3, 2, 2])).toEqual([2, 4, 3, 3, 6]);
    expect(packSpans([4, 2, 3, 3])).toEqual([4, 2, 3, 3]);
    expect(packSpans([3, 3, 6])).toEqual([3, 3, 6]);
    expect(packSpans([2, 2, 2])).toEqual([2, 2, 2]);
    expect(packSpans([2, 2])).toEqual([3, 3]);
    expect(packSpans([4, 4])).toEqual([6, 6]);
    expect(packSpans([1, 1, 1, 1], 6)).toEqual([2, 2, 1, 1]);
    const rows = packSpans([2, 3, 4, 2, 3, 2, 6, 3]);
    let used = 0;
    for (const s of rows) { used += s; if (used > 6) throw new Error('row overflow'); if (used === 6) used = 0; }
    expect(used).toBe(0);
  });
  it('fills a two-column tablet grid too', async () => {
    const { packSpans } = await import('./employerImpactLayout');
    expect(packSpans([3, 6, 3, 3, 3], 6)).toEqual([6, 6, 3, 3, 6]);
  });
});

describe('generateEmployerReportPdf', () => {
  it('draws every widget type, empty ones included, into a multi-page PDF', async () => {
    const { generateEmployerReportPdf } = await import('./generateEmployerReportPdf');
    const months = [{ x: 'Jan 26', a: 10, b: 5, avg: 7.5 }, { x: 'Feb 26', a: 12, b: 6, avg: 9 }];
    const series = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }];
    const w = (type, extra = {}) => ({ key: type, title: type, type, series, format: undefined, ...extra });
    const item = (widget, model, full = false) => ({ key: widget.key, kind: 'widget', widget, model, subtitle: 'Jan 2026 - Feb 2026', full });
    const items = [
      item(w('stackedBar', { line: { key: 'avg', label: 'Avg' } }), { hasData: true, data: months, sideStats: [{ label: '3 mo', pct: 10, count: 1, total: 10, hasData: true }] }),
      item(w('line'), { hasData: true, data: months }),
      item(w('hbar', { series: [{ key: 'a', label: 'A' }] }), { hasData: true, data: months }),
      item(w('donut', { series: [{ key: 'a', label: 'A' }] }), { hasData: true, data: months }),
      item(w('stats'), { hasData: true, stats: [{ label: '90 days', pct: 50, count: 5, total: 10, hasData: true }] }),
      item(w('duration'), { hasData: true, data: [{ x: 'Average Duration', in_person: 20 }] }),
      item(w('satisfaction'), { hasData: true, form: 'Quiz', sent: 10, responded: 8, notResponded: 2, averageScore: 7.5, data: [{ x: 'Jan 26', responded: 80, not_responded: 20 }] }),
      item(w('stackedBar', { key: 'empty' }), { hasData: false, data: [] }, true),
    ];
    const blob = generateEmployerReportPdf({
      title: 'Employer Impact Report',
      meta: 'Jan 2026 - Feb 2026',
      sections: [
        { title: 'Charts', subtitle: 'Members and revenue, month by month', note: 'For the <b>Q1</b> review.<div><i>Draft</i> &amp; <u>internal</u></div>', items: [...items, ...items] },
        { title: 'Savings', items: [{ key: 's', kind: 'savings', card: { title: 'Imaging Savings', traditional: 97000, ours: 100000, savings: -3000, hasData: true } }] },
      ],
    });
    expect(blob.type).toBe('application/pdf');
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
  });
});

describe('parseRichText', () => {
  it('keeps bold, italic, underline and strike, and splits paragraphs', async () => {
    const { parseRichText } = await import('./generateEmployerReportPdf');
    const out = parseRichText('Hello <b>big <i>world</i></b><div><u>next</u> &amp; <s>old</s></div><br>');
    expect(out[0]).toEqual([
      { text: 'Hello ', bold: false, italic: false, underline: false, strike: false },
      { text: 'big ', bold: true, italic: false, underline: false, strike: false },
      { text: 'world', bold: true, italic: true, underline: false, strike: false },
    ]);
    expect(out[1].map(r => [r.text, r.underline, r.strike])).toEqual([['next', true, false], [' & ', false, false], ['old', false, true]]);
  });
});

describe('report fonts', () => {
  it('embeds Inter when the TTFs are supplied', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const dir = fileURLToPath(new URL('../../../../assets/fonts/inter/', import.meta.url));
    const rd = (n) => readFileSync(dir + n).toString('base64');
    const fonts = { regular: rd('Inter-Regular.ttf'), medium: rd('Inter-Medium.ttf'), bold: rd('Inter-Bold.ttf'), italic: rd('Inter-Italic.ttf'), boldItalic: rd('Inter-BoldItalic.ttf') };
    const { generateEmployerReportPdf } = await import('./generateEmployerReportPdf');
    fonts.semibold = rd('Inter-SemiBold.ttf');
    const blob = generateEmployerReportPdf({ fonts, title: 'Employer Impact Report', cover: { range: 'Jan 2026 - Mar 2026', description: 'Quarterly summary.' }, sections: [] });
    const pdf = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    expect(pdf).toContain('/BaseFont /Inter');
    expect(pdf).toContain('/BaseFont /InterMedium');
    expect(pdf).toContain('/BaseFont /InterSemiBold'); // cover title
  });
});

describe('cover background', () => {
  it('picks dark text only for light backgrounds', async () => {
    const { isLightBackground } = await import('./generateEmployerReportPdf');
    expect(isLightBackground({ type: 'color', color: '#F6F7F8' })).toBe(true);
    expect(isLightBackground({ type: 'color', color: '#1376BC' })).toBe(false);
    expect(isLightBackground({ type: 'gradient', gradient: 'ocean' })).toBe(false);
    expect(isLightBackground({ type: 'gradient', gradient: 'frost' })).toBe(true);
    expect(isLightBackground({ type: 'gradient', gradient: 'amethyst' })).toBe(false);
    expect(isLightBackground({ type: 'image', dataUrl: 'x' })).toBe(false);
  });
});
