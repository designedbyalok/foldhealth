import { Button } from '../../../components/Button/Button';
import { Toggle } from '../../../components/Toggle/Toggle';
import { KpiCard, InsightBanner, Card, ProgressBar, EmptyState, KpiSkeleton, TableSkeleton, ChartSkeleton, ProgressBarSkeleton } from './shared';
import { safeTableRows, safeBarItems } from './shared.utils';
import { TcocLineChart, SavingsAreaChart } from './charts';
import s from '../AnalyticsLayout.module.css';

export function ExecutiveInsightSection({ insight, showToast }) {
  if (!insight) return null;
  return (
    <InsightBanner
      icon={insight.icon}
      title={insight.title}
      variant={insight.variant}
      text={insight.text}
      buttons={insight.buttons || []}
      showToast={showToast}
    />
  );
}

export function ExecutiveKpiRowSection({ kpiData, kpis, start, end }) {
  if (kpiData === null) return <KpiSkeleton count={end - start} />;
  return (
    <div className={s.kpiGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {kpis.slice(start, end).map(k => (
        <KpiCard key={k.key} value={k.value} label={k.label} delta={k.delta} deltaType={k.deltaType} sub={k.sub} accentColor={k.accentColor} />
      ))}
    </div>
  );
}

export function ExecutiveDriversSection({ showToast }) {
  return (
    <InsightBanner
      icon="solar:chart-linear"
      title="Key Drivers: Where to Focus"
      text="Cost: <strong>Inpatient $23 over benchmark</strong> driven by readmission spike at 3 facilities. Quality: <strong>AWV 19pp below target</strong>. Risk: <strong>962 HCC suspects open</strong> = $2.1M revenue at risk. Engagement: <strong>SMS-first converting at 61%</strong> vs 29% phone."
      buttons={[
        { label: 'Financial', navTo: 'financial' },
        { label: 'Quality', navTo: 'quality' },
        { label: 'Risk', navTo: 'risk' },
      ]}
      showToast={showToast}
    />
  );
}

export function ExecutiveTcocSection({
  periodLabel,
  tcocMode,
  tcocTab,
  tcocData,
  costBySettingInline,
  onTcocModeChange,
  onTcocTabChange,
}) {
  return (
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
            value={tcocMode}
            onValueChange={onTcocModeChange}
            size="sm"
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
            value={tcocTab}
            onValueChange={onTcocTabChange}
            size="sm"
          />
        </div>
      }
    >
      {tcocData === null ? <ChartSkeleton bars={12} /> : <TcocLineChart tab={tcocTab} data={tcocData} mode={tcocMode} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--neutral-100)' }}>
        {costBySettingInline.map(c => (
          <div key={c.label} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 6 }}>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 500, color: c.color, lineHeight: 1.2 }}>{c.value}</div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)', marginTop: 3 }}>{c.note}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ExecutiveQualitySection({ qualitySummary, qualFallback, showToast }) {
  return (
    <Card title="Quality Summary" actions={<Button variant="ghost" size="sm" onClick={() => showToast?.('Opening Quality view')}>Full View &rarr;</Button>}>
      {qualitySummary === null ? (
        <ProgressBarSkeleton count={5} />
      ) : (
        qualFallback.map(q => (
          <ProgressBar key={q.label} label={q.label} value={q.value} pct={q.pct} color={q.color} sub={q.sub} />
        ))
      )}
    </Card>
  );
}

export function ExecutiveCareSection({ careProgramData, carePrograms, showToast }) {
  return (
    <Card
      title="Care Program Command Center"
      sub={`8 programs · $7.3M saved · 3.7× blended ROI`}
      actions={<Button variant="ghost" size="sm" onClick={() => showToast?.('Opening Care Management view')}>Full Program View &rarr;</Button>}
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
            {careProgramData === null && (
              <tr><td colSpan={5} style={{ padding: 0 }}><TableSkeleton rows={5} cols={5} /></td></tr>
            )}
            {careProgramData !== null && carePrograms.length === 0 && (
              <EmptyState colSpan={5} message="No care programs configured for this period." icon="solar:heart-pulse-linear" />
            )}
            {carePrograms.map((p, i) => (
              <tr key={i} style={{ cursor: 'pointer' }} onClick={() => showToast?.(`Navigating to Care Management → Programs → ${p.abbr}`)}>
                <td className={s.fw600}>{p.abbr}<div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>{p.members} mbrs</div></td>
                <td className={s.r}>
                  <span className={`${s.stPill} ${p.status === 'green' ? s.stGreen : p.status === 'amber' ? s.stAmber : s.stRed}`}>
                    {p.status === 'green' ? 'On Track' : p.status === 'amber' ? 'Review' : 'At Risk'}
                  </span>
                </td>
                <td className={`${s.r} ${s.mono} ${s.valG}`}>{p.saved}</td>
                <td className={`${s.r} ${s.mono}`} style={{ fontWeight: 500 }}>{p.roi}</td>
                <td style={{ fontSize: 'var(--font-sm)', color: p.status === 'red' ? 'var(--status-error)' : 'var(--status-warning)', maxWidth: 200 }}>{p.alert}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ExecutiveSavingsSection({
  periodLabel,
  periodMode,
  savingsData,
  savingsTrajectory,
  showToast,
}) {
  return (
    <Card
      title="Shared Savings Trajectory"
      sub={periodLabel}
      actions={<Button variant="ghost" size="sm" onClick={() => showToast?.('Opening Shared Savings view')}>Full View &rarr;</Button>}
    >
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 500, color: 'var(--status-success)' }}>{periodMode === 'r12' ? '$1.8M' : '$1.2M'}</div>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--neutral-200)' }}>Savings {periodMode === 'r12' ? 'Rolling 12M' : 'YTD'}</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--neutral-100)', paddingLeft: 16 }}>
          <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 500, color: 'var(--status-warning)' }}>{periodMode === 'r12' ? '82%' : '78%'}</div>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--neutral-200)' }}>Prob. of hitting MSR</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--neutral-100)', paddingLeft: 16 }}>
          <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 500, color: 'var(--neutral-500)' }}>4.1</div>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--neutral-200)' }}>Quality Composite</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--neutral-100)', paddingLeft: 16 }}>
          <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 500, color: 'var(--neutral-500)' }}>{periodMode === 'r12' ? '$3.8M' : '$3.2M'}</div>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--neutral-200)' }}>Full-year projection</div>
        </div>
      </div>
      {savingsData === null ? (
        <ChartSkeleton bars={12} />
      ) : savingsTrajectory.length === 0 ? (
        <EmptyState message="No savings trajectory data for this period." icon="solar:chart-2-linear" />
      ) : (
        <SavingsAreaChart data={savingsTrajectory} targetLabel="MSR $2.8M" targetValue={2.8} />
      )}
      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)', padding: '8px 14px 4px', borderTop: '1px solid var(--neutral-100)', marginTop: '0.5rem' }}>
        MSSP Track 1B &middot; Performance Year 2025 &middot; Quality composite secures maximum sharing rate
      </div>
    </Card>
  );
}

export function ExecutiveCostTableSection({ costData, costRows }) {
  return (
    <Card title="Cost by Setting: Benchmark Comparison" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Setting</th><th className={s.r}>Actual PMPM</th><th className={s.r}>Benchmark</th><th className={s.r}>Variance</th><th>Status</th></tr>
          </thead>
          <tbody>
            {costData === null && (
              <tr><td colSpan={5} style={{ padding: 0 }}><TableSkeleton rows={5} cols={5} /></td></tr>
            )}
            {costData !== null && costRows.length === 0 && (
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
}
