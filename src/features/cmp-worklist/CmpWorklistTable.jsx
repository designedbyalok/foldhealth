import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { WorklistShell } from '../worklists/WorklistShell';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { SubnavToggle } from '../../components/SubnavToggle/SubnavToggle';
import { FilterBar } from '../worklists/FilterBar';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { DobFilter } from '../../components/DobFilter/DobFilter';
import { dobInRange } from '../../components/DateRangePopover/yearSpan';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { GENDER_FILTER_OPTIONS, LANGUAGE_FILTER_OPTIONS, memberGenderLabel, memberLanguageLabel } from '../../lib/memberFilters';
import { SavedFiltersChip } from '../hcc/SavedFiltersChip';
import { useSavedFilterActions } from '../hcc/useSavedFilterActions';
import { CMP_SUB_PROGRAMS } from '../patient/data/cmpSubPrograms';
import { CmpWorklistRow } from './CmpWorklistRow';
import { CMP_MIDDLE_COLUMNS } from './cmpColumns';

// Worklist filter spec: the member filters first (DOB, Gender, Language,
// Assignee), then the program workflow filters (Sub Program first). Risk IQ
// is secondary, under Clinical in More Filters.
const CMP_FILTER_DEFS = [
  { key: 'dob',            label: 'DOB',                primary: true },
  { key: 'gender',         label: 'Gender',             primary: true },
  { key: 'language',       label: 'Language',           primary: true },
  { key: 'assignee',       label: 'Assignee',           primary: true },
  { key: 'subProgram',     label: 'Sub Program',        primary: true },
  { key: 'progSubStatus',  label: 'Program Sub Status', primary: true },
  { key: 'carePlanStatus', label: 'Care Plan Status',   primary: true },
  { key: 'ri',             label: 'Risk IQ',            primary: false, group: 'Clinical' },
];
const CMP_MORE_FILTER_ITEMS = CMP_FILTER_DEFS.map(fd => ({ k: fd.key, label: fd.label, primary: fd.primary, group: fd.group }));

// The value each multi-select filter compares against, per row.
const FILTER_VALUE = {
  gender: (m) => memberGenderLabel(m.g),
  language: (m) => memberLanguageLabel(m.language),
  assignee: (m) => m.assignee || 'Unassigned',
  subProgram: (m) => m.subProgram,
  progSubStatus: (m) => m.progSubStatus,
  carePlanStatus: (m) => m.carePlanStatus,
  ri: (m) => m.ri,
};
// Member filters show the vocabulary every worklist shares.
const STATIC_OPTIONS = { gender: GENDER_FILTER_OPTIONS, language: LANGUAGE_FILTER_OPTIONS, subProgram: CMP_SUB_PROGRAMS };

// MM/DD/YYYY → timestamp, so date columns sort chronologically (the shared
// sort would compare them as month-first numbers).
const mdyTime = (mdy) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy || '');
  return m ? new Date(+m[3], +m[1] - 1, +m[2]).getTime() : null;
};

const CMP_SHELL_COLUMNS = [
  { key: 'select', showCheckbox: true, sticky: 'left', left: 0, width: 36 },
  { key: 'name',   label: 'Members', sortKey: 'name', sticky: 'left', left: 36, width: 240 },
  ...CMP_MIDDLE_COLUMNS,
  { key: 'actions', label: 'Actions', sticky: 'right', width: 120 },
];

export function CmpWorklistTable() {
  const members = useAppStore(s => s.cmpMembers);
  const loading = useAppStore(s => s.cmpMembersLoading);
  const fetchMembers = useAppStore(s => s.fetchCmpMembers);
  const filters = useAppStore(s => s.cmpFilters);
  const setFilter = useAppStore(s => s.setCmpFilter);
  const clearFilters = useAppStore(s => s.clearCmpFilters);
  // A selected saved filter stays selected while edited: Go Back / Save Changes / Copy Filter.
  const savedActions = useSavedFilterActions('CMP', filters, clearFilters);
  const selectedIds = useAppStore(s => s.selectedCmpIds);
  const selectMember = useAppStore(s => s.selectCmpMember);
  const selectAll = useAppStore(s => s.selectAllCmp);
  const clearSelected = useAppStore(s => s.clearCmpSelected);
  const showToast = useAppStore(s => s.showToast);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  const openHistoryDrawer = useAppStore(s => s.openHccHistoryDrawer);
  const saveSavedFilter = useAppStore(s => s.saveSavedFilter);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarOpen, setFilterBarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filterOptions = useMemo(() => {
    const opts = {};
    for (const [key, valueOf] of Object.entries(FILTER_VALUE)) {
      opts[key] = STATIC_OPTIONS[key]
        || [...new Set(members.map(valueOf).filter(Boolean))].toSorted();
    }
    return opts;
  }, [members]);

  const enriched = useMemo(() => members.map(m => ({
    ...m,
    nextActionDueSort: mdyTime(m.nextActionDue),
    programStartSort: mdyTime(m.programStartDate),
    programDueSort: mdyTime(m.programDueDate),
  })), [members]);

  const filtered = useMemo(() => {
    let rows = enriched;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(m => (m.name || '').toLowerCase().includes(q) || (m.memberId || '').toLowerCase().includes(q));
    }
    for (const [key, valueOf] of Object.entries(FILTER_VALUE)) {
      const vals = filters[key];
      if (vals?.length) rows = rows.filter(m => vals.includes(valueOf(m)));
    }
    // DOB is a date range (Years or Custom Dates), not a value list.
    return rows.filter(m => dobInRange(m.dob, m.age, filters.dob));
  }, [enriched, searchQuery, filters]);

  // One row per member: their matching enrollments (one per CMP
  // sub-program), soonest Next Action Due first. Member columns come from
  // the first; sorting on an enrollment column uses the member's first one.
  const grouped = useMemo(() => {
    const byMember = new Map();
    for (const e of filtered) {
      const key = String(e.memberId || e.patientId || e.id);
      if (!byMember.has(key)) byMember.set(key, []);
      byMember.get(key).push(e);
    }
    const minOf = (list, k) => Math.min(...list.map(e => e[k] ?? Infinity));
    return [...byMember.entries()].map(([key, list]) => {
      const enrollments = list.toSorted((a, b) => (a.nextActionDueSort ?? Infinity) - (b.nextActionDueSort ?? Infinity));
      return {
        ...enrollments[0],
        id: key,
        enrollments,
        task: list.reduce((n, e) => n + (e.task || 0), 0),
        nextActionDueSort: minOf(list, 'nextActionDueSort'),
        programStartSort: minOf(list, 'programStartSort'),
        programDueSort: minOf(list, 'programDueSort'),
      };
    });
  }, [filtered]);

  const { sorted, sortKey, sortDir, requestSort } = useTableSort(grouped, 'nextActionDueSort', 'asc');

  const pageRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page, perPage]);

  const handleSelectAll = (checked) => {
    if (checked) selectAll([...new Set([...selectedIds, ...pageRows.map(r => r.id)])]);
    else selectAll(selectedIds.filter(id => !pageRows.some(r => r.id === id)));
  };

  const filterNode = (
    <FilterBar
      autoFit
      pinPrimary
      multiSelect
      leading={null}
      filterDefs={CMP_FILTER_DEFS}
      filters={filters}
      onFilterChange={(k, vals) => setFilter(k, vals)}
      onClearAll={savedActions.onClearAll}
      clearAllLabel={savedActions.clearAllLabel}
      saveLabel={savedActions.saveLabel}
      saveMenuItems={savedActions.saveMenuItems}
      onSaveMenuSelect={savedActions.onSaveMenuSelect}
      hasActive={savedActions.edited || undefined}
      onSaveFilter={(name) => saveSavedFilter('CMP', name)}
      moreFilterItems={CMP_MORE_FILTER_ITEMS}
      renderChip={(k) => {
        if (k === 'dob') return <DobFilter value={filters.dob || []} onChange={vals => setFilter('dob', vals)} />;
        const def = CMP_FILTER_DEFS.find(d => d.key === k);
        if (!def) return null;
        return (
          <FilterChip
            label={def.label}
            options={filterOptions[k] || []}
            selected={filters[k] || []}
            onChange={vals => setFilter(k, vals)}
            searchable={k === 'language' || k === 'assignee'}
          />
        );
      }}
    />
  );

  const header = (
    <SectionTitleBar
      variant="titleOnly"
      leadingElement={<SubnavToggle />}
      title="CMP"
      actions={['search', 'filter', 'history', 'download']}
      searchPlaceholder="Search by name or member ID…"
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      filterActive={filterBarOpen}
      onFilter={() => setFilterBarOpen(v => !v)}
      onHistory={openHistoryDrawer}
      rightExtras={
        <>
          <SavedFiltersChip list="CMP" />
          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
        </>
      }
      onDownload={() => showToast('Export is coming soon')}
    />
  );

  return (
    <WorklistShell
      header={header}
      worklistKey="cmp"
      showFilters={filterBarOpen}
      filters={filterNode}
      columns={CMP_SHELL_COLUMNS}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={requestSort}
      rows={pageRows}
      renderRow={(m, _i, ctx) => (
        <CmpWorklistRow
          key={m.id}
          member={m}
          columns={ctx.orderedColumns}
          hiddenSet={ctx.hiddenSet}
          selected={selectedIds.includes(m.id)}
          onToggle={() => selectMember(m.id)}
          onView={(e) => navigateToPatient(e.patientId || e.id, { profileTab: 'Care Programs', programCode: 'CMP', subProgram: e.subProgram })}
          showToast={showToast}
        />
      )}
      loading={loading && pageRows.length === 0}
      emptyState="No members match the current filters."
      selectedIds={selectedIds}
      onSelectAll={handleSelectAll}
      onClearSelection={clearSelected}
      page={page}
      perPage={perPage}
      totalItems={grouped.length}
      onPageChange={setPage}
      onPageSizeChange={(p) => { setPerPage(p); setPage(1); }}
      minTableWidth={1700}
    />
  );
}
