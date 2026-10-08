import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../../../../components/Icon/Icon';
import { Button } from '../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { FilterChip } from '../../../../../../components/FilterChip/FilterChip';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { SubTabs } from '../../../../../../components/SubTabs/SubTabs';
import { useAppStore } from '../../../../../../store/useAppStore';
import { CareProgramsTab } from '../../care-programs/CareProgramsTab/CareProgramsTab';
import { CarePlanSummaryView } from '../../care-programs/care-plan/summary/CarePlanSummaryView/CarePlanSummaryView.jsx';
import { buildCarePlanSnapshot, filterCarePlanSnapshot, downloadCarePlanCsv, CARE_PLAN_DATE_PRESETS } from '../../care-programs/care-plan/summary/carePlanSnapshot';
import { programUrlKey } from '../../care-programs/CareProgramsTab/CareProgramsTab.utils';
import { stepsFor, flatSteps } from '../../care-programs/program-detail/ProgramDetailView/ProgramDetailView.utils';
import { CareManagementToolbar } from '../CareManagementToolbar/CareManagementToolbar';
import { PatientCarePlanPane } from '../PatientCarePlanPane/PatientCarePlanPane';
import { RollupSignButton } from '../../care-programs/care-plan/summary/RollupSignButton';
import { showsPatientCarePlan } from '../../care-programs/care-plan/lib/carePlanMode';
import { ProgramActivityDay } from '../ProgramActivityCard/ProgramActivityCard.jsx';
import { groupProgramActivity } from '../programActivity';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { RingEmptyState } from '../../../../../../components/RingEmptyState/RingEmptyState';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { CM_FILTERS } from '../../../../data/programActivityMock';
import { resolvePatientStoreId } from '../../../../../../lib/resolvePatientStoreId';
import styles from './CareManagementView.module.css';

// Program-level orgs get the read-only Comprehensive roll-up; patient-level
// and both-level orgs get an editable "Care Plan" in its place.
const CM_TABS_PROGRAM = ['Care Programs', 'Comprehensive Care Plan', 'Program Activity Log'];
const CM_TABS_PATIENT = ['Care Programs', 'Care Plan', 'Program Activity Log'];

/** Shared "Add Care Note" drawer used by both the Comprehensive
 *  Care Plan and Program Activity Log panes. Composer only for now —
 *  hands the note body back to the caller, which decides how to
 *  persist it (toast placeholder until the patient-level notes API
 *  ships). */
function AddCareNoteDrawer({ onClose, onSave }) {
  const [body, setBody] = useState('');
  const canSave = body.trim().length > 0;
  return (
    <Drawer
      title="Add Care Note"
      onClose={onClose}
      primaryAction={(
        <Button variant="primary" size="L" disabled={!canSave} onClick={() => onSave?.(body.trim())}>
          Add Note
        </Button>
      )}
      secondaryAction={(
        <Button variant="secondary" size="L" onClick={onClose}>Cancel</Button>
      )}
    >
      <div className={styles.addNoteBody}>
        <label className={styles.addNoteLabel} htmlFor="care-note-body">Note</label>
        <Textarea
          id="care-note-body"
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Reviewed care plan with patient; increased dietary check-ins."
          rows={6}
        />
      </div>
    </Drawer>
  );
}

/** Comprehensive Care Plan pane — read-only cross-program snapshot with its own
 *  search + (program) filter and a Download CTA. */
function ComprehensiveCarePlanPane({ header, patientId, programs, onClose, onOpenProgramStep, editable = false }) {
  const showToast = useAppStore(s => s.showToast);
  const patientCarePlans = useAppStore(s => s.patientCarePlans);
  const carePlanTemplates = useAppStore(s => s.carePlanTemplates) || [];
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [programFilter, setProgramFilter] = useState([]);
  const [templateFilter, setTemplateFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [dueDateFilter, setDueDateFilter] = useState([]);
  const [createdDateFilter, setCreatedDateFilter] = useState([]);

  const programCodes = useMemo(() => [...new Set(programs.map(p => p.code))], [programs]);
  // Option lists — only surface template / status / priority values
  // that actually appear on this patient's plans, so the popovers
  // never show empty rows.
  const snapshot = useMemo(
    () => buildCarePlanSnapshot(programs, patientCarePlans, patientId),
    [programs, patientCarePlans, patientId],
  );
  const allRows = useMemo(
    () => [...snapshot.goals, ...snapshot.interventions, ...(snapshot.barriers || [])],
    [snapshot],
  );
  const templateOptions = useMemo(() => {
    const usedIds = new Set(allRows.flatMap(r => r.templateIds || []));
    return carePlanTemplates
      .filter(t => usedIds.has(t.id))
      .map(t => ({ id: t.id, name: t.name || t.title || t.id }));
  }, [allRows, carePlanTemplates]);
  const templateNames = useMemo(() => templateOptions.map(t => t.name), [templateOptions]);
  const nameToTemplateId = useMemo(
    () => Object.fromEntries(templateOptions.map(t => [t.name, t.id])),
    [templateOptions],
  );
  const statusOptions   = useMemo(() => [...new Set(allRows.map(r => r.status).filter(Boolean))], [allRows]);
  const priorityOptions = useMemo(() => [...new Set(allRows.map(r => r.priority).filter(Boolean))], [allRows]);

  const templateIdsSelected = useMemo(
    () => templateFilter.map(name => nameToTemplateId[name]).filter(Boolean),
    [templateFilter, nameToTemplateId],
  );

  const activeCount = [
    programFilter, templateFilter, statusFilter,
    priorityFilter, dueDateFilter, createdDateFilter,
  ].reduce((n, f) => n + (f.length > 0 ? 1 : 0), 0);
  const clearAll = () => {
    setProgramFilter([]);
    setTemplateFilter([]);
    setStatusFilter([]);
    setPriorityFilter([]);
    setDueDateFilter([]);
    setCreatedDateFilter([]);
  };

  const handleDownload = () => {
    const filtered = filterCarePlanSnapshot(snapshot, {
      searchText,
      programFilter,
      templateFilter: templateIdsSelected,
      statusFilter,
      priorityFilter,
      dueDateFilter,
      createdDateFilter,
    });
    if (filtered.goals.length === 0 && filtered.interventions.length === 0) {
      showToast?.('No care plan data to download');
      return;
    }
    downloadCarePlanCsv(filtered, `care-plan-${patientId || 'patient'}`);
    showToast?.('Care plan downloaded');
  };

  return (
    <div className={styles.pane}>
      <CareManagementToolbar
        header={header}
        searchMode={searchMode} setSearchMode={setSearchMode}
        searchText={searchText} setSearchText={setSearchText}
        searchPlaceholder="Search goals & interventions"
        showFilters={showFilters} setShowFilters={setShowFilters}
        cta={(
          /* Icon-only cluster: note (opens the Add Care Note drawer)
             then download (streams the CSV). Grouped so the two CTAs
             hug the toolbar's right edge like the rest of the app's
             icon actions. */
          <div className={styles.ctaCluster}>
            <ActionButton
              icon="solar:notes-linear"
              size="L"
              tooltip="Add care note"
              tooltipBelow
              tooltipLeft
              onClick={() => setAddNoteOpen(true)}
            />
            <span className={styles.ctaDivider} aria-hidden="true" />
            <ActionButton
              icon="solar:download-minimalistic-linear"
              size="L"
              tooltip="Download"
              tooltipBelow
              tooltipLeft
              onClick={handleDownload}
            />
            {/* Both-level orgs edit every program's plan here, so they sign
                here too: one Sign covers each plan with unsigned changes. */}
            {editable && (
              <>
                <span className={styles.ctaDivider} aria-hidden="true" />
                <RollupSignButton patientId={patientId} programs={programs} />
              </>
            )}
          </div>
        )}
        filterBar={(
          <div className={styles.filterBar}>
            <FilterChip label="Program" options={programCodes} selected={programFilter} onChange={setProgramFilter} />
            <FilterChip label="Care Plan Template" options={templateNames} selected={templateFilter} onChange={setTemplateFilter} searchable />
            <FilterChip label="Status" options={statusOptions} selected={statusFilter} onChange={setStatusFilter} />
            <FilterChip label="Priority" options={priorityOptions} selected={priorityFilter} onChange={setPriorityFilter} />
            <FilterChip label="Due Date" options={CARE_PLAN_DATE_PRESETS} selected={dueDateFilter} onChange={setDueDateFilter} />
            <FilterChip label="Create Date" options={CARE_PLAN_DATE_PRESETS} selected={createdDateFilter} onChange={setCreatedDateFilter} />
            {activeCount > 0 && (
              <button type="button" className={styles.clearAll} onClick={clearAll}>
                <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
                Clear All
              </button>
            )}
          </div>
        )}
      />
      <div className={styles.paneBody}>
        <CarePlanSummaryView
          embedded
          editable={editable}
          patientId={patientId}
          programs={programs}
          searchText={searchText}
          programFilter={programFilter}
          templateFilter={templateIdsSelected}
          statusFilter={statusFilter}
          priorityFilter={priorityFilter}
          dueDateFilter={dueDateFilter}
          createdDateFilter={createdDateFilter}
          onClose={onClose}
          onOpenProgramStep={onOpenProgramStep}
        />
      </div>
      {addNoteOpen && (
        <AddCareNoteDrawer
          onClose={() => setAddNoteOpen(false)}
          onSave={(body) => {
            setAddNoteOpen(false);
            showToast?.(`Care note saved${body ? '' : ''}`);
          }}
        />
      )}
    </div>
  );
}

/** Program Activity Log — the monthly activity timeline with its own search +
 *  filter and an Add Care Note CTA. */
function ProgramActivityLog({ header }) {
  const showToast = useAppStore(s => s.showToast);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const patientId = useAppStore(s => resolvePatientStoreId(s, s.selectedPatientId));
  const fetchPatientProgramActivity = useAppStore(s => s.fetchPatientProgramActivity);
  const activityByPatient = useAppStore(s => s.patientProgramActivity);
  const loadingMap = useAppStore(s => s.patientProgramActivityLoading);
  const loadedFor = useAppStore(s => s.patientProgramActivityLoadedFor);
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState({});

  useEffect(() => {
    if (patientId) fetchPatientProgramActivity(patientId);
  }, [patientId, fetchPatientProgramActivity]);

  const entries = activityByPatient[patientId] || [];
  const loading = !!loadingMap[patientId] && !loadedFor[patientId];

  const months = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const filtered = q
      ? entries.filter(e => `${e.programName} ${e.programCode} ${e.title} ${e.actorName}`.toLowerCase().includes(q))
      : entries;
    return groupProgramActivity(filtered);
  }, [entries, searchText]);

  return (
    <div className={styles.pane}>
      <CareManagementToolbar
        header={header}
        searchMode={searchMode} setSearchMode={setSearchMode}
        searchText={searchText} setSearchText={setSearchText}
        searchPlaceholder="Search activity"
        showFilters={showFilters} setShowFilters={setShowFilters}
        cta={(
          <Button
            variant="tertiary"
            size="L"
            leadingIconElement={<AddIconMinimalist size={16} />}
            onClick={() => setAddNoteOpen(true)}
          >
            Add Care Note
          </Button>
        )}
        filterBar={(
          <div className={styles.filterBar}>
            {CM_FILTERS.map(f => (
              <FilterChip key={f.label} label={f.label} options={[]} selected={[]} onChange={() => {}} />
            ))}
          </div>
        )}
      />
      <div className={styles.timeline}>
        {loading ? (
          <CardSkeleton count={4} />
        ) : months.length === 0 ? (
          <RingEmptyState icon="solar:clipboard-list-linear" label={searchText ? 'No matching activity' : 'No program activity yet'} />
        ) : (
          months.map(month => {
            const collapsed = !!collapsedMonths[month.key];
            return (
              <div key={month.key} className={styles.monthSection}>
                <button
                  type="button"
                  className={styles.monthToggle}
                  onClick={() => setCollapsedMonths(s => ({ ...s, [month.key]: !s[month.key] }))}
                  aria-expanded={!collapsed}
                >
                  <span className={styles.monthTitle}>{month.label}</span>
                  <DownChevronIcon
                    size={13}
                    color="var(--neutral-500)"
                    className={`${styles.monthChevron} ${collapsed ? styles.monthChevronClosed : ''}`}
                  />
                </button>
                {!collapsed && month.days.map(day => (
                  <ProgramActivityDay key={day.key} day={day} />
                ))}
              </div>
            );
          })
        )}
      </div>
      {addNoteOpen && (
        <AddCareNoteDrawer
          onClose={() => setAddNoteOpen(false)}
          onSave={() => {
            setAddNoteOpen(false);
            showToast?.('Care note saved');
          }}
        />
      )}
    </div>
  );
}

/**
 * Care Management — a secondary switch (SubTabs) over the three program views.
 * Every tab shares the same toolbar layout (search · sub-tabs · CTA · filter);
 * only the CTA changes per tab. Each pane reuses its existing, data-backed view.
 */
export function CareManagementView() {
  // Sub-tab lives in the store so it rides the URL and survives a refresh.
  const storedSubTab = useAppStore(s => s.careManagementTab);
  const carePlanMode = useAppStore(s => s.carePlanMode);
  const patientLevel = showsPatientCarePlan(carePlanMode);
  const cmTabs = patientLevel ? CM_TABS_PATIENT : CM_TABS_PROGRAM;
  // A link or a mode switch can name the other level's plan tab; show this
  // org's equivalent rather than an empty pane.
  const subTab = cmTabs.includes(storedSubTab)
    ? storedSubTab
    : (storedSubTab === 'Care Plan' || storedSubTab === 'Comprehensive Care Plan'
      ? (patientLevel ? 'Care Plan' : 'Comprehensive Care Plan')
      : 'Care Programs');
  const setSubTab = useAppStore(s => s.setCareManagementTab);
  const patientId = useAppStore(s => s.selectedPatientId);
  const careProgramsByPatient = useAppStore(s => s.careProgramsByPatient);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const openCareProgram = useAppStore(s => s.openCareProgram);
  const setCareProgramStep = useAppStore(s => s.setCareProgramStep);

  useEffect(() => {
    if (patientId) fetchCareProgramsForPatient(patientId);
  }, [patientId, fetchCareProgramsForPatient]);

  const programs = useMemo(
    () => careProgramsByPatient[patientId] || [],
    [careProgramsByPatient, patientId],
  );

  // From the comprehensive view, hand off to the owning program's Care Plan
  // step: open the program (store) and switch to the Care Programs sub-tab so
  // CareProgramsTab renders it.
  const openProgramAtCarePlan = (program) => {
    const carePlanStep = flatSteps(stepsFor(program.code)).find(s => s.name.toLowerCase().includes('care plan'));
    openCareProgram(programUrlKey(program));
    if (carePlanStep) setCareProgramStep(carePlanStep.id);
    setSubTab('Care Programs');
  };

  // The sub-tab switch is a controlled element owned here, handed to each pane
  // so it renders inline in that pane's shared toolbar row.
  const subTabBar = <SubTabs tabs={cmTabs} activeKey={subTab} onChange={setSubTab} />;

  // Keep all three panes mounted and toggle visibility, so switching only
  // shows/hides a pane instead of unmounting + remounting it — no re-fetch,
  // no re-animation, no reflow. The result is a flicker-free switch.
  return (
    <div className={styles.container}>
      <div className={styles.paneSlot} hidden={subTab !== 'Care Programs'}>
        <CareProgramsTab header={subTabBar} />
      </div>
      {carePlanMode === 'patient' && (
        <div className={styles.paneSlot} hidden={subTab !== 'Care Plan'}>
          <PatientCarePlanPane header={subTabBar} patientId={patientId} />
        </div>
      )}
      {/* Program-level: the read-only roll-up. Both-level: the same roll-up
          under "Care Plan" (editing arrives with the roll-up's drawers). */}
      <div
        className={styles.paneSlot}
        hidden={carePlanMode === 'patient' || subTab !== (patientLevel ? 'Care Plan' : 'Comprehensive Care Plan')}
      >
        <ComprehensiveCarePlanPane
          header={subTabBar}
          editable={carePlanMode === 'both'}
          patientId={patientId}
          programs={programs}
          onClose={() => setSubTab('Care Programs')}
          onOpenProgramStep={openProgramAtCarePlan}
        />
      </div>
      <div className={styles.paneSlot} hidden={subTab !== 'Program Activity Log'}>
        <ProgramActivityLog header={subTabBar} />
      </div>
    </div>
  );
}
