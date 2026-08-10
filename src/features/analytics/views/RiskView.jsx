import { useState, useEffect } from 'react';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { KpiCard, InsightBanner, Card, ProgressBar, safeBarItems, safeTableRows, EmptyState, KpiSkeleton, TableSkeleton, ProgressBarSkeleton } from './shared';
import { RafTrendLineChart } from './charts';
import { EditableGrid } from './EditableGrid';
import s from '../AnalyticsLayout.module.css';

const STORAGE_KEY = 'analytics-risk-layout-v2';

const DEFAULT_LAYOUT = [
  { i: 'insight',      x: 0, y: 0,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5  },
  { i: 'methodology',  x: 0, y: 3,  w: 12, h: 3, minW: 6, minH: 2, maxW: 12, maxH: 6  },
  { i: 'kpis',         x: 0, y: 6,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 5  },
  { i: 'rafTrend',     x: 0, y: 9,  w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 16 },
  { i: 'rafPractice',  x: 6, y: 9,  w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 20 },
  { i: 'hccPerf',      x: 0, y: 17, w: 12, h: 8, minW: 6, minH: 5, maxW: 12, maxH: 16 },
  { i: 'hccRecap',     x: 0, y: 25, w: 6,  h: 7, minW: 4, minH: 4, maxW: 12, maxH: 16 },
  { i: 'hccCat',       x: 6, y: 25, w: 6,  h: 7, minW: 4, minH: 4, maxW: 12, maxH: 16 },
  { i: 'hccSuspects',  x: 0, y: 32, w: 12, h: 8, minW: 6, minH: 5, maxW: 12, maxH: 20 },
];

const RAF_TREND = [1.010, 1.014, 1.018, 1.022, 1.025, 1.028, 1.031, 1.034, 1.037, 1.040, 1.041, 1.042];
const HCC_HIGH = [
  { code: 'HCC 19', label: 'Diabetes w/o complications', rate: '89%', pct: 89, color: 'var(--status-success)' },
  { code: 'HCC 108', label: 'Vascular Disease', rate: '84%', pct: 84, color: 'var(--status-success)' },
  { code: 'HCC 85', label: 'CHF', rate: '78%', pct: 78, color: 'var(--status-info)' },
  { code: 'HCC 22', label: 'Morbid Obesity', rate: '76%', pct: 76, color: 'var(--status-info)' },
  { code: 'HCC 18', label: 'Diabetes w/ chronic comp.', rate: '74%', pct: 74, color: 'var(--status-info)' },
];
const HCC_LOW = [
  { code: 'HCC 111', label: 'COPD', rate: '42%', pct: 42, color: 'var(--status-error)' },
  { code: 'HCC 138', label: 'Peripheral Artery Disease', rate: '47%', pct: 47, color: 'var(--status-error)' },
  { code: 'HCC 40', label: 'Rheumatoid Arthritis', rate: '51%', pct: 51, color: 'var(--status-warning)' },
  { code: 'HCC 10', label: 'Lymphatic Cancers', rate: '55%', pct: 55, color: 'var(--status-warning)' },
  { code: 'HCC 21', label: 'Protein-Calorie Malnutrition', rate: '58%', pct: 58, color: 'var(--status-warning)' },
];

export function RiskView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const fetchProgressBars = useAppStore(st => st.fetchProgressBars);
  const period = useAppStore(st => st.analyticsPeriod);

  const [kpiData, setKpiData] = useState(null);
  const [rafByPractice, setRafByPractice] = useState(null);
  const [hccRecapture, setHccRecapture] = useState(null);
  const [hccRecaptureCategories, setHccRecaptureCategories] = useState(null);
  const [openHccSuspects, setOpenHccSuspects] = useState(null);

  useEffect(() => {
    fetchViewKpis('risk').then(d => setKpiData(d || { kpis: [], insight: null }));
    fetchViewTable('risk', 'raf_by_practice').then(d => setRafByPractice(d || { columns: [], rows: [] }));
    fetchProgressBars('risk', 'hcc_recapture').then(d => setHccRecapture(d || []));
    fetchProgressBars('risk', 'hcc_recapture_categories').then(d => setHccRecaptureCategories(d || []));
    fetchViewTable('risk', 'open_hcc_suspects').then(d => setOpenHccSuspects(d || { columns: [], rows: [] }));
  }, [period]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const rafRows = safeTableRows(rafByPractice);
  const hccItems = safeBarItems(hccRecapture);

  const periodLabel = period === 'ytd' ? 'YTD 2025' : 'Rolling 12M';

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

  const renderMethodology = () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 8, fontSize: 14, color: 'var(--neutral-400)', lineHeight: 1.6 }}>
      <span style={{ fontSize: 14, marginTop: 1 }}>{'ℹ️'}</span>
      <span>
        <strong>CMS HCC Model V28</strong> &mdash; RAF displayed to 3 decimal places. Potential RAF is derived from all open HCC suspects in the suspect worklist below.
      </span>
    </div>
  );

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

  const renderRafTrend = () => (
    <Card title="RAF Score Trend" sub={periodLabel}>
      <RafTrendLineChart data={RAF_TREND} potential={1.120} />
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--neutral-200)', marginTop: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: 'var(--status-warning)', display: 'inline-block', borderRadius: 2 }} />Actual RAF</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--neutral-150)', display: 'inline-block' }} />Potential 1.120</span>
      </div>
    </Card>
  );

  const renderRafPractice = () => (
    <Card title="RAF Breakup by Practice — Recapture Opportunity" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Practice</th><th className={s.r}>Members</th><th className={s.r}>Avg RAF</th><th className={s.r}>Capture%</th><th className={s.r}>Gap%</th><th className={s.r}>Rev. Opp.</th></tr>
          </thead>
          <tbody>
            {rafByPractice === null && (
              <tr><td colSpan={6} style={{ padding: 0 }}><TableSkeleton rows={5} cols={6} /></td></tr>
            )}
            {rafByPractice !== null && rafRows.length === 0 && (
              <EmptyState colSpan={6} message="No RAF by practice data for this period." icon="solar:buildings-linear" />
            )}
            {rafRows.map((row, i) => (
              <tr key={i}>
                <td className={s.fw600}>{row.name}</td>
                <td className={`${s.r} ${s.mono}`}>{row.members}</td>
                <td className={`${s.r} ${s.mono}`} style={{ fontWeight: 500 }}>{row.avg_raf}</td>
                <td className={`${s.r}`}>{row.potential || row.capture || '-'}</td>
                <td className={`${s.r} ${s.valA}`}>{row.gap}</td>
                <td className={`${s.r} ${s.valR}`} style={{ fontWeight: 500 }}>{row.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderHccPerf = () => (
    <Card
      title="HCC Performance — Closure Rates"
      actions={<Button variant="ghost" size="S" onClick={() => showToast?.('Opening HCC Suspect Worklist')}>Full Workbook &rarr;</Button>}
    >
      <div className={s.g2}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--neutral-200)', marginBottom: 8 }}>{'✓'} Highest Closure Rates</div>
          {HCC_HIGH.map(h => (
            <div key={h.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--neutral-50)' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--primary-300)', minWidth: 55 }}>{h.code}</span>
              <span style={{ flex: 1, fontSize: 12 }}>{h.label}</span>
              <div style={{ width: 80, height: 6, background: 'var(--neutral-50)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${h.pct}%`, height: '100%', background: h.color, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: h.color, width: 35, textAlign: 'right' }}>{h.rate}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--neutral-200)', marginBottom: 8 }}>{'⚠'} Lowest Closure Rates &mdash; Biggest Opportunity</div>
          {HCC_LOW.map(h => (
            <div key={h.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--neutral-50)' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--primary-300)', minWidth: 55 }}>{h.code}</span>
              <span style={{ flex: 1, fontSize: 12 }}>{h.label}</span>
              <div style={{ width: 80, height: 6, background: 'var(--neutral-50)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${h.pct}%`, height: '100%', background: h.color, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: h.color, width: 35, textAlign: 'right' }}>{h.rate}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );

  const renderHccRecap = () => {
    // Hide the card entirely when there's data but no items (matches the
    // original conditional render). EditableGrid drops null renderers.
    if (!(hccRecapture === null || hccItems.length > 0)) return null;
    return (
      <Card title="HCC Recapture Performance">
        {hccRecapture === null ? (
          <ProgressBarSkeleton count={4} />
        ) : (
          hccItems.map(b => (
            <ProgressBar key={b.label} label={b.label} value={b.value} pct={b.pct} color={b.color} sub={b.sub} />
          ))
        )}
      </Card>
    );
  };

  const renderHccCat = () => (
    <Card title="HCC Recapture by Category">
      {hccRecaptureCategories === null ? (
        <ProgressBarSkeleton count={4} />
      ) : safeBarItems(hccRecaptureCategories).length === 0 ? (
        <EmptyState message="No HCC recapture categories for this period." icon="solar:diagram-up-linear" />
      ) : (
        safeBarItems(hccRecaptureCategories).map(b => (
          <ProgressBar key={b.label} label={b.label} value={b.value} pct={b.pct} color={b.color} sub={b.sub} />
        ))
      )}
    </Card>
  );

  const renderHccSuspects = () => (
    <Card title="Top Open HCC Suspects" flush actions={<Button variant="ghost" size="S" onClick={() => showToast?.('Opening full HCC suspect worklist')}>View All &rarr;</Button>}>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Member ID</th><th>HCC Category</th><th>Description</th><th className={s.r}>Est. Revenue Impact</th><th>Last Coded Date</th><th>Action</th></tr>
          </thead>
          <tbody>
            {openHccSuspects === null && (
              <tr><td colSpan={6} style={{ padding: 0 }}><TableSkeleton rows={5} cols={6} /></td></tr>
            )}
            {openHccSuspects !== null && safeTableRows(openHccSuspects).length === 0 && (
              <EmptyState colSpan={6} message="No open HCC suspects for this period." icon="solar:document-text-linear" />
            )}
            {safeTableRows(openHccSuspects).map((row, i) => (
              <tr key={i}>
                <td className={s.fw600}>{row.member_id}</td>
                <td><span className={`${s.stPill} ${s.stNeutral}`}>{row.hcc_category}</span></td>
                <td>{row.description}</td>
                <td className={`${s.r} ${s.valR}`} style={{ fontWeight: 500 }}>{row.revenue_impact}</td>
                <td className={s.mono}>{row.last_coded}</td>
                <td><Button variant="ghost" size="S" onClick={() => showToast?.(`${row.action} for ${row.member_id}`)}>{row.action}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const RENDERERS = {
    insight: renderInsight,
    methodology: renderMethodology,
    kpis: renderKpis,
    rafTrend: renderRafTrend,
    rafPractice: renderRafPractice,
    hccPerf: renderHccPerf,
    hccRecap: renderHccRecap,
    hccCat: renderHccCat,
    hccSuspects: renderHccSuspects,
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
