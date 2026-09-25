import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import { Toggle } from '../../../../components/Toggle/Toggle';
import { SubTabs } from '../../../../components/SubTabs/SubTabs';
import { Button } from '../../../../components/Button/Button';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { FilterChip } from '../../../../components/FilterChip/FilterChip';
import { DateRangePopover } from '../../../../components/DateRangePopover/DateRangePopover';
import { Select } from '../../../../components/Select/Select';
import { CheckboxListPopover } from '../../../../components/CheckboxListPopover/CheckboxListPopover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ShadcnDialog/ShadcnDialog';
import { ChartSkeleton, KpiSkeleton } from '../shared';
import { ChartContainer } from '../../../../components/ChartContainer/ChartContainer';
import { StackedBars, Lines, HBars, Donut, ChartLegend } from './EmployerCharts';
import { formatValue } from './employerImpactFormat';
import {
  SECTIONS, WIDGETS, SAVINGS_CATEGORIES, SAVINGS_METRIC, TIME_FRAMES, SCOPE_OPTIONS,
} from './employerImpactConfig';
import {
  monthsBetween, addMonths, rangeLabel, toMonthKey, indexRows,
  buildSeriesData, buildStats, buildSavings, buildDuration, buildSatisfaction, surveyForms, toCsv,
} from './employerImpactData';
import { VIEW_TITLES } from '../../analyticsData';
import layout from '../../AnalyticsLayout.module.css';
import { readLayouts, writeLayouts, savingsKey, packSpans, SPAN_COLUMNS } from './employerImpactLayout';
import { UpdateDashboardDrawer } from './UpdateDashboardDrawer';
import { PrintReportDrawer } from './PrintReportDrawer';
import styles from './EmployerImpactView.module.css';

const DEFAULT_SPAN_MONTHS = 7;
// Every chart card is this tall so rows of cards line up.
const CHART_CARD_HEIGHT = 330;
const WIDGET_MENU = [
  { key: 'table', label: 'View as table', icon: 'solar:list-linear' },
  { key: 'hide', label: 'Hide widget', icon: 'solar:eye-closed-linear' },
];

function downloadCsv(filename, csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const lastDayOf = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  return `${monthKey}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};

// ── Per-widget view model ────────────────────────────────────────────────

/**
 * What a widget draws, as rows plus the columns that describe them: the
 * same shape feeds the chart, the table view and the CSV, so the three
 * always agree.
 */
function widgetModel(widget, idx, ctx, extra) {
  if (widget.type === 'stats') {
    const stats = buildStats(idx, widget.stats, ctx);
    return {
      hasData: stats.some(s => s.hasData),
      stats,
      rows: stats.map(s => ({ x: s.label, pct: `${s.pct}%`, count: s.count, total: s.total })),
      columns: [{ key: 'x', label: 'Window' }, { key: 'pct', label: 'Share' }, { key: 'count', label: 'Members' }, { key: 'total', label: 'Total members' }],
    };
  }
  if (widget.type === 'duration') {
    const d = buildDuration(idx, widget.metric, ctx);
    return { ...d, rows: d.data, columns: [{ key: 'x', label: 'Measure' }, { key: 'in_person', label: 'Minutes' }] };
  }
  if (widget.type === 'satisfaction') {
    const forms = surveyForms(idx, widget.metric);
    const form = forms.includes(extra?.form) ? extra.form : forms[0];
    const s = form ? buildSatisfaction(idx, widget.metric, form, ctx) : { hasData: false, data: [] };
    return {
      ...s, forms, form,
      rows: s.data,
      columns: [{ key: 'x', label: 'Period' }, { key: 'responded', label: 'Responded %' }, { key: 'not_responded', label: 'Not Responded %' }],
    };
  }
  const { data, hasData } = buildSeriesData(idx, widget, ctx);
  const columns = [
    { key: 'x', label: widget.type === 'hbar' ? (widget.yLabel || 'Category') : (widget.xLabel || 'Category') },
    ...widget.series.map(s => ({ key: s.key, label: s.label })),
    ...(widget.line ? [{ key: widget.line.key, label: widget.line.label }] : []),
  ];
  return { data, hasData, rows: data, columns };
}

// ── Widget bodies ────────────────────────────────────────────────────────

function StatCards({ stats, compact }) {
  return (
    <div className={compact ? styles.statStack : styles.statGrid}>
      {stats.map(s => (
        <div key={s.window} className={styles.statCard}>
          <span className={styles.statLabel}>{s.label}</span>
          <span className={styles.statValue}>
            <strong>{s.hasData ? `${s.pct}%` : '–'}</strong>
            {s.hasData && <span className={styles.statSub}> • {s.count.toLocaleString()} / {s.total.toLocaleString()}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function WidgetChart({ widget, model, hidden, onToggle, height }) {
  if (widget.type === 'stats') return <StatCards stats={model.stats} />;

  if (widget.type === 'duration') {
    return <div className={styles.chartFill}><HBars data={model.data} seriesKey="in_person" seriesLabel={widget.series[0].label} xLabel={widget.xLabel} format="minutes" height={height} /></div>;
  }

  if (widget.type === 'donut') {
    return <div className={styles.chartFill}><Donut data={model.data} seriesKey={widget.series[0].key} height={height} /></div>;
  }

  if (widget.type === 'hbar') {
    return (
      <div className={styles.chartFill}>
      <HBars
        data={model.data}
        seriesKey={widget.series[0].key}
        seriesLabel={widget.series[0].label}
        yLabel={widget.yLabel}
        xLabel={widget.xLabel}
        height={height}
      />
      </div>
    );
  }

  const legend = <ChartLegend series={widget.series} hidden={hidden} onToggle={onToggle} line={widget.line} />;
  const chart = widget.type === 'line'
    ? <Lines data={model.data} series={widget.series} hidden={hidden} yLabel={widget.yLabel} xLabel={widget.xLabel} format={widget.format} height={height} />
    : (
      <StackedBars
        data={model.data}
        series={widget.series}
        line={widget.line}
        hidden={hidden}
        yLabel={widget.yLabel}
        xLabel={widget.xLabel}
        format={widget.format}
        height={height}
        denseX={widget.x === 'hour'}
      />
    );

  if (widget.stats) {
    // Engaged for Care: the not-engaged windows sit beside the chart.
    return (
      <div className={styles.withStats}>
        <StatCards stats={model.sideStats || []} compact />
        <div className={styles.withStatsChart}>{legend}<div className={styles.chartFill}>{chart}</div></div>
      </div>
    );
  }
  return <>{legend}<div className={styles.chartFill}>{chart}</div></>;
}

function SatisfactionBody({ widget, model, onForm, hidden, onToggle, height }) {
  return (
    <div className={styles.satisfaction}>
      <div className={styles.satisfactionSide}>
        <Select
          portal
          options={model.forms.map(f => ({ value: f, label: f }))}
          value={model.form}
          onChange={onForm}
        />
        <div className={styles.satBox}>
          <span className={styles.statLabel}>Average Score</span>
          <span className={styles.statValue}>
            <strong>{model.averageScore ?? '–'}</strong>
            <span className={styles.statSub}> from {model.responded.toLocaleString()} responses</span>
          </span>
        </div>
        <div className={styles.satBox}>
          <span className={styles.statLabel}>Total form sent</span>
          <strong className={styles.satNumber}>{model.sent.toLocaleString()}</strong>
          <div className={styles.satSplit}>
            <span>
              <span className={styles.statLabel}>Responded</span>
              <strong className={styles.satNumber}>{model.responded.toLocaleString()}</strong>
            </span>
            <span>
              <span className={styles.statLabel}>Not Responded</span>
              <strong className={styles.satNumber}>{model.notResponded.toLocaleString()}</strong>
            </span>
          </div>
        </div>
      </div>
      <div className={styles.satisfactionChart}>
        <ChartLegend
          series={[{ key: 'responded', label: 'Responded' }, { key: 'not_responded', label: 'Not Responded' }]}
          hidden={hidden}
          onToggle={onToggle}
        />
        <div className={styles.chartFill}>
          <StackedBars
            data={model.data}
            series={[{ key: 'responded', label: 'Responded' }, { key: 'not_responded', label: 'Not Responded' }]}
            hidden={hidden}
            yLabel={widget.yLabel}
            xLabel={widget.xLabel}
            format="percent"
            height={height}
          />
        </div>
      </div>
    </div>
  );
}

function SavingsCard({ card, loading, rangeText, onDownload, style }) {
  const negative = card.savings < 0;
  return (
    <ChartContainer title={card.title} info={card.info} empty={!loading && !card.hasData} onDownload={onDownload} style={style}>
      {loading ? <KpiSkeleton count={3} /> : (
      <div className={styles.savingsRow} aria-label={rangeText}>
        <span className={styles.savingsCol}>
          <span className={styles.savingsLabel}>Traditional Cost</span>
          <span className={styles.savingsValue}>{formatValue(card.traditional, 'currency')}</span>
        </span>
        <span className={styles.savingsCol}>
          <span className={styles.savingsLabel}>Our Cost</span>
          <span className={styles.savingsValue}>{formatValue(card.ours, 'currency')}</span>
        </span>
        <span className={[styles.savingsCol, styles.savingsEnd].join(' ')}>
          <span className={styles.savingsLabel}>Savings Amt.</span>
          {/* Colour and sign both carry the direction, so a cost overrun reads
              as one without relying on red alone. */}
          <span className={[styles.savingsAmount, negative ? styles.savingsLoss : styles.savingsGain].join(' ')}>
            {negative ? '−' : ''}{formatValue(Math.abs(card.savings), 'currency')}
          </span>
        </span>
      </div>
      )}
    </ChartContainer>
  );
}

// ── View ─────────────────────────────────────────────────────────────────

/**
 * Employer Impact Report: Analytics → Overview. Figma 5618:10554.
 *
 * Every chart is computed from `employer_impact_metrics` through the
 * `employer_impact_rollup` SQL function, so the filters (employer,
 * location, time frame, date range) really change what each chart shows.
 */
export function EmployerImpactView() {
  const filterOptions = useAppStore(s => s.employerImpactFilters);
  const filtersLoaded = useAppStore(s => s.employerImpactFiltersLoaded);
  const fetchFilters = useAppStore(s => s.fetchEmployerImpactFilters);
  const fetchRollup = useAppStore(s => s.fetchEmployerImpact);

  const [scope, setScope] = useState('patient');
  // `undefined` = not chosen yet, so the first (topmost) employer is used;
  // `null` = cleared to All Employers.
  const [pickedEmployer, setEmployerName] = useState(undefined);
  const [location, setLocation] = useState(null);
  const [timeFrame, setTimeFrame] = useState('Month');
  const [range, setRange] = useState(null); // { from, to } as 'YYYY-MM'
  const [rows, setRows] = useState(null);
  // One saved layout per location view; `dashboard` is the one on screen.
  const [layouts, setLayouts] = useState(readLayouts);
  const dashboard = layouts[scope];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const hiddenWidgets = useMemo(() => new Set(dashboard.hidden), [dashboard.hidden]);
  // A section whose widgets are all switched off drops out, Quick Jump included.
  const sectionsInOrder = useMemo(() => dashboard.sections
    .map(id => SECTIONS.find(s => s.id === id))
    .filter(s => s && dashboard.widgets[s.id].some(k => !hiddenWidgets.has(k))), [dashboard.sections, dashboard.widgets, hiddenWidgets]);
  const [hiddenSeries, setHiddenSeries] = useState({});
  const [forms, setForms] = useState({});
  const [dialog, setDialog] = useState(null); // { key, mode: 'expand' | 'table' }
  const [widgetMenuRect, setWidgetMenuRect] = useState(null);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const widgetBtnRef = useRef(null);
  const sectionRefs = useRef({});

  useEffect(() => { fetchFilters(); }, [fetchFilters]);

  // Default range: the last seven months that have data.
  const lastMonth = filterOptions?.lastMonth || toMonthKey(new Date());
  const firstMonth = filterOptions?.firstMonth || addMonths(lastMonth, -11);
  const effectiveRange = range || {
    from: [addMonths(lastMonth, -(DEFAULT_SPAN_MONTHS - 1)), firstMonth].sort().pop(),
    to: lastMonth,
  };

  const employers = filterOptions?.employers || [];
  const employerName = pickedEmployer === undefined ? (employers[0]?.name ?? null) : pickedEmployer;
  const employerId = employers.find(e => e.name === employerName)?.id || null;
  const locations = (scope === 'visit' ? filterOptions?.visitLocations : filterOptions?.patientLocations) || [];

  // Refetch whenever a filter that the SQL narrows by changes. Time frame
  // only regroups months, so it doesn't need the network.
  // Rows are tagged with the request they answer, so a filter change reads
  // as loading until its own response lands.
  const requestKey = [effectiveRange.from, effectiveRange.to, employerId, scope, location].join('|');
  useEffect(() => {
    if (!filtersLoaded) return undefined;
    let cancelled = false;
    fetchRollup({ from: effectiveRange.from, to: effectiveRange.to, employer: employerId, scope, location })
      .then(r => { if (!cancelled) setRows({ key: requestKey, rows: r || [] }); });
    return () => { cancelled = true; };
  }, [filtersLoaded, fetchRollup, requestKey, effectiveRange.from, effectiveRange.to, employerId, scope, location]);

  const loading = rows?.key !== requestKey;
  const idx = useMemo(() => indexRows(loading ? [] : rows.rows), [rows, loading]);
  const months = useMemo(() => monthsBetween(effectiveRange.from, effectiveRange.to), [effectiveRange.from, effectiveRange.to]);
  const ctx = useMemo(() => ({ months, timeFrame }), [months, timeFrame]);
  const rangeText = rangeLabel(effectiveRange.from, effectiveRange.to);

  const models = useMemo(() => {
    const out = {};
    for (const w of WIDGETS) {
      const m = widgetModel(w, idx, ctx, { form: forms[w.key] });
      if (w.stats && w.type !== 'stats') m.sideStats = buildStats(idx, w.stats, ctx);
      out[w.key] = m;
    }
    return out;
  }, [idx, ctx, forms]);
  const savings = useMemo(() => buildSavings(idx, SAVINGS_CATEGORIES, SAVINGS_METRIC, ctx), [idx, ctx]);

  // Quick Jump follows whichever section heading is nearest the top.
  useEffect(() => {
    const els = sectionsInOrder.map(sec => sectionRefs.current[sec.id]).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.dataset.section);
    }, { rootMargin: '0px 0px -70% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [loading, sectionsInOrder]);

  const jumpTo = (id) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const saveLayouts = (next) => { setLayouts(next); writeLayouts(next); };
  const saveDashboard = (next) => saveLayouts({ ...layouts, [scope]: next });
  const setHidden = (next) => saveDashboard({ ...dashboard, hidden: [...next] });
  const hideWidget = (key) => setHidden(new Set([...hiddenWidgets, key]));
  const toggleSeries = (widgetKey) => (seriesKey) => setHiddenSeries((prev) => {
    const cur = new Set(prev[widgetKey] || []);
    if (cur.has(seriesKey)) cur.delete(seriesKey); else cur.add(seriesKey);
    return { ...prev, [widgetKey]: cur };
  });
  const csvName = (title) => `${slug(title)}-${effectiveRange.from}-to-${effectiveRange.to}.csv`;

  // The picker lists only the widgets this location view has.
  const titleOf = {
    ...Object.fromEntries(WIDGETS.map(w => [w.key, w.title])),
    ...Object.fromEntries(SAVINGS_CATEGORIES.map(c => [savingsKey(c.key), c.title])),
  };
  const widgetTitles = dashboard.sections.flatMap(id => dashboard.widgets[id]).map(key => ({ key, title: titleOf[key] }));

  const renderWidget = (w, style) => {
    const model = models[w.key];
    const hidden = hiddenSeries[w.key] || new Set();
    const body = w.type === 'satisfaction'
      ? <SatisfactionBody widget={w} model={model} hidden={hidden} onToggle={toggleSeries(w.key)} onForm={(f) => setForms(p => ({ ...p, [w.key]: f }))} />
      : <WidgetChart widget={w} model={model} hidden={hidden} onToggle={toggleSeries(w.key)} />;
    return (
      <ChartContainer
        key={w.key}
        title={w.title}
        info={w.info}
        // Until the filters land the range is only a guess from today's date.
        subtitle={filtersLoaded ? rangeText : undefined}
        empty={!loading && !model.hasData}
        height={CHART_CARD_HEIGHT}
        style={style}
        onExpand={w.type === 'stats' ? undefined : () => setDialog({ key: w.key, mode: 'expand' })}
        onDownload={() => downloadCsv(csvName(w.title), toCsv(model.rows, model.columns))}
        menuItems={model.hasData ? WIDGET_MENU : WIDGET_MENU.filter(i => i.key !== 'table')}
        onMenuSelect={(key) => (key === 'table' ? setDialog({ key: w.key, mode: 'table' }) : hideWidget(w.key))}
      >
        {loading ? (w.type === 'stats' ? <KpiSkeleton count={w.stats.windows.length} /> : <ChartSkeleton />) : body}
      </ChartContainer>
    );
  };

  /**
   * A section's visible cards in saved order, each with its grid span.
   * Spans are packed so reordering never leaves a gap at a row's end: on
   * the desktop 6-column grid, and again on tablet where every card but a
   * full-width one takes half.
   */
  const gridCells = (sectionId) => {
    const cells = dashboard.widgets[sectionId]
      .filter(key => !hiddenWidgets.has(key))
      .map((key) => {
        if (sectionId === 'costSavings') {
          const card = savings.find(c => savingsKey(c.key) === key);
          return card && { key, card, span: SPAN_COLUMNS.third };
        }
        const widget = WIDGETS.find(w => w.key === key);
        return widget && { key, widget, span: SPAN_COLUMNS[widget.span] };
      })
      .filter(Boolean);
    const desktop = packSpans(cells.map(c => c.span));
    const tablet = packSpans(cells.map(c => (c.span === SPAN_COLUMNS.full ? SPAN_COLUMNS.full : SPAN_COLUMNS.half)));
    return cells.map((c, i) => ({ ...c, style: { '--span': desktop[i], '--span-md': tablet[i] } }));
  };

  const dialogWidget = dialog && WIDGETS.find(w => w.key === dialog.key);
  const dialogModel = dialogWidget && models[dialogWidget.key];

  return (
    <div className={styles.page}>
      {/* Header, filter and quick-jump rows: full-bleed 48px rows split by
          hairlines, per Figma 5625:15129. */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={layout.viewTitle}>{VIEW_TITLES.employer.title}</div>
          <Toggle
            items={SCOPE_OPTIONS}
            active={scope}
            onChange={(k) => { setScope(k); setLocation(null); }}
          />
        </div>
        {/* Figma 1530:41988: Widget, then Print and Settings, split by hairlines. */}
        <div className={styles.headerActions}>
          <span ref={widgetBtnRef}>
            <Button
              variant="tertiary"
              size="L"
              leadingIcon="solar:widget-add-linear"
              onClick={() => setWidgetMenuRect(widgetBtnRef.current?.getBoundingClientRect() || null)}
            >
              Widget
            </Button>
          </span>
          <span className={styles.actionDivider} aria-hidden="true" />
          <ActionButton icon="solar:printer-minimalistic-linear" tooltip="Print" aria-label="Print report" onClick={() => setPrintOpen(true)} />
          <span className={styles.actionDivider} aria-hidden="true" />
          <ActionButton
            icon="solar:settings-minimalistic-linear"
            tooltip="Update dashboard"
            aria-label="Update dashboard"
            onClick={() => setSettingsOpen(true)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <FilterChip
          label="Employer"
          options={employers.map(e => e.name)}
          selected={employerName ? [employerName] : []}
          onChange={(next) => setEmployerName(next[0] || null)}
          singleSelect
          searchable={employers.length > 6}
        />
        {/* Always shows the range the charts use: the default span reads as a
            fixed value (no ✕); a picked range can be cleared back to it.
            The report counts whole months, so a picked range widens to the
            months it touches. */}
        <FilterChip
          label="Date Range"
          active={filtersLoaded}
          activeSummary={rangeText}
          noClear={!range}
          onClear={() => setRange(null)}
          renderPopover={({ anchorRect, onClose }) => (
            <DateRangePopover
              anchorRect={anchorRect}
              label="Date Range"
              selected={[`${effectiveRange.from}-01`, lastDayOf(effectiveRange.to)]}
              onChange={(vals) => {
                if (vals.length !== 2) { setRange(null); return; }
                const clamp = (m) => [firstMonth, [m, lastMonth].sort()[0]].sort()[1];
                const [a, b] = [toMonthKey(vals[0]), toMonthKey(vals[1])].sort();
                setRange({ from: clamp(a), to: clamp(b) });
              }}
              onClose={onClose}
            />
          )}
        />
        <FilterChip
          key={scope}
          label={scope === 'visit' ? 'Visit Location' : 'Patient Location'}
          options={locations}
          selected={location ? [location] : []}
          onChange={(next) => setLocation(next[0] || null)}
          singleSelect
        />
        {/* Month is the default grouping, so the chip reads idle until another is picked. */}
        <FilterChip
          label="Time Frame"
          options={TIME_FRAMES}
          selected={timeFrame === 'Month' ? [] : [timeFrame]}
          onChange={(next) => setTimeFrame(next[0] || 'Month')}
          singleSelect
        />
      </div>

      {/* Section tabs jump to a section and follow the scroll. By Location
          has a single section, so it has none. */}
      {scope !== 'visit' && (
        <nav className={styles.quickJump} aria-label="Report sections">
          <SubTabs
            tabs={sectionsInOrder.map(sec => ({ key: sec.id, label: sec.title }))}
            activeKey={activeSection}
            onChange={jumpTo}
          />
        </nav>
      )}

      {/* Sections */}
      <div className={styles.sections}>
        {sectionsInOrder.map(section => (
          <section
            key={section.id}
            className={styles.section}
            data-section={section.id}
            ref={(el) => { sectionRefs.current[section.id] = el; }}
            aria-labelledby={`eir-${section.id}`}
          >
            <h2 className={styles.sectionTitle} id={`eir-${section.id}`}>{section.heading || section.title}</h2>
            <div className={styles.grid}>
              {gridCells(section.id).map(({ key, widget, card, style }) => (widget
                ? renderWidget(widget, style)
                : (
                  <SavingsCard
                    key={key}
                    style={style}
                    card={card}
                    loading={loading}
                    rangeText={rangeText}
                    onDownload={() => downloadCsv(csvName(card.title), toCsv(
                      [{ x: card.title, traditional: card.traditional, ours: card.ours, savings: card.savings }],
                      [{ key: 'x', label: 'Category' }, { key: 'traditional', label: 'Traditional Cost' }, { key: 'ours', label: 'Our Cost' }, { key: 'savings', label: 'Savings' }],
                    ))}
                  />
                )))}
            </div>
          </section>
        ))}
      </div>

      {printOpen && (
        <PrintReportDrawer
          range={rangeText}
          employerName={employerName}
          meta={[
            rangeText,
            employerName || 'All Employers',
            SCOPE_OPTIONS.find(o => o.key === scope)?.label,
            location,
            `By ${timeFrame}`,
          ].filter(Boolean).join('  ·  ')}
          filename={`employer-impact-report-${effectiveRange.from}-to-${effectiveRange.to}`}
          sections={sectionsInOrder.map(section => ({
            id: section.id,
            title: section.heading || section.title,
            items: gridCells(section.id).map(cell => (cell.widget
              ? { key: cell.key, title: cell.widget.title, kind: 'widget', widget: cell.widget, model: models[cell.key], subtitle: rangeText, full: cell.widget.span === 'full' }
              : { key: cell.key, title: cell.card.title, kind: 'savings', card: cell.card })),
          }))}
          onClose={() => setPrintOpen(false)}
        />
      )}

      {settingsOpen && (
        <UpdateDashboardDrawer
          layouts={layouts}
          scope={scope}
          onClose={() => setSettingsOpen(false)}
          onSubmit={(next, nextScope) => {
            saveLayouts(next);
            if (nextScope !== scope) { setScope(nextScope); setLocation(null); }
            setSettingsOpen(false);
          }}
        />
      )}

      {/* Widget picker */}
      {widgetMenuRect && (
        <CheckboxListPopover
          anchorRect={widgetMenuRect}
          label="Widgets"
          options={widgetTitles.map(w => w.title)}
          selected={widgetTitles.filter(w => !hiddenWidgets.has(w.key)).map(w => w.title)}
          onChange={(shownTitles) => {
            const shown = new Set(shownTitles);
            setHidden(new Set(widgetTitles.filter(w => !shown.has(w.title)).map(w => w.key)));
          }}
          onClose={() => setWidgetMenuRect(null)}
          width={300}
          searchable
          showClear={false}
        />
      )}

      {/* Expand / table */}
      <Dialog open={!!dialogWidget} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        {dialogWidget && (
          <DialogContent className={styles.dialog}>
            <DialogHeader>
              <DialogTitle>{dialogWidget.title}</DialogTitle>
              <span className={styles.cardSub}>{rangeText}</span>
            </DialogHeader>
            {dialog.mode === 'table' ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>{dialogModel.columns.map(c => <th key={c.key} scope="col">{c.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {dialogModel.rows.map(r => (
                      <tr key={r.x}>
                        {dialogModel.columns.map((c, ci) => (
                          ci === 0
                            ? <th key={c.key} scope="row">{r[c.key]}</th>
                            : <td key={c.key}>{typeof r[c.key] === 'number' ? formatValue(r[c.key], dialogWidget.format) : r[c.key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.expandBody}>
                {dialogWidget.type === 'satisfaction'
                  ? <SatisfactionBody widget={dialogWidget} model={dialogModel} hidden={hiddenSeries[dialogWidget.key] || new Set()} onToggle={toggleSeries(dialogWidget.key)} onForm={(f) => setForms(p => ({ ...p, [dialogWidget.key]: f }))} height={420} />
                  : <WidgetChart widget={dialogWidget} model={dialogModel} hidden={hiddenSeries[dialogWidget.key] || new Set()} onToggle={toggleSeries(dialogWidget.key)} height={420} />}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
