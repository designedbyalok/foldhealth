import { useState, useEffect } from 'react';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import { KpiCard, InsightBanner, Card, ProgressBar, StatusPill, EmptyState, KpiSkeleton, TableSkeleton, ProgressBarSkeleton } from './shared';
import { safeBarItems, safeTableRows, safeConfigData } from './shared.utils';
import { EditableGrid } from './EditableGrid';
import s from '../AnalyticsLayout.module.css';

const TABS = ['Productivity', 'Bottlenecks', 'Team', 'Quality', 'Programs'];

const ROI_PROGRAMS = [
  { prog: 'CCM', members: '4,823 members', saved: '$1,620K', spent: '$450K', roi: '3.6x' },
  { prog: 'TCM', members: '2,156 members', saved: '$980K', spent: '$280K', roi: '3.5x' },
  { prog: 'ED Diversion', members: '1,842 members', saved: '$540K', spent: '$180K', roi: '3.0x' },
  { prog: 'Post-Discharge', members: '3,241 members', saved: '$660K', spent: '$220K', roi: '3.0x' },
];

export function CareView({ showToast, editing = false, resetTick = 0 }) {
  const fetchViewKpis = useAppStore(st => st.fetchViewKpis);
  const fetchViewTable = useAppStore(st => st.fetchViewTable);
  const fetchConfig = useAppStore(st => st.fetchConfig);
  const fetchProgressBars = useAppStore(st => st.fetchProgressBars);
  const period = useAppStore(st => st.analyticsPeriod);

  const [kpiData, setKpiData] = useState(null);
  const [prodByCm, setProdByCm] = useState(null);
  const [prodStrip, setProdStrip] = useState(null);
  const [careQuality, setCareQuality] = useState(null);
  const [programsDetail, setProgramsDetail] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    fetchViewKpis('care').then(d => setKpiData(d || { kpis: [], insight: null }));
    fetchViewTable('care', 'productivity_by_cm').then(d => setProdByCm(d || { columns: [], rows: [] }));
    fetchConfig('care_productivity_strip').then(d => setProdStrip(d || {}));
    fetchProgressBars('care', 'care_quality_metrics').then(d => setCareQuality(d || []));
    fetchViewTable('care', 'programs_detail').then(d => setProgramsDetail(d || { columns: [], rows: [] }));
  }, [period]);

  const kpis = kpiData?.kpis || [];
  const insight = kpiData?.insight || null;
  const safeProdStrip = safeConfigData(prodStrip);
  const stripMetrics = safeProdStrip.metrics || [];
  const cmRows = safeTableRows(prodByCm);

  return (
    <>
      {/* Insight Banner */}
      {insight ? (
        <InsightBanner icon={insight.icon} title={insight.title} variant={insight.variant} text={insight.text} buttons={insight.buttons || []} showToast={showToast} />
      ) : (
        <InsightBanner
          icon="solar:pulse-2-linear"
          title="Care Management Command Center"
          text="Caseload: <strong>1,856 open cases / 8 staff</strong>. CCM saved <strong>$1.62M</strong> (3.6x ROI). TCM 48h adherence: <strong>82%</strong> (target 85%). <strong>127 overdue cases</strong> need attention. Top performer: <strong>Sarah Chen</strong> &mdash; 78% engagement."
          buttons={[]}
          showToast={showToast}
        />
      )}

      {/* Program ROI Strip */}
      <div className={s.roiStrip}>
        {ROI_PROGRAMS.map((r, i) => (
          <div key={i} className={s.roiCard}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-500)' }}>{r.prog}</div>
            <div style={{ fontSize: 12, color: 'var(--neutral-200)', marginTop: 2 }}>{r.members}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Saved</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--status-success)' }}>{r.saved}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Spent</span>
              <span style={{ fontSize: 12, color: 'var(--neutral-300)' }}>{r.spent}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--primary-300)', marginTop: 4 }}>ROI {r.roi}</div>
          </div>
        ))}
      </div>

      <div className={s.tabRow}>
        {TABS.map((t, i) => (
          <button key={t} className={`${s.tab} ${tab === i ? s.active : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {tab === 0 && <ProductivityTab stripMetrics={stripMetrics} cmRows={cmRows} prodByCmLoading={prodByCm === null} showToast={showToast} editing={editing} resetTick={resetTick} />}
      {tab === 1 && <BottlenecksTab showToast={showToast} editing={editing} resetTick={resetTick} />}
      {tab === 2 && <TeamTab showToast={showToast} editing={editing} resetTick={resetTick} />}
      {tab === 3 && <QualityTab bars={careQuality} showToast={showToast} editing={editing} resetTick={resetTick} />}
      {tab === 4 && <ProgramsTab showToast={showToast} programsDetail={programsDetail} programsLoading={programsDetail === null} editing={editing} resetTick={resetTick} />}
    </>
  );
}

// ── ProductivityTab ────────────────────────────────────────────────────
const PRODUCTIVITY_STORAGE_KEY = 'analytics-care-productivity-layout-v2';
const PRODUCTIVITY_DEFAULT_LAYOUT = [
  { i: 'prodStrip',  x: 0, y: 0,  w: 12, h: 5, minW: 6, minH: 3, maxW: 12, maxH: 10 },
  { i: 'cases',      x: 0, y: 5,  w: 12, h: 3, minW: 6, minH: 2, maxW: 12, maxH: 6  },
  { i: 'cmTable',    x: 0, y: 8,  w: 12, h: 9, minW: 6, minH: 5, maxW: 12, maxH: 20 },
];

const DEFAULT_PRODUCTIVITY_METRICS = [
  { label: 'Calls Completed', val: '2,847', target: '3,000', delta: '+5.2%', cls: 'g' },
  { label: 'Successful Contacts', val: '1,892', target: '2,100', delta: '+8.1%', cls: 'g' },
  { label: 'Touches / Member / Mo', val: '4.2', target: '5', delta: '-3.1%', cls: 'r' },
  { label: 'CCM Minutes', val: '142,500', target: '150,000', delta: '+12.4%', cls: 'g' },
  { label: 'TCM Within 48h', val: '82%', target: '85%', delta: '+4.5%', cls: 't' },
  { label: 'Follow-Up Adherence', val: '78%', target: '85%', delta: '+6.3%', cls: 't' },
];

const PRODUCTIVITY_CASES = [
  { label: 'Cases Closed', value: '423', color: 'var(--status-success)' },
  { label: 'Cases Open', value: '1,856', color: 'var(--neutral-500)' },
  { label: 'Overdue Cases', value: '127', color: 'var(--status-error)' },
];

function ProductivityTab({ stripMetrics, cmRows, prodByCmLoading, showToast, editing = false, resetTick = 0 }) {
  // Productivity metrics strip
  const metrics = stripMetrics.length > 0 ? stripMetrics : DEFAULT_PRODUCTIVITY_METRICS;

  const cases = PRODUCTIVITY_CASES;

  const renderProdStrip = () => (
    <div className={s.prodStrip}>
      {metrics.map((m, i) => {
        const dc = m.cls === 'g' ? 'var(--status-success)' : m.cls === 'r' ? 'var(--status-error)' : 'var(--status-warning)';
        return (
          <div key={i} className={s.prodCard}>
            <div className={s.prodLabel}>{m.label}</div>
            <div className={s.prodVal}>{m.val}<span className={s.prodTarget}> / {m.target}</span></div>
            <div style={{ fontSize: 12, fontWeight: 500, color: dc, marginTop: 2 }}>{m.delta} vs last mo</div>
          </div>
        );
      })}
    </div>
  );

  const renderCases = () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {cases.map((c, i) => (
        <button key={i} type="button" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 8, flex: '1 1 200px', cursor: 'pointer', textAlign: 'left' }}
          onClick={() => c.label === 'Overdue Cases' ? showToast?.('Viewing 127 overdue cases') : showToast?.('Loading case list...')}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 500, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{c.label}</div>
          </div>
        </button>
      ))}
    </div>
  );

  const renderCmTable = () => (
    <Card title="Productivity by Care Manager" flush>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Care Manager</th><th className={s.r}>Calls</th><th className={s.r}>Contacts</th><th className={s.r}>CCM Min</th><th className={s.r}>TCM 48h</th><th className={s.r}>Follow-Up</th><th>Status</th></tr>
          </thead>
          <tbody>
            {prodByCmLoading && (
              <tr><td colSpan={7} style={{ padding: 0 }}><TableSkeleton rows={5} cols={7} /></td></tr>
            )}
            {!prodByCmLoading && (cmRows || []).length === 0 && (
              <EmptyState colSpan={7} message="No care manager productivity data for this period." icon="solar:users-group-rounded-linear" />
            )}
            {(cmRows || []).map((row, i) => {
              const st = row.status;
              return (
                <tr key={i}>
                  <td className={s.fw600}>{row.name}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.calls}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.contacts}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.ccm_min}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.tcm_48h}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.follow_up}</td>
                  <td><StatusPill label={st === 'green' ? 'On Track' : 'Behind'} variant={st} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const RENDERERS = {
    prodStrip: renderProdStrip,
    cases: renderCases,
    cmTable: renderCmTable,
  };

  return (
    <EditableGrid
      storageKey={PRODUCTIVITY_STORAGE_KEY}
      defaultLayout={PRODUCTIVITY_DEFAULT_LAYOUT}
      renderers={RENDERERS}
      editing={editing}
      resetTick={resetTick}
    />
  );
}

// ── BottlenecksTab ─────────────────────────────────────────────────────
const BOTTLENECKS_STORAGE_KEY = 'analytics-care-bottlenecks-layout-v2';
const BOTTLENECKS_DEFAULT_LAYOUT = [
  { i: 'funnel',   x: 0, y: 0, w: 6,  h: 9, minW: 4, minH: 5, maxW: 12, maxH: 20 },
  { i: 'leakage',  x: 6, y: 0, w: 6,  h: 9, minW: 4, minH: 5, maxW: 12, maxH: 20 },
  { i: 'alerts',   x: 0, y: 9, w: 12, h: 3, minW: 6, minH: 2, maxW: 12, maxH: 6  },
];

const FUNNEL_STAGES = [
  { label: 'Identified', n: 4286, pct: 100 },
  { label: 'Outreach Attempted', n: 3214, pct: 75, drop: '-25%' },
  { label: 'Contacted', n: 2142, pct: 50, drop: '-33%' },
  { label: 'Consented', n: 1499, pct: 35, drop: '-30%' },
  { label: 'Enrolled', n: 1071, pct: 25, drop: '-29%' },
  { label: 'Active (90d+)', n: 642, pct: 15, drop: '-40%' },
];

const LEAKAGE_POINTS = [
  { step: 'Outreach → Contact', reason: 'Unable to reach member', n: '1,072', drop: '33%', rec: 'Optimize outreach timing — best contact window 10am–12pm Tue/Wed', cls: 'r' },
  { step: 'Contact → Consent', reason: 'Declined enrollment', n: '643', drop: '30%', rec: 'Review value proposition script — peer success stories', cls: 'a' },
  { step: 'Consent → Enrolled', reason: 'Documentation incomplete', n: '428', drop: '29%', rec: 'Streamline e-consent paperwork — digital signature integration', cls: 'a' },
  { step: 'Enrolled → Active', reason: 'Lost to follow-up', n: '429', drop: '40%', rec: 'Early engagement protocol — Week 1 check-in within 48 hours', cls: 'r' },
];

const BOTTLENECK_ALERTS = [
  { label: 'Overdue TCM Calls', n: '47', color: 'var(--status-error)' },
  { label: 'Pending Consents', n: '123', color: 'var(--status-warning)' },
  { label: 'At-Risk Members', n: '89', color: 'var(--status-error)' },
];

function BottlenecksTab({ showToast, editing = false, resetTick = 0 }) {
  const funnelStages = FUNNEL_STAGES;
  const leakagePoints = LEAKAGE_POINTS;
  const alerts = BOTTLENECK_ALERTS;

  const renderFunnel = () => (
    <Card title="Enrollment Funnel Drop-off Analysis" sub="Overall conversion: 15.0%">
      {funnelStages.map((stage, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--neutral-50)' }}>
          <div style={{ width: 140, fontSize: 12, fontWeight: 500 }}>{stage.label}</div>
          <div style={{ flex: 1, height: 20, background: 'var(--neutral-50)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${stage.pct}%`, height: '100%', background: stage.pct < 25 ? 'var(--status-success)' : stage.pct < 50 ? 'var(--status-info)' : 'var(--status-info)', borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-0)' }}>{stage.n.toLocaleString()}</span>
            </div>
          </div>
          {stage.drop && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--status-error)', width: 40 }}>{stage.drop}</span>}
        </div>
      ))}
    </Card>
  );

  const renderLeakage = () => (
    <Card title="Process Leakage Points">
      {leakagePoints.map((lp, i) => {
        const rc = lp.cls === 'r' ? 'var(--status-error)' : 'var(--status-warning)';
        return (
          <div key={i} style={{ padding: '10px 12px', background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{lp.step}</div>
                <div style={{ fontSize: 12, color: 'var(--neutral-200)', marginTop: 2 }}>{lp.reason}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: rc }}>{lp.n}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: rc }}>{lp.drop} drop-off</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--status-info)', marginTop: 8 }}><strong>Recommended:</strong> {lp.rec}</div>
          </div>
        );
      })}
    </Card>
  );

  const renderAlerts = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {alerts.map((a, i) => (
        <button key={i} type="button" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => showToast?.(`Viewing ${a.n} ${a.label.toLowerCase()}`)}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 500, color: a.color }}>{a.n}</div>
            <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{a.label}</div>
          </div>
        </button>
      ))}
    </div>
  );

  const RENDERERS = {
    funnel: renderFunnel,
    leakage: renderLeakage,
    alerts: renderAlerts,
  };

  return (
    <EditableGrid
      storageKey={BOTTLENECKS_STORAGE_KEY}
      defaultLayout={BOTTLENECKS_DEFAULT_LAYOUT}
      renderers={RENDERERS}
      editing={editing}
      resetTick={resetTick}
    />
  );
}

// ── TeamTab ────────────────────────────────────────────────────────────
const TEAM_STORAGE_KEY = 'analytics-care-team-layout-v2';
const TEAM_DEFAULT_LAYOUT = [
  { i: 'topPerformers', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6, maxW: 12, maxH: 20 },
  { i: 'needsSupport',  x: 6, y: 0, w: 6, h: 12, minW: 4, minH: 6, maxW: 12, maxH: 20 },
];

// Hoisted out of TeamTab so it isn't redefined (and remounted) every render.
const StaffCard = ({ staff, isBottom, showToast }) => {
  const bg = isBottom ? 'var(--status-warning-light)' : 'var(--status-success-light)';
  const rkColor = isBottom ? 'var(--status-warning)' : 'var(--status-success)';
  const trendColor = staff.trend === '↑' ? 'var(--status-success)' : staff.trend === '↓' ? 'var(--status-error)' : 'var(--neutral-200)';
  return (
    <button type="button" style={{ display: 'block', width: '100%', padding: '10px 12px', background: bg, borderRadius: 8, marginBottom: 6, cursor: 'pointer', textAlign: 'left' }}
      onClick={() => showToast?.(`Viewing ${staff.name} detail`)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: rkColor, color: 'var(--neutral-0)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>#{staff.rank}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{staff.name}</div>
          <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{staff.role}</div>
        </div>
        <span style={{ fontSize: 16, color: trendColor }}>{staff.trend}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: staff.engage > 70 ? 'var(--status-success)' : staff.engage > 55 ? 'var(--status-warning)' : 'var(--status-error)' }}>{staff.engage}%</div>
          <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Engage</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: staff.tcm > 80 ? 'var(--status-success)' : staff.tcm > 65 ? 'var(--status-warning)' : 'var(--status-error)' }}>{staff.tcm}%</div>
          <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>TCM Adh.</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{staff.caseload}</div>
          <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Caseload</div>
        </div>
      </div>
      {isBottom && <div style={{ fontSize: 12, color: 'var(--status-warning)', marginTop: 6 }}>Low contact rate &middot; TCM gaps &middot; High-risk challenges</div>}
    </button>
  );
};

const TOP_PERFORMERS = [
  { name: 'Sarah Chen', role: 'Senior Care Manager', rank: 1, engage: 78, tcm: 91, caseload: 48, trend: '↑' },
  { name: 'Michael Torres', role: 'Care Manager', rank: 2, engage: 75, tcm: 88, caseload: 44, trend: '↑' },
  { name: 'Emily Rodriguez', role: 'Care Manager', rank: 3, engage: 72, tcm: 85, caseload: 46, trend: '→' },
  { name: 'James Wilson', role: 'Care Coordinator', rank: 4, engage: 68, tcm: 82, caseload: 42, trend: '↑' },
  { name: 'Lisa Park', role: 'Care Manager', rank: 5, engage: 66, tcm: 79, caseload: 50, trend: '↓' },
];

const NEEDS_SUPPORT = [
  { name: 'David Kim', role: 'Care Coordinator', rank: 16, engage: 52, tcm: 68, caseload: 40, trend: '↓' },
  { name: 'Amanda Foster', role: 'Care Manager', rank: 17, engage: 48, tcm: 62, caseload: 37, trend: '↓' },
  { name: 'Robert Chang', role: 'Care Coordinator', rank: 18, engage: 45, tcm: 58, caseload: 35, trend: '↓' },
];

function TeamTab({ showToast, editing = false, resetTick = 0 }) {
  const topPerformers = TOP_PERFORMERS;
  const needsSupport = NEEDS_SUPPORT;

  const renderTopPerformers = () => (
    <Card title={<span>&#x1F3C6; Top Performers</span>}>
      {topPerformers.map(st => <StaffCard key={st.name} staff={st} isBottom={false} showToast={showToast} />)}
    </Card>
  );

  const renderNeedsSupport = () => (
    <Card title={<span>&#x26A0; Needs Support</span>} style={{ border: '1px solid var(--status-warning-light)' }}>
      {needsSupport.map(st => <StaffCard key={st.name} staff={st} isBottom={true} showToast={showToast} />)}
      <Button variant="primary" size="S" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={() => showToast?.('Scheduling coaching sessions for 3 staff')}>
        Schedule Support Sessions (3)
      </Button>
    </Card>
  );

  const RENDERERS = {
    topPerformers: renderTopPerformers,
    needsSupport: renderNeedsSupport,
  };

  return (
    <EditableGrid
      storageKey={TEAM_STORAGE_KEY}
      defaultLayout={TEAM_DEFAULT_LAYOUT}
      renderers={RENDERERS}
      editing={editing}
      resetTick={resetTick}
    />
  );
}

// ── QualityTab ─────────────────────────────────────────────────────────
const QUALITY_STORAGE_KEY = 'analytics-care-quality-layout-v2';
const QUALITY_DEFAULT_LAYOUT = [
  { i: 'qualityScores',    x: 0, y: 0,  w: 6,  h: 9, minW: 4, minH: 5, maxW: 12, maxH: 20 },
  { i: 'complianceIssues', x: 6, y: 0,  w: 6,  h: 9, minW: 4, minH: 5, maxW: 12, maxH: 20 },
  { i: 'pathways',         x: 0, y: 9,  w: 12, h: 9, minW: 6, minH: 5, maxW: 12, maxH: 20 },
  { i: 'additionalQuality', x: 0, y: 18, w: 12, h: 7, minW: 6, minH: 4, maxW: 12, maxH: 20 },
];

const QUALITY_SCORES = [
  { label: 'Call Quality', value: '86%', delta: '+3.2% vs last period', color: 'var(--status-success)' },
  { label: 'Documentation Accuracy', value: '92%', delta: '+1.5% vs last period', color: 'var(--status-success)' },
  { label: 'Care Plan Completeness', value: '78%', delta: '-2.1% vs last period', color: 'var(--status-error)' },
  { label: 'Patient Satisfaction', value: '88%', delta: '+4.2% vs last period', color: 'var(--status-success)' },
];

const COMPLIANCE_ISSUES = [
  { issue: 'Late TCM contacts (>48h)', assigned: 'Michael T., Lisa P.', n: 47, severity: 'high' },
  { issue: 'Missing care plan documentation', assigned: 'David K., Amanda F.', n: 23, severity: 'medium' },
  { issue: 'Overdue follow-up calls', assigned: 'Robert C., James W.', n: 34, severity: 'high' },
  { issue: 'Incomplete consent forms', assigned: 'Emily R.', n: 12, severity: 'low' },
];

const PATHWAYS = [
  { name: 'CCM Pathway', rate: 84, target: 85, delta: '+6.1%' },
  { name: 'TCM Pathway', rate: 79, target: 85, delta: '+5.8%' },
  { name: 'ED Diversion Pathway', rate: 88, target: 90, delta: '+4.2%' },
  { name: 'Post-Discharge', rate: 81, target: 85, delta: '+7.2%' },
];

function QualityTab({ bars, showToast, editing = false, resetTick = 0 }) {
  const items = safeBarItems(bars);

  const qualityScores = QUALITY_SCORES;
  const complianceIssues = COMPLIANCE_ISSUES;
  const pathways = PATHWAYS;

  const renderQualityScores = () => (
    <Card title="Quality Scores">
      {qualityScores.map((q, i) => {
        const dc = q.delta.startsWith('+') ? 'var(--status-success)' : 'var(--status-error)';
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--neutral-50)' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 12 }}>{q.label}</div>
              <div style={{ fontSize: 12, color: dc, marginTop: 2 }}>{q.delta}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 500, color: q.color }}>{q.value}</div>
          </div>
        );
      })}
    </Card>
  );

  const renderComplianceIssues = () => (
    <Card title={<span>&#x26A0; Compliance Issues</span>} style={{ border: '1px solid var(--status-warning-light)' }}
      actions={<Button variant="primary" size="S" style={{ fontSize: 12 }} onClick={() => showToast?.('Compliance alerts sent to managers')}>Alert All</Button>}
    >
      {complianceIssues.map((c, i) => {
        const sc = c.severity === 'high' ? 'var(--status-error)' : c.severity === 'medium' ? 'var(--status-warning)' : 'var(--status-success)';
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--neutral-50)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 12 }}>{c.issue}</div>
              <div style={{ fontSize: 12, color: 'var(--neutral-200)', marginTop: 2 }}>Assigned: {c.assigned}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 12 }}>
              <span className={`${s.stPill} ${c.severity === 'high' ? s.stRed : c.severity === 'medium' ? s.stAmber : s.stGreen}`}>{c.severity}</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: sc }}>{c.n}</span>
            </div>
          </div>
        );
      })}
    </Card>
  );

  const renderPathways = () => (
    <Card title="Process Adherence by Pathway">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {pathways.map((p, i) => {
          const vc = p.rate >= p.target ? 'var(--status-success)' : p.rate >= p.target - 5 ? 'var(--status-warning)' : 'var(--status-error)';
          return (
            <div key={i} style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 500, color: vc }}>{p.rate}%</div>
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--neutral-200)', marginTop: 2 }}>Target: {p.target}%</div>
              <div style={{ fontSize: 12, color: 'var(--status-success)', marginTop: 3 }}>{'↑'} {p.delta}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <ProgressBar label="Coleman Model Compliance" value="78% of TCM episodes" pct={78} color="teal" sub="Target 85% — 7pp gap" />
        <ProgressBar label="Care Plan Update Timeliness" value="72% updated within 30 days" pct={72} color="amber" sub="Target 90%" />
        <ProgressBar label="Medication Reconciliation" value="68% at enrollment" pct={68} color="amber" sub="Target 75%" />
      </div>
    </Card>
  );

  // Hide the card entirely when there are no items. EditableGrid drops
  // null renderers and re-flows the grid.
  const renderAdditionalQuality = () => items.length === 0 ? null : (
    <Card title="Additional Quality Metrics">
      {items.map(b => (
        <ProgressBar key={b.label} label={b.label} value={b.value} pct={b.pct} color={b.color} sub={b.sub} />
      ))}
    </Card>
  );

  const RENDERERS = {
    qualityScores: renderQualityScores,
    complianceIssues: renderComplianceIssues,
    pathways: renderPathways,
    additionalQuality: renderAdditionalQuality,
  };

  return (
    <EditableGrid
      storageKey={QUALITY_STORAGE_KEY}
      defaultLayout={QUALITY_DEFAULT_LAYOUT}
      renderers={RENDERERS}
      editing={editing}
      resetTick={resetTick}
    />
  );
}

// ── ProgramsTab ────────────────────────────────────────────────────────
const PROGRAMS_STORAGE_KEY = 'analytics-care-programs-layout-v2';
const PROGRAMS_DEFAULT_LAYOUT = [
  { i: 'programsTable', x: 0, y: 0,  w: 12, h: 10, minW: 6, minH: 5, maxW: 12, maxH: 20 },
  { i: 'summaryStrip',  x: 0, y: 10, w: 12, h: 3,  minW: 6, minH: 2, maxW: 12, maxH: 6  },
  { i: 'programCards',  x: 0, y: 13, w: 12, h: 20, minW: 6, minH: 8, maxW: 12, maxH: 40 },
];

const PROGRAMS_DATA = [
  { name: 'Chronic Care Management', abbr: 'CCM', color: 'var(--status-info)', members: 4823, eligible: 6100, enrolled: 79, saved: '$1,620K', spent: '$450K', roi: '3.6x',
    kpis: [['Monthly Minutes Avg','38 min','≥20 min','g'],['Monthly Review Plan %','71%','85%','a'],['1st Month Contact Rate','84%','80%','g'],['Care Plan Update Rate','58%','75%','r']],
    alert: '312 eligible members not yet enrolled — $390K revenue opportunity' },
  { name: 'Transitional Care', abbr: 'TCM', color: 'var(--status-success)', members: 2156, eligible: 2480, enrolled: 87, saved: '$980K', spent: '$280K', roi: '3.5x',
    kpis: [['48h Contact Rate','82%','85%','t'],['7-Day F/U Completion','88%','85%','g'],['Med Reconciliation','68%','75%','a'],['30-Day Readmit','14.2%','15%','g']],
    alert: '47 overdue TCM contacts — readmission risk elevated' },
  { name: 'TOC — Inpatient', abbr: 'TOC-IP', color: 'var(--primary-300)', members: 1284, eligible: 1410, enrolled: 91, saved: '$740K', spent: '$190K', roi: '3.9x',
    kpis: [['PCP F/U Within 7d','72%','80%','a'],['Discharge Summary','89%','95%','a'],['30-Day Readmit','16.8%','15%','r'],['SNF Placement','18%','<20%','g']],
    alert: '24 readmissions this month — 3 facilities driving 71%' },
  { name: 'TOC — ED', abbr: 'TOC-ED', color: 'var(--status-error)', members: 1842, eligible: 2100, enrolled: 88, saved: '$540K', spent: '$180K', roi: '3.0x',
    kpis: [['Avoidable ED Rate','34%','<30%','r'],['Post-ED Contact <48h','78%','85%','a'],['ED → PCP Redirect','61%','70%','a'],['Repeat ED (≥3/yr)','12%','<10%','r']],
    alert: '221 high-ED utilizers (3+ visits/yr) — top cost driver' },
  { name: 'Quality Program', abbr: 'Quality', color: 'var(--status-warning)', members: 8420, eligible: 8420, enrolled: 100, saved: '$840K', spent: '$220K', roi: '3.8x',
    kpis: [['Quality Composite','4.1/5.0','4.0','g'],['AWV Completion','61%','80%','r'],['HbA1c Control','72%','70%','g'],['Colorectal Screening','58%','65%','r']],
    alert: '847 members unscheduled for AWV — biggest drag on composite' },
  { name: 'Annual Wellness Visit', abbr: 'AWV', color: 'var(--status-info)', members: 5120, eligible: 8420, enrolled: 61, saved: '$620K', spent: '$160K', roi: '3.9x',
    kpis: [['Completion Rate','61%','80%','r'],['Codes/AWV','2.4','3.2','a'],['HCC Suspects Closed','42%','60%','r'],['Quality Gaps Closed','2.8','3.2','a']],
    alert: '847 members overdue for AWV — $127K revenue + quality impact' },
  { name: 'Risk Coding / HCC', abbr: 'Risk Coding', color: 'var(--status-warning)', members: 5280, eligible: 8420, enrolled: 63, saved: '$2,100K', spent: '$380K', roi: '5.5x',
    kpis: [['RAF Capture Rate','73%','85%','r'],['Avg RAF Score','1.042','1.120','a'],['Suspects Closed/AWV','2.4','3.2','a'],['Recapture Rate','71%','80%','a']],
    alert: '962 open HCC suspects — $2.1M uncaptured revenue' },
  { name: 'Health Risk Assessment', abbr: 'HRA', color: 'var(--status-success)', members: 3840, eligible: 8420, enrolled: 46, saved: '$410K', spent: '$90K', roi: '4.6x',
    kpis: [['Completion Rate','46%','70%','r'],['High-Risk Identified','22%','—','t'],['SDOH Positive Screen','31%','—','t'],['HRA → AWV Conversion','54%','65%','a']],
    alert: '4,580 eligible members without completed HRA this year' },
];

const PROGRAMS_SUMMARY_STRIP = [
  ['Total in Programs', '11,062', 'var(--status-info)'],
  ['Total Savings', '$7.3M', 'var(--status-success)'],
  ['Total Spend', '$1.95M', 'var(--status-warning)'],
  ['Blended ROI', '3.7x', 'var(--status-success)'],
];

function renderProgramsSummaryStrip() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '12px 16px', background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 8 }}>
      {PROGRAMS_SUMMARY_STRIP.map(([label, val, c], i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 500, color: c }}>{val}</div>
          <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function ProgramsTab({ showToast, programsDetail, programsLoading, editing = false, resetTick = 0 }) {
  const pdRows = safeTableRows(programsDetail);
  const programs = PROGRAMS_DATA;

  const renderProgramsTable = () => (
    <Card title="Programs Detail" flush actions={<Button variant="ghost" size="S" onClick={() => showToast?.('Exporting programs detail...')}>Export</Button>}>
      <div className={s.tblWrap}>
        <table className={s.tbl}>
          <thead>
            <tr><th>Program</th><th className={s.r}>Eligible</th><th className={s.r}>Engaged</th><th>Last Outreach</th><th>Pref Mode</th><th>Language</th><th>Pref Day</th><th className={s.r}>Outreach%</th><th className={s.r}>Engage%</th><th>Action</th></tr>
          </thead>
          <tbody>
            {programsLoading && (
              <tr><td colSpan={10} style={{ padding: 0 }}><TableSkeleton rows={5} cols={10} /></td></tr>
            )}
            {!programsLoading && pdRows.length === 0 && (
              <EmptyState colSpan={10} message="No programs detail for this period." icon="solar:clipboard-list-linear" />
            )}
            {pdRows.map((row, i) => {
              const engColor = parseInt(row.engage_pct) >= 85 ? 'green' : parseInt(row.engage_pct) >= 70 ? 'amber' : 'red';
              return (
                <tr key={i}>
                  <td className={s.fw600}>{row.program}</td>
                  <td className={`${s.r} ${s.mono}`}>{typeof row.eligible === 'number' ? row.eligible.toLocaleString() : row.eligible}</td>
                  <td className={`${s.r} ${s.mono}`}>{typeof row.engaged === 'number' ? row.engaged.toLocaleString() : row.engaged}</td>
                  <td className={s.mono}>{row.last_outreach}</td>
                  <td>{row.pref_mode}</td>
                  <td>{row.language}</td>
                  <td>{row.pref_day}</td>
                  <td className={`${s.r} ${s.mono}`}>{row.outreach_pct}</td>
                  <td className={`${s.r}`}><span className={`${s.stPill} ${engColor === 'green' ? s.stGreen : engColor === 'amber' ? s.stAmber : s.stRed}`}>{row.engage_pct}</span></td>
                  <td><Button variant="ghost" size="S" onClick={() => showToast?.(`${row.action} ${row.program}`)}>{row.action}</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const renderProgramCards = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {programs.map((p, i) => {
        const enrollColor = p.enrolled < 60 ? 'var(--status-error)' : p.enrolled < 75 ? 'var(--status-warning)' : 'var(--status-success)';
        return (
          <Card key={i} style={{ borderLeft: `4px solid ${p.color}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {p.name} <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: p.color + '20', color: p.color, fontWeight: 500 }}>{p.abbr}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center', marginBottom: 8 }}>
              <div><div style={{ fontSize: 14, fontWeight: 500, color: enrollColor }}>{p.enrolled}%</div><div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Enrolled</div></div>
              <div><div style={{ fontSize: 14, fontWeight: 500 }}>{p.members.toLocaleString()}</div><div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Members</div></div>
              <div><div style={{ fontSize: 14, fontWeight: 500, color: 'var(--status-success)' }}>{p.saved}</div><div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Saved</div></div>
              <div><div style={{ fontSize: 14, fontWeight: 500, color: p.color }}>{p.roi}</div><div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>ROI</div></div>
            </div>
            <div style={{ background: 'var(--neutral-50)', borderRadius: 2, height: 4, marginBottom: 8 }}>
              <div style={{ height: 4, borderRadius: 2, background: enrollColor, width: `${p.enrolled}%` }} />
            </div>
            {p.kpis.map(([label, val, target, cl], j) => {
              const vc = cl === 'g' ? 'var(--status-success)' : cl === 'r' ? 'var(--status-error)' : cl === 'a' ? 'var(--status-warning)' : 'var(--neutral-300)';
              return (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
                  <span style={{ color: 'var(--neutral-300)' }}>{label}</span>
                  <span><span style={{ fontWeight: 500, color: vc }}>{val}</span> <span style={{ color: 'var(--neutral-200)' }}>/ {target}</span></span>
                </div>
              );
            })}
            <div style={{ fontSize: 12, color: 'var(--status-warning)', marginTop: 6, padding: '6px 8px', background: 'var(--status-warning-light)', borderRadius: 4 }}>
              {'●'} {p.alert}
            </div>
          </Card>
        );
      })}
    </div>
  );

  const RENDERERS = {
    programsTable: renderProgramsTable,
    summaryStrip: renderProgramsSummaryStrip,
    programCards: renderProgramCards,
  };

  return (
    <EditableGrid
      storageKey={PROGRAMS_STORAGE_KEY}
      defaultLayout={PROGRAMS_DEFAULT_LAYOUT}
      renderers={RENDERERS}
      editing={editing}
      resetTick={resetTick}
    />
  );
}
