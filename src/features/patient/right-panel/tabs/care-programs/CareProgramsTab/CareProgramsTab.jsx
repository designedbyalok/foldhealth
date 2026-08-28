import { useEffect, useMemo, useRef, useState } from 'react';
import { RingEmptyState } from '../../../../../../components/RingEmptyState/RingEmptyState';
import { statusColorFor } from '../../../../data/programStatus';
import { CARE_PROGRAM_CATALOG } from '../../../../data/careProgramCatalog';
import { useAppStore } from '../../../../../../store/useAppStore';
import { ProgramDetailView } from '../program-detail/ProgramDetailView/ProgramDetailView.jsx';
import { ProgramDetailSkeleton } from '../program-detail/ProgramDetailSkeleton/ProgramDetailSkeleton.jsx';
import { CarePlanSummaryView } from '../summary/CarePlanSummaryView/CarePlanSummaryView.jsx';
import { stepsFor, flatSteps } from '../program-detail/ProgramDetailView/ProgramDetailView.utils';
import { CareProgramsTabTable } from './CareProgramsTabTable';
import { CareProgramsTabToolbar, CareProgramsTabMenus } from './CareProgramsTabToolbar';
import {
  matchesTab,
  programUrlKey,
  EMPTY_FILTERS,
  SUB_STATUS_OPTIONS,
  DATE_RANGE_OPTIONS,
  todayStr,
} from './CareProgramsTab.utils';
import styles from './CareProgramsTab.module.css';

function EmptyState() {
  return <RingEmptyState icon="solar:hand-heart-linear" label="No Active Programs" />;
}

export function CareProgramsTab() {
  const [activeSubTab, setActiveSubTab] = useState('All');
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [startAtFirstStep, setStartAtFirstStep] = useState(false);
  const [pendingProgram, setPendingProgram] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [npOpen, setNpOpen] = useState(false);
  const [statusMenu, setStatusMenu] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const npBtnRef = useRef(null);

  const patientId = useAppStore(s => s.selectedPatientId);
  const careProgramsByPatient = useAppStore(s => s.careProgramsByPatient);
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
  const openProgramAtCarePlan = (program) => {
    const carePlanStep = flatSteps(stepsFor(program.code)).find(s => s.name === 'Care Plan');
    setShowSummary(false);
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
      setTimeout(() => document.querySelector(`[data-assign-row="${program.id}"]`)?.click(), 0);
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
    if (activeSubTab !== 'All') list = list.filter(p => matchesTab(p, activeSubTab));
    const assigneeSet = filters.assignee.length ? new Set(filters.assignee) : null;
    const programSet = filters.program.length ? new Set(filters.program) : null;
    const statusSet = filters.status.length ? new Set(filters.status) : null;
    if (assigneeSet) list = list.filter(p => assigneeSet.has(p.assignee));
    if (programSet) list = list.filter(p => programSet.has(p.code));
    if (statusSet) list = list.filter(p => statusSet.has(p.status));
    const q = searchText.trim().toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
    return list;
  }, [programs, activeSubTab, filters, searchText]);

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

  if (showSummary && !selectedProgram) {
    return (
      <CarePlanSummaryView
        patientId={patientId}
        programs={programs}
        onClose={() => setShowSummary(false)}
        onOpenProgramStep={openProgramAtCarePlan}
      />
    );
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
      <CareProgramsTabToolbar
        searchMode={searchMode} setSearchMode={setSearchMode}
        searchText={searchText} setSearchText={setSearchText}
        activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab}
        showFilters={showFilters} setShowFilters={setShowFilters}
        filters={filters} filterOptionsFor={filterOptionsFor}
        setFilter={setFilter} clearFilters={clearFilters}
        npOpen={npOpen} setNpOpen={setNpOpen} npBtnRef={npBtnRef}
        programOptions={programOptions} handleAddProgram={handleAddProgram}
        onOpenSummary={() => setShowSummary(true)}
      />

      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <CareProgramsTabTable
          visible={visible}
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

      <CareProgramsTabMenus
        statusMenu={statusMenu} setStatusMenu={setStatusMenu}
        rowMenu={rowMenu} setRowMenu={setRowMenu}
        visible={visible} changeStatus={changeStatus} handleRowAction={handleRowAction}
      />
    </div>
  );
}
