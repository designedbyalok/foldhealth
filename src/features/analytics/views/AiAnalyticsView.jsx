import { useState, useEffect } from 'react';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { KpiCard, InsightBanner, Card, EmptyState, KpiSkeleton, TableSkeleton } from './shared';
import { safeTableRows, safeConfigData } from './shared.utils';
import { EditableGrid } from './EditableGrid';
import s from '../AnalyticsLayout.module.css';

const STORAGE_KEY = 'analytics-aianalytics-layout-v2';

const DEFAULT_LAYOUT = [
  { i: 'insight',   x: 0, y: 0,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5  },
  { i: 'kpis',      x: 0, y: 3,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 5  },
  { i: 'nlq',       x: 0, y: 6,  w: 12, h: 7, minW: 6, minH: 5, maxW: 12, maxH: 16 },
  { i: 'anomalies', x: 0, y: 13, w: 6,  h: 9, minW: 4, minH: 5, maxW: 12, maxH: 20 },
  { i: 'models',    x: 6, y: 13, w: 6,  h: 9, minW: 4, minH: 5, maxW: 12, maxH: 20 },
];

export function AiAnalyticsView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchConfig = useAppStore(st => st.fetchConfig);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const period = useAppStore(st => st.analyticsPeriod);

  const [kpiData, setKpiData] = useState(null);
  const [nlqExamples, setNlqExamples] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [predictiveModels, setPredictiveModels] = useState(null);

  useEffect(() => {
    fetchViewKpis('aianalytics').then(d => setKpiData(d || { kpis: [], insight: null }));
    fetchConfig('nlq_examples').then(d => setNlqExamples(d || {}));
    fetchConfig('anomalies').then(d => setAnomalies(d || {}));
    fetchViewTable('aianalytics', 'predictive_models').then(d => setPredictiveModels(d || { columns: [], rows: [] }));
  }, [period]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const safeNlq = safeConfigData(nlqExamples);
  const safeAnomalies = safeConfigData(anomalies);
  const examples = safeNlq.examples || [];
  const anomalyList = safeAnomalies.anomalies || [];
  const modelRows = safeTableRows(predictiveModels);

  const renderInsight = () => insight ? (
    <InsightBanner
      icon={insight.icon}
      title={insight.title}
      variant={insight.variant}
      text={insight.text}
      buttons={insight.buttons || []}
      showToast={showToast}
    />
  ) : (
    <InsightBanner
      icon="custom:ai"
      title="AI-Generated Narrative"
      text="Fold Unity detected <strong>3 anomalies</strong> this week: (1) CHF IP admissions <strong>+18%</strong> vs 4-week avg at Riverside Hospital. (2) RAF recapture velocity <strong>-12%</strong> since V28 transition. (3) TCM enrollment <strong>-24%</strong> from coordinator capacity gap."
      buttons={[
        { label: 'Review All Anomalies', primary: true, toast: 'Opening anomaly dashboard' },
        { label: 'Configure Alerts', toast: 'Opening alert config' },
      ]}
      showToast={showToast}
    />
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

  const renderNlq = () => (
    <Card title="Ask Fold: Natural Language Query Engine" sub="Click an example or type your own question">
      <div style={{ fontSize: 'var(--font-base)', color: 'var(--neutral-300)', marginBottom: 'var(--font-sm)' }}>
        Type any clinical or operational question. Fold Unity translates to structured queries against your data.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {examples.map((q, i) => (
          <div key={i} className={s.nlqCard} onClick={() => showToast?.(`Running query: ${q.title}`)}>
            <div className={s.nlqTitle}>{q.title}</div>
            <div className={s.nlqDesc}>{q.desc}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderAnomalies = () => (
    <Card title="Anomaly Detection" actions={<Button variant="ghost" size="sm" onClick={() => showToast?.('Configuring alert thresholds')}>Configure Thresholds</Button>}>
      {anomalyList.map((a, i) => (
        <div key={i} className={s.ruleCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className={`${s.stPill} ${a.severity === 'red' ? s.stRed : s.stAmber}`}>
              {a.severity === 'red' ? 'Critical' : 'Warning'}
            </span>
            {a.detected && <span style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>{a.detected}</span>}
          </div>
          <div className={s.ruleTrigger} style={{ marginTop: 6, color: 'var(--neutral-500)' }}>{a.title}</div>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)', lineHeight: 1.55, marginTop: 4 }}>{a.desc}</div>
          {a.actionLabel && (
            <Button variant={a.severity === 'red' ? 'solid' : 'ghost'} size="sm" style={{ marginTop: 8 }} onClick={() => showToast?.(a.actionToast || a.actionLabel)}>
              {a.actionLabel}
            </Button>
          )}
        </div>
      ))}
    </Card>
  );

  const renderModels = () => (
    <Card title="Predictive Models" sub="Performance & active predictions" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Model</th><th className={s.r}>AUC</th><th className={s.r}>Accuracy</th><th className={s.r}>Active Predictions</th><th className={s.r}>Last Retrained</th><th>Status</th></tr>
          </thead>
          <tbody>
            {predictiveModels === null && (
              <tr><td colSpan={6} style={{ padding: 0 }}><TableSkeleton rows={4} cols={6} /></td></tr>
            )}
            {predictiveModels !== null && modelRows.length === 0 && (
              <EmptyState colSpan={6} message="No predictive models for this period." icon="solar:graph-up-linear" />
            )}
            {modelRows.map((row, i) => {
              const st = row.status;
              return (
                <tr key={i}>
                  <td className={s.fw600}>{row.model}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.auc}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.accuracy}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.predictions}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.retrained}</td>
                  <td>
                    <span className={`${s.stPill} ${st === 'green' ? s.stGreen : s.stAmber}`}>
                      {st === 'green' ? 'Active' : 'Stale'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, padding: '0 14px 4px', fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>
        Models retrained bi-weekly on rolling 24-month data. Drift monitoring active. Alert threshold: AUC drop &gt; 0.03.
      </div>
    </Card>
  );

  const RENDERERS = {
    insight: renderInsight,
    kpis: renderKpis,
    nlq: renderNlq,
    anomalies: renderAnomalies,
    models: renderModels,
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
