import { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from '../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { OverflowTabStrip } from '../../../../components/TabStrip/OverflowTabStrip';
import { StickyNote } from '../../../../components/StickyNote/StickyNote';
import { StickyNoteAuditDrawer } from '../../../../components/StickyNoteAuditDrawer/StickyNoteAuditDrawer';
import { useAppStore } from '../../../../store/useAppStore';
import { CareGapSection } from '../tabs/gaps/CareGapSection/CareGapSection.jsx';
import { DiagnosisGapsTable } from '../tabs/gaps/DiagnosisGapsTable/DiagnosisGapsTable.jsx';
import { AlertsTable } from '../tabs/gaps/AlertsTable/AlertsTable.jsx';
import { PAMIHxTab } from '../tabs/pami-hx/PAMIHxTab/PAMIHxTab.jsx';
import { VitalsLabsTab } from '../tabs/vitals-labs/VitalsLabsTab/VitalsLabsTab.jsx';
import { CommsTab } from '../tabs/comms/CommsTab/CommsTab.jsx';
import { OutreachTab } from '../tabs/outreach/OutreachTab/OutreachTab.jsx';
import { SummaryTab } from '../tabs/summary/SummaryTab/SummaryTab.jsx';
import { TasksTab } from '../tabs/tasks/TasksTab/TasksTab.jsx';
import { ProfileTab } from '../tabs/profile/ProfileTab/ProfileTab.jsx';
import { CARE_GAP_SECTIONS_EXTENDED, CARE_GAP_TABS, CARE_GAP_TABS_DRAWER } from '../../data/careGapsMock';
import styles from './PatientProfileTabs.module.css';

// In the P360 (full-page) surface the right panel already hosts Tasks and
// Profile, so the left-panel tab strip drops them to avoid duplicate nav.
// In the QuickView drawer there IS no right panel, so we keep the full set.
export function PatientProfileTabs({ patientId, patient, variant = 'full' }) {
  const tabs = variant === 'drawer' ? CARE_GAP_TABS_DRAWER : CARE_GAP_TABS;
  const tabItems = useMemo(() => tabs.map(tab => ({ key: tab, label: tab })), [tabs]);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [selectedGaps, setSelectedGaps] = useState([]);
  const [gapsCollapsed, setGapsCollapsed] = useState(false);
  const [diagnosisCollapsed, setDiagnosisCollapsed] = useState(false);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const searchRef = useRef(null);

  const stickyNotes = useAppStore(s => s.stickyNotes);
  const fetchStickyNotes = useAppStore(s => s.fetchStickyNotes);
  const createStickyNote = useAppStore(s => s.createStickyNote);
  const updateStickyNote = useAppStore(s => s.updateStickyNote);
  const deleteStickyNote = useAppStore(s => s.deleteStickyNote);

  useEffect(() => { if (patientId) fetchStickyNotes(patientId); }, [patientId]);

  useEffect(() => { if (searching && searchRef.current) searchRef.current.focus(); }, [searching]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') { setSearching(false); setSearchQuery(''); }
  };

  const toggleGap = (id) => {
    setSelectedGaps(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const careGapSections = CARE_GAP_SECTIONS_EXTENDED.map(section => ({
    ...section,
    items: searchQuery
      ? section.items.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : section.items,
  }));

  const activeIdx = useMemo(() => tabs.indexOf(activeTab), [tabs, activeTab]);

  return (
    <div className={styles.panel}>
      {/* Sticky tab bar OR search input */}
      {searching ? (
        <div className={styles.searchBar}>
          <input aria-label="Search gaps"
            ref={searchRef}
            className={styles.searchInput}
            placeholder="Search gaps"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button className={styles.searchClose} onClick={() => { setSearching(false); setSearchQuery(''); }} aria-label="Close search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-300)" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      ) : (
        <div className={styles.tabRow}>
          <div className={styles.tabsArea}>
            <OverflowTabStrip
              items={tabItems}
              activeKey={activeTab}
              onChange={setActiveTab}
            />
          </div>
          <ActionButton
            icon="solar:magnifer-linear"
            size="S"
            tooltip="Search gaps"
            className={styles.searchBtn}
            onClick={() => setSearching(true)}
          />
        </div>
      )}

      {/* Scrollable content */}
      <div className={`${styles.scrollContent} ${styles.flushContent}`}>
        {/* Sticky Note */}
        <div className={styles.stickyNoteWrap}>
        <StickyNote
          notes={stickyNotes}
          onSave={(id, text) => updateStickyNote(id, { text, author_name: 'You' }, patientId)}
          onCreate={(text) => createStickyNote({ patient_id: patientId, text, author_name: 'You', ehr_profile: 'Central Profile' })}
          onDelete={(id) => deleteStickyNote(id, patientId)}
          onAuditLog={() => setShowAuditDrawer(true)}
        />
        </div>

        {/* Audit Log Drawer */}
        {showAuditDrawer && (
          <StickyNoteAuditDrawer
            patientId={patientId}
            note={stickyNotes[0]}
            profileOptions={['Central Profile', 'APC', 'FoldHealth']}
            onClose={() => setShowAuditDrawer(false)}
          />
        )}

        {activeIdx === 0 && (
          <div className={styles.gapsWrapper}>
            {/* Care Gaps header */}
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Care Gaps</span>
              <button
                className={styles.collapseToggle}
                onClick={() => setGapsCollapsed(v => !v)}
                aria-label={gapsCollapsed ? 'Expand Care Gaps' : 'Collapse Care Gaps'}
                aria-expanded={!gapsCollapsed}
              >
                <DownChevronIcon
                  size={12}
                  color="var(--neutral-200)"
                  className={gapsCollapsed ? styles.chevronCollapsed : undefined}
                />
              </button>
              {!gapsCollapsed && (
                <div className={styles.sectionActions}>
                  <span className={styles.viewBy}>View By: Action</span>
                  <DownChevronIcon size={10} />
                  <span className={styles.filterDivider} />
                  <ActionButton icon="custom:filter" size="S" tooltip="Filter" />
                </div>
              )}
            </div>

            <div className={`${styles.collapseOuter} ${gapsCollapsed ? styles.collapsedSection : ''}`}>
              <div className={styles.collapseInner}>
                <div className={styles.sections}>
                  {careGapSections.map(section => (
                    <CareGapSection key={section.title} section={section} selectedGaps={selectedGaps} onToggleGap={toggleGap} />
                  ))}
                </div>
              </div>
            </div>

            {/* Diagnosis Gaps header */}
            <div className={`${styles.sectionHeader} ${styles.diagnosisHeader}`}>
              <span className={styles.sectionTitle}>Diagnosis Gaps</span>
              <button
                className={styles.collapseToggle}
                onClick={() => setDiagnosisCollapsed(v => !v)}
                aria-label={diagnosisCollapsed ? 'Expand Diagnosis Gaps' : 'Collapse Diagnosis Gaps'}
                aria-expanded={!diagnosisCollapsed}
              >
                <DownChevronIcon
                  size={12}
                  color="var(--neutral-200)"
                  className={diagnosisCollapsed ? styles.chevronCollapsed : undefined}
                />
              </button>
              {!diagnosisCollapsed && (
                <div className={styles.sectionActions}>
                  <span className={styles.dosLabel}>DOS:</span>
                  <span className={styles.dosValue}>03/04/2025</span>
                  <DownChevronIcon size={10} />
                  <span className={styles.filterDivider} />
                  <ActionButton icon="custom:filter" size="S" tooltip="Filter" />
                </div>
              )}
            </div>

            <div className={`${styles.collapseOuter} ${diagnosisCollapsed ? styles.collapsedSection : ''}`}>
              <div className={styles.collapseInner}>
                <div className={styles.sections}>
                  <DiagnosisGapsTable />
                </div>
              </div>
            </div>

            {/* Alerts header */}
            <div className={`${styles.sectionHeader} ${styles.diagnosisHeader}`}>
              <span className={styles.sectionTitle}>Alerts</span>
              <button
                className={styles.collapseToggle}
                onClick={() => setAlertsCollapsed(v => !v)}
                aria-label={alertsCollapsed ? 'Expand Alerts' : 'Collapse Alerts'}
                aria-expanded={!alertsCollapsed}
              >
                <DownChevronIcon
                  size={12}
                  color="var(--neutral-200)"
                  className={alertsCollapsed ? styles.chevronCollapsed : undefined}
                />
              </button>
              {!alertsCollapsed && (
                <div className={styles.sectionActions}>
                  <ActionButton icon="custom:filter" size="S" tooltip="Filter" />
                </div>
              )}
            </div>

            <div className={`${styles.collapseOuter} ${alertsCollapsed ? styles.collapsedSection : ''}`}>
              <div className={styles.collapseInner}>
                <div className={styles.sections}>
                  <AlertsTable />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeIdx === 1 && <PAMIHxTab />}

        {activeIdx === 2 && <VitalsLabsTab />}

        {activeIdx === 3 && <CommsTab />}

        {activeIdx === 4 && <OutreachTab />}

        {activeIdx === 5 && <SummaryTab />}

        {/* Tail tabs — index layout depends on variant:
            - full  (P360 page):   [6] CRM
            - drawer (QuickView):  [6] Tasks · [7] CRM · [8] Profile
            Tasks/Profile live only on the right panel in P360, so they're
            keyed off tabs[idx] rather than a hard-coded index. */}
        {tabs[activeIdx] === 'Tasks' && <TasksTab />}

        {tabs[activeIdx] === 'CRM' && (
          <div className={styles.placeholder}>
            <Icon name="solar:document-text-linear" size={32} color="var(--neutral-150)" />
            <span>Coming soon</span>
          </div>
        )}

        {tabs[activeIdx] === 'Profile' && (
          <ProfileTab patient={patient || { id: patientId }} />
        )}
      </div>
    </div>
  );
}
