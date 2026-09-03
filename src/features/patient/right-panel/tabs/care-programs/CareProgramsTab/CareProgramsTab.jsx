import { useEffect, useMemo, useRef, useState } from 'react';
import { RingEmptyState } from '../../../../../../components/RingEmptyState/RingEmptyState';
import { statusColorFor } from '../../../../data/programStatus';
import { CARE_PROGRAM_CATALOG } from '../../../../data/careProgramCatalog';
import { useAppStore } from '../../../../../../store/useAppStore';
import { ProgramDetailView } from '../program-detail/ProgramDetailView/ProgramDetailView.jsx';
import { ProgramDetailSkeleton } from '../program-detail/shared/ProgramDetailSkeleton/ProgramDetailSkeleton.jsx';
import { CarePlanSummaryView } from '../care-plan/summary/CarePlanSummaryView/CarePlanSummaryView.jsx';
import { CarePlanReportView } from '../care-plan/report/CarePlanReportView/CarePlanReportView.jsx';
import { stepsFor, flatSteps } from '../program-detail/ProgramDetailView/ProgramDetailView.utils';
import { CareProgramsTabTable } from './CareProgramsTabTable';
import { CareProgramsTabMenus } from './CareProgramsTabToolbar';
import { CareManagementToolbar } from '../../care-management/CareManagementToolbar/CareManagementToolbar';
import {
  programUrlKey,
  EMPTY_FILTERS,
  SUB_STATUS_OPTIONS,
  DATE_RANGE_OPTIONS,
  todayStr,
} from './CareProgramsTab.utils';
import { Icon } from '../../../../../../components/Icon/Icon';
import { Button } from '../../../../../../components/Button/Button';
import { FilterChip } from '../../../../../../components/FilterChip/FilterChip';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { SearchListPopover } from '../../../../../../components/SearchListPopover/SearchListPopover';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { CP_FILTERS } from '../../../../data/programActivityMock';
import styles from './CareProgramsTab.module.css';

// Programs move to the "Past" section once completed or closed.
const PAST_STATUSES = new Set(['Completed', 'Closed']);

/** Collapsible "Active" / "Past" grouping header for the programs list. */
function ProgramSection({ title, open, onToggle, children }) {
  return (
    <div className={styles.programSection}>
      <button type="button" className={styles.programSectionHeader} onClick={onToggle} aria-expanded={open}>
        <span className={styles.programSectionTitle}>{title}</span>
        <DownChevronIcon
          size={14}
          className={`${styles.programSectionChevron} ${open ? '' : styles.programSectionChevronClosed}`}
        />
      </button>
      {open && children}
    </div>
  );
}

function EmptyState() {
  return <RingEmptyState icon="solar:hand-heart-linear" label="No Active Programs" />;
}

export function CareProgramsTab({ header }) {
  const [searchMode, setSearchMode] = useState(false);
  const [activeOpen, setActiveOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [startAtFirstStep, setStartAtFirstStep] = useState(false);
  const [pendingProgram, setPendingProgram] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [npOpen, setNpOpen] = useState(false);
  const [statusMenu, setStatusMenu] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const carePlanSummaryOpen = useAppStore(s => s.carePlanSummaryOpen);
  const setCarePlanSummaryOpen = useAppStore(s => s.setCarePlanSummaryOpen);
  const [reportOpen, setReportOpen] = useState(false);
  const npBtnRef = useRef(null);

  const patientId = useAppStore(s => s.selectedPatientId);
  const careProgramsByPatient = useAppStore(s => s.careProgramsByPatient);
  const careProgramsLoadedFor = useAppStore(s => s.careProgramsLoadedFor);
  const addCareProgram = useAppStore(s => s.addCareProgram);
  const updateCareProgram = useAppStore(s => s.updateCareProgram);
  const showToast = useAppStore(s => s.showToast);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const pendingCareProgramCode = useAppStore(s => s.pendingCareProgramCode);
  const clearPendingCareProgramCode = useAppStore(s => s.clearPendingCareProgramCode);
  const selectedCareProgramKey = useAppStore(s => s.selectedCareProgramKey);
  const openCareProgram = useAppStore(s => s.openCareProgram);
  const closeCareProgram = useAppStore(s => s.closeCareProgram);
  const setCareProgramStep = useAppStore(s => s.setCareProgramStep);

  useEffect(() => {
    if (patientId) fetchCareProgramsForPatient(patientId);
  }, [patientId, fetchCareProgramsForPatient]);

  const programs = useMemo(
    () => careProgramsByPatient[patientId] || [],
    [careProgramsByPatient, patientId],
  );

  // The open program is derived from its URL key, so a refresh restores the
  // detail view as soon as the patient's programs finish loading.
  const selectedProgram = useMemo(
    () => (selectedCareProgramKey ? programs.find(p => programUrlKey(p) === selectedCareProgramKey) : null),
    [programs, selectedCareProgramKey],
  );

  useEffect(() => {
    if (!pendingCareProgramCode || !patientId) return;
    const existing = programs.find(p => p.code === pendingCareProgramCode);
    if (existing) {
      setPendingProgram({ program: existing, firstStep: false });
    } else {
      const entry = CARE_PROGRAM_CATALOG.find(e => e.code === pendingCareProgramCode);
      if (entry) {
        addCareProgram(patientId, entry);
        const created = useAppStore.getState().careProgramsByPatient[patientId]?.find(p => p.code === entry.code);
        if (created) setPendingProgram({ program: created, firstStep: false });
      }
    }
    clearPendingCareProgramCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCareProgramCode, patientId]);

  const programOptions = useMemo(() => {
    const added = new Set(programs.map(p => p.code));
    return CARE_PROGRAM_CATALOG.map(entry => ({
      value: entry.code,
      label: entry.code,
      disabled: entry.code === 'SNP' ? false : added.has(entry.code),
      searchText: `${entry.code} ${entry.name}`,
    }));
  }, [programs]);

  const assigneeOptions = useMemo(
    () => [...new Set(programs.flatMap(p => p.assignee ? [p.assignee] : []))],
    [programs],
  );
  const programOptionsList = useMemo(() => [...new Set(programs.map(p => p.code))], [programs]);
  const statusOptions = useMemo(() => [...new Set(programs.map(p => p.status))], [programs]);

  const filterOptionsFor = (key) => {
    if (key === 'assignee') return assigneeOptions;
    if (key === 'program') return programOptionsList;
    if (key === 'status') return statusOptions;
    if (key === 'subStatus') return SUB_STATUS_OPTIONS;
    return DATE_RANGE_OPTIONS;
  };

  const setFilter = (key, vals) => setFilters(f => ({ ...f, [key]: vals }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const handleAddProgram = (code) => {
    const entry = CARE_PROGRAM_CATALOG.find(e => e.code === code);
    if (!entry) return;
    addCareProgram(patientId, entry);
    const list = useAppStore.getState().careProgramsByPatient[patientId] || [];
    const created = [...list].reverse().find(p => p.code === code);
    if (created) setPendingProgram({ program: created, firstStep: true });
  };

  const openProgram = (program) => setPendingProgram({ program, firstStep: false });

  // From the comprehensive view, hand off to the owning program's Care Plan
  // step. openCareProgram resets the step to null, so set it right after.
  // Uses a loose match so "Care Plan" and "Care Plan Details" both resolve.
  const openProgramAtCarePlan = (program) => {
    const carePlanStep = flatSteps(stepsFor(program.code)).find(s => s.name.toLowerCase().includes('care plan'));
    setCarePlanSummaryOpen(false);
    openCareProgram(programUrlKey(program));
    if (carePlanStep) setCareProgramStep(carePlanStep.id);
  };

  const changeStatus = (program, status) => {
    const patch = { status, statusColor: statusColorFor(status) };
    if (status === 'Enrolled' && (!program.startDate || program.startDate === '—')) {
      patch.startDate = todayStr();
    }
    updateCareProgram(patientId, program.id, patch);
  };

  const assignOwner = (program, user) =>
    updateCareProgram(patientId, program.id, { assignee: user.name });

  const handleRowAction = (key, program) => {
    if (key === 'assign') {
      setTimeout(() => document.querySelector(`[data-assign-row="${program.id}"] button`)?.click(), 0);
    } else if (key === 'print') {
      showToast?.(`Preparing ${program.name} summary…`);
    } else if (key === 'close') {
      updateCareProgram(patientId, program.id, { status: 'Closed', statusColor: statusColorFor('Closed') });
    }
  };

  useEffect(() => {
    if (!pendingProgram) return;
    const t = setTimeout(() => {
      setStartAtFirstStep(pendingProgram.firstStep);
      openCareProgram(programUrlKey(pendingProgram.program));
      setPendingProgram(null);
    }, 700);
    return () => clearTimeout(t);
  }, [pendingProgram, openCareProgram]);

  const visible = useMemo(() => {
    let list = programs;
    const assigneeSet = filters.assignee.length ? new Set(filters.assignee) : null;
    const programSet = filters.program.length ? new Set(filters.program) : null;
    const statusSet = filters.status.length ? new Set(filters.status) : null;
    if (assigneeSet) list = list.filter(p => assigneeSet.has(p.assignee));
    if (programSet) list = list.filter(p => programSet.has(p.code));
    if (statusSet) list = list.filter(p => statusSet.has(p.status));
    const q = searchText.trim().toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
    return list;
  }, [programs, filters, searchText]);

  // A program is "Past" once it's completed or closed; everything else is Active.
  const activePrograms = useMemo(() => visible.filter(p => !PAST_STATUSES.has(p.status)), [visible]);
  const pastPrograms = useMemo(() => visible.filter(p => PAST_STATUSES.has(p.status)), [visible]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = visible.map(p => p.id);
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const toggleAll = (checked) =>
    setSelectedIds(checked
      ? [...new Set([...selectedIds, ...visibleIds])]
      : selectedIds.filter(id => !visibleIdSet.has(id)));
  const toggleOne = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (pendingProgram) return <ProgramDetailSkeleton />;

  if (carePlanSummaryOpen && !selectedProgram) {
    return (
      <CarePlanSummaryView
        patientId={patientId}
        programs={programs}
        onClose={() => setCarePlanSummaryOpen(false)}
        onOpenProgramStep={openProgramAtCarePlan}
      />
    );
  }

  if (reportOpen && !selectedProgram) {
    return (
      <CarePlanReportView
        patientId={patientId}
        programs={programs}
        onClose={() => setReportOpen(false)}
      />
    );
  }

  const programsLoaded = Boolean(patientId && careProgramsLoadedFor[patientId]);
  if (selectedCareProgramKey && !selectedProgram && !programsLoaded) {
    return <ProgramDetailSkeleton />;
  }

  if (selectedProgram) {
    return (
      <ProgramDetailView
        program={selectedProgram}
        startAtFirstStep={startAtFirstStep}
        onClose={closeCareProgram}
        onSwitchProgram={(p) => openCareProgram(programUrlKey(p))}
      />
    );
  }

  return (
    <div className={styles.view}>
      <CareManagementToolbar
        header={header}
        searchMode={searchMode} setSearchMode={setSearchMode}
        searchText={searchText} setSearchText={setSearchText}
        searchPlaceholder="Search programs"
        showFilters={showFilters} setShowFilters={setShowFilters}
        cta={(
          <div className={styles.npWrap}>
            <Button
              ref={npBtnRef}
              variant="tertiary"
              size="L"
              leadingIconElement={<AddIconMinimalist size={16} />}
              trailingIconElement={<DownChevronIcon size={16} />}
              onClick={() => setNpOpen(o => !o)}
            >
              New Program
            </Button>
            {npOpen && (
              <SearchListPopover
                anchorRect={npBtnRef.current?.getBoundingClientRect()}
                align="right"
                options={programOptions}
                onSelect={handleAddProgram}
                onClose={() => setNpOpen(false)}
                searchPlaceholder="Search programs"
                emptyText="No programs found"
              />
            )}
          </div>
        )}
        filterBar={(
          <div className={styles.filterBar}>
            {CP_FILTERS.map(f => (
              <FilterChip key={f.key} label={f.label} options={filterOptionsFor(f.key)}
                selected={filters[f.key]} onChange={vals => setFilter(f.key, vals)} />
            ))}
            <button className={styles.clearAll} onClick={clearFilters}>
              <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
              Clear All
            </button>
          </div>
        )}
      />

      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div className={styles.programSections}>
          <ProgramSection
            title="Active Care Programs"
            open={activeOpen}
            onToggle={() => setActiveOpen(v => !v)}
          >
            {activePrograms.length === 0 ? (
              <div className={styles.programSectionEmpty}>No active care programs.</div>
            ) : (
              <CareProgramsTabTable
                visible={activePrograms}
                selectedIdSet={selectedIdSet}
                toggleAll={toggleAll}
                toggleOne={toggleOne}
                openProgram={openProgram}
                setStatusMenu={setStatusMenu}
                assignOwner={assignOwner}
                setRowMenu={setRowMenu}
                rowMenuId={rowMenu?.id}
              />
            )}
          </ProgramSection>

          {pastPrograms.length > 0 && (
            <ProgramSection
              title="Past Care Programs"
              open={pastOpen}
              onToggle={() => setPastOpen(v => !v)}
            >
              <CareProgramsTabTable
                visible={pastPrograms}
                selectedIdSet={selectedIdSet}
                toggleAll={toggleAll}
                toggleOne={toggleOne}
                openProgram={openProgram}
                setStatusMenu={setStatusMenu}
                assignOwner={assignOwner}
                setRowMenu={setRowMenu}
                rowMenuId={rowMenu?.id}
              />
            </ProgramSection>
          )}
        </div>
      )}

      <CareProgramsTabMenus
        statusMenu={statusMenu} setStatusMenu={setStatusMenu}
        rowMenu={rowMenu} setRowMenu={setRowMenu}
        visible={visible} changeStatus={changeStatus} handleRowAction={handleRowAction}
      />
    </div>
  );
}
