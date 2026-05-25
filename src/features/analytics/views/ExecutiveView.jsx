import { useState, useEffect, useRef, useCallback } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { Toggle } from '../../../components/Toggle/Toggle';
import { KpiCard, InsightBanner, Card, ProgressBar, GhostBtn, safeTableRows, safeBarItems, safeConfigData, EmptyState } from './shared';
import { TcocLineChart, SavingsAreaChart } from './charts';
import s from '../AnalyticsLayout.module.css';

// ── Editable dashboard config ────────────────────────────────────────────
// Mirrors the pattern in src/features/home/HomeView.jsx so the Executive
// dashboard supports drag-and-drop reordering and resize via react-grid-
// layout. Layout is persisted per-view to localStorage so each analytics
// view can have its own customization.
const STORAGE_KEY = 'analytics-executive-layout-v1';
const COLS = 12;
const ROW_HEIGHT = 40;

// Heights tuned aggressively so each grid cell hugs the card's natural
// content height. Combined with `height: 100%` on the inner card (in
// AnalyticsLayout.module.css), this gives a dashed editing border that
// snaps to the grid cell with no visible gap above or below content.
// Users can resize up via the bottom-right handle if they want more
// breathing room.
const DEFAULT_LAYOUT = [
  { i: 'insight',   x: 0, y: 0,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5  },
  { i: 'kpi1',      x: 0, y: 3,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 5  },
  { i: 'kpi2',      x: 0, y: 6,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 5  },
  { i: 'drivers',   x: 0, y: 9,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5  },
  { i: 'tcoc',      x: 0, y: 12, w: 12, h: 7, minW: 6, minH: 5, maxW: 12, maxH: 20 },
  { i: 'quality',   x: 0, y: 19, w: 6,  h: 7, minW: 3, minH: 5, maxW: 12, maxH: 16 },
  { i: 'care',      x: 6, y: 19, w: 6,  h: 7, minW: 3, minH: 5, maxW: 12, maxH: 16 },
  { i: 'savings',   x: 0, y: 26, w: 12, h: 7, minW: 6, minH: 5, maxW: 12, maxH: 16 },
  { i: 'costTable', x: 0, y: 33, w: 12, h: 5, minW: 6, minH: 4, maxW: 12, maxH: 14 },
];

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT;
    return parsed;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(layout) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* noop */ }
}

export function ExecutiveView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchTimeSeries = useAppStore(st => st.fetchTimeSeries);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const fetchProgressBars = useAppStore(st => st.fetchProgressBars);
  const fetchConfig = useAppStore(st => st.fetchConfig);
  const period = useAppStore(st => st.analyticsPeriod);
  const periodMode = useAppStore(st => st.analyticsPeriodMode);

  const [kpiData, setKpiData] = useState({ kpis: [], insight: null });
  const [tcocData, setTcocData] = useState({});
  const [costData, setCostData] = useState({ columns: [], rows: [] });
  const [qualitySummary, setQualitySummary] = useState([]);
  const [tcocTab, setTcocTab] = useState('all');
  const [tcocMode, setTcocMode] = useState('pmpm');
  const [costInlineData, setCostInlineData] = useState({});
  const [savingsData, setSavingsData] = useState({});
  const [careProgramData, setCareProgramData] = useState({});

  // ── Editable layout state ───────────────────────────────────────────
  // `editing` is controlled by AnalyticsLayout (which renders the
  // Customize toggle in the view header). `resetTick` is an incrementing
  // counter — when it changes, the layout is restored to DEFAULT_LAYOUT.
  const [layout, setLayout] = useState(loadLayout);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleLayoutChange = useCallback((next) => {
    setLayout(next);
    saveLayout(next);
  }, []);

  // React to reset signal from parent (AnalyticsLayout's Reset button).
  // Skipping resetTick=0 (initial value) so first mount doesn't clobber a
  // persisted custom layout.
  useEffect(() => {
    if (resetTick === 0) return;
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }, [resetTick]);

  useEffect(() => {
    fetchViewKpis('executive').then(d => d && setKpiData(d));
    fetchTimeSeries(['tcoc_all','tcoc_ip','tcoc_op','tcoc_ed','tcoc_rx','tcoc_pac']).then(d => d && setTcocData(d));
    fetchViewTable('executive', 'cost_by_setting_benchmark').then(d => d && setCostData(d));
    fetchProgressBars('executive', 'executive_quality_summary').then(d => d && setQualitySummary(d));
    fetchConfig('exec_cost_by_setting_inline').then(d => d && setCostInlineData(d));
    fetchConfig('exec_savings_trajectory').then(d => d && setSavingsData(d));
    fetchConfig('exec_care_programs').then(d => d && setCareProgramData(d));
  }, [period, periodMode]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const costRows = safeTableRows(costData);
  const qualityItems = safeBarItems(qualitySummary);

  const qualFallback = qualityItems.length > 0 ? qualityItems : [
    { label: 'AWV Completion', value: '61%', pct: 61, color: 'amber', sub: 'Target 80% · 847 unscheduled' },
    { label: 'Diabetes HbA1c Control', value: '72%', pct: 72, color: 'teal', sub: 'Target 70% ✓' },
    { label: 'BP Control (<140/90)', value: '64%', pct: 64, color: 'purple', sub: 'Target 70%' },
    { label: 'Colorectal Screening', value: '58%', pct: 58, color: 'red', sub: 'Target 65%' },
    { label: 'Depression Screening', value: '83%', pct: 83, color: 'green', sub: 'Target 80% ✓' },
  ];

  // fetchConfig returns rows shaped { configData: {...} }. Unwrap via
  // safeConfigData so reads work whether the source is the DB row or
  // a future raw-shape fallback. Bug history: prior to this, the view
  // read top-level keys (savingsData.data_points), which works for the
  // deleted JS fallbacks but never matches DB-mapped rows.
  const costInline = safeConfigData(costInlineData);
  const savings = safeConfigData(savingsData);
  const carePrograms = safeConfigData(careProgramData)?.rows || [];

  const costBySettingInline = costInline?.items || [];

  const rawSavings = savings?.data_points || [];
  const savingsTrajectory = periodMode === 'r12'
    ? rawSavings.map(v => v != null ? +(v * 1.15).toFixed(2) : null)
    : rawSavings;

  const periodLabel = periodMode === 'ytd' ? 'YTD 2025' : 'Rolling 12M';

  // ── Per-key content renderers ───────────────────────────────────────
  const renderInsight = () => insight ? (
    <InsightBanner
      icon={insight.icon}
      title={insight.title}
      variant={insight.variant}
      text={insight.text}
      buttons={insight.buttons || []}
      showToast={showToast}
    />
  ) : null;

  const renderKpiRow = (start, end) => (
    <div className={s.kpiGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {kpis.slice(start, end).map(k => (
        <KpiCard key={k.key} value={k.value} label={k.label} delta={k.delta} deltaType={k.deltaType} sub={k.sub} accentColor={k.accentColor} />
      ))}
    </div>
  );

  const renderDrivers = () => (
    <InsightBanner
      icon="solar:chart-linear"
      title="Key Drivers — Where to Focus"
      text="Cost: <strong>Inpatient $23 over benchmark</strong> driven by readmission spike at 3 facilities. Quality: <strong>AWV 19pp below target</strong>. Risk: <strong>962 HCC suspects open</strong> = $2.1M revenue at risk. Engagement: <strong>SMS-first converting at 61%</strong> vs 29% phone."
      buttons={[
        { label: 'Financial', navTo: 'financial' },
        { label: 'Quality', navTo: 'quality' },
        { label: 'Risk', navTo: 'risk' },
      ]}
      showToast={showToast}
    />
  );

  const renderTcoc = () => (
    <Card
      title="TCOC Trend & Cost by Setting"
      sub={periodLabel}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Toggle
            items={[
              { key: 'pmpm', label: 'PMPM' },
              { key: 'total', label: 'Total Cost' },
            ]}
            active={tcocMode}
            onChange={setTcocMode}
            size="S"
          />
          <Toggle
            items={[
              { key: 'all', label: 'All' },
              { key: 'ip', label: 'Inpatient' },
              { key: 'op', label: 'Outpatient' },
              { key: 'ed', label: 'ED' },
              { key: 'rx', label: 'Pharmacy' },
              { key: 'pac', label: 'PAC' },
            ]}
            active={tcocTab}
            onChange={setTcocTab}
            size="S"
          />
        </div>
      }
    >
      <TcocLineChart tab={tcocTab} data={tcocData} mode={tcocMode} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--neutral-100)' }}>
        {costBySettingInline.map(c => (
          <div key={c.label} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--neutral-200)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: c.color, lineHeight: 1.2 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--neutral-300)', marginTop: 3 }}>{c.note}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderQuality = () => (
    <Card title="Quality Summary" actions={<Button variant="ghost" size="S" onClick={() => showToast?.('Opening Quality view')}>Full View &rarr;</Button>}>
      {qualFallback.map(q => (
        <ProgressBar key={q.label} label={q.label} value={q.value} pct={q.pct} color={q.color} sub={q.sub} />
      ))}
    </Card>
  );

  const renderCare = () => (
    <Card
      title="Care Program Command Center"
      sub={`8 programs · $7.3M saved · 3.7× blended ROI`}
      actions={<Button variant="ghost" size="S" onClick={() => showToast?.('Opening Care Management view')}>Full Program View &rarr;</Button>}
      flush
    >
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr>
              <th>Program</th>
              <th className={s.r}>Status</th>
              <th className={s.r}>Saved</th>
              <th className={s.r}>ROI</th>
              <th>Top Alert</th>
            </tr>
          </thead>
          <tbody>
            {carePrograms.length === 0 && (
              <EmptyState colSpan={5} message="No care programs configured for this period." icon="solar:heart-pulse-linear" />
            )}
            {carePrograms.map((p, i) => (
              <tr key={i} style={{ cursor: 'pointer' }} onClick={() => showToast?.(`Navigating to Care Management → Programs → ${p.abbr}`)}>
                <td className={s.fw600}>{p.abbr}<div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{p.members} mbrs</div></td>
                <td className={s.r}>
                  <span className={`${s.stPill} ${p.status === 'green' ? s.stGreen : p.status === 'amber' ? s.stAmber : s.stRed}`}>
                    {p.status === 'green' ? 'On Track' : p.status === 'amber' ? 'Review' : 'At Risk'}
                  </span>
                </td>
                <td className={`${s.r} ${s.mono} ${s.valG}`}>{p.saved}</td>
                <td className={`${s.r} ${s.mono}`} style={{ fontWeight: 500 }}>{p.roi}</td>
                <td style={{ fontSize: 12, color: p.status === 'red' ? 'var(--status-error)' : 'var(--status-warning)', maxWidth: 200 }}>{p.alert}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderSavings = () => (
    <Card
      title="Shared Savings Trajectory"
      sub={periodLabel}
      actions={<Button variant="ghost" size="S" onClick={() => showToast?.('Opening Shared Savings view')}>Full View &rarr;</Button>}
    >
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--status-success)' }}>{periodMode === 'r12' ? '$1.8M' : '$1.2M'}</div>
          <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--neutral-200)' }}>Savings {periodMode === 'r12' ? 'Rolling 12M' : 'YTD'}</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--neutral-100)', paddingLeft: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--status-warning)' }}>{periodMode === 'r12' ? '82%' : '78%'}</div>
          <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--neutral-200)' }}>Prob. of hitting MSR</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--neutral-100)', paddingLeft: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--neutral-500)' }}>4.1</div>
          <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--neutral-200)' }}>Quality Composite</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--neutral-100)', paddingLeft: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--neutral-500)' }}>{periodMode === 'r12' ? '$3.8M' : '$3.2M'}</div>
          <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--neutral-200)' }}>Full-year projection</div>
        </div>
      </div>
      {savingsTrajectory.length === 0 ? (
        <EmptyState message="No savings trajectory data for this period." icon="solar:chart-2-linear" />
      ) : (
        <SavingsAreaChart data={savingsTrajectory} targetLabel="MSR $2.8M" targetValue={2.8} />
      )}
      <div style={{ fontSize: 12, color: 'var(--neutral-200)', padding: '8px 14px 4px', borderTop: '1px solid var(--neutral-100)', marginTop: 8 }}>
        MSSP Track 1B &middot; Performance Year 2025 &middot; Quality composite secures maximum sharing rate
      </div>
    </Card>
  );

  const renderCostTable = () => (
    <Card title="Cost by Setting — Benchmark Comparison" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Setting</th><th className={s.r}>Actual PMPM</th><th className={s.r}>Benchmark</th><th className={s.r}>Variance</th><th>Status</th></tr>
          </thead>
          <tbody>
            {costRows.length === 0 && (
              <EmptyState colSpan={5} message="No cost-by-setting data for this period." icon="solar:wallet-money-linear" />
            )}
            {costRows.map((row, i) => {
              const setting = row.setting || row[0];
              const actual = row.actual || row[1];
              const bench = row.benchmark || row[2];
              const variance = row.variance || row[3];
              const st = row.status || row[4];
              return (
                <tr key={i}>
                  <td className={s.fw600}>{setting}</td>
                  <td className={`${s.r} ${s.mono}`}>{actual}</td>
                  <td className={`${s.r} ${s.mono}`}>{bench}</td>
                  <td className={`${s.r} ${st === 'green' ? s.valG : st === 'red' ? s.valR : st === 'amber' ? s.valA : ''}`}>{variance}</td>
                  <td>
                    <span className={`${s.stPill} ${st === 'green' ? s.stGreen : st === 'red' ? s.stRed : st === 'amber' ? s.stAmber : s.stNeutral}`}>
                      {st === 'green' ? 'Below' : st === 'red' ? 'Above' : st === 'amber' ? 'Watch' : 'At'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const RENDERERS = {
    insight: renderInsight,
    kpi1: () => renderKpiRow(0, 4),
    kpi2: () => renderKpiRow(4, 8),
    drivers: renderDrivers,
    tcoc: renderTcoc,
    quality: renderQuality,
    care: renderCare,
    savings: renderSavings,
    costTable: renderCostTable,
  };

  // Filter out the insight slot when there's no insight to show. The grid
  // re-flows other items to fill the gap thanks to react-grid-layout's
  // default vertical compaction.
  const renderedLayout = insight ? layout : layout.filter(l => l.i !== 'insight');

  return (
    <>
      <div
        ref={containerRef}
        className={[s.gridContainer, editing ? s.gridEditing : ''].filter(Boolean).join(' ')}
      >
        <GridLayout
          className="layout"
          layout={renderedLayout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={width}
          isDraggable={editing}
          isResizable={editing}
          onLayoutChange={handleLayoutChange}
          margin={[12, 12]}
          containerPadding={[0, 0]}
        >
          {renderedLayout.map(l => (
            <div key={l.i} className={s.gridItem}>
              {RENDERERS[l.i]?.()}
            </div>
          ))}
        </GridLayout>
      </div>
    </>
  );
}
