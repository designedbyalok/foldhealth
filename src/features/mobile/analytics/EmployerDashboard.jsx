import { useEffect, useMemo, useState } from 'react';
import { ChartContainer } from '../../../components/ChartContainer/ChartContainer';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { useAppStore } from '../../../store/useAppStore';
import { ChartLegend, Donut, HBars, Lines, StackedBars } from '../../analytics/views/employer/EmployerCharts';
import { SAVINGS_CATEGORIES, SAVINGS_METRIC, SECTIONS, TIME_FRAMES, WIDGETS } from '../../analytics/views/employer/employerImpactConfig';
import {
  buildDuration, buildSatisfaction, buildSavings, buildSavingsSummary, buildSeriesData, buildStats, frameRange, indexRows,
  monthsBetween, rangeLabel, surveyForms, toMonthKey, weeksBetween,
} from '../../analytics/views/employer/employerImpactData';
import { formatValue } from '../../analytics/views/employer/employerImpactFormat';
import { DesktopOnlyNote, KpiGrid, Section, SectionLoading } from './AnalyticsParts';
import pharmacy from './PharmacyDashboard.module.css';
import styles from './EmployerDashboard.module.css';

const CHART_HEIGHT = 220;
const NONE = new Set();
const signed = (n) => `${n < 0 ? '−' : ''}${formatValue(Math.abs(n), 'currency')}`;

/**
 * Employer Impact Report on the phone, read only. The same rollup fetches
 * as EmployerImpactView (All Locations, the range ending this month), with
 * its Employer and Time Frame filters; the desktop's widget layout, saved
 * reports, print and email stay on the computer.
 */
export function EmployerDashboard() {
  const filterOptions = useAppStore(s => s.employerImpactFilters);
  const filtersLoaded = useAppStore(s => s.employerImpactFiltersLoaded);
  const fetchFilters = useAppStore(s => s.fetchEmployerImpactFilters);
  const fetchRollup = useAppStore(s => s.fetchEmployerImpact);
  useEffect(() => { fetchFilters(); }, [fetchFilters]);

  const [pickedEmployer, setEmployerName] = useState(undefined);
  const [timeFrame, setTimeFrame] = useState('Quarter');
  const employers = filterOptions?.employers || [];
  const employerName = pickedEmployer === undefined ? (employers[0]?.name ?? null) : pickedEmployer;
  const employerId = employers.find(e => e.name === employerName)?.id || null;
  const range = frameRange(timeFrame, toMonthKey(new Date()));
  const weekly = timeFrame !== 'Year';

  const requestKey = [range.from, range.to, employerId].join('|');
  const [rows, setRows] = useState(null);
  const [weekRows, setWeekRows] = useState(null);
  useEffect(() => {
    if (!filtersLoaded) return undefined;
    let cancelled = false;
    const filters = { from: range.from, to: range.to, employer: employerId, scope: 'patient', location: null };
    fetchRollup(filters).then(r => { if (!cancelled) setRows({ key: requestKey, rows: r || [] }); });
    if (weekly) fetchRollup({ ...filters, weekly: true }).then(r => { if (!cancelled) setWeekRows({ key: requestKey, rows: r }); });
    return () => { cancelled = true; };
  }, [filtersLoaded, fetchRollup, requestKey, weekly, range.from, range.to, employerId]);

  const loading = rows?.key !== requestKey || (weekly && weekRows?.key !== requestKey);
  const idx = useMemo(() => indexRows(loading ? [] : rows.rows), [rows, loading]);
  const weekIdx = useMemo(() => (weekly && !loading && weekRows.rows ? indexRows(weekRows.rows) : null), [weekly, loading, weekRows]);
  const ctx = useMemo(() => {
    const months = monthsBetween(range.from, range.to);
    return weekIdx ? { months, timeFrame: 'Month', weeks: weeksBetween(range.from, range.to), weekIdx } : { months, timeFrame: 'Month' };
  }, [range.from, range.to, weekIdx]);
  const savings = useMemo(() => buildSavings(idx, SAVINGS_CATEGORIES, SAVINGS_METRIC, ctx), [idx, ctx]);
  const summary = useMemo(() => buildSavingsSummary(idx, savings, ctx), [idx, savings, ctx]);
  const rangeText = rangeLabel(range.from, range.to);

  return (
    <>
      <div className={pharmacy.filters}>
        <FilterChip
          label="Employer"
          options={employers.map(e => e.name)}
          selected={employerName ? [employerName] : []}
          onChange={(next) => setEmployerName(next[0] || null)}
          singleSelect
          searchable={employers.length > 6}
        />
        <FilterChip label="Time Frame" options={TIME_FRAMES} selected={[timeFrame]} onChange={(next) => setTimeFrame(next[0] || 'Quarter')} singleSelect noClear />
      </div>

      <Section title="Cost Savings" sub={rangeText} plain>
        <KpiGrid loading={loading} count={3} items={[
          { label: 'Traditional Cost', value: formatValue(summary.traditional, 'currency') },
          { label: 'Our Cost', value: formatValue(summary.ours, 'currency') },
          { label: 'Total Savings', value: signed(summary.savings), deltaType: summary.savings < 0 ? 'neg' : 'pos' },
          ...savings.map(c => ({ label: c.title, value: signed(c.savings), sub: `${formatValue(c.traditional, 'currency')} vs ${formatValue(c.ours, 'currency')}` })),
        ]} />
      </Section>

      {SECTIONS.filter(sec => sec.id !== 'costSavings').map(sec => (
        <Section key={sec.id} title={sec.title} sub={sec.subtitle} plain>
          {WIDGETS.filter(w => w.section === sec.id).map(w => (
            <Widget key={w.key} widget={w} idx={idx} ctx={ctx} loading={loading} subtitle={filtersLoaded ? rangeText : undefined} />
          ))}
        </Section>
      ))}
      <DesktopOnlyNote what="arrange widgets, print or email this report" />
    </>
  );
}

function Widget({ widget: w, idx, ctx, loading, subtitle }) {
  const [hidden, setHidden] = useState(NONE);
  const toggle = (key) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const weekly = !!ctx.weeks && w.x === 'month';
  const xLabel = weekly ? 'Weeks' : w.xLabel;

  let body;
  let hasData;
  if (w.type === 'stats') {
    const stats = buildStats(idx, w.stats, ctx);
    hasData = stats.some(s => s.hasData);
    body = (
      <div className={styles.stats}>
        {stats.map(s => (
          <div key={s.window} className={styles.stat}>
            <span className={styles.statLabel}>{s.label}</span>
            <span className={styles.statValue}>{s.hasData ? `${s.pct}%` : '–'}</span>
            {s.hasData && <span className={styles.statSub}>{s.count.toLocaleString()} / {s.total.toLocaleString()}</span>}
          </div>
        ))}
      </div>
    );
  } else if (w.type === 'satisfaction') {
    // The most-sent survey, as the desktop opens on; picking another stays on desktop.
    const form = surveyForms(idx, w.metric)[0];
    const sat = form ? buildSatisfaction(idx, w.metric, form, ctx) : { hasData: false };
    hasData = sat.hasData;
    body = hasData && (
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Average Score</span>
          <span className={styles.statValue}>{sat.averageScore ?? '–'}</span>
          <span className={styles.statSub}>{form}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Responded</span>
          <span className={styles.statValue}>{sat.responded.toLocaleString()}</span>
          <span className={styles.statSub}>of {sat.sent.toLocaleString()} sent</span>
        </div>
      </div>
    );
  } else if (w.type === 'duration') {
    const d = buildDuration(idx, w.metric, ctx);
    hasData = d.hasData;
    body = <HBars data={d.data} seriesKey="in_person" seriesLabel={w.series[0].label} xLabel={w.xLabel} format="minutes" height={CHART_HEIGHT} />;
  } else {
    const { data, hasData: has } = buildSeriesData(idx, w, ctx);
    hasData = has;
    if (w.type === 'donut') body = <Donut data={data} seriesKey={w.series[0].key} height={CHART_HEIGHT} />;
    else if (w.type === 'hbar') body = <HBars data={data} seriesKey={w.series[0].key} seriesLabel={w.series[0].label} yLabel={w.yLabel} xLabel={w.xLabel} height={CHART_HEIGHT} />;
    else {
      const chart = w.type === 'line'
        ? <Lines data={data} series={w.series} hidden={hidden} yLabel={w.yLabel} xLabel={xLabel} format={w.format} height={CHART_HEIGHT} thinX={weekly} />
        : <StackedBars data={data} series={w.series} line={w.line} hidden={hidden} yLabel={w.yLabel} xLabel={xLabel} format={w.format} height={CHART_HEIGHT} denseX={w.x === 'hour'} thinX={weekly} />;
      body = <><ChartLegend series={w.series} hidden={hidden} onToggle={toggle} line={w.line} />{chart}</>;
    }
  }

  return (
    <ChartContainer title={w.title} info={w.info} subtitle={subtitle} empty={!loading && !hasData}>
      {loading ? <SectionLoading height={w.type === 'stats' ? 96 : CHART_HEIGHT} /> : body}
    </ChartContainer>
  );
}
