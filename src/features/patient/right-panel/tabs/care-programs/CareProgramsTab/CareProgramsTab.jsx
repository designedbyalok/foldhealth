import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../../../../../components/EmptyState/EmptyState';
import { statusColorFor, isProgramClosed } from '../../../../data/programStatus';
import { CARE_PROGRAM_CATALOG } from '../../../../data/careProgramCatalog';
import { CMP_SUB_PROGRAMS } from '../../../../data/cmpSubPrograms';
import { useAppStore } from '../../../../../../store/useAppStore';
import { ProgramDetailView } from '../program-detail/ProgramDetailView/ProgramDetailView.jsx';
import { ProgramDetailSkeleton } from '../program-detail/shared/ProgramDetailSkeleton/ProgramDetailSkeleton.jsx';
import { CloseProgramDialog } from '../program-detail/shared/CloseProgramDialog/CloseProgramDialog.jsx';
import { PauseCarePlanDialog } from '../care-plan/drawers/PauseCarePlanDialog/PauseCarePlanDialog';
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
import { RadioListPopover } from '../../../../../../components/RadioListPopover/RadioListPopover';
import { CreateSnpProgramDrawer } from './CreateSnpProgramDrawer';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { CollapsibleContent } from '../../../../../../components/Collapsible/Collapsible';
import { CP_FILTERS } from '../../../../data/programActivityMock';
import { CareProgramsOverview } from './overview/CareProgramsOverview';
import styles from './CareProgramsTab.module.css';
import { nextEnrollment } from '../../../../data/programLifecycle';
import { useConsentedEnrollment } from './useConsentedEnrollment';
import { EligiblePrograms } from './eligible/EligiblePrograms';
import { isEmptyDash } from '../../../../../../lib/emptyDash';

// Programs move to the "Past" section once completed or closed.

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
      <CollapsibleContent open={open}>{children}</CollapsibleContent>
    </div>
  );
}

function NoProgramsEmptyState() {
  return <EmptyState icon="solar:hand-heart-linear" title="No Active Programs" />;
}

export function CareProgramsTab({ header }) {
  const [searchMode, setSearchMode] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [startAtFirstStep, setStartAtFirstStep] = useState(false);
  const [pendingProgram, setPendingProgram] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [npOpen, setNpOpen] = useState(false);
  // CMP is added per sub-program: picking CMP opens this list next, anchored
  // where New Program is (its rect, or null when closed).
  const [cmpPickerRect, setCmpPickerRect] = useState(null);
  // SNP is created from a drawer: Member Info, Trigger Type, Trigger Date.
  const [snpDrawerOpen, setSnpDrawerOpen] = useState(false);
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
  const setCareManagementTab = useAppStore(s => s.setCareManagementTab);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const pendingCareProgramCode = useAppStore(s => s.pendingCareProgramCode);
  const clearPendingCareProgramCode = useAppStore(s => s.clearPendingCareProgramCode);
  const selectedCareProgramKey = useAppStore(s => s.selectedCareProgramKey);
  const openCareProgram = useAppStore(s => s.openCareProgram);
  const closeCareProgram = useAppStore(s => s.closeCareProgram);
  const setCareProgramStep = useAppStore(s => s.setCareProgramStep);
  const closeCareProgramInstance = useAppStore(s => s.closeCareProgramInstance);
  // { program, status } while the Close Program dialog is open.
  const [closing, setClosing] = useState(null);
  const pauseCareProgramInstance = useAppStore(s => s.pauseCareProgramInstance);
  const resumeCareProgramInstance = useAppStore(s => s.resumeCareProgramInstance);
  // The program while the Pause dialog is open.
  const [pausing, setPausing] = useState(null);

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

  // Waits for the patient's programs to load: deciding before then took every
  // visit for a new enrollment.
  // Programs a patient can be enrolled in: the active types in Care Program
  // Configuration, else the built-in catalog until it loads.
  const programTypes = useAppStore(s => s.careProgramTypes);
  const fetchCareProgramTypes = useAppStore(s => s.fetchCareProgramTypes);
  useEffect(() => { fetchCareProgramTypes?.(); }, [fetchCareProgramTypes]);
  const catalog = useMemo(() => (programTypes.length
    ? programTypes.filter(t => t.status === 'active').map(t => ({ code: t.code, name: t.name }))
    : CARE_PROGRAM_CATALOG), [programTypes]);

  const programsLoaded = Boolean(patientId && careProgramsLoadedFor[patientId]);
  const requestEnrollment = useConsentedEnrollment(patientId, programs);
  useEffect(() => {
    if (!pendingCareProgramCode || !patientId || !programsLoaded) return;
    const { pendingCareProgramCarePlan: carePlan, pendingCareProgramSubProgram: subProgram, pendingCareProgramOpenOnly: openOnly } = useAppStore.getState();
    // CMP is enrolled per sub-program: match on it when one was given.
    const existing = programs.find(p => p.code === pendingCareProgramCode && (!subProgram || p.subProgram === subProgram));
    if (existing) {
      setPendingProgram({ program: existing, firstStep: false, carePlan });
    } else if (openOnly) {
      // Not in the program: stay on Care Programs.
    } else if (pendingCareProgramCode === 'CMP' && !subProgram) {
      // No sub-program to enroll in: let the user pick one.
      setCmpPickerRect(npBtnRef.current?.getBoundingClientRect() ?? null);
    } else {
      const entry = catalog.find(e => e.code === pendingCareProgramCode);
      if (entry) {
        requestEnrollment(entry.code, () => {
          addCareProgram(patientId, subProgram ? { ...entry, subProgram } : entry);
          const created = useAppStore.getState().careProgramsByPatient[patientId]
            ?.find(p => p.code === entry.code && (!subProgram || p.subProgram === subProgram));
          if (created) setPendingProgram({ program: created, firstStep: false });
        }, { subProgram });
      }
    }
    clearPendingCareProgramCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCareProgramCode, patientId, programsLoaded]);

  // CMP sub-programs this member already has (greyed out in the picker).
  const cmpTaken = useMemo(
    () => programs.flatMap(p => (p.code === 'CMP' && p.subProgram ? [p.subProgram] : [])),
    [programs],
  );

  const programOptions = useMemo(() => {
    // A program whose enrollments have all ended can be enrolled again.
    const disabledFor = (code) => {
      if (code === 'SNP') return false;
      if (code === 'CMP') return CMP_SUB_PROGRAMS.every(sp => cmpTaken.includes(sp));
      return !nextEnrollment(programs, code).allowed;
    };
    return catalog.map(entry => ({
      value: entry.code,
      label: entry.code,
      disabled: disabledFor(entry.code),
      searchText: `${entry.code} ${entry.name}`,
    }));
  }, [programs, catalog, cmpTaken]);

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

  // `details`: CMP's { subProgram }, SNP's { memberInfo, triggerType, triggerDate }.
  const handleAddProgram = (code, details = null) => {
    const entry = catalog.find(e => e.code === code);
    if (!entry) return;
    if (code === 'CMP' && !details) {
      setNpOpen(false);
      setCmpPickerRect(npBtnRef.current?.getBoundingClientRect() ?? null);
      return;
    }
    if (code === 'SNP' && !details) {
      setNpOpen(false);
      setSnpDrawerOpen(true);
      return;
    }
    requestEnrollment(code, () => {
      addCareProgram(patientId, details ? { ...entry, ...details } : entry);
      const list = useAppStore.getState().careProgramsByPatient[patientId] || [];
      const created = [...list].reverse().find(p => p.code === code && (!details?.subProgram || p.subProgram === details.subProgram));
      if (created) setPendingProgram({ program: created, firstStep: true });
    }, { subProgram: details?.subProgram || null });
  };

  const openProgram = (program) => setPendingProgram({ program, firstStep: false });
  // Overview: open a program at a step, or at its care plan (no program: the
  // Comprehensive Care Plan across programs).
  const openProgramAtStep = (program, stepId) => setPendingProgram({ program, firstStep: false, stepId });
  const openPlanFromOverview = (program) => {
    if (program) setPendingProgram({ program, firstStep: false, carePlan: true });
    else setCareManagementTab('Comprehensive Care Plan');
  };

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
    // Completed / Discontinued end the enrollment, so they ask for a reason.
    if (status === 'Completed' || status === 'Discontinued') { setClosing({ program: program, status: status }); return; }
    // Paused asks why and until when; leaving Paused resumes the program and its plan.
    if (status === 'Paused') { if (program.status !== 'Paused') setPausing(program); return; }
    if (program.status === 'Paused') { resumeCareProgramInstance(patientId, program, { status }); return; }
    const patch = { status, statusColor: statusColorFor(status) };
    if (status === 'Enrolled' && (!program.startDate || isEmptyDash(program.startDate))) {
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
      setClosing({ program, status: null });
    } else if (key === 'again') {
      // A new instance of an ended program (CMP keeps its sub-program; SNP
      // asks for the new trigger in its drawer).
      handleAddProgram(program.code, program.code === 'CMP' && program.subProgram ? { subProgram: program.subProgram } : null);
    }
  };

  useEffect(() => {
    if (!pendingProgram) return;
    const t = setTimeout(() => {
      setStartAtFirstStep(pendingProgram.firstStep);
      openCareProgram(programUrlKey(pendingProgram.program));
      // Asked to land on the Care Plan step (e.g. the Review drawer's Open
      // care plan); openCareProgram resets the step, so set it after.
      if (pendingProgram.carePlan) {
        const carePlanStep = flatSteps(stepsFor(pendingProgram.program.code)).find(s => s.name.toLowerCase().includes('care plan'));
        if (carePlanStep) setCareProgramStep(carePlanStep.id);
      }
      if (pendingProgram.stepId) setCareProgramStep(pendingProgram.stepId);
      setPendingProgram(null);
    }, 700);
    return () => clearTimeout(t);
  }, [pendingProgram, openCareProgram, setCareProgramStep]);

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
  const activePrograms = useMemo(() => visible.filter(p => !isProgramClosed(p.status)), [visible]);
  const pastPrograms = useMemo(() => visible.filter(p => isProgramClosed(p.status)), [visible]);

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
              variant="soft"
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
            {cmpPickerRect && (
              <RadioListPopover
                anchorRect={cmpPickerRect}
                options={CMP_SUB_PROGRAMS}
                disabledOptions={cmpTaken}
                showClear={false}
                width={280}
                onChange={([sp]) => { setCmpPickerRect(null); if (sp) handleAddProgram('CMP', { subProgram: sp }); }}
                onClose={() => setCmpPickerRect(null)}
              />
            )}
            {snpDrawerOpen && (
              <CreateSnpProgramDrawer
                patientId={patientId}
                onClose={() => setSnpDrawerOpen(false)}
                onCreate={(details) => { setSnpDrawerOpen(false); handleAddProgram('SNP', details); }}
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
        <div className={styles.programSections}>
          <NoProgramsEmptyState />
          <div className={styles.eligibleAlone}>
            <EligiblePrograms patientId={patientId} programs={programs} catalog={catalog} onEnroll={handleAddProgram} />
          </div>
        </div>
      ) : (
        <div className={styles.programSections}>
          {activePrograms.length === 0 ? (
            <div className={styles.programSectionEmpty}>No active care programs.</div>
          ) : (
            <CareProgramsOverview
              patientId={patientId}
              programs={activePrograms}
              onOpenProgram={openProgram}
              onOpenStep={openProgramAtStep}
              onOpenPlan={openPlanFromOverview}
              onOpenLog={() => setCareManagementTab('Program Activity Log')}
              onStatusMenu={setStatusMenu}
              onRowMenu={setRowMenu}
              onAssign={assignOwner}
              onEnroll={handleAddProgram}
              eligible={<EligiblePrograms patientId={patientId} programs={programs} catalog={catalog} onEnroll={handleAddProgram} />}
            />
          )}

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
      {closing && (
        <CloseProgramDialog
          program={closing.program}
          status={closing.status}
          onCancel={() => setClosing(null)}
          onSubmit={({ reason, note, status }) => {
            closeCareProgramInstance(patientId, closing.program.id, { reason, note, status });
            showToast?.(`${closing.program.name} closed`);
            setClosing(null);
          }}
        />
      )}
      {pausing && (
        <PauseCarePlanDialog
          subject="program"
          onCancel={() => setPausing(null)}
          onSubmit={async (form) => {
            const program = pausing;
            setPausing(null);
            if (await pauseCareProgramInstance(patientId, program, form)) showToast?.(`${program.name} paused`);
          }}
        />
      )}
    </div>
  );
}
