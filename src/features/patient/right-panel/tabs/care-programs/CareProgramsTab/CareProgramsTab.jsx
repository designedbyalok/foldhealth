import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../components/Button/Button';
import { SearchListPopover } from '../../../../../../components/SearchListPopover/SearchListPopover';
import { MenuPopover } from '../../../../../../components/MenuPopover/MenuPopover';
import { SearchBar } from '../../../../../../components/SearchBar/SearchBar';
import { FilterChip } from '../../../../../../components/FilterChip/FilterChip';
import { Checkbox } from '../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { RingEmptyState } from '../../../../../../components/RingEmptyState/RingEmptyState';
import { RoleAssigneePicker } from '../../../../../hcc/RoleAssigneePicker';
import { ProgramStatusRing } from '../program-detail/ProgramStatusRing/ProgramStatusRing.jsx';
import { CP_SUB_TABS, CP_FILTERS, PROGRAM_STEPS } from '../../../../data/programActivityMock';
import { PROGRAM_STATUS_OPTIONS, statusColorFor } from '../../../../data/programStatus';
import { CARE_PROGRAM_CATALOG } from '../../../../data/careProgramCatalog';
import { useAppStore } from '../../../../../../store/useAppStore';
import { ProgramDetailView } from '../program-detail/ProgramDetailView/ProgramDetailView.jsx';
import { ProgramDetailSkeleton } from '../program-detail/ProgramDetailSkeleton/ProgramDetailSkeleton.jsx';
import styles from './CareProgramsTab.module.css';

const matchesTab = (p, tab) => {
  if (tab === 'New') return p.status === 'New';
  if (tab === 'Enrolled') return p.status === 'Enrolled' || p.status === 'Engaged';
  if (tab === 'Completed') return p.status === 'Completed';
  if (tab === 'Closed') return p.status === 'Closed';
  return true;
};

const SUB_STATUS_OPTIONS = ['Assigned', 'Unassigned'];
const DATE_RANGE_OPTIONS = ['Last 7 days', 'Last 30 days', 'Last 90 days'];
const EMPTY_FILTERS = { assignee: [], program: [], status: [], subStatus: [], startDate: [], endDate: [] };

// Per-row overflow-menu actions (three-dot). Close Program is destructive.
const ROW_MENU_ITEMS = [
  { key: 'assign', icon: 'solar:user-plus-rounded-linear', label: 'Assign to' },
  { key: 'print',  icon: 'solar:printer-linear',           label: 'Print Summary' },
  { key: 'close',  icon: 'solar:close-circle-linear',      label: 'Close Program', danger: true },
];

// Program completion % from its step list — completed steps ÷ total steps.
// Sections are flattened to their child steps.
const stepProgress = (code) => {
  const list = PROGRAM_STEPS[code] || [];
  const flat = list.flatMap(s => (s.type === 'section' ? (s.children || []) : [s]));
  if (!flat.length) return 0;
  const done = flat.filter(s => s.status === 'completed').length;
  return Math.round((done / flat.length) * 100);
};

// MM/DD/YYYY for "today" — used to stamp Start Date when a program starts.
const todayStr = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

// Shown whenever the active tab has no matching programs. The "New Program"
// entry point lives in the toolbar, so this card carries no button.
function EmptyState() {
  return <RingEmptyState icon="solar:hand-heart-linear" label="No Active Programs" />;
}

export function CareProgramsTab() {
  const [activeSubTab, setActiveSubTab] = useState('All');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [startAtFirstStep, setStartAtFirstStep] = useState(false);
  const [pendingProgram, setPendingProgram] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [npOpen, setNpOpen] = useState(false);
  const [statusMenu, setStatusMenu] = useState(null); // { id, rect }
  const [rowMenu, setRowMenu] = useState(null);       // { id, rect }
  const npBtnRef = useRef(null);

  const patientId = useAppStore(s => s.selectedPatientId);
  const careProgramsByPatient = useAppStore(s => s.careProgramsByPatient);
  const addCareProgram = useAppStore(s => s.addCareProgram);
  const updateCareProgram = useAppStore(s => s.updateCareProgram);
  const showToast = useAppStore(s => s.showToast);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const pendingCareProgramCode = useAppStore(s => s.pendingCareProgramCode);
  const clearPendingCareProgramCode = useAppStore(s => s.clearPendingCareProgramCode);

  // Hydrate enrollments from Supabase on mount so programs the user
  // enrolled in previous sessions render on cold load.
  useEffect(() => {
    if (patientId) fetchCareProgramsForPatient(patientId);
  }, [patientId, fetchCareProgramsForPatient]);
  const programs = useMemo(
    () => careProgramsByPatient[patientId] || [],
    [careProgramsByPatient, patientId],
  );

  // Deep-link: when a caller navigated in with { programCode }, either open
  // the existing program row or enroll and open it. Runs once per pending
  // code, then clears the store flag.
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

  // New Program picker options — short codes only, disabled once enrolled.
  // SNP is triggerable (repeat-enrollable), so it never disables.
  const programOptions = useMemo(() => {
    const added = new Set(programs.map(p => p.code));
    return CARE_PROGRAM_CATALOG.map(entry => ({
      value: entry.code,
      label: entry.code,
      disabled: entry.code === 'SNP' ? false : added.has(entry.code),
      searchText: `${entry.code} ${entry.name}`,
    }));
  }, [programs]);

  // Filter chip options (string lists), derived from the enrolled programs.
  const assigneeOptions = useMemo(
    () => [...new Set(programs.flatMap(p => p.assignee ? [p.assignee] : []))],
    [programs],
  );
  const programOptionsList = useMemo(
    () => [...new Set(programs.map(p => p.code))],
    [programs],
  );
  const statusOptions = useMemo(
    () => [...new Set(programs.map(p => p.status))],
    [programs],
  );
  const filterOptionsFor = (key) => {
    if (key === 'assignee') return assigneeOptions;
    if (key === 'program') return programOptionsList;
    if (key === 'status') return statusOptions;
    if (key === 'subStatus') return SUB_STATUS_OPTIONS;
    return DATE_RANGE_OPTIONS; // startDate / endDate
  };

  const setFilter = (key, vals) => setFilters(f => ({ ...f, [key]: vals }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  // Enroll the patient and drop into the program's workflow at its first step,
  // bridged by a short loading state so the screen fills in smoothly.
  const handleAddProgram = (code) => {
    const entry = CARE_PROGRAM_CATALOG.find(e => e.code === code);
    if (!entry) return;
    addCareProgram(patientId, entry);
    // Open the just-created instance — for triggerable SNP that's the newest
    // trigger (last row of that code), not the first.
    const list = useAppStore.getState().careProgramsByPatient[patientId] || [];
    const created = [...list].reverse().find(p => p.code === code);
    if (created) setPendingProgram({ program: created, firstStep: true });
  };

  const openProgram = (program) => setPendingProgram({ program, firstStep: false });

  // Change a program's status. Enrolling stamps the Start Date with today's
  // date (when the program starts); updateCareProgram bumps Last Updated.
  const changeStatus = (program, status) => {
    const patch = { status, statusColor: statusColorFor(status) };
    if (status === 'Enrolled' && (!program.startDate || program.startDate === '—')) {
      patch.startDate = todayStr();
    }
    updateCareProgram(patientId, program.id, patch);
  };

  const assignOwner = (program, user) =>
    updateCareProgram(patientId, program.id, { assignee: user.name });

  // Three-dot row menu actions. "Assign to" reuses the row's inline assignee
  // picker by triggering its button (deferred so the menu overlay is gone).
  const handleRowAction = (key, program) => {
    if (key === 'assign') {
      setTimeout(() => document.querySelector(`[data-assign-row="${program.id}"]`)?.click(), 0);
    } else if (key === 'print') {
      showToast?.(`Preparing ${program.name} summary…`);
    } else if (key === 'close') {
      updateCareProgram(patientId, program.id, { status: 'Closed', statusColor: statusColorFor('Closed') });
    }
  };

  // Show the loading placeholder briefly, then commit to the detail view.
  useEffect(() => {
    if (!pendingProgram) return;
    const t = setTimeout(() => {
      setStartAtFirstStep(pendingProgram.firstStep);
      setSelectedProgram(pendingProgram.program);
      setPendingProgram(null);
    }, 700);
    return () => clearTimeout(t);
  }, [pendingProgram]);

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
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIdSet.has(id));
  const someSelected = selectedIds.some(id => visibleIdSet.has(id)) && !allSelected;
  const toggleAll = (checked) =>
    setSelectedIds(checked
      ? [...new Set([...selectedIds, ...visibleIds])]
      : selectedIds.filter(id => !visibleIdSet.has(id)));
  const toggleOne = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const newProgramControl = (align = 'left') => (
    <div className={styles.npWrap}>
      <Button
        ref={npBtnRef}
        variant="tertiary"
        size="L"
        leadingIcon="solar:add-circle-linear"
        trailingIconElement={<DownChevronIcon size={16} color="var(--primary-300)" />}
        onClick={() => setNpOpen(o => !o)}
      >
        New Program
      </Button>
      {npOpen && (
        <SearchListPopover
          anchorRect={npBtnRef.current?.getBoundingClientRect()}
          align={align}
          options={programOptions}
          onSelect={handleAddProgram}
          onClose={() => setNpOpen(false)}
          searchPlaceholder="Search programs"
          emptyText="No programs found"
        />
      )}
    </div>
  );

  if (pendingProgram) {
    return <ProgramDetailSkeleton />;
  }

  if (selectedProgram) {
    return (
      <ProgramDetailView
        program={selectedProgram}
        startAtFirstStep={startAtFirstStep}
        onClose={() => setSelectedProgram(null)}
        onSwitchProgram={setSelectedProgram}
      />
    );
  }

  return (
    <div className={styles.view}>
      {/* Top area: sub-tab bar + filter bar sit flush (no gap between them) */}
      <div className={styles.topArea}>
        {/* Sub-tab bar — transforms into a search bar when search is active */}
        {searchMode ? (
          <div className={styles.subTabBar}>
            <div className={styles.searchWrap}>
              <SearchBar
                className={styles.searchBox350}
                placeholder="Search programs"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onClose={() => { setSearchMode(false); setSearchText(''); }}
              />
            </div>
            {newProgramControl('right')}
            <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
            <ActionButton
              icon="solar:filter-linear"
              size="S"
              tooltip="Filter"
              tooltipLeft
              iconColor={showFilters ? 'var(--primary-300)' : undefined}
              onClick={() => setShowFilters(v => !v)}
            />
          </div>
        ) : (
          <div className={styles.subTabBar}>
            <div className={styles.subTabs}>
              <ActionButton icon="solar:magnifer-linear" size="S" tooltip="Search" onClick={() => setSearchMode(true)} />
              <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
              {CP_SUB_TABS.map(tab => (
                <button
                  key={tab}
                  className={`${styles.subTab} ${activeSubTab === tab ? styles.subTabActive : ''}`}
                  onClick={() => setActiveSubTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            {newProgramControl('right')}
            <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
            <ActionButton
              icon="solar:filter-linear"
              size="S"
              tooltip="Filter"
              tooltipLeft
              iconColor={showFilters ? 'var(--primary-300)' : undefined}
              onClick={() => setShowFilters(v => !v)}
            />
          </div>
        )}

        {/* Filter bar — filter chips; only shown when toggled on */}
        {showFilters && (
          <div className={styles.filterBar}>
            {CP_FILTERS.map(f => (
              <FilterChip
                key={f.key}
                label={f.label}
                options={filterOptionsFor(f.key)}
                selected={filters[f.key]}
                onChange={vals => setFilter(f.key, vals)}
              />
            ))}
            <button className={styles.clearAll} onClick={clearFilters}>
              <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Table — or an empty-state card when the active tab has no programs */}
      {visible.length === 0 ? (
        <EmptyState />
      ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkCell}>
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all programs"
                />
              </th>
              <th className={styles.programCell}>Program Name</th>
              <th className={styles.statusCell}>Status</th>
              <th className={styles.dateCell}>Start Date</th>
              <th className={styles.dateCell}>End Date</th>
              <th className={styles.dateCell}>Last Updated</th>
              <th className={styles.assigneeCell}>Assignee</th>
              <th className={styles.pcpCell}>PCP</th>
              <th className={styles.actionsCell} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visible.map(p => (
              <tr key={p.id} className={styles.clickableRow} onClick={() => openProgram(p)}>
                <td className={styles.checkCell} onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIdSet.has(p.id)}
                    onCheckedChange={() => toggleOne(p.id)}
                    aria-label={`Select ${p.name}`}
                  />
                </td>
                <td className={styles.programCell}>
                  <div className={styles.programName}>
                    <ProgramStatusRing progress={stepProgress(p.code)} size={16} />
                    <div className={styles.nameBlock}>
                      <span className={styles.nameText}>{p.name}</span>
                      {p.acuity && <span className={styles.acuityText}>Acuity : {p.acuity}</span>}
                    </div>
                  </div>
                </td>
                <td className={styles.statusCell} onClick={e => e.stopPropagation()}>
                  <button
                    className={styles.statusBtn}
                    style={{ color: p.statusColor }}
                    onClick={e => setStatusMenu({ id: p.id, rect: e.currentTarget.getBoundingClientRect() })}
                  >
                    {p.status}
                    <DownChevronIcon size={16} color={p.statusColor} />
                  </button>
                </td>
                <td className={styles.dateCell}>{p.startDate}</td>
                <td className={styles.dateCell}>{p.endDate}</td>
                <td className={styles.dateCell}>{p.lastUpdated}</td>
                <td className={styles.assigneeCell} onClick={e => e.stopPropagation()}>
                  <RoleAssigneePicker
                    role="care_program"
                    memberId={p.id}
                    dosDate="care-program"
                    titleLabel=""
                    currentName={p.assignee && p.assignee !== 'Unassigned' ? p.assignee : null}
                    onAssign={user => assignOwner(p, user)}
                    trigger={({ ref, onClick }) => (
                      p.assignee && p.assignee !== 'Unassigned' ? (
                        <button ref={ref} type="button" data-assign-row={p.id} className={styles.assignName} onClick={onClick}>
                          {p.assignee}
                        </button>
                      ) : (
                        <button ref={ref} type="button" data-assign-row={p.id} className={styles.assignPill} onClick={onClick}>
                          <Icon name="solar:user-plus-rounded-linear" size={14} color="var(--neutral-200)" />
                          <span>Assign</span>
                        </button>
                      )
                    )}
                  />
                </td>
                <td className={styles.pcpCell}>{p.pcp}</td>
                <td className={styles.actionsCell} onClick={e => e.stopPropagation()}>
                  <ActionButton
                    icon="solar:menu-dots-linear"
                    size="S"
                    tooltip="More actions"
                    className={`${styles.rowMenuBtn} ${rowMenu?.id === p.id ? styles.rowMenuBtnOpen : ''}`}
                    onClick={e => setRowMenu({ id: p.id, rect: e.currentTarget.getBoundingClientRect() })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {statusMenu && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={180}
          ariaLabel="Change status"
          items={PROGRAM_STATUS_OPTIONS.map(s => ({
            key: s,
            label: <span style={{ color: 'var(--neutral-400)' }}>{s}</span>,
          }))}
          onSelect={(status) => {
            const program = visible.find(p => p.id === statusMenu.id);
            if (program) changeStatus(program, status);
          }}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          align="right"
          width={180}
          ariaLabel="Program actions"
          items={ROW_MENU_ITEMS}
          onSelect={(key) => {
            const program = visible.find(p => p.id === rowMenu.id);
            if (program) handleRowAction(key, program);
          }}
          onClose={() => setRowMenu(null)}
        />
      )}
    </div>
  );
}
