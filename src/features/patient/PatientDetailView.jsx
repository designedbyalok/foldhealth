import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { PanelStack } from '../../components/PanelStack/PanelStack';
import { PatientP360Banner } from './shell/PatientP360Banner/PatientP360Banner';
import { PatientProfileTabs } from './left-panel/PatientProfileTabs/PatientProfileTabs';
import { ProfileTabBar } from './shell/ProfileTabBar/ProfileTabBar';
import { CareManagementView } from './right-panel/tabs/care-management/CareManagementView/CareManagementView';
import { OverviewTab } from './right-panel/tabs/overview/OverviewTab/OverviewTab';
import { MonitoringTab } from './right-panel/tabs/monitoring/MonitoringTab';
import { PatientNotesTab } from './right-panel/tabs/notes/PatientNotesTab';
import { ClinicalNotePreviewDrawer } from '../tasks/ClinicalNotePreviewDrawer';
import { ClinicalNotePanel } from '../hedis-worklist/ClinicalNotePanel';
import { ProfileTab } from './left-panel/tabs/profile/ProfileTab/ProfileTab';
import { TasksTab } from './left-panel/tabs/tasks/TasksTab/TasksTab';
import { CcmTimerWidget } from './shell/CcmTimerWidget/CcmTimerWidget';
import { CcmTimerDockProvider } from './shell/CcmTimerWidget/CcmTimerDockContext';
import { PatientBreadcrumb } from './shell/PatientBreadcrumb/PatientBreadcrumb';
import { ProgramPanel } from './right-panel/tabs/care-programs/program-detail/ProgramPanel/ProgramPanel';
import { useProgramPanelSplitTarget } from './hooks/useProgramPanelSplitActive';
import { PatientCarePlanPane } from './right-panel/tabs/care-management/PatientCarePlanPane/PatientCarePlanPane';
import { programUrlKey } from './right-panel/tabs/care-programs/CareProgramsTab/CareProgramsTab.utils';
import { CARE_GAP_TABS } from './data/careGapsMock';
import { PROFILE_TABS } from './data/programActivityMock';
import styles from './PatientDetailView.module.css';

// Split layout: the right card belongs to the care program, so the right
// panel's other tabs join the patient card's tab strip. Care Management is
// left out because the program card already is that view.
const SPLIT_EXTRA_TABS = PROFILE_TABS.filter(tab => tab !== 'Care Management');

// Left-panel collapse is remembered per user (keyed by profile id) in
// localStorage so it survives reloads. A `:last` mirror holds the most recent
// choice on this device and seeds the first paint before the user profile has
// loaded, so a single-user browser never flickers open→closed on reload.
const COLLAPSE_KEY = 'patientLeftPanelCollapsed';
function readCollapse(id) {
  try { return localStorage.getItem(`${COLLAPSE_KEY}:${id}`); } catch { return null; }
}
function writeCollapse(id, value) {
  try {
    localStorage.setItem(`${COLLAPSE_KEY}:${id}`, String(value));
    localStorage.setItem(`${COLLAPSE_KEY}:last`, String(value));
  } catch { /* storage unavailable (private mode) */ }
}

function TabPlaceholder({ tabName }) {
  return (
    <div className={styles.placeholder}>
      <Icon name="solar:widget-2-linear" size={40} color="var(--neutral-150)" />
      <span className={styles.placeholderTitle}>{tabName}</span>
      <span className={styles.placeholderText}>This section is under development</span>
    </div>
  );
}

// Every worklist (HCC, AWV, CCM, SNP, HEDIS) keeps its own member slice
// with a compact row shape (id, in, g, memberId, …). The patient banner
// expects the fuller patients-table shape, so we normalize any worklist
// row into that shape before the profile view consumes it.
function worklistMemberToPatient(m) {
  if (!m) return null;
  // Field naming diverges across slices: HCC/AWV use short `in`/`g`,
  // CCM/SNP/HEDIS use full `initials`/`gender`. Read both so a slice with
  // either shape flows through to the banner.
  const rawG = m.g ?? m.gender;
  return {
    id: m.id,
    memberId: m.memberId,
    name: m.name,
    initials: m.in || m.initials || (m.name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
    gender: rawG === 'M' ? 'Male' : rawG === 'F' ? 'Female' : (rawG || ''),
    age: m.age,
    dob: m.dob,
    pcp: m.pcp,
    rp: m.rp,
    language: m.language || 'en',
    patientAppActive: m.patientAppActive ?? false,
  };
}

export function PatientDetailView() {
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const patients = useAppStore(s => s.patients);
  const hccMembers = useAppStore(s => s.hccMembers);
  const awvMembers = useAppStore(s => s.awvMembers);
  const ccmWorklistMembers = useAppStore(s => s.ccmWorklistMembers);
  const snpWorklistMembers = useAppStore(s => s.snpWorklistMembers);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const allPatients = useAppStore(s => s.allPatients);
  const fetchPatients = useAppStore(s => s.fetchPatients);
  const fetchHccMembers = useAppStore(s => s.fetchHccMembers);
  const fetchAwvMembers = useAppStore(s => s.fetchAwvMembers);
  const fetchCcmWorklistMembers = useAppStore(s => s.fetchCcmWorklistMembers);
  const fetchSnpWorklistMembers = useAppStore(s => s.fetchSnpWorklistMembers);
  const fetchHedisMembers = useAppStore(s => s.fetchHedisMembers);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const fetchOrgFeatures = useAppStore(s => s.fetchOrgFeatures);
  const navigateBackToWorklist = useAppStore(s => s.navigateBackToWorklist);
  const patientsLoading = useAppStore(s => s.patientsLoading);
  const patientsDidFetch = useAppStore(s => s.patientsDidFetch);
  const hccMembersLoading = useAppStore(s => s.hccMembersLoading);
  const hccMembersDidFetch = useAppStore(s => s.hccMembersDidFetch);
  const awvMembersLoading = useAppStore(s => s.awvMembersLoading);
  const awvMembersDidFetch = useAppStore(s => s.awvMembersDidFetch);
  const ccmWorklistLoading = useAppStore(s => s.ccmWorklistLoading);
  const ccmWorklistDidFetch = useAppStore(s => s.ccmWorklistDidFetch);
  const snpWorklistLoading = useAppStore(s => s.snpWorklistLoading);
  const snpWorklistDidFetch = useAppStore(s => s.snpWorklistDidFetch);
  const hedisLoading = useAppStore(s => s.hedisLoading);
  const hedisDidFetch = useAppStore(s => s.hedisDidFetch);
  const allPatientsLoading = useAppStore(s => s.allPatientsLoading);
  const allPatientsDidFetch = useAppStore(s => s.allPatientsDidFetch);
  // Active profile tab is stored on the store so callers (e.g. the CCM
  // worklist's "View billing" button) can deep-link into a specific tab.
  const activeTab = useAppStore(s => s.patientProfileTab);
  const setActiveTab = useAppStore(s => s.setPatientProfileTab);
  const currentUserId = useAppStore(s => s.currentUserProfile?.id);
  // 'program' | 'patient-plan' | null: what the split's main panel shows.
  const splitTarget = useProgramPanelSplitTarget();
  const programSplit = splitTarget !== null;
  // Split layout's panel stack, right of the patient card: the main panel
  // (program or patient-level plan) plus any right-panel tabs opened as
  // panels, in display order, and the panel in view. Keyed to the main panel
  // it was built over, so opening another program (or re-entering the split)
  // starts from that panel alone.
  const programKey = useAppStore(s => s.selectedCareProgramKey);
  // The main panel the stack was built over: the open program, or the
  // patient-level care plan.
  const primaryKey = splitTarget === 'patient-plan' ? 'patient-plan' : programKey;
  const careProgramsByPatient = useAppStore(s => s.careProgramsByPatient);
  const [stackState, setStackState] = useState(null); // { programKey, ids, activeId }
  const stack = stackState && stackState.programKey === primaryKey
    ? stackState
    : { programKey: primaryKey, ids: ['program'], activeId: 'program' };
  const [leftWidth, setLeftWidth] = useState(496);
  // Seed from the device's most recent choice so the first paint matches;
  // the per-user value is reconciled once the profile id resolves (below).
  const [leftCollapsed, setLeftCollapsed] = useState(() => readCollapse('last') === 'true');
  // Left-panel tab, lifted here so it survives collapse: when the panel is
  // collapsed its tabs flow into the right-panel tab bar and its content
  // renders in the right panel. `showingLeftContent` is only meaningful while
  // collapsed — true means a flowed-in left tab is the active view.
  const [leftTabRaw, setLeftTab] = useState(CARE_GAP_TABS[0]);
  // The split hosts the right panel's tabs here too; outside it, a hosted
  // tab has no home in this panel, so fall back to Gaps.
  const leftTab = programSplit || CARE_GAP_TABS.includes(leftTabRaw) ? leftTabRaw : CARE_GAP_TABS[0];
  const [showingLeftContent, setShowingLeftContent] = useState(false);
  const dragging = useRef(false);
  const bodyRef = useRef(null);

  // Collapsed: the tab bar is the merged [right tabs, …left tabs]. Route a
  // click to the correct side and record which content the right panel shows.
  const handleRightTabChange = useCallback((key) => {
    if (leftCollapsed && CARE_GAP_TABS.includes(key)) {
      setLeftTab(key);
      setShowingLeftContent(true);
    } else {
      setActiveTab(key);
      setShowingLeftContent(false);
    }
  }, [leftCollapsed, setActiveTab]);

  // Once the signed-in user is known, load their saved collapse state (only if
  // they have one — a new user keeps the device default until they toggle).
  useEffect(() => {
    if (!currentUserId) return;
    const saved = readCollapse(currentUserId);
    if (saved !== null) setLeftCollapsed(saved === 'true');
  }, [currentUserId]);

  // Toggling the panel flows the left tabs back to the left panel; the right
  // panel returns to its own active tab, and the choice is persisted per user.
  const toggleLeft = useCallback(() => {
    const wasCollapsed = leftCollapsed;
    const next = !leftCollapsed;
    writeCollapse(currentUserId || 'anon', next);
    setLeftCollapsed(next);
    if (wasCollapsed) setShowingLeftContent(false);
  }, [currentUserId, leftCollapsed]);

  // While collapsed and viewing a flowed-in left tab, the tab bar's active key
  // is that left tab; otherwise it's the right tab.
  const barActiveTab = leftCollapsed && showingLeftContent ? leftTab : activeTab;

  // Keep the left panel mounted through the collapse animation so it slides
  // out (width + fade) instead of snapping, then unmount it. On expand it
  // mounts immediately and slides back in.
  const [leftMounted, setLeftMounted] = useState(!leftCollapsed);
  useEffect(() => {
    if (!leftCollapsed) { setLeftMounted(true); return undefined; }
    const t = setTimeout(() => setLeftMounted(false), 320); // matches CSS width transition
    return () => clearTimeout(t);
  }, [leftCollapsed]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      if (!dragging.current || !bodyRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const newWidth = Math.max(300, Math.min(700, e.clientX - rect.left));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Fall back through every worklist slice when the id isn't in the main
  // patients list — those rows live in separate slices and shouldn't 404.
  // Also match by memberId so a deep-link URL with the fold id (from
  // #/population/<list>/patient/<memberId>) resolves before the router's
  // reverse lookup has store data to work with.
  const matchesId = m => m && (m.id === selectedPatientId || String(m.memberId) === String(selectedPatientId));
  const patient = patients.find(matchesId)
    || worklistMemberToPatient(hccMembers.find(matchesId))
    || worklistMemberToPatient(awvMembers?.find(matchesId))
    || worklistMemberToPatient(ccmWorklistMembers?.find(matchesId))
    || worklistMemberToPatient(snpWorklistMembers?.find(matchesId))
    || worklistMemberToPatient(hedisMembers?.find(matchesId))
    || worklistMemberToPatient(allPatients?.find(matchesId));

  // Worklist slices don't all carry patient_app_active — merge from the
  // patients / all_patients tables when the resolved row is missing it.
  const patientWithAppStatus = useMemo(() => {
    if (!patient) return null;
    if (patient.patientAppActive != null) return patient;
    const byMember = (rows) => rows?.find(
      (r) => r.id === patient.id || String(r.memberId) === String(patient.memberId),
    );
    const source = byMember(patients) || byMember(allPatients);
    if (!source || source.patientAppActive == null) return patient;
    return { ...patient, patientAppActive: source.patientAppActive };
  }, [patient, patients, allPatients]);

  // The app assumes we're always inside a real patient's record — if the id
  // doesn't resolve to a patient (e.g. a stale hash from a deleted row, or a
  // worklist row wired to a placeholder id), bounce straight back to the
  // worklist instead of showing an orphan "Patient not found" screen.
  // A slice is still resolving when it's empty and either hasn't been fetched
  // yet or its fetch is in flight. Wait for every slice before deciding the
  // patient id is stale — otherwise the first slice to return (often
  // `patients`) trips the bounce while SNP/HCC rows are still loading.
  const slicePending = (items, didFetch, loading) =>
    (items?.length || 0) === 0 && (!didFetch || loading);
  const patientLookupPending = selectedPatientId && !patient && (
    slicePending(patients, patientsDidFetch, patientsLoading)
    || slicePending(hccMembers, hccMembersDidFetch, hccMembersLoading)
    || slicePending(awvMembers, awvMembersDidFetch, awvMembersLoading)
    || slicePending(ccmWorklistMembers, ccmWorklistDidFetch, ccmWorklistLoading)
    || slicePending(snpWorklistMembers, snpWorklistDidFetch, snpWorklistLoading)
    || slicePending(hedisMembers, hedisDidFetch, hedisLoading)
    || slicePending(allPatients, allPatientsDidFetch, allPatientsLoading)
  );

  // Cold-refresh into a patient URL (e.g. #/population/toc/patient/10003)
  // arrives with every worklist slice empty because no table has mounted
  // to trigger a fetch. Kick off every empty slice so the patient lookup
  // (matchesId across every slice) can resolve. Guarded by
  // `selectedPatientId && !patient` so this only fires while we're
  // actually stuck looking for a patient, not on normal profile mounts
  // where the row is already in memory.
  useEffect(() => { fetchOrgFeatures?.(); }, [fetchOrgFeatures]);

  useEffect(() => {
    if (!selectedPatientId || patient) return;
    if (patients.length === 0) fetchPatients?.();
    if (hccMembers.length === 0) fetchHccMembers?.();
    if ((awvMembers?.length || 0) === 0) fetchAwvMembers?.();
    if ((ccmWorklistMembers?.length || 0) === 0) fetchCcmWorklistMembers?.();
    if ((snpWorklistMembers?.length || 0) === 0) fetchSnpWorklistMembers?.();
    if ((hedisMembers?.length || 0) === 0) fetchHedisMembers?.();
    if ((allPatients?.length || 0) === 0) fetchAllPatients?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, patient]);
  useEffect(() => {
    if (selectedPatientId && !patient && !patientLookupPending) navigateBackToWorklist();
  }, [selectedPatientId, patient, patientLookupPending, navigateBackToWorklist]);

  // Deep links carry the fold member id; normalize to the store row id once
  // slices load so downstream fetches (care programs, P360) query correctly.
  useEffect(() => {
    if (!patient?.id || !selectedPatientId || patient.id === selectedPatientId) return;
    if (String(patient.memberId) === String(selectedPatientId)) {
      useAppStore.setState({ selectedPatientId: patient.id });
    }
  }, [patient, selectedPatientId]);

  if (!patientWithAppStatus) return null;

  // Floating shell, program opened "in right panel": the patient's context
  // (trail, compact banner, care-gap tabs) is one card and the program is a
  // full-height card beside it. The P360 banner and the profile tab bar step
  // aside; closing the program or "Open Inline" brings them back.
  // One renderer for the right panel's tabs, shared by the standard layout
  // and the split (where they render in the patient card or the side panel).
  const renderRightTab = (tab) => (
    tab === 'Overview' ? <OverviewTab />
      : tab === 'Monitoring' ? <MonitoringTab patient={patientWithAppStatus} />
        : tab === 'Notes' ? <PatientNotesTab patient={patientWithAppStatus} />
          : tab === 'Care Management' ? <CareManagementView />
            : tab === 'Profile' ? <ProfileTab patient={patientWithAppStatus} />
              : tab === 'Tasks' ? <TasksTab />
                : <TabPlaceholder tabName={tab} />
  );

  if (programSplit) {
    // A hosted tab opens in the patient card by default. "Open in panel" (its
    // row in the More dropdown, or the hosted view's header) adds it to the
    // stack right after the patient card, ahead of the panel that was in
    // view, which stays peeking at the edge.
    const TAB_PREFIX = 'tab:';
    const panelIdFor = (tab) => `${TAB_PREFIX}${tab}`;
    // Functional so back-to-back updates (reorder, then focus the moved
    // panel) build on each other instead of on this render's snapshot.
    const setStack = (patch) => setStackState((prev) => {
      const base = prev && prev.programKey === primaryKey ? prev : stack;
      return { ...base, ...(typeof patch === 'function' ? patch(base) : patch) };
    });
    const openInPanel = (tab) => {
      const id = panelIdFor(tab);
      setStack(base => ({ ids: base.ids.includes(id) ? base.ids : [id, ...base.ids], activeId: id }));
      if (leftTab === tab) setLeftTab(CARE_GAP_TABS[0]);
    };
    const removePanel = (id) => setStack((base) => {
      const idx = base.ids.indexOf(id);
      const ids = base.ids.filter(x => x !== id);
      return { ids, activeId: base.activeId === id ? ids[Math.min(idx, ids.length - 1)] : base.activeId };
    });
    const moveToLeftPanel = (id) => {
      removePanel(id);
      setLeftTab(id.slice(TAB_PREFIX.length));
    };
    // A tab that's already a panel focuses that panel rather than opening a
    // second copy in the patient card.
    const handleLeftTabChange = (tab) => {
      if (stack.ids.includes(panelIdFor(tab))) setStack({ activeId: panelIdFor(tab) });
      else setLeftTab(tab);
    };
    const panelAction = {
      icon: 'solar:sidebar-minimalistic-linear',
      label: (item) => `Open ${item.label} in a panel`,
      onSelect: openInPanel,
    };
    const renderHostedTab = (tab) => (
      <div className={styles.hostedTab}>
        <div className={styles.hostedTabHeader}>
          <span className={styles.hostedTabTitle}>{tab}</span>
          <ActionButton
            icon="solar:sidebar-minimalistic-linear"
            size="S"
            tooltip="Open in panel"
            onClick={() => openInPanel(tab)}
          />
        </div>
        <div className={styles.hostedTabBody}>{renderRightTab(tab)}</div>
      </div>
    );
    const programName = (careProgramsByPatient[selectedPatientId] || [])
      .find(p => programUrlKey(p) === programKey)?.name || 'Care Program';
    const panels = stack.ids.map((id) => {
      if (id === 'program') {
        return splitTarget === 'patient-plan'
          ? { id, title: 'Care Plan', content: <PatientCarePlanPane patientId={selectedPatientId} /> }
          : { id, title: programName, content: <ProgramPanel /> };
      }
      const tab = id.slice(TAB_PREFIX.length);
      return {
        id,
        title: tab,
        actions: (
          <ActionButton
            icon="solar:sidebar-minimalistic-linear"
            size="S"
            tooltip="Move to patient panel"
            onClick={() => moveToLeftPanel(id)}
          />
        ),
        onClose: () => removePanel(id),
        content: <div className={styles.hostedTabBody}>{renderRightTab(tab)}</div>,
      };
    });
    return (
      <CcmTimerDockProvider>
      <div className={styles.split} ref={bodyRef}>
        <section className={styles.splitPatientCard} style={{ width: leftWidth }} aria-label="Patient">
          <PatientBreadcrumb patientName={patientWithAppStatus.name} />
          <PatientP360Banner patient={patientWithAppStatus} variant="drawer" />
          <div className={styles.splitPatientTabs}>
            <PatientProfileTabs
              patientId={selectedPatientId}
              patient={patientWithAppStatus}
              activeTab={leftTab}
              onTabChange={handleLeftTabChange}
              extraTabs={SPLIT_EXTRA_TABS}
              renderExtraTab={renderHostedTab}
              extraTabAction={panelAction}
            />
          </div>
        </section>
        {/* A resize separator: pointer drag, or arrow keys step the width
            within the same 300–700px range the drag clamps to. */}
        <div
          className={styles.splitHandle}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize patient panel"
          aria-valuenow={leftWidth}
          aria-valuemin={300}
          aria-valuemax={700}
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const step = e.key === 'ArrowLeft' ? -16 : 16;
            setLeftWidth(w => Math.max(300, Math.min(700, w + step)));
          }}
        >
          <div className={styles.dragHandleLine} />
        </div>
        <PanelStack
          panels={panels}
          activeId={stack.activeId}
          onActiveChange={(activeId) => setStack({ activeId })}
          onReorder={(ids) => setStack({ ids })}
          ariaLabel="Open panels"
        />
      </div>
      <CcmTimerWidget patient={patient} />
      <P360NotePreviewMount />
      </CcmTimerDockProvider>
    );
  }

  return (
    <CcmTimerDockProvider>
    <div className={styles.wrapper}>
      <PatientP360Banner patient={patientWithAppStatus} />
      <CcmTimerWidget patient={patient} />
      <div className={styles.body} ref={bodyRef}>
        {leftMounted && (
          <>
            <div
              className={`${styles.leftPanel} ${leftCollapsed ? styles.leftPanelCollapsed : ''}`}
              style={{ width: leftCollapsed ? 0 : leftWidth }}
            >
              {/* Fixed-width inner keeps the content's shape while the outer
                  clips it, so collapse reads as a slide rather than a reflow. */}
              <div className={styles.leftPanelInner} style={{ width: leftWidth }}>
                <PatientProfileTabs
                  patientId={selectedPatientId}
                  patient={patientWithAppStatus}
                  activeTab={leftTab}
                  onTabChange={setLeftTab}
                />
              </div>
            </div>
            {/* Drag handle — fades with the panel it borders. */}
            <div
              className={`${styles.dragHandle} ${leftCollapsed ? styles.dragHandleHidden : ''}`}
              onMouseDown={handleMouseDown}
            >
              <div className={styles.dragHandleLine} />
            </div>
          </>
        )}
        <div className={styles.rightPanel}>
          <ProfileTabBar
            activeTab={barActiveTab}
            onTabChange={handleRightTabChange}
            leftCollapsed={leftCollapsed}
            onToggleLeft={toggleLeft}
            extraTabs={leftCollapsed ? CARE_GAP_TABS : undefined}
          />
          <div className={styles.tabContent}>
            {leftCollapsed && showingLeftContent ? (
              // Left tabs flowed into this panel: render the left content here,
              // capped + centered so a narrow form doesn't stretch across the
              // now-full-width panel.
              <div className={styles.centeredContent}>
                <PatientProfileTabs
                  patientId={selectedPatientId}
                  patient={patientWithAppStatus}
                  activeTab={leftTab}
                  onTabChange={setLeftTab}
                  showTabBar={false}
                />
              </div>
            ) : renderRightTab(activeTab)}
          </div>
        </div>
      </div>
      <P360NotePreviewMount />
    </div>
    </CcmTimerDockProvider>
  );
}

/**
 * P360-level mount for the standalone `ClinicalNotePreviewDrawer`, driven
 * by the store's `previewNoteFromHover` slice. The P360 Notes tab (and
 * anywhere else on this page that calls `openNotePreview`) needs a mount
 * point — TasksView already owns one for the Tasks page, but P360 didn't
 * have one, so the Notes-tab View action was a silent no-op.
 */
function P360NotePreviewMount() {
  const previewNote = useAppStore(s => s.previewNoteFromHover);
  const closeNotePreview = useAppStore(s => s.closeNotePreview);
  // Same edit-hover slice TasksView uses so the P360 preview's Edit /
  // Amend button opens the note in a ClinicalNotePanel right here on
  // the P360 page instead of silently no-op'ing or navigating away.
  const setEditHoverNote = useAppStore(s => s.setEditHoverNote);
  const clearEditHoverNote = useAppStore(s => s.clearEditHoverNote);
  const editHoverNote = useAppStore(s => s.editHoverNote);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const fetchHedisMembers = useAppStore(s => s.fetchHedisMembers);
  useEffect(() => { fetchHedisMembers?.(); }, [fetchHedisMembers]);
  const editHoverMember = editHoverNote?.hedisMemberId
    ? hedisMembers.find(m => m.id === editHoverNote.hedisMemberId)
    : null;
  if (!previewNote && !editHoverNote) return null;
  return (
    <>
      {previewNote && (
        <ClinicalNotePreviewDrawer
          note={previewNote}
          onClose={closeNotePreview}
          onEdit={(note) => setEditHoverNote?.(note)}
        />
      )}
      {editHoverNote && editHoverMember && (
        <ClinicalNotePanel
          member={editHoverMember}
          gapCode={editHoverNote.gapCodes?.[0]}
          year={new Date().getFullYear()}
          editingTaskId={editHoverNote.reviewTaskId}
          onClose={clearEditHoverNote}
        />
      )}
    </>
  );
}
