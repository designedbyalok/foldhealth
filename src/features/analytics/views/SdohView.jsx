import { useState, useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { KpiCard, InsightBanner, Card, StatusPill, EmptyState, KpiSkeleton, TableSkeleton } from './shared';
import { safeTableRows } from './shared.utils';
import { EditableGrid } from './EditableGrid';
import s from '../AnalyticsLayout.module.css';

// v3 adds the UDS social-risk card (care plan SDOH needs).
const STORAGE_KEY = 'analytics-sdoh-layout-v3';

const DEFAULT_LAYOUT = [
  { i: 'insight',   x: 0, y: 0,  w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5  },
  { i: 'kpis',      x: 0, y: 3,  w: 12, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 5  },
  { i: 'uds',       x: 0, y: 6,  w: 12, h: 9, minW: 6, minH: 6, maxW: 12, maxH: 16 },
  { i: 'equity',    x: 0, y: 15, w: 12, h: 8, minW: 6, minH: 5, maxW: 12, maxH: 16 },
  { i: 'risks',     x: 0, y: 23, w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 16 },
  { i: 'referrals', x: 6, y: 23, w: 6,  h: 8, minW: 4, minH: 5, maxW: 12, maxH: 16 },
];

export function SdohView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const period = useAppStore(st => st.analyticsPeriod);

  const [kpiData, setKpiData] = useState(null);
  const [equityByRace, setEquityByRace] = useState(null);
  const [sdohRiskFactors, setSdohRiskFactors] = useState(null);
  const [communityReferrals, setCommunityReferrals] = useState(null);
  const socialRisk = useAppStore(st => st.sdohSocialRisk);
  const fetchSdohSocialRisk = useAppStore(st => st.fetchSdohSocialRisk);
  useEffect(() => { fetchSdohSocialRisk(); }, [fetchSdohSocialRisk]);

  useEffect(() => {
    fetchViewKpis('sdoh').then(d => setKpiData(d || { kpis: [], insight: null }));
    fetchViewTable('sdoh', 'equity_by_race').then(d => setEquityByRace(d || { columns: [], rows: [] }));
    fetchViewTable('sdoh', 'sdoh_risk_factors').then(d => setSdohRiskFactors(d || { columns: [], rows: [] }));
    fetchViewTable('sdoh', 'community_referrals').then(d => setCommunityReferrals(d || { columns: [], rows: [] }));
  }, [period]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const equityRows = safeTableRows(equityByRace);
  const riskRows = safeTableRows(sdohRiskFactors);
  const referralRows = safeTableRows(communityReferrals);

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

  const renderEquity = () => (
    <Card title="Health Equity Dashboard" sub="Quality measures by race/ethnicity" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Measure</th><th className={s.r}>Overall Rate</th><th className={s.r}>White</th><th className={s.r}>Black</th><th className={s.r}>Hispanic</th><th className={s.r}>Asian</th><th className={s.r}>Disparity Gap</th><th>Status</th></tr>
          </thead>
          <tbody>
            {equityByRace === null && (
              <tr><td colSpan={8} style={{ padding: 0 }}><TableSkeleton rows={5} cols={8} /></td></tr>
            )}
            {equityByRace !== null && equityRows.length === 0 && (
              <EmptyState colSpan={8} message="No equity-by-race data for this period." icon="solar:users-group-rounded-linear" />
            )}
            {equityRows.map((row, i) => {
              const gapNum = parseInt((row.gap || '').replace('pp', ''));
              const st = gapNum >= 16 ? 'red' : gapNum >= 12 ? 'amber' : 'green';
              const nums = [row.white, row.black, row.hispanic, row.asian, row.other].map(v => parseInt((v || '0').replace('%', '')));
              const overall = Math.round(nums.reduce((a, b) => a + b, 0) / nums.filter(n => !isNaN(n)).length);
              return (
                <tr key={i}>
                  <td className={s.fw600}>{row.measure}</td>
                  <td className={`${s.r} ${s.mono}`}>{overall}%</td>
                  <td className={`${s.r} ${s.mono}`}>{row.white}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.black}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.hispanic}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.asian}</td>
                  <td className={`${s.r} ${s.valR}`}>{row.gap}</td>
                  <td><StatusPill label={st === 'red' ? 'Action Needed' : st === 'amber' ? 'Monitor' : 'On Track'} variant={st} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderRisks = () => (
    <Card title="SDoH Risk Factors" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Risk Factor</th><th className={s.r}>Members</th><th className={s.r}>% of Pop</th><th className={s.r}>TCOC Impact</th><th className={s.r}>Referral Rate</th></tr>
          </thead>
          <tbody>
            {sdohRiskFactors === null && (
              <tr><td colSpan={5} style={{ padding: 0 }}><TableSkeleton rows={5} cols={5} /></td></tr>
            )}
            {sdohRiskFactors !== null && riskRows.length === 0 && (
              <EmptyState colSpan={5} message="No SDoH risk factors for this period." icon="solar:danger-triangle-linear" />
            )}
            {riskRows.map((row, i) => (
              <tr key={i}>
                <td className={s.fw600}>{row.factor}</td>
                <td className={`${s.r} ${s.mono}`}>{row.members}</td>
                <td className={`${s.r} ${s.mono}`}>{row.pct}</td>
                <td className={`${s.r} ${s.valR}`}>{row.tcoc_impact}</td>
                <td className={`${s.r} ${s.mono}`}>{row.referral_rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderReferrals = () => (
    <Card title="Community Referral Network" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Organization</th><th>Service</th><th className={s.r}>Referrals</th><th className={s.r}>Completion</th><th>Status</th></tr>
          </thead>
          <tbody>
            {communityReferrals === null && (
              <tr><td colSpan={5} style={{ padding: 0 }}><TableSkeleton rows={5} cols={5} /></td></tr>
            )}
            {communityReferrals !== null && referralRows.length === 0 && (
              <EmptyState colSpan={5} message="No community referral data for this period." icon="solar:hand-heart-linear" />
            )}
            {referralRows.map((row, i) => {
              const st = row.status;
              return (
                <tr key={i}>
                  <td className={s.fw600}>{row.org}</td>
                  <td>{row.service}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.referrals}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.completion}</td>
                  <td><StatusPill label={st === 'green' ? 'Active' : st === 'amber' ? 'Moderate' : 'Low'} variant={st} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // Live from care plans: SDOH needs (barriers with a domain) and their
  // community referrals, by domain (lib/sdohReport). The period and practice
  // filters don't apply: it reads every plan's current state.
  const renderUds = () => {
    const { status, data } = socialRisk;
    const t = data?.totals;
    return (
      <Card title="UDS Social Risk" sub="Social needs on care plans, by domain · all current plans" flush>
        {(status === 'idle' || status === 'loading') && <TableSkeleton rows={6} cols={6} />}
        {status === 'missing' && (
          <div className={s.tblWrap}><table className={s.tbl}><tbody>
            <EmptyState colSpan={6} message="Needs the care plan SDOH migration (care_plan_sdoh_migration.sql)." icon="solar:database-linear" />
          </tbody></table></div>
        )}
        {status === 'error' && (
          <div className={s.tblWrap}><table className={s.tbl}><tbody>
            <EmptyState colSpan={6} message="Couldn't load care plan social needs." icon="solar:danger-triangle-linear" />
          </tbody></table></div>
        )}
        {status === 'ready' && (
          <div className={s.tblWrap}>
            <table className={s.tbl}>
              <thead>
                <tr><th>Domain</th><th className={s.r}>Patients</th><th className={s.r}>Needs</th><th className={s.r}>Referred</th><th className={s.r}>Closed loop</th><th className={s.r}>Resolved</th></tr>
              </thead>
              <tbody>
                {t.needs === 0 && (
                  <EmptyState colSpan={6} message="No social needs recorded on care plans yet." icon="solar:hand-heart-linear" />
                )}
                {t.needs > 0 && data.domains.map(d => (
                  <tr key={d.key}>
                    <td className={s.fw600}>{d.label}</td>
                    <td className={`${s.r} ${s.mono}`}>{d.patients}</td>
                    <td className={`${s.r} ${s.mono}`}>{d.needs}</td>
                    <td className={`${s.r} ${s.mono}`}>{d.needs ? `${d.referredPct}% (${d.referred})` : '-'}</td>
                    <td className={`${s.r} ${s.mono}`}>{d.referrals ? `${d.closedLoopPct}% (${d.closedLoop}/${d.referrals})` : '-'}</td>
                    <td className={`${s.r} ${s.mono}`}>{d.needs ? `${d.resolvedPct}% (${d.resolved})` : '-'}</td>
                  </tr>
                ))}
                {t.needs > 0 && (
                  <tr>
                    <td className={s.fw600}>All domains</td>
                    <td className={`${s.r} ${s.mono} ${s.fw600}`}>{t.patients}</td>
                    <td className={`${s.r} ${s.mono} ${s.fw600}`}>{t.needs}</td>
                    <td className={`${s.r} ${s.mono} ${s.fw600}`}>{t.referredPct}% ({t.referred})</td>
                    <td className={`${s.r} ${s.mono} ${s.fw600}`}>{t.referrals ? `${t.closedLoopPct}% (${t.closedLoop}/${t.referrals})` : '-'}</td>
                    <td className={`${s.r} ${s.mono} ${s.fw600}`}>{t.resolvedPct}% ({t.resolved})</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  };

  const RENDERERS = {
    insight: renderInsight,
    kpis: renderKpis,
    uds: renderUds,
    equity: renderEquity,
    risks: renderRisks,
    referrals: renderReferrals,
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
