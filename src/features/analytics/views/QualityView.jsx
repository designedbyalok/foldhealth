import { useState, useEffect } from 'react';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { KpiCard, InsightBanner, Card, ProgressBar, Tag, safeTableRows, EmptyState, KpiSkeleton, TableSkeleton } from './shared';
import { EditableGrid } from './EditableGrid';
import s from '../AnalyticsLayout.module.css';

// Editable dashboard config. `h` values are seeds only — EditableGrid
// auto-fits each cell to its content height. x/y/w drive placement & order.
const STORAGE_KEY = 'analytics-quality-layout-v2';

const DEFAULT_LAYOUT = [
  { i: 'insight',         x: 0, y: 0,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 60 },
  { i: 'kpis',            x: 0, y: 3,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 60 },
  { i: 'measures',        x: 0, y: 6,  w: 6,  h: 9, minW: 4, minH: 5, maxW: 12, maxH: 200 },
  { i: 'practiceQuality', x: 6, y: 6,  w: 6,  h: 9, minW: 4, minH: 5, maxW: 12, maxH: 200 },
  { i: 'zeroGap',         x: 0, y: 15, w: 12, h: 7, minW: 6, minH: 5, maxW: 12, maxH: 200 },
];

const QUALITY_FILTER_OPTIONS = ['All Measures', 'HEDIS', 'Star Ratings', 'ACO CAHPS', 'ACO PC01'];
const PRACTICE_QUALITY = [
  { name: 'Patel Family Med.', composite: '72%', gaps: 342, toGoal: '-18', awv: '71%', trend: '\u2191', status: 'green' },
  { name: 'Riverside Medical', composite: '58%', gaps: 511, toGoal: '+46', awv: '48%', trend: '\u2193', status: 'red' },
  { name: 'Valley Primary Care', composite: '65%', gaps: 428, toGoal: '+12', awv: '61%', trend: '\u2192', status: 'amber' },
  { name: 'Northside Clinic', composite: '69%', gaps: 198, toGoal: '-4', awv: '74%', trend: '\u2191', status: 'green' },
  { name: 'Eastside Health', composite: '71%', gaps: 162, toGoal: '-10', awv: '68%', trend: '\u2191', status: 'green' },
];

export function QualityView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const period = useAppStore(st => st.analyticsPeriod);

  const [kpiData, setKpiData] = useState(null);
  const [qualityMeasures, setQualityMeasures] = useState(null);
  const [measureFilter, setMeasureFilter] = useState('All Measures');

  useEffect(() => {
    fetchViewKpis('quality').then(d => setKpiData(d || { kpis: [], insight: null }));
    fetchViewTable('quality', 'quality_measures').then(d => setQualityMeasures(d || { columns: [], rows: [] }));
  }, [period]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const allMeasures = safeTableRows(qualityMeasures);

  const filterOptions = QUALITY_FILTER_OPTIONS;
  const measures = measureFilter === 'All Measures'
    ? allMeasures
    : allMeasures.filter(m => (m.tag || '') === measureFilter || (m.tag === 'Stars' && measureFilter === 'Star Ratings'));

  // ── Per-key content renderers ───────────────────────────────────────────
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

  const renderMeasures = () => (
    <Card
      title="Measure Performance"
      flush
      actions={
        <select
          value={measureFilter}
          onChange={e => setMeasureFilter(e.target.value)}
          style={{ fontSize: 12, padding: '3px 8px', minWidth: 130, borderRadius: 6, border: '1px solid var(--neutral-100)' }}
        >
          {QUALITY_FILTER_OPTIONS.map(f => <option key={f}>{f}</option>)}
        </select>
      }
    >
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr>
              <th>Measure</th>
              <th className={s.r}>Current Rate</th>
              <th className={s.r}>Target</th>
              <th className={s.r}>Gap</th>
              <th>Program</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {qualityMeasures === null && (
              <tr><td colSpan={6} style={{ padding: 0 }}><TableSkeleton rows={6} cols={6} /></td></tr>
            )}
            {qualityMeasures !== null && measures.length === 0 && (
              <EmptyState colSpan={6} message="No quality measures for this filter." icon="solar:medal-ribbon-linear" />
            )}
            {measures.map((m, i) => {
              const rate = m.rate ?? 0;
              const target = m.target ?? 0;
              const gap = rate - target;
              const gapStr = gap >= 0 ? `+${gap}pp` : `${gap}pp`;
              const gapCls = gap >= 0 ? s.valG : gap >= -10 ? s.valA : s.valR;
              return (
                <tr key={i}>
                  <td className={s.fw600}>{m.name}</td>
                  <td className={`${s.r} ${s.mono}`}>{rate}%</td>
                  <td className={`${s.r} ${s.mono}`}>{target}%</td>
                  <td className={`${s.r} ${gapCls}`}>{gapStr}</td>
                  <td>
                    <Tag
                      label={m.tag || ''}
                      variant={m.tag === 'Stars' ? 'stars' : m.tag === 'HEDIS' ? 'hedis' : 'aco'}
                    />
                  </td>
                  <td>{m.trend === 'up' ? '\u2191' : m.trend === 'down' ? '\u2193' : '\u2192'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderPracticeQuality = () => (
    <Card title="Practice-Level Quality" flush actions={<Button variant="ghost" size="S" onClick={() => showToast?.('Exporting practice quality...')}>Export</Button>}>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Practice</th><th className={s.r}>Composite</th><th className={s.r}>Open Gaps</th><th className={s.r}>Gaps to Goal</th><th className={s.r}>AWV%</th><th>Trend</th></tr>
          </thead>
          <tbody>
            {PRACTICE_QUALITY.map((p, i) => {
              const rc = p.status === 'red' ? s.valR : p.status === 'green' ? s.valG : s.valA;
              const tc = p.trend === '\u2191' ? 'var(--status-success)' : p.trend === '\u2193' ? 'var(--status-error)' : 'var(--status-warning)';
              return (
                <tr key={i}>
                  <td className={s.fw600}>{p.name}</td>
                  <td className={`${s.r} ${rc}`} style={{ fontWeight: 500 }}>{p.composite}</td>
                  <td className={`${s.r} ${s.mono}`}>{p.gaps}</td>
                  <td className={`${s.r} ${rc}`} style={{ fontWeight: 500 }}>{p.toGoal}</td>
                  <td className={`${s.r}`}>{p.awv}</td>
                  <td style={{ color: tc, fontSize: 14, textAlign: 'center' }}>{p.trend}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderZeroGap = () => (
    <Card
      title={<span style={{ color: 'var(--status-error)' }}>\u26A0 1,240 Members \u2014 Zero Gaps Closed YTD</span>}
      style={{ border: '1px solid var(--status-error-light)' }}
      actions={
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="primary" size="S" style={{ fontSize: 12 }} onClick={() => showToast?.('Scheduling AWV for 620 members')}>Schedule AWV (620)</Button>
          <Button variant="ghost" size="S" style={{ fontSize: 12 }} onClick={() => showToast?.('Scheduling office visits for 620 members')}>Schedule Office Visit (620)</Button>
        </div>
      }
    >
      <ProgressBar label="Tier 4\u20135 (High Risk)" value="412 members \u00B7 priority via care manager" pct={33} color="red" />
      <ProgressBar label="Tier 3 (Moderate Risk)" value="488 members \u00B7 close via AWV scheduling" pct={39} color="amber" />
      <ProgressBar label="Tier 1\u20132 (Low Risk)" value="340 members \u00B7 close via targeted reminder" pct={27} color="green" />
      <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
        <Button variant="primary" size="S" onClick={() => showToast?.('Viewing all 1,240 members')}>View All 1,240 Members &rarr;</Button>
        <Button variant="ghost" size="S" onClick={() => showToast?.('AWV Opportunity: 847 members')}>AWV Opportunity (847) &rarr;</Button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--neutral-200)', marginTop: 8 }}>
        Two separate cohorts for split targeting: AWV scheduling for prevention-eligible members; office visit for members recently seen but no gap addressed.
      </div>
    </Card>
  );

  const RENDERERS = {
    insight: renderInsight,
    kpis: renderKpis,
    measures: renderMeasures,
    practiceQuality: renderPracticeQuality,
    zeroGap: renderZeroGap,
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
