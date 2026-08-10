import { useState, useEffect } from 'react';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { KpiCard, InsightBanner, Card, ProgressBar, safeBarItems, safeTableRows, KpiSkeleton } from './shared';
import { SavingsAreaChart } from './charts';
import { EditableGrid } from './EditableGrid';
import s from '../AnalyticsLayout.module.css';

const STORAGE_KEY = 'analytics-shared-layout-v2';

const DEFAULT_LAYOUT = [
  { i: 'insight',    x: 0, y: 0,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5  },
  { i: 'kpis',       x: 0, y: 3,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 5  },
  { i: 'trajectory', x: 0, y: 6,  w: 6,  h: 10, minW: 4, minH: 6, maxW: 12, maxH: 20 },
  { i: 'levers',     x: 6, y: 6,  w: 6,  h: 10, minW: 4, minH: 6, maxW: 12, maxH: 20 },
  { i: 'composite',  x: 0, y: 16, w: 12, h: 8, minW: 6, minH: 5, maxW: 12, maxH: 16 },
];

const SAVINGS_DATA = [0, 0.1, 0.2, 0.35, 0.5, 0.62, 0.75, 0.9, 1.0, 1.1, 1.2, 1.32];
const SAVINGS_METADATA = [
  { label: 'Benchmark PMPM', value: '$910' },
  { label: 'Actual PMPM', value: '$890' },
  { label: 'Savings/Member/Mo', value: '$20' },
  { label: 'Full-Year Proj.', value: '$3.2M' },
  { label: 'Min. Savings Rate', value: '$2.8M' },
  { label: 'Quality Withhold', value: '$320K' },
];
const QUAL_COMPOSITE_FALLBACK = [
  { label: 'AWV / Care Coordination', value: '61% / target 80%', pct: 61, color: 'amber', sub: 'Pulling composite down — 847 open AWVs' },
  { label: 'Diabetes HbA1c Control', value: '72% / target 70%', pct: 72, color: 'teal', sub: '✓ On target' },
  { label: 'BP Control', value: '64% / target 70%', pct: 64, color: 'purple', sub: '6pp gap — 504 members' },
  { label: 'Colorectal Screening', value: '58% / target 65%', pct: 58, color: 'red', sub: '7pp gap — 588 members' },
  { label: 'Depression Screening PHQ-9', value: '83% / target 80%', pct: 83, color: 'green', sub: '✓ Above target' },
  { label: 'Statin Therapy — Diabetes', value: '71% / target 75%', pct: 71, color: 'amber', sub: '4pp gap — 336 members' },
  { label: 'Patient Experience CAHPS', value: '4.3 / 5.0', pct: 86, color: 'green', sub: '✓ Strong' },
  { label: 'Preventive Screening', value: '63% / target 70%', pct: 63, color: 'amber', sub: '7pp gap — colorectal gap' },
];

export function SharedSavingsView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const fetchProgressBars = useAppStore(st => st.fetchProgressBars);
  const period = useAppStore(st => st.analyticsPeriod);

  const [kpiData, setKpiData] = useState(null);
  const [keyLevers, setKeyLevers] = useState(null);
  const [qualityComposite, setQualityComposite] = useState(null);

  useEffect(() => {
    fetchViewKpis('shared').then(d => setKpiData(d || { kpis: [], insight: null }));
    fetchViewTable('shared', 'key_levers').then(d => setKeyLevers(d || { columns: [], rows: [] }));
    fetchProgressBars('shared', 'quality_composite').then(d => setQualityComposite(d || []));
  }, [period]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const leverRows = safeTableRows(keyLevers);
  const compositeItems = safeBarItems(qualityComposite);
  const qualFallback = compositeItems.length > 0 ? compositeItems : QUAL_COMPOSITE_FALLBACK;

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

  const renderTrajectory = () => (
    <Card title="Savings Trajectory" sub="MSSP">
      <SavingsAreaChart data={SAVINGS_DATA} targetLabel="MSR $2.8M" targetValue={2.8} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--neutral-100)' }}>
        {SAVINGS_METADATA.map(m => (
          <div key={m.label}>
            <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{m.label}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-500)', marginTop: 2 }}>{m.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderLevers = () => (
    <Card title="Key Savings Levers — Current Status">
      {leverRows.length > 0 ? (
        <div className={s.tblWrap}>
          <table className={s.tbl}>
            <thead>
              <tr><th>Lever</th><th className={s.r}>Current</th><th className={s.r}>Target</th><th className={s.r}>Gap</th><th className={s.r}>Savings Impact</th><th>Status</th></tr>
            </thead>
            <tbody>
              {leverRows.map((row, i) => {
                const st = row.status;
                return (
                  <tr key={i}>
                    <td className={s.fw600}>{row.lever}</td>
                    <td className={`${s.r} ${s.mono}`}>{row.current}</td>
                    <td className={`${s.r} ${s.mono}`}>{row.target}</td>
                    <td className={`${s.r} ${st === 'red' ? s.valR : st === 'amber' ? s.valA : s.valG}`}>{row.gap}</td>
                    <td className={`${s.r} ${s.fw600}`}>{row.impact}</td>
                    <td>
                      <span className={`${s.stPill} ${st === 'green' ? s.stGreen : st === 'red' ? s.stRed : s.stAmber}`}>
                        {st === 'green' ? 'On Track' : st === 'red' ? 'At Risk' : 'Monitor'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <ProgressBar label="IP Admissions / 1000" value="287 vs 265 benchmark" pct={65} color="amber" sub="$23 PMPM over — top savings opportunity" />
          <ProgressBar label="30-Day Readmission Rate" value="18.4% vs 15% threshold" pct={55} color="red" sub="3.4pp over — $840K projected cost" />
          <ProgressBar label="RAF Recapture Gap" value="0.078 RAF pts · $2.1M revenue" pct={42} color="red" sub="Open HCC suspects unaddressed" />
          <ProgressBar label="Quality Composite" value="4.1 / 5.0 · above share threshold" pct={82} color="green" sub="100% quality withhold share secured" />
          <ProgressBar label="Pharmacy PMPM Growth" value="+18% QoQ · GLP-1 driving" pct={58} color="amber" sub="Risk to TCOC if not managed" />
        </>
      )}
      <Button variant="primary" size="S" fullWidth style={{ marginTop: 10 }} onClick={() => showToast?.('Opening ROI Simulator')}>
        &#9654; Run Scenario Simulator &rarr;
      </Button>
    </Card>
  );

  const renderComposite = () => (
    <Card title="Quality Composite Breakdown" actions={<Button variant="ghost" size="S" onClick={() => showToast?.('Opening full Quality view')}>Full Quality View &rarr;</Button>}>
      <div className={s.g2}>
        <div>
          {qualFallback.slice(0, 4).map(b => (
            <ProgressBar key={b.label} label={b.label} value={b.value} pct={b.pct} color={b.color} sub={b.sub} />
          ))}
        </div>
        <div>
          {qualFallback.slice(4, 8).map(b => (
            <ProgressBar key={b.label} label={b.label} value={b.value} pct={b.pct} color={b.color} sub={b.sub} />
          ))}
        </div>
      </div>
    </Card>
  );

  const RENDERERS = {
    insight: renderInsight,
    kpis: renderKpis,
    trajectory: renderTrajectory,
    levers: renderLevers,
    composite: renderComposite,
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
