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

function AgentRow({ agent, isFirst }) {
  const updateAgent = useAppStore(s => s.updateAgent);
  const openBuilder = useAppStore(s => s.openBuilder);
  const fetchAgents = useAppStore(s => s.fetchAgents);
  const showToast = useAppStore(s => s.showToast);
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
      <td className={rowStyles.td}>{agent.last_updated}</td>
      <td className={rowStyles.td}>
        <span
          className={rowStyles.userLink}
          onClick={(e) => {
            e.stopPropagation();
            const name = agent.last_updated_by || 'Unknown';
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
          {agent.last_updated_by}
        </span>
      </td>
      <td className={rowStyles.td} onClick={(e) => e.stopPropagation()}>
        <Switch checked={agent.enabled} onChange={() => updateAgent(agent.id, { enabled: !agent.enabled })} />
      </td>
      <td className={`${rowStyles.td} ${rowStyles.stickyRight}`} onClick={(e) => e.stopPropagation()}>
        <div className={rowStyles.actionsCell} {...(isFirst ? { 'data-tour': 'agent-actions' } : {})}>
          <ActionButton size="L" tooltip="Call Queue" onClick={() => setShowCallQueue(true)} {...(isFirst ? { 'data-tour': 'call-queue-btn' } : {})}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.1333 4.18663V5.86663L15.1833 6.91663M11.7506 13.2226L12.1301 12.823C12.6548 12.2706 13.4727 12.1571 14.144 12.5435L15.7361 13.4599C16.7585 14.0484 16.9838 15.4907 16.1847 16.332L15.0009 17.5783C14.6999 17.8952 14.3264 18.1268 13.8969 18.1692C12.539 18.3032 9.21841 18.1551 5.67943 14.4292C2.34222 10.9158 1.74416 7.90447 1.66903 6.50487C1.63967 5.9578 1.88182 5.46464 2.24317 5.08421L3.55117 3.70713C4.27993 2.93988 5.50853 3.05868 6.14434 3.95794L7.19516 5.44418C7.70886 6.17073 7.65335 7.16596 7.06456 7.78586L6.82555 8.03749C6.82555 8.03749 5.92339 8.98729 8.3859 11.5798C10.8484 14.1724 11.7506 13.2226 11.7506 13.2226ZM18.3333 5.86663C18.3333 8.18622 16.4529 10.0666 14.1333 10.0666C11.8137 10.0666 9.93329 8.18622 9.93329 5.86663C9.93329 3.54703 11.8137 1.66663 14.1333 1.66663C16.4529 1.66663 18.3333 3.54703 18.3333 5.86663Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </ActionButton>
          <span className={rowStyles.actionDivider} />
          <ActionButton icon="solar:chart-linear" size="L" tooltip="Call Analytics" onClick={() => { setCallQueueInitTab('analytics'); setShowCallQueue(true); }} {...(isFirst ? { 'data-tour': 'call-analytics-btn' } : {})} />
          <span className={rowStyles.actionDivider} />
          <ActionButton icon="solar:menu-dots-bold" size="L" tooltip="More Options" ref={moreBtnRef} onClick={handleMoreClick} {...(isFirst ? { 'data-tour': 'more-options-btn' } : {})} />
        </div>
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
              await supabase.from('agents').delete().eq('id', agent.id);
              await fetchAgents();
              showToast(`"${agent.name}" deleted`);
              setDeleting(false);
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
const AGENT_COLUMNS = [
  { key: 'useCase',   label: 'Use Case',        sortKey: 'use_case',        sticky: 'left', left: 0, width: 260 },
  { key: 'name',      label: 'Agent Name',      sortKey: 'name',            width: 260 },
  { key: 'model',     label: 'Model',           sortKey: 'model',           width: 200 },
  { key: 'updated',   label: 'Last Updated',    sortKey: 'last_updated',    width: 160 },
  { key: 'updatedBy', label: 'Last Updated By', sortKey: 'last_updated_by', width: 180 },
  { key: 'status',    label: 'Status',          width: 100 },
  { key: 'actions',   label: 'Actions',         sticky: 'right',            width: 180 },
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
    if (!searchVal.trim()) return agents;
    const q = searchVal.toLowerCase().trim();
    return agents.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.use_case?.toLowerCase().includes(q) ||
      a.last_updated_by?.toLowerCase().includes(q)
    );
  }, [agents, searchVal]);

  const { sorted: sortedAgents, sortKey, sortDir, requestSort } = useTableSort(filteredAgents, 'last_updated', 'desc');
  const startIdx = (currentPage - 1) * perPage;
  const paginatedAgents = sortedAgents.slice(startIdx, startIdx + perPage);

  return (
    <div className={styles.wrapper} data-tour="settings-tabs">
      <SectionTitleBar
        tabs={tabsForBar}
        activeTab={tabKey}
        onTabChange={setSettingsTab}
        showSearch
        searchPlaceholder={searchPlaceholder}
        searchValue={searchVal}
        onSearchChange={setSearchVal}
        showFilter={settingsTab === 'goals'}
        filterActive={goalsFilterOpen}
        onFilter={() => setGoalsFilterOpen(v => !v)}
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
