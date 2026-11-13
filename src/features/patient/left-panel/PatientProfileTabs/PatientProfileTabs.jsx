import { Fragment, useState, useRef, useEffect, useMemo } from 'react';
import { DownChevronIcon } from '../../../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { OverflowTabs } from '../../../../components/Tabs/OverflowTabs';
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
import { PatientTasksTab } from '../tabs/tasks/PatientTasksTab/PatientTasksTab.jsx';
import { ProfileTab } from '../tabs/profile/ProfileTab/ProfileTab.jsx';
import { CrmTab } from '../tabs/crm/CrmTab/CrmTab.jsx';
import { CARE_GAP_SECTIONS_EXTENDED, CARE_GAP_TABS, CARE_GAP_TABS_DRAWER } from '../../data/careGapsMock';
import { CareGapDetailDrawer } from '../../../hedis-worklist/CareGapDetailDrawer';
import { STATUS_BADGE_VARIANT } from '../../../hedis-worklist/HedisWorklistRow';
import { MEASURE_NAMES } from '../../../hedis-worklist/ClinicalNotePanel.utils';
import { usePatientPanelLayout } from '../../hooks/usePatientPanelLayout';
import { visibleTabs, visibleWidgets } from '../patientPanelLayout';
import { PanelCustomizeDrawer } from '../PanelCustomizeDrawer/PanelCustomizeDrawer';
import styles from './PatientProfileTabs.module.css';

// In the P360 (full-page) surface the right panel already hosts Tasks and
// Profile, so the left-panel tab strip drops them to avoid duplicate nav.
// In the QuickView drawer there IS no right panel, so we keep the full set.
export function PatientProfileTabs({
  patientId,
  patient,
  variant = 'full',
  // Controlled mode: when `activeTab`/`onTabChange` are supplied the parent
  // owns the active tab (used when the left tabs flow into the right panel's
  // tab bar on collapse). Uncontrolled otherwise.
  activeTab: controlledActiveTab,
  onTabChange,
  // Hide the panel's own tab strip when the tabs are hosted elsewhere (the
  // right-panel tab bar): the sticky note + content still render.
  showTabBar = true,
  // Tabs hosted elsewhere that join this strip (the right panel's tabs while
  // a care program owns the right card). The parent renders their content
  // via `renderExtraTab(key)`; pass a stable array.
  extraTabs,
  renderExtraTab,
  // Put the hosted tabs before this panel's own (the Quick View's Overview).
  extraTabsFirst = false,
  // Trailing action on hosted tabs in the More dropdown (OverflowTabs
  // `itemAction` shape, minus `appliesTo`, which is scoped to extraTabs here).
  extraTabAction,
}) {
  const allTabs = variant === 'drawer' ? CARE_GAP_TABS_DRAWER : CARE_GAP_TABS;
  // The user's tab order and on/off, and per-tab widget order and on/off
  // (More > Customize).
  const { layout, saveLayout } = usePatientPanelLayout();
  const tabs = useMemo(() => visibleTabs(layout, allTabs), [layout, allTabs]);
  const [customizing, setCustomizing] = useState(false);
  const moreActions = useMemo(
    () => [{ key: 'customize', label: 'Customize', icon: 'solar:tuning-2-linear', onSelect: () => setCustomizing(true) }],
    [],
  );
  const tabItems = useMemo(
    () => (extraTabsFirst ? [...(extraTabs || []), ...tabs] : [...tabs, ...(extraTabs || [])]).map(tab => ({ key: tab, label: tab })),
    [tabs, extraTabs, extraTabsFirst],
  );
  const [internalTab, setInternalTab] = useState(tabs[0]);
  const activeTab = controlledActiveTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [selectedGaps, setSelectedGaps] = useState([]);
  const [gapsCollapsed, setGapsCollapsed] = useState(false);
  const [diagnosisCollapsed, setDiagnosisCollapsed] = useState(false);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  // Care Gap detail drawer target: `{ member, gapCode, year }` when set.
  const [careGapDrawer, setCareGapDrawer] = useState(null);
  const searchRef = useRef(null);
  const hedisMembers = useAppStore(s => s.hedisMembers) || [];

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

  // Open the Care Gap detail drawer for the picked item. Gap codes read
  // as the leading token before " - " in the title (e.g. "EED - Eye Exam"
  // → "EED"). We resolve the patient's HEDIS member by id or name so the
  // drawer opens with the right measure set. When no HEDIS row exists
  // the toggle-select fallback runs so the click never dead-ends.
  const hedisMember = (hedisMembers || []).find(m => m
    && (m.id === patientId || m.patientId === patientId
      || (patient?.name && (m.name === patient.name))));

  const openGap = (item) => {
    const code = String(item.title || '').split(' - ')[0].trim();
    const member = hedisMember;
    if (!code || !member) {
      toggleGap(item.id);
      return;
    }
    setCareGapDrawer({ member, gapCode: code, year: new Date().getFullYear() });
  };

  // A patient on the HEDIS worklist shows their real gaps, one row per gap,
  // so a re-added measure lists its Open gap and its closed parent apart.
  const sourceSections = hedisMember?.gaps?.length
    ? [{
        title: 'HEDIS Measures',
        items: hedisMember.gaps.map((g, i) => ({
          id: `hedis-${g.code}-${i}`,
          title: `${g.code} - ${MEASURE_NAMES[g.code] || g.code}`,
          status: g.status,
          statusVariant: STATUS_BADGE_VARIANT[g.status] || 'neutral',
          diagnosis: g.supersededAt
            ? `Previous gap · Closed ${g.closedDate || g.supersededAt}`
            : g.startDate ? `Opened ${g.startDate}` : '',
        })),
      }]
    : CARE_GAP_SECTIONS_EXTENDED;

  const careGapSections = sourceSections.map(section => ({
    ...section,
    items: searchQuery
      ? section.items.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : section.items,
  }));

  // A tab switched off while open falls back to the first one shown.
  const currentTab = tabs.includes(activeTab) ? activeTab : tabs[0];
  const extraActive = !!(extraTabs && renderExtraTab && extraTabs.includes(activeTab));
  const itemAction = useMemo(
    () => (extraTabAction && extraTabs
      ? { ...extraTabAction, appliesTo: key => extraTabs.includes(key) }
      : undefined),
    [extraTabAction, extraTabs],
  );

  // Gaps tab widgets, keyed so the user's order applies; every header after
  // the first gets the extra top spacing.
  const gapWidgets = visibleWidgets(layout, 'Gaps(11)');
  const headerClass = key => (gapWidgets[0] === key ? styles.sectionHeader : `${styles.sectionHeader} ${styles.diagnosisHeader}`);
  const gapBlocks = {
    'care-gaps': (
          <>
            {/* Care Gaps header */}
            <div className={headerClass('care-gaps')}>
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
                  <ActionButton icon="custom:filter" size="sm" tooltip="Filter" />
                </div>
              )}
            </div>

            <div className={`${styles.collapseOuter} ${gapsCollapsed ? styles.collapsedSection : ''}`}>
              <div className={styles.collapseInner}>
                <div className={styles.sections}>
                  {careGapSections.map(section => (
                    <CareGapSection
                      key={section.title}
                      section={section}
                      selectedGaps={selectedGaps}
                      onToggleGap={toggleGap}
                      onOpenGap={openGap}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
    ),
    'diagnosis-gaps': (
          <>
            {/* Diagnosis Gaps header */}
            <div className={headerClass('diagnosis-gaps')}>
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
                  <ActionButton icon="custom:filter" size="sm" tooltip="Filter" />
                </div>
              )}
            </div>

            <div className={`${styles.collapseOuter} ${diagnosisCollapsed ? styles.collapsedSection : ''}`}>
              <div className={styles.collapseInner}>
                <div className={styles.sections}>
                  <DiagnosisGapsTable memberName={patient?.name} />
                </div>
              </div>
            </div>
          </>
    ),
    alerts: (
          <>
            {/* Alerts header */}
            <div className={headerClass('alerts')}>
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
                  <ActionButton icon="custom:filter" size="sm" tooltip="Filter" />
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
          </>
    ),
  };

  return (
    <div className={styles.panel}>
      {/* Sticky tab bar OR search input. Hidden when the tabs are hosted by
          the right-panel tab bar (collapsed layout). */}
      {showTabBar && (searching ? (
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
            <OverflowTabs
              items={tabItems}
              value={extraActive ? activeTab : currentTab}
              onValueChange={setActiveTab}
              itemAction={itemAction}
              moreActions={moreActions}
            />
          </div>
          {!extraActive && (
            <ActionButton
              icon="solar:magnifer-linear"
              size="sm"
              tooltip="Search gaps"
              className={styles.searchBtn}
              onClick={() => setSearching(true)}
            />
          )}
        </div>
      ))}

      {extraActive ? (
        <div className={styles.extraContent}>{renderExtraTab(activeTab)}</div>
      ) : (
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

        {currentTab === 'Gaps(11)' && (
          <div className={styles.gapsWrapper}>
            {gapWidgets.map(key => <Fragment key={key}>{gapBlocks[key]}</Fragment>)}
          </div>
        )}

        {currentTab === 'PAMI/Hx' && <PAMIHxTab patientId={patientId} widgets={visibleWidgets(layout, 'PAMI/Hx')} />}

        {currentTab === 'Vitals/Labs' && <VitalsLabsTab widgets={visibleWidgets(layout, 'Vitals/Labs')} patientId={patientId} />}

        {currentTab === 'Comms' && <CommsTab patient={patient} />}

        {currentTab === 'Outreach' && <OutreachTab memberName={patient?.name} classicForm />}

        {currentTab === 'Summary' && <SummaryTab widgets={visibleWidgets(layout, 'Summary')} />}

        {/* Tasks and Profile show here only in the QuickView drawer; on the
            full page they live in the right panel. */}
        {currentTab === 'Tasks' && <PatientTasksTab patient={patient} />}

        {currentTab === 'CRM' && <CrmTab patientId={patientId} />}

        {currentTab === 'Profile' && (
          <ProfileTab patient={patient || { id: patientId }} />
        )}
      </div>
      )}

      {customizing && (
        <PanelCustomizeDrawer
          layout={layout}
          available={allTabs}
          onSave={saveLayout}
          onClose={() => setCustomizing(false)}
        />
      )}

      {careGapDrawer && (
        <CareGapDetailDrawer
          member={careGapDrawer.member}
          gapCode={careGapDrawer.gapCode}
          year={careGapDrawer.year}
          onClose={() => setCareGapDrawer(null)}
        />
      )}
    </div>
  );
}
