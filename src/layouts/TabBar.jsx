import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { SectionTitleBar } from '../SectionTitleBar/SectionTitleBar';
import { SavedFiltersChip } from '../../features/hcc/SavedFiltersChip';
import { useAppStore } from '../../store/useAppStore';
import styles from './TabBar.module.css';

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.4)',
    }} onClick={onCancel}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '24px 28px',
        maxWidth: 420, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,.2)',
        fontFamily: "'Inter', sans-serif",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--primary-50)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="solar:routing-2-bold" size={20} color="var(--primary-300)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--neutral-500)' }}>
            Open Agent Builder?
          </div>
        </div>
        <p style={{ fontSize: 14, color: 'var(--neutral-300)', lineHeight: 1.6, margin: '0 0 20px' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" size="L" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="L" onClick={onConfirm}>
            Open Agent Builder
          </Button>
        </div>
      </div>
    </div>
  );
}

// Two-tab TOC switch (Worklist / Agent Queue) rendered through SectionTitleBar
// variant 3. Falls back to a title-only header for single-list subnav routes
// (All Patients, HCC, CCM) — SectionTitleBar drops the segmented toggle when
// only one item is supplied.
export function TabBar() {
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const showFilterBar = useAppStore(s => s.showFilterBar);
  const setShowFilterBar = useAppStore(s => s.setShowFilterBar);
  const queueTabDot = useAppStore(s => s.queueTabDot);
  const clearQueueTabDot = useAppStore(s => s.clearQueueTabDot);
  const searchQuery = useAppStore(s => s.searchQuery);
  const setSearchQuery = useAppStore(s => s.setSearchQuery);
  const abortAllAgents = useAppStore(s => s.abortAllAgents);
  const showToast = useAppStore(s => s.showToast);
  const patients = useAppStore(s => s.patients);
  const agents = useAppStore(s => s.agents);
  const openBuilder = useAppStore(s => s.openBuilder);
  const activeSubnavList = useAppStore(s => s.activeSubnavList);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  const hasActiveAgents = patients.some(p => p.agentAssigned);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'toc-queue') clearQueueTabDot();
  };

  const handleAbort = () => {
    if (!confirmAbort) {
      setConfirmAbort(true);
      setTimeout(() => setConfirmAbort(false), 3000);
      return;
    }
    abortAllAgents();
    setConfirmAbort(false);
  };

  const handleEditConfiguration = () => {
    setShowEditConfirm(true);
  };

  const handleConfirmEdit = () => {
    setShowEditConfirm(false);
    // Find the TOC agent by name or use_case
    const tocAgent = agents.find(a =>
      (a.name && a.name.toLowerCase().includes('toc')) ||
      (a.use_case && a.use_case.toLowerCase().includes('toc'))
    );
    const agent = tocAgent || agents[0];
    if (agent) {
      openBuilder({ id: agent.id, name: agent.name });
    } else {
      showToast('No agents configured. Create one in Settings first.');
    }
  };

  // Left-side config per subnav route. Single-list routes render as a plain
  // title (empty toggleItems → SectionTitleBar skips the Toggle).
  const { title, toggleItems } = (() => {
    if (activeSubnavList === 'All Patients') return { title: 'All Patients', toggleItems: [] };
    if (activeSubnavList === 'HCC')          return { title: 'HCC Worklist', toggleItems: [] };
    if (activeSubnavList === 'CCM')          return { title: 'CCM Worklist', toggleItems: [] };
    return {
      title: 'TOC',
      toggleItems: [
        { key: 'toc-worklist', label: 'Worklist' },
        { key: 'toc-queue',    label: 'Agent Queue' },
      ],
    };
  })();

  const onQueueTab = activeTab === 'toc-queue';

  return (
    <>
      <SectionTitleBar
        variant="titleWithToggle"
        title={title}
        toggleItems={toggleItems}
        toggleActive={activeTab}
        onToggleChange={handleTabChange}
        leftExtras={queueTabDot && toggleItems.length > 1 && (
          <span
            className={styles.notifDot}
            title="Agent invoked — view queue"
            aria-label="Agent Queue has new activity"
          />
        )}
        showSearch
        searchPlaceholder="Search by member name…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        showFilter
        filterActive={showFilterBar}
        onFilter={() => setShowFilterBar(!showFilterBar)}
        showHistory
        onHistory={() => showToast('History – coming soon')}
        showDownload
        onDownload={() => showToast('Export – coming soon')}
        rightExtras={
          <>
            {onQueueTab && (
              <>
                <Button
                  variant="secondary"
                  size="L"
                  leadingIcon="solar:pen-new-square-linear"
                  onClick={handleEditConfiguration}
                >
                  Edit Configuration
                </Button>
                <Button
                  variant="danger"
                  size="L"
                  leadingIcon="solar:close-circle-bold"
                  onClick={handleAbort}
                  disabled={!hasActiveAgents}
                >
                  {confirmAbort ? 'Click again to confirm' : 'Abort'}
                </Button>
                <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
              </>
            )}
            {/* Saved Filters dropdown — writes to whichever list this TabBar
                is currently rendering (TOC / SNP / High Utilizers / DM),
                falling back to 'TOC' when no subnav list is active. */}
            <SavedFiltersChip list={activeSubnavList || 'TOC'} />
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          </>
        }
      />

      {showEditConfirm && (
        <ConfirmDialog
          message="This will take you to the Agent Builder where you can modify the conversation flow, prompts, and transitions for the TOC agent. Any unsaved changes in the current view will be preserved."
          onConfirm={handleConfirmEdit}
          onCancel={() => setShowEditConfirm(false)}
        />
      )}
    </>
  );
}
