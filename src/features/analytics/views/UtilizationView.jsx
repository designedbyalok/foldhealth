import { useState, useEffect } from 'react';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { KpiCard, InsightBanner, Card, ProgressBar, EmptyState, KpiSkeleton, TableSkeleton } from './shared';
import { safeBarItems, safeTableRows } from './shared.utils';
import { ReadmitTrendLineChart } from './charts';
import { EditableGrid } from './EditableGrid';
import s from '../AnalyticsLayout.module.css';

const STORAGE_KEY = 'analytics-utilization-layout-v2';

const DEFAULT_LAYOUT = [
  { i: 'adtAlert',   x: 0, y: 0,  w: 12, h: 3, minW: 6, minH: 2, maxW: 12, maxH: 5  },
  { i: 'insight',    x: 0, y: 3,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5  },
  { i: 'kpis',       x: 0, y: 6,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 5  },
  { i: 'readmit',    x: 0, y: 9,  w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 16 },
  { i: 'tcm',        x: 6, y: 9,  w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 16 },
  { i: 'drg',        x: 0, y: 17, w: 12, h: 8, minW: 6, minH: 5, maxW: 12, maxH: 20 },
  { i: 'deepDive',   x: 0, y: 25, w: 12, h: 8, minW: 6, minH: 5, maxW: 12, maxH: 16 },
];

const TCM_FALLBACK_BARS = [
  { label: 'Readmit w/ TCM Follow-Up', value: '11%', pct: 22, color: 'green', sub: '62% below threshold ✓' },
  { label: 'Readmit w/o TCM Follow-Up', value: '31%', pct: 74, color: 'red', sub: '2.8x higher, urgent gap' },
  { label: 'TCM Completion Rate', value: '72%', pct: 72, color: 'teal', sub: 'Target 80%: 8pp gap' },
  { label: 'TCM Within 7 Days', value: '58%', pct: 58, color: 'amber', sub: 'Target 70%' },
];

const READMIT_TREND = [14.2, 14.8, 15.1, 15.8, 14.9, 15.3, 15.8, 16.2, 16.8, 17.1, 17.8, 18.4];

function renderUtilizationDeepDive() {
  return (
    <Card title="Manager Deep Dive &mdash; Readmission Drivers">
      <div className={s.g2}>
        <div>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--neutral-200)', marginBottom: '0.5rem' }}>By DRG</div>
          <ProgressBar label="DRG 291: Heart Failure" value="8 readmits" pct={80} color="red" sub="18.7% readmit rate" />
          <ProgressBar label="DRG 193: COPD" value="5 readmits" pct={50} color="amber" sub="17.9%" />
          <ProgressBar label="DRG 690: UTI w/ MCC" value="4 readmits" pct={40} color="amber" sub="16.7%" />
        </div>
        <div>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--neutral-200)', marginBottom: '0.5rem' }}>By Avg LOS Before Readmit</div>
          <ProgressBar label="0–7 days post-discharge" value="42%" pct={84} color="red" sub="Very early: TCM critical" />
          <ProgressBar label="8–14 days" value="31%" pct={62} color="amber" sub="TCM + SNF coordination" />
          <ProgressBar label="15–30 days" value="27%" pct={54} color="green" sub="Late readmit: SNF quality" />
        </div>
      </div>
    </Card>
  );
}

export function UtilizationView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const fetchProgressBars = useAppStore(st => st.fetchProgressBars);
  const period = useAppStore(st => st.analyticsPeriod);

  const [kpiData, setKpiData] = useState(null);
  const [readmissionByDrg, setReadmissionByDrg] = useState(null);
  const [tcmImpact, setTcmImpact] = useState(null);

  useEffect(() => {
    fetchViewKpis('utilization').then(d => setKpiData(d || { kpis: [], insight: null }));
    fetchViewTable('utilization', 'readmission_by_drg').then(d => setReadmissionByDrg(d || { columns: [], rows: [] }));
    fetchProgressBars('utilization', 'tcm_impact').then(d => setTcmImpact(d || []));
  }, [period]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const drgRows = safeTableRows(readmissionByDrg);
  const tcmItems = safeBarItems(tcmImpact);

  const tcmFallback = tcmItems.length > 0 ? tcmItems : TCM_FALLBACK_BARS;

  const readmitTrend = READMIT_TREND;
  const periodLabel = period === 'ytd' ? 'YTD' : 'Rolling 12M';

  const renderAdtAlert = () => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--status-error-light)', border: '0.5px solid var(--status-error)', borderRadius: 8,
      padding: '12px 16px'
    }}>
      <div style={{ fontSize: 'var(--font-xl)' }}>&#x1F6A8;</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 'var(--font-base)', color: 'var(--status-error)' }}>Live ADT Alert &mdash; Manager View</div>
        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--status-error)', marginTop: 2 }}>James M. (Tier 5) discharged to Valley SNF. 34% readmit risk. TCM: Maria Chen, RN.</div>
      </div>
      <Button size="sm" style={{ fontSize: 'var(--font-sm)' }} onClick={() => showToast?.('Opening ADT detail for James M.')}>View &rarr;</Button>
    </div>
  );

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

  const renderKpis = () => {
    if (kpiData === null) return <KpiSkeleton count={4} />;
    return (
      <div className={s.kpiGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {kpis.map(k => (
          <KpiCard key={k.key} value={k.value} label={k.label} delta={k.delta} deltaType={k.deltaType} sub={k.sub} accentColor={k.accentColor} />
        ))}
      </div>
    );
  };

  const renderReadmit = () => (
    <Card title="Readmission Rate Trend" sub={periodLabel}>
      <ReadmitTrendLineChart data={readmitTrend} threshold={15.0} />
      <div style={{ display: 'flex', gap: 12, fontSize: 'var(--font-sm)', color: 'var(--neutral-200)', marginTop: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: 'var(--status-error)', display: 'inline-block', borderRadius: 2 }} />Readmit Rate</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--neutral-150)', display: 'inline-block' }} />Threshold 15%</span>
      </div>
    </Card>
  );

  const renderTcm = () => (
    <Card title="TCM Impact">
      {tcmFallback.map(b => (
        <ProgressBar key={b.label} label={b.label} value={b.value} pct={b.pct} color={b.color} sub={b.sub} />
      ))}
      <Button size="sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={() => showToast?.('Creating post-discharge TCM cohort for 48 members')}>
        Create Post-Discharge TCM Cohort (48)
      </Button>
    </Card>
  );

  const renderDrg = () => (
    <Card title="Readmission Rate by DRG" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>DRG Category</th><th className={s.r}>Admits</th><th className={s.r}>Readmits</th><th className={s.r}>Rate</th><th className={s.r}>Benchmark</th><th>Status</th></tr>
          </thead>
          <tbody>
            {readmissionByDrg === null && (
              <tr><td colSpan={6} style={{ padding: 0 }}><TableSkeleton rows={5} cols={6} /></td></tr>
            )}
            {readmissionByDrg !== null && drgRows.length === 0 && (
              <EmptyState colSpan={6} message="No readmission-by-DRG data for this period." icon="solar:document-text-linear" />
            )}
            {drgRows.map((row, i) => {
              const st = row.status;
              return (
                <tr key={i}>
                  <td className={s.fw600}>{row.drg}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.admits}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.readmits}</td>
                  <td className={`${s.r} ${st === 'red' ? s.valR : st === 'amber' ? s.valA : s.valG}`}>{row.rate}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.benchmark}</td>
                  <td>
                    <span className={`${s.stPill} ${st === 'green' ? s.stGreen : st === 'red' ? s.stRed : s.stAmber}`}>
                      {st === 'green' ? 'Below' : st === 'red' ? 'Above' : 'Watch'}
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

  const renderDeepDive = renderUtilizationDeepDive;

  const RENDERERS = {
    adtAlert: renderAdtAlert,
    insight: renderInsight,
    kpis: renderKpis,
    readmit: renderReadmit,
    tcm: renderTcm,
    drg: renderDrg,
    deepDive: renderDeepDive,
  };

  return (
    <EditableGrid
      storageKey={STORAGE_KEY}
      defaultLayout={DEFAULT_LAYOUT}
      renderers={RENDERERS}
      editing={editing}
      resetTick={resetTick}
    />
  );
}
