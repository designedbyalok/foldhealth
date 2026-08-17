import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { Avatar } from '../../components/Avatar/Avatar';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import { FilterBar } from '../../components/FilterBar/FilterBar';
import { Switch } from '../../components/Switch/Switch';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { supabase } from '../../lib/supabase';
import { PracticeConfigPanel } from './panels/PracticeConfigPanel';
import { FeatureTogglesPanel } from './panels/FeatureTogglesPanel';
import { EscalationPolicyPanel } from './panels/EscalationPolicyPanel';
import { KnowledgeBasePanel } from './panels/KnowledgeBasePanel';
import { GoalsPanel } from './panels/GoalsPanel';
import { AuditLogDrawer } from './panels/AuditLogDrawer';
import { CallQueueDrawer } from '../../components/CallQueueDrawer/CallQueueDrawer';
import { ViewUserDrawer } from './account/AccountPanel';
import { ProductTour } from '../../components/ProductTour/ProductTour';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { VoicePreviewPopover } from '../../components/VoicePreviewPopover/VoicePreviewPopover';
import styles from './AgentsTable.module.css';
import rowStyles from './AgentRow.module.css';

const TABS = ['Agents', 'Goals', 'Knowledge Base', 'Tools', 'Compliance Policies', 'Test Cases', 'Analytics'];

const VOICE_COLORS = { Erica: '#E74C8B', Ricardo: '#7C5CFC', Jia: '#F59E0B' };
const POPOVER_W = 280;
const POPOVER_H = 200;

const AGENT_FILTER_DEFS = [
  { key: 'status',   label: 'Status',   primary: true },
  { key: 'model',    label: 'Model',    primary: true },
  { key: 'use_case', label: 'Use Case', primary: true },
];

function VoiceBadge({ voice }) {
  const badgeRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const [popoverPos, setPopoverPos] = useState(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const cancelOpen = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };

  const open = () => {
    cancelClose();
    if (popoverPos) return; // already open
    openTimer.current = setTimeout(() => {
      const rect = badgeRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(12, Math.min(window.innerWidth - POPOVER_W - 12, rect.left));
      const flipUp = rect.bottom + POPOVER_H + 12 > window.innerHeight;
      const top = flipUp ? Math.max(12, rect.top - POPOVER_H - 8) : rect.bottom + 8;
      setPopoverPos({ top, left });
    }, 250);
  };
  const close = () => {
    cancelOpen();
    closeTimer.current = setTimeout(() => setPopoverPos(null), 180);
  };

  useEffect(() => () => {
    cancelOpen();
    cancelClose();
  }, []);

  if (!voice) return <span style={{ color: 'var(--neutral-300)' }}>—</span>;
  const name = voice.name || 'Erica';
  const color = VOICE_COLORS[name] || '#7C5CFC';

  return (
    <>
      <div
        ref={badgeRef}
        className={styles.voiceBadge}
        onMouseEnter={open}
        onMouseLeave={close}
      >
        <span className={styles.voiceDot} style={{ background: color }} />
        <span>{name}</span>
        <span className={styles.voiceMeta}>
          {voice.gender && <> &bull; {voice.gender}</>}
          {voice.language && <> &bull; {voice.language}</>}
        </span>
      </div>
      {popoverPos && createPortal(
        <VoicePreviewPopover
          voice={voice}
          pos={popoverPos}
          onMouseEnter={cancelClose}
          onMouseLeave={close}
        />,
        document.body,
      )}
    </>
  );
}

/* ── 3-dot action dropdown (items rendered via shared MenuPopover) ── */
const AGENT_MENU_ITEMS = [
  { key: 'edit', icon: 'solar:pen-new-square-linear', label: 'Edit Agent' },
  { key: 'duplicate', icon: 'solar:copy-linear', label: 'Duplicate' },
  { key: 'audit', icon: 'solar:history-linear', label: 'Audit Log' },
  { divider: true },
  { key: 'delete', icon: 'solar:trash-bin-minimalistic-linear', label: 'Delete Agent', danger: true },
];

// Provider inference — used to pick the leading model icon. The `model`
// string may live either in agent.model or (legacy) inside voice metadata.
function modelIcon(modelName) {
  const m = (modelName || '').toLowerCase();
  if (m.includes('claude') || m.includes('anthropic')) return 'custom:anthropic';
  if (m.includes('gpt') || m.includes('openai'))       return 'custom:openai';
  if (m.includes('gemini') || m.includes('google'))    return 'custom:google';
  return 'solar:cpu-bolt-linear';
}

// Resolves the current user's display name from Supabase — used to swap
// the literal "Current User" placeholder that older duplicate-agent code
// writes to `last_updated_by`, and to append "(You)" when the row's
// updater matches the logged-in user. Cached at module scope so every
// row shares one lookup.
let currentUserNamePromise = null;
function useCurrentUserName() {
  const [name, setName] = useState(null);
  useEffect(() => {
    if (!currentUserNamePromise) {
      currentUserNamePromise = (async () => {
        const { data } = await supabase.auth.getSession();
        const uid = data?.session?.user?.id;
        if (!uid) return null;
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', uid)
          .maybeSingle();
        return profile?.full_name || profile?.email?.split('@')[0] || null;
      })();
    }
    currentUserNamePromise.then(setName);
  }, []);
  return name;
}

function AgentRow({ agent, isFirst }) {
  const updateAgent = useAppStore(s => s.updateAgent);
  const openBuilder = useAppStore(s => s.openBuilder);
  const fetchAgents = useAppStore(s => s.fetchAgents);
  const showToast = useAppStore(s => s.showToast);
  const currentUserName = useCurrentUserName();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [auditDrawerEntity, setAuditDrawerEntity] = useState(null);
  const [showCallQueue, setShowCallQueue] = useState(false);
  const [callQueueInitTab, setCallQueueInitTab] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const moreBtnRef = useRef(null);

  const handleMoreClick = (e) => {
    e.stopPropagation();
    setShowMenu(v => !v);
  };

  const handleDuplicate = async () => {
    const dup = {
      id: 'a' + Date.now(),
      name: agent.name + ' (Copy)',
      use_case: agent.use_case,
      version: '1.0',
      voice: agent.voice,
      last_updated: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      last_updated_by: 'Current User',
      enabled: false,
    };
    await supabase.from('agents').insert(dup);
    await fetchAgents();
    showToast(`"${agent.name}" duplicated`);
  };

  const handleMenuSelect = (key) => {
    if (key === 'edit') { openBuilder({ id: agent.id, name: agent.name }); return; }
    if (key === 'duplicate') { handleDuplicate(); return; }
    if (key === 'audit') { setAuditDrawerEntity({ type: 'Agent', name: agent.name, id: agent.id }); return; }
    if (key === 'delete') setShowDeleteConfirm(true);
  };

  const initials = (agent.name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const model = agent.model || 'ChatGPT 4.5 Mini';

  return (
    <tr className={rowStyles.row} onClick={() => openBuilder({ id: agent.id, name: agent.name })}>
      <td className={`${rowStyles.membersTd} ${rowStyles.stickyLeft}`} style={{ left: 0 }}>
        {agent.use_case}
      </td>
      <td className={rowStyles.td}>
        <div className={rowStyles.nameCell}>
          <Avatar variant="staff" size="M" initials={initials} />
          <div className={rowStyles.nameInfo}>
            <button
              type="button"
              className={rowStyles.nameLink}
              onClick={(e) => {
                e.stopPropagation();
                openBuilder({ id: agent.id, name: agent.name });
              }}
              {...(isFirst ? { 'data-tour': 'agent-name-link' } : {})}
            >
              {agent.name}
            </button>
            {agent.role && <span className={rowStyles.role}>{agent.role}</span>}
          </div>
        </div>
      </td>
      <td className={rowStyles.td}>
        <div className={rowStyles.modelCell}>
          <Icon name={modelIcon(model)} size={16} color="var(--neutral-400)" />
          <span>{model}</span>
        </div>
      </td>
      <td className={rowStyles.td}>
        {(() => {
          const raw = agent.last_updated_by || 'Unknown';
          // Swap the legacy "Current User" placeholder for the real name;
          // also flag any row updated by the logged-in user with "(You)".
          const isSelf = raw === 'Current User' || (currentUserName && raw === currentUserName);
          const displayName = raw === 'Current User' && currentUserName ? currentUserName : raw;
          return (
            <div className={rowStyles.updatedStack}>
              <button type="button"
                className={rowStyles.userLink}
                onClick={(e) => {
                  e.stopPropagation();
                  const name = displayName;
                  const initials2 = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                  setViewingUser({
                    id: `user-${name}`,
                    name,
                    initials: initials2,
                    email: name.toLowerCase().replace(/\s+/g, '.') + '@fold.health',
                    status: 'Active',
                    role: 'Care Team Member',
                    _raw: {},
                  });
                }}
              >
                {displayName}
                {isSelf && <span className={rowStyles.youTag}> (You)</span>}
              </button>
              {agent.last_updated && <span className={rowStyles.updatedDate}>{agent.last_updated}</span>}
            </div>
          );
        })()}
      </td>
      <td className={`${rowStyles.statusTd} ${rowStyles.stickyRight}`} style={{ right: 132, borderLeft: 'none' }} onClick={(e) => e.stopPropagation()}>
        <Switch checked={agent.enabled} onChange={() => updateAgent(agent.id, { enabled: !agent.enabled })} />
      </td>
      <td
        className={`${rowStyles.actionsTd} ${rowStyles.stickyRight}`}
        onClick={(e) => e.stopPropagation()}
        {...(isFirst ? { 'data-tour': 'agent-actions' } : {})}
      >
        <ActionButton size="L" tooltip="Call Queue" onClick={() => setShowCallQueue(true)} {...(isFirst ? { 'data-tour': 'call-queue-btn' } : {})}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.13 4.19V5.87L15.18 6.92M11.75 13.22L12.13 12.823C12.65 12.27 13.47 12.16 14.144 12.54L15.74 13.46C16.76 14.05 16.98 15.49 16.18 16.332L15 17.58C14.7 17.9 14.33 18.13 13.9 18.17C12.539 18.3 9.22 18.16 5.68 14.43C2.34 10.92 1.74 7.9 1.67 6.5C1.64 5.96 1.88 5.46 2.24 5.08L3.55 3.71C4.28 2.94 5.51 3.06 6.14 3.96L7.2 5.44C7.71 6.17 7.65 7.17 7.06 7.79L6.83 8.04C6.83 8.04 5.92 8.99 8.39 11.58C10.85 14.17 11.75 13.22 11.75 13.22ZM18.33 5.87C18.33 8.19 16.45 10.07 14.13 10.07C11.81 10.07 9.93 8.19 9.93 5.87C9.93 3.55 11.81 1.67 14.13 1.67C16.45 1.67 18.33 3.55 18.33 5.87Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </ActionButton>
        <span className={rowStyles.actionDivider} />
        <ActionButton icon="solar:chart-linear" size="L" tooltip="Call Analytics" onClick={() => { setCallQueueInitTab('analytics'); setShowCallQueue(true); }} {...(isFirst ? { 'data-tour': 'call-analytics-btn' } : {})} />
        <span className={rowStyles.actionDivider} />
        <ActionButton icon="solar:menu-dots-bold" size="L" tooltip="More Options" ref={moreBtnRef} onClick={handleMoreClick} {...(isFirst ? { 'data-tour': 'more-options-btn' } : {})} />
        {showMenu && (
          <MenuPopover
            anchorRef={moreBtnRef}
            items={AGENT_MENU_ITEMS}
            onSelect={handleMenuSelect}
            onClose={() => setShowMenu(false)}
            ariaLabel="Agent actions"
          />
        )}
        {showDeleteConfirm && (
          <ConfirmDialog
            icon="solar:danger-triangle-linear"
            iconColor="var(--status-error)"
            title={`Delete ${agent.name}`}
            description={`Are you sure you want to delete this agent? All associated workflows, conversation flows, and analytics data will be permanently removed. This action cannot be undone.`}
            confirmLabel="Delete Agent"
            cancelLabel="Cancel"
            variant="error"
            loading={deleting}
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={async () => {
              setDeleting(true);
              try {
                await supabase.from('agents').delete().eq('id', agent.id);
                await fetchAgents();
                showToast(`"${agent.name}" deleted`);
              } finally {
                setDeleting(false);
              }
              setShowDeleteConfirm(false);
            }}
          />
        )}
        {auditDrawerEntity && <AuditLogDrawer entity={auditDrawerEntity} onClose={() => setAuditDrawerEntity(null)} />}
        {showCallQueue && <CallQueueDrawer agent={agent} initialTab={callQueueInitTab} onClose={() => { setShowCallQueue(false); setCallQueueInitTab(null); }} />}
        {viewingUser && <ViewUserDrawer user={viewingUser} onClose={() => setViewingUser(null)} onEdit={() => setViewingUser(null)} />}
      </td>
    </tr>
  );
}

// Column definitions for the Agents WorklistShell — order matches the
// user-provided screenshot: Use Case (sticky-left), Agent Name (avatar +
// role subtitle), Model, Last Updated, Last Updated By, Status, Actions.
// Status pins to the right alongside Actions so it stays visible at every
// scroll position (like the user tab). "Last Updated" collapses into
// "Last Updated By" as a two-line cell — name on top, date underneath.
const AGENT_COLUMNS = [
  { key: 'useCase',   label: 'Use Case',        sortKey: 'use_case',        sticky: 'left', left: 0, width: 260 },
  { key: 'name',      label: 'Agent Name',      sortKey: 'name',            width: 260 },
  { key: 'model',     label: 'Model',           sortKey: 'model',           width: 200 },
  { key: 'updatedBy', label: 'Last Updated By', sortKey: 'last_updated_by', width: 220 },
  { key: 'status',    label: 'Status',          sticky: 'right', right: 132, width: 1 },
  // width: 1 is the CSS trick that tells `<table>` to shrink both sticky
  // columns to their exact content. Status hugs the Switch, Actions hugs
  // the three ActionButtons + dividers.
  { key: 'actions',   label: 'Actions',         sticky: 'right', width: 1 },
];

export function AgentsTable() {
  const agents = useAppStore(s => s.agents);
  const agentsLoading = useAppStore(s => s.agentsLoading);
  const fetchAgents = useAppStore(s => s.fetchAgents);
  const settingsTab = useAppStore(s => s.settingsTab);
  const setSettingsTab = useAppStore(s => s.setSettingsTab);
  const setShowCreateAgent = useAppStore(s => s.setShowCreateAgent);
  const setGoalWizard = useAppStore(s => s.setGoalWizard);
  const fetchGoals = useAppStore(s => s.fetchGoals);

  const [searchVal, setSearchVal] = useState('');
  const [goalsFilter, setGoalsFilter] = useState('all');
  const [goalsViewMode, setGoalsViewMode] = useState('table');
  const [goalsFilterOpen, setGoalsFilterOpen] = useState(false);

  // Agents filter chips — Status / Model / Use Case are all primary so
  // they always render in the FilterBar (no "More filters" overflow).
  const [agentsFilterOpen, setAgentsFilterOpen] = useState(false);
  const [agentFilters, setAgentFilters] = useState({ status: [], model: [], use_case: [] });
  const agentFiltersActive =
    agentFilters.status.length + agentFilters.model.length + agentFilters.use_case.length;

  const tabKey = settingsTab === 'agents' ? 'agents' : settingsTab;
  const tabsForBar = TABS.map(label => ({ key: label.toLowerCase(), label }));
  const searchPlaceholder = settingsTab === 'goals'
    ? 'Search goals…'
    : settingsTab === 'knowledge base'
      ? 'Search FAQs…'
      : 'Search agents…';
  const primaryActionLabel = settingsTab === 'goals'
    ? 'New Goal'
    : settingsTab === 'knowledge base'
      ? 'Add FAQ'
      : 'Create New';
  const handlePrimaryAction = () => {
    if (settingsTab === 'goals') {
      useAppStore.setState({ goalWizardOpen: true, goalWizardEditId: null });
    } else if (settingsTab === 'knowledge base') {
      useAppStore.getState().setKbAddTrigger(true);
    } else {
      setShowCreateAgent(true);
    }
  };

  useEffect(() => { fetchAgents(); }, [fetchAgents]);
  useEffect(() => { if (settingsTab === 'goals') fetchGoals(); }, [settingsTab, fetchGoals]);

  const currentPage = useAppStore(s => s.currentPage);
  const perPage = useAppStore(s => s.perPage);

  const filteredAgents = useMemo(() => {
    let list = agents;
    if (agentFilters.status.length) {
      const statusSet = new Set(agentFilters.status);
      list = list.filter(a => statusSet.has(a.enabled ? 'Enabled' : 'Disabled'));
    }
    if (agentFilters.model.length) {
      const modelSet = new Set(agentFilters.model);
      list = list.filter(a => modelSet.has(a.model || 'ChatGPT 4.5 Mini'));
    }
    if (agentFilters.use_case.length) {
      const useCaseSet = new Set(agentFilters.use_case);
      list = list.filter(a => useCaseSet.has(a.use_case));
    }
    if (!searchVal.trim()) return list;
    const q = searchVal.toLowerCase().trim();
    return list.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.use_case?.toLowerCase().includes(q) ||
      a.last_updated_by?.toLowerCase().includes(q)
    );
  }, [agents, searchVal, agentFilters]);

  // Populate the chip dropdowns from what's actually in the data. Model
  // + Use Case can grow over time; deriving from the fetched rows keeps
  // the options in sync without another config file.
  const agentFilterOptions = useMemo(() => {
    const models = new Set();
    const useCases = new Set();
    for (const a of agents) {
      if (a.model) models.add(a.model);
      if (a.use_case) useCases.add(a.use_case);
    }
    return {
      status:   ['Enabled', 'Disabled'],
      model:    [...models].sort(),
      use_case: [...useCases].sort(),
    };
  }, [agents]);

  const { sorted: sortedAgents, sortKey, sortDir, requestSort } = useTableSort(filteredAgents, 'last_updated', 'desc');
  const startIdx = (currentPage - 1) * perPage;
  const paginatedAgents = sortedAgents.slice(startIdx, startIdx + perPage);

  return (
    <div className={styles.wrapper} data-tour="settings-tabs">
      <SectionTitleBar
        tabs={tabsForBar}
        activeTab={tabKey}
        onTabChange={setSettingsTab}
        actions={[
          'search',
          ...(settingsTab === 'goals' || settingsTab === 'agents' ? ['filter'] : []),
        ]}
        searchPlaceholder={searchPlaceholder}
        searchValue={searchVal}
        onSearchChange={setSearchVal}
        filterActive={settingsTab === 'agents' ? agentsFilterOpen : goalsFilterOpen}
        filterBadgeCount={settingsTab === 'agents' ? agentFiltersActive : 0}
        onFilter={() => {
          if (settingsTab === 'agents') setAgentsFilterOpen(v => !v);
          else setGoalsFilterOpen(v => !v);
        }}
        primaryActionLabel={primaryActionLabel}
        onPrimaryAction={handlePrimaryAction}
      />

      {/* Goals filter bar */}
      {settingsTab === 'goals' && goalsFilterOpen && (
        <div className={styles.filterBar}>
          {['all', 'active', 'draft', 'TCM', 'Outreach'].map(f => (
            <button
              key={f}
              className={`${styles.filterChip} ${goalsFilter === f ? styles.filterChipActive : ''}`}
              onClick={() => setGoalsFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${goalsViewMode === 'grid' ? styles.viewBtnActive : ''}`}
              onClick={() => setGoalsViewMode('grid')}
              title="Grid view"
            >
              <Icon name="solar:widget-linear" size={14} />
            </button>
            <button
              className={`${styles.viewBtn} ${goalsViewMode === 'table' ? styles.viewBtnActive : ''}`}
              onClick={() => setGoalsViewMode('table')}
              title="Table view"
            >
              <Icon name="solar:list-linear" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Tab-specific content */}
      {settingsTab === 'goals' ? (
        <div className={styles.tableWrap}><GoalsPanel searchQuery={searchVal} filter={goalsFilter} viewMode={goalsViewMode} /></div>
      ) : settingsTab === 'knowledge base' ? (
        <div className={styles.tableWrap}><KnowledgeBasePanel searchQuery={searchVal} /></div>
      ) : settingsTab === 'tools' ? (
        <div className={styles.tableWrap}><PracticeConfigPanel /></div>
      ) : settingsTab === 'compliance policies' ? (
        <div className={styles.tableWrap}><EscalationPolicyPanel /></div>
      ) : settingsTab === 'test cases' ? (
        <div className={styles.tableWrap}><FeatureTogglesPanel /></div>
      ) : (
        <WorklistShell
          // Header is owned by the outer SectionTitleBar above so the tab
          // strip + search + primary action stay identical to every other
          // Settings surface. Passing `null` keeps the shell headless.
          header={null}
          showFilters={agentsFilterOpen}
          filters={
            <FilterBar
              multiSelect
              leading={null}
              filterDefs={AGENT_FILTER_DEFS}
              filters={agentFilters}
              onFilterChange={(k, vals) => setAgentFilters(f => ({ ...f, [k]: vals }))}
              onClearAll={() => setAgentFilters({ status: [], model: [], use_case: [] })}
              getOptions={(def) => agentFilterOptions[def.key] || []}
              showMoreFilters={false}
              showSaveFilter={false}
            />
          }
          columns={AGENT_COLUMNS}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={requestSort}
          rows={paginatedAgents}
          renderRow={(agent, idx) => <AgentRow key={agent.id} agent={agent} isFirst={idx === 0} />}
          loading={agentsLoading}
          emptyState={
            <div className={styles.emptySearch}>
              <Icon
                name={searchVal.trim() ? 'solar:magnifer-linear' : 'solar:ghost-smile-linear'}
                size={40}
                color="var(--neutral-150)"
              />
              <p className={styles.emptyTitle}>
                {searchVal.trim() ? 'No results found' : 'No agents configured yet'}
              </p>
              {searchVal.trim() && (
                <p className={styles.emptyDesc}>
                  No agents match "<strong>{searchVal.trim()}</strong>". Try a different name or clear the search.
                </p>
              )}
            </div>
          }
          page={currentPage}
          perPage={perPage}
          totalItems={filteredAgents.length}
          onPageChange={(p) => useAppStore.setState({ currentPage: p })}
          onPageSizeChange={(pp) => useAppStore.setState({ perPage: pp, currentPage: 1 })}
          minTableWidth={1400}
        />
      )}

      {/* Product Tour — shown once for new users on the Agents tab */}
      {settingsTab === 'agents' && !agentsLoading && paginatedAgents.length > 0 && (
        <ProductTour
          tourId="agents-call-queue"
          steps={AGENT_TOUR_STEPS}
        />
      )}
    </div>
  );
}

const AGENT_TOUR_STEPS = [
  {
    target: '[data-tour="settings-tabs"]',
    title: 'Agent Settings',
    content: 'Manage your AI agents, goals, knowledge base, tools, and compliance policies from these tabs.',
    icon: 'solar:settings-linear',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="agent-actions"]',
    title: 'Agent Actions',
    content: 'Each agent has quick actions for managing calls, viewing analytics, editing configuration, and more.',
    icon: 'solar:widget-linear',
    placement: 'left',
    skipBeacon: true,
  },
  {
    target: '[data-tour="call-queue-btn"]',
    title: 'Call Queue',
    content: 'View ongoing calls, manage the outreach queue, and browse call logs for this agent.',
    icon: 'solar:phone-calling-rounded-linear',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="call-analytics-btn"]',
    title: 'Call Analytics',
    content: 'Jump directly into call performance — see goal progress, engagement scores, and sentiment analysis.',
    icon: 'solar:chart-linear',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="agent-name-link"]',
    title: 'Quick Edit',
    content: "Click an agent's name to jump straight into the builder and modify conversation flows, prompts, and configuration.",
    icon: 'solar:pen-linear',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="more-options-btn"]',
    title: 'More Options',
    content: 'Duplicate, view audit logs, or delete this agent from the overflow menu.',
    icon: 'solar:menu-dots-bold',
    placement: 'bottom',
    skipBeacon: true,
  },
];
