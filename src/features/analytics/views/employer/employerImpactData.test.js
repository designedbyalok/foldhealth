import { describe, it, expect } from 'vitest';
import {
  monthsBetween, addMonths, periodOf, rangeLabel, indexRows, mondaysOf, weeksBetween, weekLabel,
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

describe('weeks', () => {
  it('gives a month the weeks whose Monday falls in it', () => {
    // Nov 2026 starts on a Sunday; its last Monday is the 30th.
    expect(mondaysOf('2026-11')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(mondaysOf('2026-06')).toEqual(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29']);
  });
  it('lists a quarter of weeks, labelled by Monday', () => {
    const weeks = weeksBetween('2026-10', '2026-12');
    expect(weeks).toHaveLength(13);
    expect(weeks[0]).toBe('2026-10-05');
    expect(weekLabel(weeks[0])).toBe('Oct 5');
  });
  it('charts weeks from the weekly index when the context has them', () => {
    const events = { metric: 'calls', x: 'month', agg: 'sum', series: [{ key: 'in' }] };
    const weekIdx = indexRows([row('calls', 'in', '2026-11-02', 4), row('calls', 'in', '2026-11-09', 6)]);
    const ctx = { months: ['2026-11'], timeFrame: 'Month', weeks: mondaysOf('2026-11'), weekIdx };
    const { data, hasData } = buildSeriesData(new Map(), events, ctx);
    expect(hasData).toBe(true);
    expect(data.map(r => r.x)).toEqual(['Nov 2', 'Nov 9', 'Nov 16', 'Nov 23', 'Nov 30']);
    expect(data.map(r => r.in)).toEqual([4, 6, null, null, null]);
  });
});

describe('weekly seed', () => {
  it('splits each month over its weeks so they add back up to it', async () => {
    const { employerImpactRows, employerImpactWeeklyRows } = await import('./employerImpactSeed');
    const monthly = employerImpactRows('2026-11').filter(r => r.month === '2026-11-01' && r.employer_id === 'emp-harbor');
    const weekly = employerImpactWeeklyRows(monthly);
    const revenue = monthly.find(r => r.metric === 'membership_revenue');
    const weeks = weekly.filter(r => r.metric === 'membership_revenue' && r.patient_location === revenue.patient_location && r.visit_location === revenue.visit_location);
    expect(weeks).toHaveLength(5);
    expect(weeks.reduce((a, r) => a + r.value, 0)).toBe(revenue.value);
    // Categorical metrics stay monthly only.
    expect(weekly.some(r => r.metric === 'calls_by_hour')).toBe(false);
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

  it('gives one row per month, a gap where a month has no rows', () => {
    const { data, hasData } = buildSeriesData(idx, events, { months, timeFrame: 'Month' });
    expect(hasData).toBe(true);
    expect(data.map(r => r.in)).toEqual([10, 20, null, 5]);
    // A series with no rows in a month that has others' rows is a real zero.
    expect(data[1].out).toBe(0);
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
        { title: 'Savings with comparison', items: [
          { key: 'sum', kind: 'savings', summary: true, subtitle: 'Jan 2026 - Feb 2026', card: { title: 'Cost Savings Comparison', traditional: 900000, membership: 20000, service: 80000, ours: 100000, savings: 800000, hasData: true } },
          ...['a', 'b', 'c'].map(k => ({ key: k, kind: 'savings', card: { title: `${k} Savings`, traditional: 5000, ours: 1000, savings: 4000, hasData: true } })),
        ] },
      ],
    });
    expect(blob.type).toBe('application/pdf');
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
  });

  it('draws header and footer components, or none', async () => {
    const { generateEmployerReport } = await import('./generateEmployerReportPdf');
    // 1×1 PNG standing in for a drawn header component.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const sections = [{ id: 's', title: 'Savings', items: [{ key: 's', kind: 'savings', card: { title: 'Lab Savings', traditional: 5, ours: 1, savings: 4, hasData: true } }] }];
    for (const header of [{ dataUrl: png, width: 600, height: 110 }, null]) {
      const { blob } = generateEmployerReport({ title: 'Report', sections, header });
      expect(blob.type).toBe('application/pdf');
    }
    // Footers: one image per page, one for all pages, or none.
    for (const footer of [{ width: 600, height: 24, images: [png] }, { width: 600, height: 24, dataUrl: png }, null]) {
      const { blob } = generateEmployerReport({ title: 'Report', sections, footer });
      expect(blob.type).toBe('application/pdf');
    }
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

describe('report pages', () => {
  it('starts every section on a fresh page and reports where', async () => {
    const { generateEmployerReport } = await import('./generateEmployerReportPdf');
    const widget = { key: 'w', title: 'W', type: 'line', series: [{ key: 'a', label: 'A' }] };
    const item = (key) => ({ key, kind: 'widget', widget, model: { hasData: true, data: [{ x: 'Jan 26', a: 1 }] } });
    const { anchors } = generateEmployerReport({
      title: 'Employer Impact Report',
      cover: { range: 'Jan 2026 - Mar 2026' },
      sections: [
        { id: 'one', title: 'One', items: [item('w1')] },
        { id: 'two', title: 'Two', items: [item('w2')] },
        { id: 'three', title: 'Three', items: [item('w3')] },
      ],
    });
    const pages = Object.fromEntries(Object.entries(anchors).map(([k, a]) => [k, a.page]));
    expect(pages).toEqual({ cover: 1, one: 2, w1: 2, two: 3, w2: 3, three: 4, w3: 4 });
    // A widget sits below its section title on the same page.
    expect(anchors.w1.top).toBeGreaterThan(anchors.one.top);
  });

  it('fits four rows of chart cards on a page', async () => {
    const { generateEmployerReport } = await import('./generateEmployerReportPdf');
    const widget = { key: 'w', title: 'W', type: 'line', series: [{ key: 'a', label: 'A' }] };
    const item = (key) => ({ key, kind: 'widget', widget, model: { hasData: true, data: [{ x: 'Jan 26', a: 1 }] } });
    const { anchors } = generateEmployerReport({
      title: 'Employer Impact Report',
      cover: null,
      sections: [{
        id: 'big',
        title: 'Big',
        subtitle: 'A one-line subtitle',
        items: Array.from({ length: 9 }, (_, i) => item(`w${i + 1}`)),
      }],
    });
    // Two per row: w1..w8 are four rows on the section's page; w9 starts the next.
    expect(anchors.w8.page).toBe(anchors.big.page);
    expect(anchors.w9.page).toBe(anchors.big.page + 1);
  });
});

describe('parseRichText lists', () => {
  it('turns bullet and numbered items into lines led by a marker', async () => {
    const { parseRichText } = await import('./generateEmployerReportPdf');
    const lines = parseRichText('Intro<ul><li>One</li><li><b>Two</b></li></ul><ol><li>First</li><li>Second</li></ol>')
      .map(runs => runs.map(r => r.text).join(''));
    expect(lines).toEqual(['Intro', '• One', '• Two', '1. First', '2. Second']);
  });
});

describe('PDF chart widths', () => {
  it('widens a chart whose labels would be cut short at half width', async () => {
    const { default: jsPDF } = await import('jspdf');
    const { labelsFit, labelEvery, registerFonts, HALF_W, FULL_W } = await import('./generateEmployerReportPdf');
    const { readFileSync } = await import('node:fs');
    // Measured in Inter, as the real report is.
    const ttf = (name) => readFileSync(new URL(`../../../../assets/fonts/inter/Inter-${name}.ttf`, import.meta.url)).toString('base64');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    registerFonts(doc, { regular: ttf('Regular'), bold: ttf('Bold'), italic: ttf('Italic'), boldItalic: ttf('BoldItalic'), medium: ttf('Medium') });
    const series = [{ key: 'a', label: 'A' }];
    const hours = Array.from({ length: 24 }, (_, h) => ({ x: `${String(h).padStart(2, '0')}-${String(h + 1).padStart(2, '0')}`, a: 10 }));
    const hourly = { widget: { type: 'stackedBar', series, yLabel: 'No. of Visits' }, model: { hasData: true, data: hours } };
    expect(labelsFit(doc, hourly, HALF_W)).toBe(false);
    expect(labelsFit(doc, hourly, FULL_W)).toBe(true);
    // Across the page every hour gets its own label, under its own bar.
    expect(labelEvery(doc, hours.map(h => h.x), (FULL_W - 60) / 24)).toBe(1);
    const monthly = { widget: { type: 'stackedBar', series }, model: { hasData: true, data: ['Jan 26', 'Feb 26', 'Mar 26'].map(x => ({ x, a: 1 })) } };
    expect(labelsFit(doc, monthly, HALF_W)).toBe(true);
    // Charts with no category axis never need widening.
    expect(labelsFit(doc, { widget: { type: 'donut', series }, model: { hasData: true, data: hours } }, HALF_W)).toBe(true);
  });
});

describe('PDF card rows', () => {
  it('widens a half card left alone in its row', async () => {
    const { fillRows } = await import('./generateEmployerReportPdf');
    const half = (key) => ({ key });
    const full = (key) => ({ key, full: true });
    const widths = (items) => fillRows(items).map(i => (i.full ? 'F' : 'H')).join('');
    expect(widths([half('a'), half('b'), half('c')])).toBe('HHF');       // last one alone
    expect(widths([half('a'), half('b'), half('c'), full('d')])).toBe('HHFF'); // alone before a full chart
    expect(widths([half('a'), full('b'), half('c'), half('d')])).toBe('FFHH');
    expect(widths([half('a'), half('b')])).toBe('HH');
  });
});

describe('note spacing', () => {
  it('keeps typed line breaks and blank lines, and indents a list item\'s later lines', async () => {
    const { parseRichText } = await import('./generateEmployerReportPdf');
    const html = 'Intro line\n\n<ul><li>One</li><li>Two ends.\n\nMore of two</li></ul><ol><li>First</li></ol>';
    const paras = parseRichText(html);
    const text = paras.map(runs => runs.map(r => r.text).join(''));
    expect(text).toEqual(['Intro line', '', '• One', '• Two ends.', '', 'More of two', '1. First']);
    // The blank line and "More of two" belong to item two, so they hang under its text.
    expect(paras[5].hangText).toBe('• ');
    expect(paras[2][0].marker).toBe(true);
  });
});

describe('blank list items', () => {
  it('prints a blank item as space, unnumbered, and numbers the rest on', async () => {
    const { parseRichText } = await import('./generateEmployerReportPdf');
    const html = '<ol><li>One</li><li><br></li><li>Two</li><li data-blank=""><br></li><li>Three</li></ol>';
    const text = parseRichText(html).map(runs => runs.map(r => r.text).join(''));
    expect(text).toEqual(['1. One', '', '2. Two', '', '3. Three']);
  });
});

describe('list numbers from the editor', () => {
  it('uses each item\'s own number, so numbering carries on past bullets', async () => {
    const { parseRichText } = await import('./generateEmployerReportPdf');
    const html = '<ol><li value="1">Total</li></ol><ul><li>Unpaid</li></ul><ol><li value="2">Revenue</li><li value="3">New</li></ol>';
    expect(parseRichText(html).map(runs => runs.map(r => r.text).join(''))).toEqual(['1. Total', '• Unpaid', '2. Revenue', '3. New']);
  });
});

describe('frameRange', () => {
  it('covers the month, the calendar quarter, or the 12 months ending at a month', async () => {
    const { frameRange } = await import('./employerImpactData');
    expect(frameRange('Month', '2026-09')).toEqual({ from: '2026-09', to: '2026-09' });
    expect(frameRange('Quarter', '2026-09')).toEqual({ from: '2026-07', to: '2026-09' });
    expect(frameRange('Quarter', '2026-08')).toEqual({ from: '2026-07', to: '2026-09' });
    expect(frameRange('Quarter', '2026-01')).toEqual({ from: '2026-01', to: '2026-03' });
    expect(frameRange('Year', '2026-09')).toEqual({ from: '2025-10', to: '2026-09' });
  });
});

describe('rangeFromStart', () => {
  it('runs from a picked start: that month, its quarter, or 12 months on', async () => {
    const { rangeFromStart } = await import('./employerImpactData');
    expect(rangeFromStart('Month', '2025-01')).toEqual({ from: '2025-01', to: '2025-01' });
    expect(rangeFromStart('Quarter', '2025-08')).toEqual({ from: '2025-07', to: '2025-09' });
    expect(rangeFromStart('Year', '2025-01')).toEqual({ from: '2025-01', to: '2025-12' });
    expect(rangeFromStart('Year', '2025-10')).toEqual({ from: '2025-10', to: '2026-09' });
  });
});

