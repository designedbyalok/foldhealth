// What each Analytics dashboard shows on a phone. Every source is the same
// store fetch (and the same key) the desktop view in
// src/features/analytics/views/* calls, so both read the same rows. The
// desktop's drag-and-resize grid, simulators and report builders stay on
// the computer; `desktopOnly` names them so the screen can say so.
import { PAGES, PERSONA_ACCESS, PERSONA_LABELS } from '../../analytics/analyticsData';

/** Every dashboard in desktop nav order, with its section and icon. */
export const DASHBOARDS = PAGES.flatMap(sec => sec.items.map(p => ({ ...p, section: sec.section })));
export const dashboardMeta = (key) => DASHBOARDS.find(d => d.id === key);

/** Same rule as AnalyticsLayout: a persona with a list sees only those. */
export function isDashboardLocked(persona, key) {
  const allowed = PERSONA_ACCESS[persona];
  return allowed != null && !allowed.includes(key);
}
export const lockedMessage = (label, persona) => `${label} is restricted for ${PERSONA_LABELS[persona] || persona} persona`;

// Mirrors AnalyticsLayout's PRACTICES (the Practice chip's options).
export const PRACTICES = [
  { value: 'all', label: 'All Practices' },
  { value: 'patel', label: 'Patel Family Medicine' },
  { value: 'riverside', label: 'Riverside Medical Group' },
  { value: 'valley', label: 'Valley Primary Care' },
  { value: 'lakeview', label: 'Lakeview Health Partners' },
  { value: 'summit', label: 'Summit Internal Medicine' },
];
export const PERIOD_MODES = [
  { key: 'ytd', label: 'YTD' },
  { key: 'r12', label: 'Rolling 12M' },
];

// Views that skip the global slicers on desktop (they have their own filters).
export const NO_SLICER_VIEWS = new Set(['employer', 'pharmacy']);

/** Desktop status values (green / amber / red) as Badge tones. */
export const STATUS_TONE = { green: 'success', amber: 'warning', red: 'danger', ok: 'success', warn: 'warning' };
const labels = (green, amber, red) => (st) => ({ green, amber, red })[st] || amber;

// Desktop view constants with no table behind them yet (RiskView RAF_TREND,
// UtilizationView READMIT_TREND, SharedSavingsView SAVINGS_DATA) and the
// progress-bar fallbacks the desktop shows while the table is empty.
const RAF_TREND = [1.010, 1.014, 1.018, 1.022, 1.025, 1.028, 1.031, 1.034, 1.037, 1.040, 1.041, 1.042];
const READMIT_TREND = [14.2, 14.8, 15.1, 15.8, 14.9, 15.3, 15.8, 16.2, 16.8, 17.1, 17.8, 18.4];
const SAVINGS_DATA = [0, 0.1, 0.2, 0.35, 0.5, 0.62, 0.75, 0.9, 1.0, 1.1, 1.2, 1.32];
const EXEC_QUALITY_FALLBACK = [
  { label: 'AWV Completion', value: '61%', pct: 61, color: 'amber', sub: 'Target 80% · 847 unscheduled' },
  { label: 'Diabetes HbA1c Control', value: '72%', pct: 72, color: 'teal', sub: 'Target 70% ✓' },
  { label: 'BP Control (<140/90)', value: '64%', pct: 64, color: 'purple', sub: 'Target 70%' },
  { label: 'Colorectal Screening', value: '58%', pct: 58, color: 'red', sub: 'Target 65%' },
  { label: 'Depression Screening', value: '83%', pct: 83, color: 'green', sub: 'Target 80% ✓' },
];
const TCM_FALLBACK = [
  { label: 'Readmit w/ TCM Follow-Up', value: '11%', pct: 22, color: 'green', sub: '62% below threshold ✓' },
  { label: 'Readmit w/o TCM Follow-Up', value: '31%', pct: 74, color: 'red', sub: '2.8x higher, urgent gap' },
  { label: 'TCM Completion Rate', value: '72%', pct: 72, color: 'teal', sub: 'Target 80%: 8pp gap' },
  { label: 'TCM Within 7 Days', value: '58%', pct: 58, color: 'amber', sub: 'Target 70%' },
];
const QUAL_COMPOSITE_FALLBACK = [
  { label: 'AWV / Care Coordination', value: '61% / target 80%', pct: 61, color: 'amber', sub: 'Pulling composite down: 847 open AWVs' },
  { label: 'Diabetes HbA1c Control', value: '72% / target 70%', pct: 72, color: 'teal', sub: '✓ On target' },
  { label: 'BP Control', value: '64% / target 70%', pct: 64, color: 'purple', sub: '6pp gap: 504 members' },
  { label: 'Colorectal Screening', value: '58% / target 65%', pct: 58, color: 'red', sub: '7pp gap: 588 members' },
  { label: 'Depression Screening PHQ-9', value: '83% / target 80%', pct: 83, color: 'green', sub: '✓ Above target' },
  { label: 'Statin Therapy, Diabetes', value: '71% / target 75%', pct: 71, color: 'amber', sub: '4pp gap, 336 members' },
  { label: 'Patient Experience CAHPS', value: '4.3 / 5.0', pct: 86, color: 'green', sub: '✓ Strong' },
  { label: 'Preventive Screening', value: '63% / target 70%', pct: 63, color: 'amber', sub: '7pp gap: colorectal gap' },
];
const AI_INSIGHT_FALLBACK = {
  icon: 'custom:ai',
  title: 'AI-Generated Narrative',
  text: 'Fold Unity detected <strong>3 anomalies</strong> this week: (1) CHF IP admissions <strong>+18%</strong> vs 4-week avg at Riverside Hospital. (2) RAF recapture velocity <strong>-12%</strong> since V28 transition. (3) TCM enrollment <strong>-24%</strong> from coordinator capacity gap.',
  buttons: [
    { label: 'Review All Anomalies', primary: true, toast: 'Opening anomaly dashboard' },
    { label: 'Configure Alerts', toast: 'Opening alert config' },
  ],
};
const ACTION_INSIGHT_FALLBACK = {
  icon: 'solar:bolt-linear',
  title: 'Action Engine Status',
  text: '<strong>142 automated actions</strong> this week: 89 inline, 41 rules-engine, 12 AI agent. <strong>Zero false triggers</strong>. Highest-impact: auto-TOC assignment saved est. <strong>18 hours</strong> of coordinator time.',
  buttons: [
    { label: 'Create New Rule', primary: true, toast: 'Opening rules builder' },
    { label: 'View Audit Log', toast: 'Opening action audit log' },
  ],
};

const pctNum = (v) => parseInt(String(v || '0').replace(/[^\d-]/g, ''), 10);

/**
 * Section kinds:
 *   chart    one of the desktop's Recharts charts (`chart`: tcoc | savings | raf | readmit)
 *   bars     fetchProgressBars(view, barKey)
 *   table    fetchViewTable(view, tableKey), one card row per table row
 *   measures fetchViewTable rows of { name, rate, target, tag }, as rate-vs-target bars
 *   list     fetchConfig(configKey)[path], one row per item
 */
export const DASHBOARD_SPECS = {
  executive: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'chart', chart: 'tcoc', title: 'TCOC Trend', series: ['tcoc_all', 'tcoc_ip', 'tcoc_op', 'tcoc_ed', 'tcoc_rx', 'tcoc_pac'] },
      { kind: 'bars', title: 'Quality Summary', barKey: 'executive_quality_summary', fallback: EXEC_QUALITY_FALLBACK },
      { kind: 'list', title: 'Care Program Command Center', configKey: 'exec_care_programs', path: 'rows',
        primary: p => p.abbr, secondary: p => p.alert, meta: p => [p.members && `${p.members} mbrs`, p.saved && `${p.saved} saved`, p.roi && `${p.roi} ROI`],
        status: p => p.status, statusLabel: labels('On Track', 'Review', 'At Risk') },
      { kind: 'chart', chart: 'savings', title: 'Shared Savings Trajectory', configKey: 'exec_savings_trajectory', target: 2.8, targetLabel: 'MSR $2.8M' },
      { kind: 'table', title: 'Cost by Setting', sub: 'Benchmark comparison', tableKey: 'cost_by_setting_benchmark',
        primary: 'setting', fields: [['actual', 'Actual PMPM'], ['benchmark', 'Benchmark'], ['variance', 'Variance']],
        status: 'status', statusLabel: labels('Below', 'Watch', 'Above') },
    ],
  },
  population: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'bars', title: 'Risk Stratification', barKey: 'risk_tiers' },
      { kind: 'bars', title: 'Chronic Condition Distribution', barKey: 'chronic_conditions' },
      { kind: 'bars', title: 'SDoH Risk Screening', sub: 'Progress toward screening targets', barKey: 'sdoh_screening' },
      { kind: 'table', title: 'Actionable Member Lists', tableKey: 'actionable_member_lists',
        primary: 'cohort', secondary: 'conditions', fields: [['members', 'Members'], ['avg_tcoc', 'Avg TCOC'], ['avg_raf', 'Avg RAF']] },
    ],
  },
  financial: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'table', title: 'Cost by Provider', tableKey: 'cost_by_provider',
        primary: 'name', fields: [['members', 'Members'], ['tcoc', 'TCOC PMPM'], ['ip', 'IP PMPM'], ['ed', 'ED PMPM'], ['rx', 'Rx PMPM'], ['vs_bench', 'vs Bench']] },
      { kind: 'table', title: 'High-Cost Claimants', tableKey: 'high_cost_claimants',
        primary: 'member_id', secondary: 'diagnosis', fields: [['total_cost', 'Total Cost'], ['ip_admits', 'IP Admits']],
        status: 'status', statusLabel: labels('Monitor', 'High', 'Critical') },
      { kind: 'table', title: 'Inpatient Cost Detail', tableKey: 'ip_cost_detail',
        primary: 'category', fields: [['admits', 'Admits'], ['avg_los', 'Avg LOS'], ['avg_cost', 'Avg Cost'], ['total_pmpm', 'Total PMPM']] },
      { kind: 'bars', title: '30-Day Readmission Analysis', barKey: 'readmission_rates' },
      { kind: 'table', title: 'Top Admission DRGs', tableKey: 'top_drgs',
        primary: 'drg', secondary: 'description', fields: [['admits', 'Admits'], ['readmit_pct', 'Readmit %']] },
      { kind: 'table', title: 'Top Facilities', sub: 'Readmissions', tableKey: 'top_facilities_readmit',
        primary: 'facility', fields: [['discharges', 'Discharges'], ['readmit_pct', 'Readmit %'], ['vs_avg', 'vs Avg']] },
      { kind: 'table', title: 'Top ED Chief Complaints', tableKey: 'ed_chief_complaints',
        primary: 'complaint', fields: [['visits', 'Visits'], ['share_pct', 'Share %'], ['avoidable_pct', 'Avoidable %']] },
      { kind: 'table', title: 'Top ED Facilities', tableKey: 'ed_top_facilities',
        primary: 'facility', fields: [['visits', 'ED Visits'], ['avoid_pct', 'Avoid %'], ['avg_cost', 'Avg Cost']] },
      { kind: 'bars', title: 'Pharmacy Cost', barKey: 'pharmacy_cost' },
    ],
  },
  risk: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'chart', chart: 'raf', title: 'RAF Score Trend', data: RAF_TREND, potential: 1.120 },
      { kind: 'table', title: 'RAF by Practice', sub: 'Recapture opportunity', tableKey: 'raf_by_practice',
        primary: 'name', fields: [['members', 'Members'], ['avg_raf', 'Avg RAF'], [r => r.potential || r.capture, 'Capture %'], ['gap', 'Gap %'], ['revenue', 'Rev. Opp.']] },
      { kind: 'bars', title: 'HCC Recapture Performance', barKey: 'hcc_recapture' },
      { kind: 'bars', title: 'HCC Recapture by Category', barKey: 'hcc_recapture_categories' },
      { kind: 'table', title: 'Top Open HCC Suspects', tableKey: 'open_hcc_suspects',
        primary: 'member_id', secondary: r => [r.hcc_category, r.description].filter(Boolean).join(' · '),
        fields: [['revenue_impact', 'Est. Revenue'], ['last_coded', 'Last Coded']] },
    ],
  },
  quality: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'measures', title: 'Measure Performance', tableKey: 'quality_measures' },
    ],
  },
  utilization: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'chart', chart: 'readmit', title: 'Readmission Rate Trend', data: READMIT_TREND, threshold: 15.0 },
      { kind: 'bars', title: 'TCM Impact', barKey: 'tcm_impact', fallback: TCM_FALLBACK },
      { kind: 'table', title: 'Readmission Rate by DRG', tableKey: 'readmission_by_drg',
        primary: 'drg', fields: [['admits', 'Admits'], ['readmits', 'Readmits'], ['rate', 'Rate'], ['benchmark', 'Benchmark']],
        status: 'status', statusLabel: labels('Below', 'Watch', 'Above') },
    ],
  },
  care: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'table', title: 'Productivity by Care Manager', tableKey: 'productivity_by_cm',
        primary: 'name', fields: [['calls', 'Calls'], ['contacts', 'Contacts'], ['ccm_min', 'CCM Min'], ['tcm_48h', 'TCM 48h'], ['follow_up', 'Follow-Up']],
        status: 'status', statusLabel: labels('On Track', 'Behind', 'Behind') },
      { kind: 'bars', title: 'Care Quality Metrics', barKey: 'care_quality_metrics' },
      { kind: 'table', title: 'Programs Detail', tableKey: 'programs_detail',
        primary: 'program', secondary: r => [r.pref_mode, r.language, r.pref_day].filter(Boolean).join(' · '),
        fields: [['eligible', 'Eligible'], ['engaged', 'Engaged'], ['outreach_pct', 'Outreach %'], ['engage_pct', 'Engaged %']],
        status: r => (pctNum(r.engage_pct) >= 85 ? 'green' : pctNum(r.engage_pct) >= 70 ? 'amber' : 'red'), statusLabel: labels('On Track', 'Review', 'At Risk') },
    ],
  },
  network: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'table', title: 'Referral Leakage by Specialty', tableKey: 'referral_leakage',
        primary: 'specialty', fields: [['total', 'Referrals'], ['oon', 'Out of Network'], ['leakage', 'Leakage %'], ['cost', 'Est. Cost Impact']] },
      { kind: 'table', title: 'SNF Quality Scorecard', tableKey: 'snf_scorecard',
        primary: 'facility', fields: [['admits', 'Admits'], ['avg_los', 'Avg LOS'], ['readmit', 'Readmit %'], ['cost', 'Cost/Stay']],
        status: 'status', statusLabel: labels('Preferred', 'Monitor', 'Flagged') },
    ],
  },
  shared: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'chart', chart: 'savings', title: 'Savings Trajectory', sub: 'MSSP', data: SAVINGS_DATA, target: 2.8, targetLabel: 'MSR $2.8M' },
      { kind: 'table', title: 'Key Savings Levers', sub: 'Current status', tableKey: 'key_levers',
        primary: 'lever', fields: [['current', 'Current'], ['target', 'Target'], ['gap', 'Gap'], ['impact', 'Savings Impact']],
        status: 'status', statusLabel: labels('On Track', 'Monitor', 'At Risk') },
      { kind: 'bars', title: 'Quality Composite Breakdown', barKey: 'quality_composite', fallback: QUAL_COMPOSITE_FALLBACK },
    ],
  },
  tools: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'table', title: 'Adoption by Provider', tableKey: 'adoption_by_provider',
        primary: 'provider', fields: [['active', 'Weekly Active'], ['alerts', 'Alerts Acted'], ['gaps', 'HCC Gaps Closed'], ['response', 'Avg Response']],
        status: 'status', statusLabel: labels('Power User', 'Moderate', 'Low') },
    ],
  },
  platformops: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'list', title: 'Pipeline Health', configKey: 'pipeline_health', path: 'pipelines',
        primary: p => p.name, secondary: p => p.info, status: p => (p.status === 'ok' ? 'green' : 'amber'), statusLabel: labels('Healthy', 'Delayed', 'Delayed') },
      { kind: 'table', title: 'Data Quality Scorecard', tableKey: 'data_quality',
        primary: 'dimension', fields: [['score', 'Score'], ['threshold', 'Threshold']],
        status: 'status', statusLabel: labels('Pass', 'Below', 'Below') },
      { kind: 'table', title: 'Integration Status', tableKey: 'integration_status',
        primary: 'system', secondary: 'type', fields: [['uptime', 'Uptime'], ['errors', 'Errors (7d)']],
        status: 'status', statusLabel: labels('Healthy', 'Degraded', 'Degraded') },
    ],
  },
  aianalytics: {
    kpis: true,
    insightFallback: AI_INSIGHT_FALLBACK,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'list', title: 'Anomaly Detection', configKey: 'anomalies', path: 'anomalies',
        primary: a => a.title, secondary: a => a.desc, meta: a => [a.detected],
        status: a => (a.severity === 'red' ? 'red' : 'amber'), statusLabel: labels('Warning', 'Warning', 'Critical') },
      { kind: 'list', title: 'Ask Fold Examples', sub: 'Tap one to run it', configKey: 'nlq_examples', path: 'examples',
        primary: q => q.title, secondary: q => q.desc, onTap: q => `Running query: ${q.title}` },
      { kind: 'table', title: 'Predictive Models', tableKey: 'predictive_models',
        primary: 'model', fields: [['auc', 'AUC'], ['accuracy', 'Accuracy'], ['predictions', 'Active Predictions'], ['retrained', 'Last Retrained']],
        status: 'status', statusLabel: labels('Active', 'Stale', 'Stale') },
    ],
  },
  sdoh: {
    kpis: true,
    desktopOnly: 'customize this layout',
    sections: [
      { kind: 'table', title: 'Health Equity', sub: 'Quality measures by race/ethnicity', tableKey: 'equity_by_race',
        primary: 'measure', fields: [['white', 'White'], ['black', 'Black'], ['hispanic', 'Hispanic'], ['asian', 'Asian'], ['gap', 'Disparity Gap']],
        status: r => (pctNum(r.gap) >= 16 ? 'red' : pctNum(r.gap) >= 12 ? 'amber' : 'green'), statusLabel: labels('On Track', 'Monitor', 'Action Needed') },
      { kind: 'table', title: 'SDoH Risk Factors', tableKey: 'sdoh_risk_factors',
        primary: 'factor', fields: [['members', 'Members'], ['pct', '% of Pop'], ['tcoc_impact', 'TCOC Impact'], ['referral_rate', 'Referral Rate']] },
      { kind: 'table', title: 'Community Referral Network', tableKey: 'community_referrals',
        primary: 'org', secondary: 'service', fields: [['referrals', 'Referrals'], ['completion', 'Completion']],
        status: 'status', statusLabel: labels('Active', 'Moderate', 'Low') },
    ],
  },
  actionrules: {
    kpis: true,
    insightFallback: ACTION_INSIGHT_FALLBACK,
    desktopOnly: 'build rules or customize this layout',
    sections: [
      { kind: 'list', title: 'Inline Actions', sub: 'User-triggered from dashboard context', configKey: 'action_rules_data', path: 'inline',
        primary: r => r.trigger, secondary: r => r.action, meta: r => [r.count && `Used ${r.count} times this week`] },
      { kind: 'list', title: 'Automated Rules Engine', sub: 'Configurable thresholds trigger actions', configKey: 'action_rules_data', path: 'automated',
        primary: r => r.trigger, secondary: r => r.action, meta: r => [r.count && `Triggered ${r.count} times · ${r.overrides || 0} overrides`] },
      { kind: 'list', title: 'Agent-Triggered Actions', sub: 'AI-initiated multi-step interventions', configKey: 'action_rules_data', path: 'agent',
        primary: r => r.trigger, secondary: r => r.action, meta: r => [r.count && `Triggered ${r.count} times · ${r.resolved || 0} resolved without human`] },
    ],
  },
};
