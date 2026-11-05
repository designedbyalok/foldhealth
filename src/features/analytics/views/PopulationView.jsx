import { useState, useEffect } from 'react';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { KpiCard, InsightBanner, Card, ProgressBar, EmptyState, KpiSkeleton, TableSkeleton, ProgressBarSkeleton } from './shared';
import { safeBarItems, safeTableRows } from './shared.utils';
import { Icon } from '../../../components/Icon/Icon';
import { EditableGrid } from './EditableGrid';
import s from '../AnalyticsLayout.module.css';

const STORAGE_KEY = 'analytics-population-layout-v2';

const DEFAULT_LAYOUT = [
  { i: 'insight',   x: 0, y: 0,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5  },
  { i: 'kpis',      x: 0, y: 3,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 5  },
  { i: 'risk',      x: 0, y: 6,  w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 16 },
  { i: 'chronic',   x: 6, y: 6,  w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 16 },
  { i: 'bookmarks', x: 0, y: 14, w: 12, h: 6, minW: 6, minH: 4, maxW: 12, maxH: 12 },
  { i: 'sdoh',      x: 0, y: 20, w: 12, h: 6, minW: 6, minH: 4, maxW: 12, maxH: 14 },
  { i: 'detail',    x: 0, y: 26, w: 12, h: 8, minW: 6, minH: 5, maxW: 12, maxH: 20 },
];

const POPULATION_BOOKMARKS = [
  { icon: 'solar:calendar-search-linear', label: 'Missing AWV', count: 847, toast: 'Opening AWV drill-down' },
  { icon: 'solar:hospital-linear', label: 'Recent IP Discharges', count: 124, toast: 'Opening TCM drill-down' },
  { icon: 'solar:danger-triangle-linear', label: 'High ED Utilizers', count: 221, toast: 'Opening ED drill-down' },
];

export function PopulationView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchProgressBars = useAppStore(st => st.fetchProgressBars);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const period = useAppStore(st => st.analyticsPeriod);

  const [kpiData, setKpiData] = useState(null);
  const [riskTiers, setRiskTiers] = useState(null);
  const [chronicConditions, setChronicConditions] = useState(null);
  const [memberLists, setMemberLists] = useState(null);
  const [sdohScreening, setSdohScreening] = useState(null);

  useEffect(() => {
    fetchViewKpis('population').then(d => setKpiData(d || { kpis: [], insight: null }));
    fetchProgressBars('population', 'risk_tiers').then(d => setRiskTiers(d || []));
    fetchProgressBars('population', 'chronic_conditions').then(d => setChronicConditions(d || []));
    fetchViewTable('population', 'actionable_member_lists').then(d => setMemberLists(d || { columns: [], rows: [] }));
    fetchProgressBars('population', 'sdoh_screening').then(d => setSdohScreening(d || []));
  }, [period]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const memberRows = safeTableRows(memberLists);
  const riskTierItems = safeBarItems(riskTiers);
  const chronicItems = safeBarItems(chronicConditions);
  const sdohItems = safeBarItems(sdohScreening);

  const bookmarks = POPULATION_BOOKMARKS;

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

  const renderRisk = () => (
    <Card title="Risk Stratification">
      {riskTiers === null ? (
        <ProgressBarSkeleton count={5} />
      ) : riskTierItems.length === 0 ? (
        <EmptyState message="No risk stratification data for this period." icon="solar:graph-up-linear" />
      ) : (
        riskTierItems.map(r => (
          <ProgressBar key={r.label} label={r.label} value={r.value} pct={r.pct} color={r.color} />
        ))
      )}
    </Card>
  );

  const renderChronic = () => (
    <Card title="Chronic Condition Distribution">
      {chronicConditions === null ? (
        <ProgressBarSkeleton count={5} />
      ) : chronicItems.length === 0 ? (
        <EmptyState message="No chronic condition data for this period." icon="solar:heart-pulse-linear" />
      ) : (
        chronicItems.map(c => (
          <ProgressBar key={c.label} label={c.label} value={c.value} pct={c.pct} color={c.color} />
        ))
      )}
    </Card>
  );

  const renderBookmarks = () => (
    <Card title="Actionable Member Lists">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 4 }}>
        {bookmarks.map((bm, i) => (
          <div key={i} style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name={bm.icon} size={18} color="var(--primary-300)" />
              <span style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-400)' }}>{bm.label}</span>
            </div>
            <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 500, color: 'var(--neutral-500)' }}>{bm.count.toLocaleString()}</div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>members</div>
            <Button variant="ghost" size="sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => showToast?.(bm.toast)}>
              View List &rarr;
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderSdoh = () => (
    <Card title="SDoH Risk Screening" sub="Progress toward screening targets">
      {sdohScreening === null ? (
        <ProgressBarSkeleton count={4} />
      ) : sdohItems.length === 0 ? (
        <EmptyState message="No SDoH screening data for this period." icon="solar:user-heart-rounded-linear" />
      ) : (
        sdohItems.map(item => (
          <ProgressBar key={item.label} label={item.label} value={item.value} pct={item.pct} color={item.color} sub={item.sub} />
        ))
      )}
    </Card>
  );

  const renderDetail = () => (
    <Card title="Actionable Member Lists: Detail" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Cohort</th><th className={s.r}>Members</th><th className={s.r}>Avg TCOC</th><th className={s.r}>Avg RAF</th><th>Top Conditions</th></tr>
          </thead>
          <tbody>
            {memberLists === null && (
              <tr><td colSpan={5} style={{ padding: 0 }}><TableSkeleton rows={5} cols={5} /></td></tr>
            )}
            {memberLists !== null && memberRows.length === 0 && (
              <EmptyState colSpan={5} message="No actionable member lists for this period." icon="solar:users-group-rounded-linear" />
            )}
            {memberRows.map((row, i) => (
              <tr key={i}>
                <td className={s.fw600}>{row.cohort}</td>
                <td className={`${s.r} ${s.mono}`}>{row.members}</td>
                <td className={`${s.r} ${s.mono}`}>{row.avg_tcoc}</td>
                <td className={s.r}>{row.avg_raf}</td>
                <td>{row.conditions}</td>
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
    risk: renderRisk,
    chronic: renderChronic,
    bookmarks: renderBookmarks,
    sdoh: renderSdoh,
    detail: renderDetail,
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
