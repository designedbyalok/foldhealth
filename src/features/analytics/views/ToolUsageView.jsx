import { useState, useEffect } from 'react';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { KpiCard, InsightBanner, Card, ProgressBar, StatusPill, EmptyState, KpiSkeleton, TableSkeleton } from './shared';
import { safeTableRows } from './shared.utils';
import { EditableGrid } from './EditableGrid';
import s from '../AnalyticsLayout.module.css';

const STORAGE_KEY = 'analytics-tools-layout-v2';

const DEFAULT_LAYOUT = [
  { i: 'insight',     x: 0, y: 0,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5  },
  { i: 'kpis',        x: 0, y: 3,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 5  },
  { i: 'sidecar',     x: 0, y: 6,  w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 16 },
  { i: 'automation',  x: 6, y: 6,  w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 16 },
  { i: 'adoption',    x: 0, y: 14, w: 12, h: 8, minW: 6, minH: 5, maxW: 12, maxH: 20 },
  { i: 'nonAdopters', x: 0, y: 22, w: 12, h: 6, minW: 6, minH: 4, maxW: 12, maxH: 16 },
];

const EMPTY_TABLE_ROWS = [];

function renderToolAutomation() {
  return (
    <Card title="Automation Engine Performance">
      <ProgressBar label="SMS Outreach Sent" value="1,840 msgs" pct={73} color="teal" sub="61% engagement rate" />
      <ProgressBar label="Auto-Scheduled AWVs" value="312 appts" pct={62} color="amber" sub="Via engaged members" />
      <ProgressBar label="TCM Auto-Assigned" value="184 tasks" pct={74} color="teal" sub="Post-discharge" />
      <ProgressBar label="HCC Suspect Alerts Pushed" value="412 alerts" pct={83} color="green" sub="To Sidecar EMR" />
    </Card>
  );
}

export function ToolUsageView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const period = useAppStore(st => st.analyticsPeriod);

  const [kpiData, setKpiData] = useState(null);
  const [adoptionData, setAdoptionData] = useState(null);

  useEffect(() => {
    fetchViewKpis('tools').then(d => setKpiData(d || { kpis: [], insight: null }));
    fetchViewTable('tools', 'adoption_by_provider').then(d => setAdoptionData(d || { columns: [], rows: [] }));
  }, [period]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const adoptionRows = safeTableRows(adoptionData);
  const nonAdopterRows = EMPTY_TABLE_ROWS;

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

  const renderSidecar = () => (
    <Card title="Sidecar Usage by Provider">
      <ProgressBar label="Weekly Active Users" value="28/44" pct={64} color="teal" sub="Target 100%" />
      <ProgressBar label="HCC Alerts Acted On" value="78%" pct={78} color="green" sub="Within 48 hours ✓" />
      <ProgressBar label="Rx Opportunities Acted On" value="62%" pct={62} color="amber" sub="Target 75%" />
      <ProgressBar label="Quality Flags Reviewed" value="71%" pct={71} color="teal" sub="Target 80%" />
      <Button size="sm" fullWidth style={{ marginTop: 8 }} onClick={() => showToast?.('Viewing 12 non-adopters')}>
        View 12 Non-Adopters &rarr;
      </Button>
    </Card>
  );

  const renderAutomation = renderToolAutomation;

  const renderAdoption = () => (
    <Card title="Adoption by Provider" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Provider</th><th className={s.r}>Weekly Active</th><th className={s.r}>Alerts Acted</th><th className={s.r}>HCC Gaps Closed</th><th className={s.r}>Avg Response Time</th><th>Status</th></tr>
          </thead>
          <tbody>
            {adoptionData === null && (
              <tr><td colSpan={6} style={{ padding: 0 }}><TableSkeleton rows={5} cols={6} /></td></tr>
            )}
            {adoptionData !== null && adoptionRows.length === 0 && (
              <EmptyState colSpan={6} message="No adoption data for this period." icon="solar:user-id-linear" />
            )}
            {adoptionRows.map((row, i) => {
              const st = row.status;
              return (
                <tr key={i}>
                  <td className={s.fw600}>{row.provider}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.active}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.alerts}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.gaps}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.response}</td>
                  <td><StatusPill label={st === 'green' ? 'Power User' : st === 'amber' ? 'Moderate' : 'Low'} variant={st} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderNonAdopters = () => (
    <Card title="Non-Adopters: 0 Logins (Past 30 Days)" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Provider</th><th>Practice</th><th className={s.r}>Members</th><th className={s.r}>Open HCC Gaps</th><th className={s.r}>Last Login</th><th>Outreach Status</th></tr>
          </thead>
          <tbody>
            {nonAdopterRows.map((row, i) => (
              <tr key={i}>
                <td className={s.fw600}>{row.provider}</td>
                <td>{row.practice}</td>
                <td className={`${s.r} ${s.mono}`}>{row.members}</td>
                <td className={`${s.r} ${s.mono}`}>{row.gaps}</td>
                <td className={`${s.r} ${s.mono}`}>{row.last_login}</td>
                <td>
                  <span className={`${s.stPill} ${row.outreach === 'Contacted' ? s.stGreen : row.outreach === 'Scheduled' ? s.stAmber : s.stNeutral}`}>
                    {row.outreach}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const RENDERERS = {
    insight: renderInsight,
    kpis: renderKpis,
    sidecar: renderSidecar,
    automation: renderAutomation,
    adoption: renderAdoption,
    nonAdopters: renderNonAdopters,
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
