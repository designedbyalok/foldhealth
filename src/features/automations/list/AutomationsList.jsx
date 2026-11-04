import { useCallback, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { SubTabs } from '../../../components/SubTabs/SubTabs';
import { Input } from '../../../components/Input/Input';
import { Link } from '../../../components/Link/Link';
import { Icon } from '../../../components/Icon/Icon';
import { Toggle } from '../../../components/Toggle/Toggle';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { CardSkeleton } from '../../../components/CardSkeleton/CardSkeleton';
import { TableSkeleton } from '../../../components/TableSkeleton/TableSkeleton';
import { RingEmptyState } from '../../../components/RingEmptyState/RingEmptyState';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { TEMPLATE_CATEGORIES, executionTypeOf } from '../lib/catalog';
import { AutomationCard } from './AutomationCard';
import { TemplateCard } from './TemplateCard';
import { AutomationsTable, TemplatesTable } from './AutomationsTable';
import { AutomationQuickView } from './AutomationQuickView';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { RunAutomationDrawer } from './RunAutomationDrawer';
import { HistoryLogDrawer } from './HistoryLogDrawer';
import { GetStartedModal } from './GetStartedModal';
import {
  STATUS_TABS, avgRunMinutes, inStatusTab, latestFailures, matchesSearch, plural, runsByAutomation, startFromTemplate,
} from './listUtils';
import styles from './AutomationsList.module.css';

const EMPTY = [];
const EXECUTION_TYPES = ['Automatic', 'Manual'];
const NO_GROUP = 'No population group';
// Grid or list is a per-viewer preference.
const LAYOUT_KEY = 'automations.layout';
const readLayout = () => {
  try { return localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
};
const LAYOUTS = [
  { key: 'grid', icon: 'solar:widget-linear' },
  { key: 'list', icon: 'solar:list-linear' },
];

/**
 * Settings > Automations, beside the Settings sub-nav: My Automations
 * (status tabs, cards or table) and Templates (category tabs, cards or
 * table), plus the quick view, template preview, Run and History drawers.
 */
export function AutomationsList() {
  const automations = useAppStore(s => s.automations);
  const status = useAppStore(s => s.automationsStatus);
  const templates = useAppStore(s => s.automationTemplates);
  const allRuns = useAppStore(s => s.automationRuns);
  const view = useAppStore(s => s.automationsView);
  const openAutomationsList = useAppStore(s => s.openAutomationsList);
  const openNewAutomation = useAppStore(s => s.openNewAutomation);
  const openAutomationBuilder = useAppStore(s => s.openAutomationBuilder);
  const openAutomationAnalytics = useAppStore(s => s.openAutomationAnalytics);
  const setAutomationsView = useAppStore(s => s.setAutomationsView);
  const setAutomationStatus = useAppStore(s => s.setAutomationStatus);
  const duplicateAutomation = useAppStore(s => s.duplicateAutomation);
  const deleteAutomation = useAppStore(s => s.deleteAutomation);
  const showToast = useAppStore(s => s.showToast);

  const tab = view.tab === 'templates' ? 'templates' : 'mine';
  const [layout, setLayoutState] = useState(readLayout);
  const setLayout = (v) => { setLayoutState(v); try { localStorage.setItem(LAYOUT_KEY, v); } catch { /* storage unavailable */ } };
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('active');
  const [category, setCategory] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [execFilter, setExecFilter] = useState(EMPTY);
  const [groupFilter, setGroupFilter] = useState(EMPTY);

  const [quickId, setQuickId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [runTarget, setRunTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const searchRef = useRef(null);

  const loading = status !== 'ready';
  const runMap = useMemo(() => runsByAutomation(allRuns), [allRuns]);
  const runsOf = useCallback((id) => runMap.get(id) || EMPTY, [runMap]);

  // A template's average run time comes from the automations made from it.
  const templateAvg = useMemo(() => {
    const byTemplate = new Map();
    for (const a of automations) {
      if (!a.templateId) continue;
      byTemplate.set(a.templateId, [...(byTemplate.get(a.templateId) || []), ...runsOf(a.id)]);
    }
    return (id) => avgRunMinutes(byTemplate.get(id));
  }, [automations, runsOf]);

  // ── My Automations ──
  const groupOptions = useMemo(
    () => [...new Set(automations.map(a => a.populationGroupName || NO_GROUP))].sort(),
    [automations],
  );
  const filtered = useMemo(() => automations.filter(a => matchesSearch(a, search)
    && (!execFilter.length || execFilter.includes(executionTypeOf(a.schedule)))
    && (!groupFilter.length || groupFilter.includes(a.populationGroupName || NO_GROUP))), [automations, search, execFilter, groupFilter]);
  const statusCounts = useMemo(
    () => Object.fromEntries(STATUS_TABS.map(t => [t.key, filtered.filter(a => inStatusTab(a, t.key)).length])),
    [filtered],
  );
  const shownAutomations = useMemo(() => filtered.filter(a => inStatusTab(a, statusTab)), [filtered, statusTab]);
  const errorCount = useMemo(
    () => automations.reduce((s, a) => s + latestFailures(a, runsOf(a.id)), 0),
    [automations, runsOf],
  );
  const filterCount = execFilter.length + groupFilter.length;

  // ── Templates ──
  const mostUsedIds = useMemo(
    () => new Set([...templates].sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0)).slice(0, 10).map(t => t.id)),
    [templates],
  );
  const searchedTemplates = useMemo(() => templates.filter(t => matchesSearch(t, search)), [templates, search]);
  const categoryTabs = useMemo(() => [
    { key: 'all', label: 'All', count: searchedTemplates.length },
    { key: 'mostUsed', label: 'Most used', count: searchedTemplates.filter(t => mostUsedIds.has(t.id)).length },
    ...TEMPLATE_CATEGORIES.map(c => ({ key: c.key, label: c.label, count: searchedTemplates.filter(t => t.category === c.key).length })),
  ], [searchedTemplates, mostUsedIds]);
  const shownTemplates = useMemo(() => {
    if (category === 'all') return searchedTemplates;
    if (category === 'mostUsed') return searchedTemplates.filter(t => mostUsedIds.has(t.id)).sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0));
    return searchedTemplates.filter(t => t.category === category);
  }, [category, searchedTemplates, mostUsedIds]);
  const templateSections = useMemo(() => {
    if (category !== 'all') return [{ key: category, label: null, items: shownTemplates }];
    return [
      { key: 'recommended', label: 'Recommended for you', items: shownTemplates.filter(t => t.recommended) },
      ...TEMPLATE_CATEGORIES.map(c => ({ key: c.key, label: c.label, items: shownTemplates.filter(t => t.category === c.key) })),
    ].filter(s => s.items.length);
  }, [category, shownTemplates]);

  // ── Actions ──
  const openFailed = (a) => setAutomationsView({ screen: 'analytics', id: a.id, analyticsTab: 'global', runMemberId: null, drawer: 'overview:failed' });
  const duplicate = async (a) => {
    const copy = await duplicateAutomation(a.id);
    if (copy) openAutomationBuilder(copy.id);
  };
  const actions = {
    open: a => setQuickId(a.id),
    edit: a => openAutomationBuilder(a.id),
    run: a => setRunTarget(a),
    toggle: (a, on) => setAutomationStatus(a.id, on ? 'active' : 'inactive'),
    errors: openFailed,
    menu: (key, a) => {
      if (key === 'history') setHistoryTarget(a);
      else if (key === 'edit') openAutomationBuilder(a.id);
      else if (key === 'duplicate') duplicate(a);
      else if (key === 'analytics') openAutomationAnalytics(a.id);
      else if (key === 'delete') setDeleteTarget(a);
    },
  };
  const confirmDelete = async () => {
    const a = deleteTarget;
    setDeleteTarget(null);
    if (await deleteAutomation(a.id)) showToast(`“${a.name}” deleted`);
  };

  const switchTab = (key) => { setSearch(''); openAutomationsList(key); };
  const clearAll = () => { setSearch(''); setExecFilter(EMPTY); setGroupFilter(EMPTY); };
  const quick = quickId ? automations.find(a => a.id === quickId) : null;

  // ── Empty states ──
  const mineEmpty = () => {
    if (!automations.length) {
      return (
        <RingEmptyState icon="solar:bolt-linear" label="No automations yet. Start from a template or build your own.">
          <div className={styles.emptyActions}>
            <Button variant="outline" onClick={() => switchTab('templates')}>Browse templates</Button>
            <Button leadingIcon="solar:add-circle-linear" onClick={() => openNewAutomation(null)}>Create an automation</Button>
          </div>
        </RingEmptyState>
      );
    }
    if (search || filterCount) {
      return (
        <RingEmptyState icon="solar:magnifer-linear" label={search ? `No automations match “${search.trim()}”` : 'No automations match these filters'}>
          <Button variant="outline" onClick={clearAll}>Clear search and filters</Button>
        </RingEmptyState>
      );
    }
    const def = STATUS_TABS.find(t => t.key === statusTab);
    return <RingEmptyState icon="solar:bolt-linear" label={`${def.empty}. ${def.hint}`} />;
  };
  const templatesEmpty = () => (search
    ? (
      <RingEmptyState icon="solar:magnifer-linear" label={`No templates match “${search.trim()}”`}>
        <Button variant="outline" onClick={() => setSearch('')}>Clear search</Button>
      </RingEmptyState>
    )
    : <RingEmptyState icon="solar:documents-linear" label="No templates in this category yet" />);

  const header = (
    <SectionTitleBar
      tabs={[
        { key: 'mine', label: 'My Automations', count: automations.length },
        { key: 'templates', label: 'Templates', count: templates.length },
      ]}
      activeTab={tab}
      onTabChange={switchTab}
      rightExtras={(
        <div className={styles.headerRight}>
          <Input
            type="search"
            leadingIcon="solar:magnifer-linear"
            placeholder="Search Automation"
            value={search}
            onChange={e => setSearch(e.target.value)}
            wrapperClassName={styles.search}
            aria-label="Search automations"
            ref={searchRef}
          />
          <span className={styles.divider} />
          <Link onClick={() => setGuideOpen(true)} role="button" tabIndex={0} className={styles.guideLink}>
            <Icon name="solar:play-linear" size={16} />
            Get Started
          </Link>
          <span className={styles.divider} />
          <Toggle items={LAYOUTS} value={layout} onValueChange={setLayout} size="sm" />
          <span className={styles.divider} />
          <ActionButton icon="solar:add-square-linear" tooltip="New automation" tooltipBelow tooltipLeft onClick={() => openNewAutomation(null)} />
        </div>
      )}
    />
  );

  const searchToggle = (
    <>
      <ActionButton icon="solar:magnifer-linear" tooltip="Search" size="sm" onClick={() => searchRef.current?.focus()} />
    </>
  );

  const mineSubBar = (
    <>
      <div className={styles.subRow}>
        <SubTabs
          leading={searchToggle}
          tabs={STATUS_TABS.map(t => ({ key: t.key, label: t.label, count: loading ? undefined : statusCounts[t.key] }))}
          value={statusTab}
          onValueChange={setStatusTab}
        />
        <span className={styles.subRight}>
          {errorCount > 0 && (
            <>
              <Tooltip label="Members who failed in each automation’s latest run">
                <button type="button" className={styles.errorsLink} onClick={() => setStatusTab('errors')}>
                  <Icon name="solar:danger-triangle-linear" size={16} />
                  {plural(errorCount, 'Error')}
                </button>
              </Tooltip>
              <span className={styles.divider} />
            </>
          )}
          <ActionButton
            icon="custom:filter"
            tooltip="Filter"
            tooltipLeft
            active={filtersOpen}
            count={filterCount ? String(filterCount) : undefined}
            onClick={() => setFiltersOpen(v => !v)}
          />
        </span>
      </div>
      {(filtersOpen || filterCount > 0) && (
        <div className={styles.filterRow}>
          <FilterChip label="Execution type" options={EXECUTION_TYPES} selected={execFilter} onChange={setExecFilter} />
          <FilterChip label="Population group" options={groupOptions} selected={groupFilter} onChange={setGroupFilter} searchable={groupOptions.length > 6} />
          {filterCount > 0 && <Link variant="secondary" onClick={() => { setExecFilter(EMPTY); setGroupFilter(EMPTY); }}>Clear all</Link>}
        </div>
      )}
    </>
  );

  const templatesSubBar = (
    <div className={styles.subRow}>
      <SubTabs
        leading={searchToggle}
        tabs={categoryTabs.map(t => ({ ...t, count: loading ? undefined : t.count }))}
        value={category}
        onValueChange={setCategory}
      />
    </div>
  );

  let body;
  if (loading) {
    body = layout === 'grid' ? <CardSkeleton count={8} /> : <div className={styles.tableWrap}><TableSkeleton rows={8} /></div>;
  } else if (tab === 'mine') {
    if (layout === 'list') {
      body = (
        <div className={styles.tableWrap}>
          <AutomationsTable automations={shownAutomations} runsOf={runsOf} actions={actions} emptyState={<div className={styles.emptyCell}>{mineEmpty()}</div>} />
        </div>
      );
    } else {
      body = shownAutomations.length ? (
        <div className={styles.grid}>
          {shownAutomations.map(a => <AutomationCard key={a.id} automation={a} runs={runsOf(a.id)} actions={actions} />)}
        </div>
      ) : <div className={styles.empty}>{mineEmpty()}</div>;
    }
  } else if (layout === 'list') {
    body = (
      <div className={styles.tableWrap}>
        <TemplatesTable
          templates={shownTemplates}
          avgOf={templateAvg}
          onPreview={setPreview}
          onUse={t => startFromTemplate(openNewAutomation, t)}
          emptyState={<div className={styles.emptyCell}>{templatesEmpty()}</div>}
        />
      </div>
    );
  } else {
    body = templateSections.length ? (
      <div className={styles.sections}>
        {templateSections.map(s => (
          <section key={s.key} className={styles.section} aria-label={s.label || undefined}>
            {s.label && <h2 className={styles.sectionTitle}>{s.label}</h2>}
            <div className={styles.grid}>
              {s.items.map(t => <TemplateCard key={t.id} template={t} avgMinutes={templateAvg(t.id)} onOpen={setPreview} />)}
            </div>
          </section>
        ))}
      </div>
    ) : <div className={styles.empty}>{templatesEmpty()}</div>;
  }

  return (
    <div className={styles.wrapper}>
      {header}
      {tab === 'mine' ? mineSubBar : templatesSubBar}
      <div className={`${styles.content} ${layout === 'list' && !loading ? styles.contentTable : ''}`}>{body}</div>

      {quick && (
        <AutomationQuickView
          automation={quick}
          onClose={() => setQuickId(null)}
          onRun={(a) => { setQuickId(null); setRunTarget(a); }}
        />
      )}
      {preview && <TemplatePreviewModal template={preview} onClose={() => setPreview(null)} />}
      {runTarget && <RunAutomationDrawer automation={runTarget} onClose={() => setRunTarget(null)} />}
      {historyTarget && <HistoryLogDrawer automation={historyTarget} onClose={() => setHistoryTarget(null)} />}
      {guideOpen && <GetStartedModal onClose={() => setGuideOpen(false)} />}
      {deleteTarget && (
        <ConfirmDialog
          variant="destructive"
          title={`Delete “${deleteTarget.name}”?`}
          description="It stops running and is removed from My Automations. This can’t be undone."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
