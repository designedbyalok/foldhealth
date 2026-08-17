import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Select } from '../../components/Select/Select';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { Button } from '../../components/Button/Button';
import { SideNav } from '../../components/SideNav/SideNav';
import { useAppStore } from '../../store/useAppStore';
import { PAGES, VIEW_TITLES, PERSONA_ACCESS, PERSONA_LABELS, PERSONA_DETAILS, ORGANIZATIONS, QUARTERS } from './analyticsData';
import { ExecutiveView } from './views/ExecutiveView';
import { PopulationView } from './views/PopulationView';
import { FinancialView } from './views/FinancialView';
import { RiskView } from './views/RiskView';
import { QualityView } from './views/QualityView';
import { UtilizationView } from './views/UtilizationView';
import { CareView } from './views/CareView';
import { NetworkView } from './views/NetworkView';
import { SharedSavingsView } from './views/SharedSavingsView';
import { RoiView } from './views/RoiView';
import { ToolUsageView } from './views/ToolUsageView';
import { PlatformOpsView } from './views/PlatformOpsView';
import { AiAnalyticsView } from './views/AiAnalyticsView';
import { SdohView } from './views/SdohView';
import { ActionRulesView } from './views/ActionRulesView';
import s from './AnalyticsLayout.module.css';

class ViewErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: 24, color: 'var(--neutral-300)', fontSize: 14 }}>
        Something went wrong loading this view.
      </div>
    );
    return this.props.children;
  }
}

const VIEW_MAP = {
  executive: ExecutiveView, population: PopulationView, financial: FinancialView,
  risk: RiskView, quality: QualityView, utilization: UtilizationView,
  care: CareView, network: NetworkView, shared: SharedSavingsView,
  roi: RoiView, tools: ToolUsageView, platformops: PlatformOpsView,
  aianalytics: AiAnalyticsView, sdoh: SdohView, actionrules: ActionRulesView,
};

const PERIODS = [
  { value: '2026-03', label: 'Mar 2026' },
  { value: '2026-02', label: 'Feb 2026' },
  { value: '2026-01', label: 'Jan 2026' },
  { value: 'Q1-2026', label: 'Q1 2026' },
  { value: 'YTD-2026', label: 'YTD 2026' },
  { value: '2025-12', label: 'Dec 2025' },
];

const PRACTICES = [
  { value: 'all', label: 'All Practices' },
  { value: 'patel', label: 'Patel Family Medicine' },
  { value: 'riverside', label: 'Riverside Medical Group' },
  { value: 'valley', label: 'Valley Primary Care' },
  { value: 'lakeview', label: 'Lakeview Health Partners' },
  { value: 'summit', label: 'Summit Internal Medicine' },
];

// Views that support the editable dashboard pattern (drag/resize cards).
// As more views are migrated, add their keys here.
const EDITABLE_VIEWS = new Set([
  'executive', 'quality',
  'aianalytics', 'actionrules', 'platformops', 'network',
  'population', 'roi', 'risk', 'shared',
  'sdoh', 'tools', 'utilization',
  'care', 'financial',
]);

export function AnalyticsLayout() {
  const view = useAppStore(st => st.analyticsView) || 'executive';
  const setAnalyticsView = useAppStore(st => st.setAnalyticsView);
  const showToast = useAppStore(st => st.showToast);
  const canvasRef = useRef(null);
  const ViewComponent = VIEW_MAP[view] || ExecutiveView;
  const meta = VIEW_TITLES[view] || VIEW_TITLES.executive;

  // Edit-mode state for the editable dashboard pattern. Lives at this level
  // so the Customize/Done + Reset buttons can render in the view header
  // (next to Export) instead of in a separate row inside each view.
  const [editingDashboard, setEditingDashboard] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  const isEditableView = EDITABLE_VIEWS.has(view);
  const editing = editingDashboard && isEditableView;

  // Auto-exit edit mode when switching views — avoids stale state when the
  // user navigates to a non-editable view while editing.
  useEffect(() => { setEditingDashboard(false); }, [view]);

  const analyticsPeriod = useAppStore(st => st.analyticsPeriod);
  const analyticsPractice = useAppStore(st => st.analyticsPractice);
  const analyticsPersona = useAppStore(st => st.analyticsPersona);
  const analyticsOrg = useAppStore(st => st.analyticsOrg);
  const analyticsPeriodMode = useAppStore(st => st.analyticsPeriodMode);
  const analyticsQuarter = useAppStore(st => st.analyticsQuarter);
  const setAnalyticsPeriod = useAppStore(st => st.setAnalyticsPeriod);
  const setAnalyticsPractice = useAppStore(st => st.setAnalyticsPractice);
  const setAnalyticsPersona = useAppStore(st => st.setAnalyticsPersona);
  const setAnalyticsOrg = useAppStore(st => st.setAnalyticsOrg);
  const setAnalyticsPeriodMode = useAppStore(st => st.setAnalyticsPeriodMode);
  const setAnalyticsQuarter = useAppStore(st => st.setAnalyticsQuarter);
  const [nlqValue, setNlqValue] = useState('');

  // Derive which views are accessible based on persona
  const allowedViews = PERSONA_ACCESS[analyticsPersona];
  const isViewLocked = (viewId) => allowedViews !== null && !allowedViews.includes(viewId);

  const switchView = useCallback((id) => {
    setAnalyticsView(id);
    canvasRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [setAnalyticsView]);

  const personaDetail = PERSONA_DETAILS[analyticsPersona] || PERSONA_DETAILS.exec;

  const cyclePersona = useCallback(() => {
    const keys = Object.keys(PERSONA_LABELS);
    const idx = keys.indexOf(analyticsPersona);
    setAnalyticsPersona(keys[(idx + 1) % keys.length]);
  }, [analyticsPersona, setAnalyticsPersona]);

  return (
    <div className={s.wrap}>
      {/* ── Slicer Bar (always visible at top) ── */}
      <div className={s.slicerBar}>
        <div className={s.slicerGroup}>
          <span className={s.slicerLabel}>Organization</span>
          <Select
            className={s.filterSelect}
            options={ORGANIZATIONS}
            value={analyticsOrg}
            onChange={setAnalyticsOrg}
          />
        </div>

        <div className={s.slicerGroup}>
          <span className={s.slicerLabel}>Period</span>
          <div className={s.slicerToggle}>
            <button className={`${s.slicerToggleBtn} ${analyticsPeriodMode === 'ytd' ? s.on : ''}`} onClick={() => setAnalyticsPeriodMode('ytd')}>YTD</button>
            <button className={`${s.slicerToggleBtn} ${analyticsPeriodMode === 'r12' ? s.on : ''}`} onClick={() => setAnalyticsPeriodMode('r12')}>Rolling 12M</button>
          </div>
        </div>

        <div className={s.slicerGroup}>
          <span className={s.slicerLabel}>Quarter</span>
          <Select
            className={s.filterSelect}
            options={QUARTERS}
            value={analyticsQuarter}
            onChange={setAnalyticsQuarter}
          />
        </div>

        <div className={s.slicerDivider} />

        <div className={s.slicerGroup}>
          <span className={s.slicerLabel}>Persona</span>
          <Select
            className={s.filterSelect}
            options={Object.entries(PERSONA_DETAILS).map(([k, d]) => ({
              value: k,
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.dot, flexShrink: 0, display: 'inline-block' }} />
                  {d.name} — {d.role}
                </span>
              ),
            }))}
            value={analyticsPersona}
            onChange={setAnalyticsPersona}
          />
        </div>

        <div className={s.slicerDivider} />

        <div className={s.askFoldSlicer} onClick={e => e.currentTarget.querySelector('input')?.focus()}>
          <Icon name="solar:magic-stick-3-linear" size={14} color="var(--primary-300)" />
          <input aria-label="Ask Fold a question"
            className={s.askFoldInput}
            type="text"
            placeholder="Ask Fold anything..."
            value={nlqValue}
            onChange={e => setNlqValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nlqValue.trim()) { showToast(`NLQ: "${nlqValue}"`); setNlqValue(''); } }}
          />
        </div>
      </div>

      {/* ── Body (nav + canvas) ── */}
      <div className={s.body}>
        {/* ── Page Navigator — shared SideNav ── */}
        <SideNav
          width={210}
          sections={PAGES.map(sec => ({
            key: sec.section,
            label: sec.section,
            items: sec.items.map(p => ({
              key: p.id,
              label: p.label,
              icon: p.icon,
              locked: isViewLocked(p.id),
            })),
          }))}
          activeKey={view}
          onSelect={(id, item) => item.locked
            ? showToast(`${item.label} is restricted for ${PERSONA_LABELS[analyticsPersona] || analyticsPersona} persona`)
            : switchView(id)}
        />

        {/* ── Canvas ── */}
        <div className={s.canvas} ref={canvasRef}>
          {/* Recency bar */}
          <div className={s.recency}>
            <span className={`${s.recDot} ${s.ok}`} />
            <span className={s.recLabel}>Claims</span>
            <span>2h ago</span>
            <span className={s.recSep} />
            <span className={`${s.recDot} ${s.ok}`} />
            <span className={s.recLabel}>EHR</span>
            <span>45m ago</span>
            <span className={s.recSep} />
            <span className={`${s.recDot} ${s.warn}`} />
            <span className={s.recLabel}>ADT</span>
            <span style={{ color: 'var(--status-warning)' }}>18h ago</span>
            <span className={s.recSep} />
            <span className={`${s.recDot} ${s.ok}`} />
            <span className={s.recLabel}>Labs</span>
            <span>3h ago</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--neutral-200)' }}>
              Last full refresh: Today 6:00 AM
            </span>
          </div>

          {/* View header + practice filter + export */}
          <div className={s.viewHeader}>
            <div style={{ flex: 1 }}>
              <div className={s.viewTitle}>{meta.title}</div>
              <div className={s.viewSub}>{meta.sub}</div>
            </div>
            <div className={s.filterBar}>
              {/* Practice — FilterChip singleSelect. The 'all' sentinel used
                  by the underlying store maps to an empty chip selection so
                  the chip reads "Practice ⌄" idle and
                  "Practice : Patel Family Medicine ✕" once picked. Options
                  are the label strings (all entries except the "All
                  Practices" sentinel); we look up the value on change. */}
              <FilterChip
                label="Practice"
                options={PRACTICES.filter(p => p.value !== 'all').map(p => p.label)}
                selected={
                  analyticsPractice === 'all'
                    ? []
                    : [PRACTICES.find(p => p.value === analyticsPractice)?.label].filter(Boolean)
                }
                onChange={(next) => {
                  const picked = PRACTICES.find(p => p.label === next[0]);
                  setAnalyticsPractice(picked ? picked.value : 'all');
                }}
                singleSelect
              />
              <Button
                variant="secondary"
                size="L"
                leadingIcon="solar:download-minimalistic-linear"
                onClick={() => showToast('Exporting report...')}
              >
                Export
              </Button>
              {isEditableView && editing && (
                <Button
                  variant="secondary"
                  size="L"
                  leadingIcon="solar:refresh-linear"
                  onClick={() => setResetTick(t => t + 1)}
                >
                  Reset
                </Button>
              )}
              {isEditableView && (
                <Button
                  variant={editing ? 'tertiary' : 'secondary'}
                  size="L"
                  leadingIcon={editing ? 'solar:check-circle-linear' : 'solar:pen-linear'}
                  onClick={() => setEditingDashboard(v => !v)}
                >
                  {editing ? 'Done' : 'Customize'}
                </Button>
              )}
            </div>
          </div>

          {/* Active view */}
          <ViewErrorBoundary key={view}>
            <ViewComponent showToast={showToast} editing={editing} resetTick={resetTick} />
          </ViewErrorBoundary>
        </div>
      </div>
    </div>
  );
}
