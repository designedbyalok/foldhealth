import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { WorklistShell } from '../worklists/WorklistShell';
import { SelectAssigneeModal } from '../../components/SelectAssigneeModal/SelectAssigneeModal';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { clinicalRolesPickerLabel } from '../../lib/worklistAssignee';
import styles from './CmpWorklistTable.module.css';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { SubnavToggle } from '../../components/SubnavToggle/SubnavToggle';
import { FilterBar } from '../worklists/FilterBar';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { DobFilter } from '../../components/DobFilter/DobFilter';
import { DateRangePopover } from '../../components/DateRangePopover/DateRangePopover';
import { fmtDay } from '../../components/DateRangeFilter/dateRangePresets';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { SavedFiltersChip } from '../hcc/SavedFiltersChip';
import { useSavedFilterActions } from '../hcc/useSavedFilterActions';
import { CmpWorklistRow } from './CmpWorklistRow';
import { CMP_MIDDLE_COLUMNS } from './cmpColumns';
import { CMP_FILTER_DEFS, CMP_FILTER_DEF_MAP, cmpFilterOptions, enrollmentMatches } from './cmpFilters';
import { CMP_OWNER_ROLES } from './cmpCareTeam';
import { Select } from '../../components/Select/Select';
import { useCovering } from '../ooo/useCovering';

// Every filter's More Filters entry, grouped (Members, Program, Care Team,
// Clinical, Tasks); the spec lives in cmpFilters.js.
const CMP_MORE_FILTER_ITEMS = CMP_FILTER_DEFS.map(fd => ({ k: fd.key, label: fd.label, primary: fd.primary, group: fd.group }));

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

const ACUITY_RANK = { Low: 1, Medium: 2, High: 3 };

// HCC-only roles don't own care program members.
const HCC_ONLY_ROLES = new Set(['Coder', 'Support', 'QA', 'Compliance']);

// One worklist row per member: the key enrollments are grouped by (and the
// row id the selection holds).
const memberKey = (e) => String(e.memberId || e.patientId || e.id);

// Every owner on an enrollment (Assignee and the care team) counts for Covering for.
const ownerNames = (e) => CMP_OWNER_ROLES.map(r => e[r.key]).filter(Boolean);
const COVERING_DEF = { key: 'coveringFor', label: 'Covering for', primary: true, group: 'Care Team' };
const NO_PICKS = [];

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
  const setCmpCareTeam = useAppStore(s => s.setCmpCareTeam);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);
  // Who the cells' assignee pickers offer: care staff, not the HCC-only roles.
  const assignableUsers = useMemo(() => platformUsers
    .filter(u => !u.clinicalRoles?.some(r => HCC_ONLY_ROLES.has(r)))
    .map(u => ({ id: u.id, name: u.name, initials: u.initials, role: clinicalRolesPickerLabel(u) })), [platformUsers]);
  const setCareTeam = async (rowId, role, user) => {
    const ok = await setCmpCareTeam([rowId], role, user);
    if (!ok) showToast('Could not save the change. Try again.');
  };
  const [assignOpen, setAssignOpen] = useState(false);
  // Which sub-programs the bulk assignee goes to; the others keep theirs.
  const [assignSubPrograms, setAssignSubPrograms] = useState([]);
  // Which owner the bulk change sets: Assignee or one care team role.
  const [assignRole, setAssignRole] = useState('assignee');

  const [searchQuery, setSearchQuery] = useState('');
  // Local, not a store key: only meaningful while I'm covering someone.
  const [coveringFor, setCoveringFor] = useState([]);
  const covering = useCovering();
  const coveringPicked = covering.names.length ? coveringFor : NO_PICKS;
  const [filterBarOpen, setFilterBarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filterOptions = useMemo(() => cmpFilterOptions(members), [members]);

  const enriched = useMemo(() => members.map(m => ({
    ...m,
    nextActionDueSort: mdyTime(m.nextActionDue),
    programStartSort: mdyTime(m.programStartDate),
    programDueSort: mdyTime(m.programDueDate),
    lastAdmissionSort: mdyTime(m.lastAdmission),
    caseAcuityRank: ACUITY_RANK[m.caseAcuity] ?? null,
  })), [members]);

  const filtered = useMemo(() => {
    let rows = enriched;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(m => (m.name || '').toLowerCase().includes(q) || (m.memberId || '').toLowerCase().includes(q));
    }
    if (coveringPicked.length) rows = rows.filter(e => covering.coveringOn(ownerNames(e), coveringPicked).length > 0);
    // Program filters keep only the matching enrollments; a member shows
    // when any of theirs is left.
    return rows.filter(m => enrollmentMatches(m, filters));
  }, [enriched, searchQuery, filters, coveringPicked, covering]);

  // One row per member: their matching enrollments (one per CMP
  // sub-program), soonest Next Action Due first. Member columns come from
  // the first; sorting on an enrollment column uses the member's first one.
  const grouped = useMemo(() => {
    const byMember = new Map();
    for (const e of filtered) {
      const key = memberKey(e);
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
        coveringFor: coveringPicked.length ? covering.coveringOn(list.flatMap(ownerNames), coveringPicked) : [],
      };
    });
  }, [filtered, coveringPicked, covering]);

  const { sorted, sortKey, sortDir, requestSort } = useTableSort(grouped, 'nextActionDueSort', 'asc');

  const pageRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page, perPage]);

  const handleSelectAll = (checked) => {
    if (checked) selectAll([...new Set([...selectedIds, ...pageRows.map(r => r.id)])]);
    else selectAll(selectedIds.filter(id => !pageRows.some(r => r.id === id)));
  };

  const barDefs = covering.names.length ? [COVERING_DEF, ...CMP_FILTER_DEFS] : CMP_FILTER_DEFS;
  const barMoreItems = covering.names.length ? [{ k: COVERING_DEF.key, label: COVERING_DEF.label, primary: true, group: COVERING_DEF.group }, ...CMP_MORE_FILTER_ITEMS] : CMP_MORE_FILTER_ITEMS;
  const barFilters = coveringPicked.length ? { ...filters, coveringFor: coveringPicked } : filters;

  const filterNode = (
    <FilterBar
      collapsed={!filterBarOpen}
      autoFit
      pinPrimary
      multiSelect
      leading={null}
      filterDefs={barDefs}
      filters={barFilters}
      onFilterChange={(k, vals) => (k === COVERING_DEF.key ? setCoveringFor(vals) : setFilter(k, vals))}
      onClearAll={() => { setCoveringFor([]); savedActions.onClearAll(); }}
      clearAllLabel={savedActions.clearAllLabel}
      saveLabel={savedActions.saveLabel}
      saveMenuItems={savedActions.saveMenuItems}
      onSaveMenuSelect={savedActions.onSaveMenuSelect}
      hasActive={savedActions.edited || undefined}
      onSaveFilter={(name) => saveSavedFilter('CMP', name)}
      moreFilterItems={barMoreItems}
      renderChip={(k) => {
        if (k === COVERING_DEF.key) {
          return <FilterChip label={COVERING_DEF.label} options={covering.names} selected={coveringPicked} onChange={setCoveringFor} searchable />;
        }
        if (k === 'dob') return <DobFilter value={filters.dob || []} onChange={vals => setFilter('dob', vals)} />;
        const def = CMP_FILTER_DEF_MAP[k];
        if (!def) return null;
        const vals = filters[k] || [];
        if (def.type === 'date') {
          return (
            <FilterChip
              label={def.label}
              active={vals.length >= 2}
              activeSummary={vals.length >= 2 ? `${fmtDay(vals[0])} – ${fmtDay(vals[1])}` : undefined}
              onClear={() => setFilter(k, [])}
              renderPopover={({ anchorRect, onClose }) => (
                <DateRangePopover anchorRect={anchorRect} label={def.label} selected={vals} onChange={v => setFilter(k, v)} onClose={onClose} />
              )}
            />
          );
        }
        return (
          <FilterChip
            label={def.label}
            options={filterOptions[k] || []}
            selected={vals}
            onChange={v => setFilter(k, v)}
            searchable={def.searchable}
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

  // Selection is by member, and a member has one enrollment (with its own
  // assignee) per CMP sub-program. Change Assignee asks which sub-programs
  // take the new assignee: those the selected members have, with how many
  // members each, starting from the Sub Program filter's picks when it's on.
  const selectedEnrollments = useMemo(() => {
    const picked = new Set(selectedIds);
    return members.filter(e => picked.has(memberKey(e)));
  }, [members, selectedIds]);
  const subProgramCounts = useMemo(() => {
    const counts = new Map();
    for (const e of selectedEnrollments) counts.set(e.subProgram, (counts.get(e.subProgram) || 0) + 1);
    return [...counts.entries()].toSorted(([a], [b]) => a.localeCompare(b));
  }, [selectedEnrollments]);
  const openAssign = () => {
    const all = subProgramCounts.map(([sp]) => sp);
    const fromFilter = (filters.subProgram || []).filter(sp => all.includes(sp));
    setAssignSubPrograms(fromFilter.length ? fromFilter : all);
    setAssignRole('assignee');
    setAssignOpen(true);
  };
  const toggleAssignSubProgram = (sp, on) => setAssignSubPrograms(cur => (on ? [...cur, sp] : cur.filter(x => x !== sp)));
  const assignSelected = async (user) => {
    setAssignOpen(false);
    const rows = selectedEnrollments.filter(e => assignSubPrograms.includes(e.subProgram));
    const memberCount = new Set(rows.map(memberKey)).size;
    const roleLabel = CMP_OWNER_ROLES.find(r => r.key === assignRole)?.label || 'Assignee';
    const ok = await setCmpCareTeam(rows.map(e => e.id), assignRole, user);
    showToast(ok
      ? `${user.name} set as ${roleLabel} for ${memberCount} member${memberCount === 1 ? '' : 's'} (${assignSubPrograms.join(', ')})`
      : `Could not save the new ${roleLabel}. Try again.`);
    if (ok) clearSelected();
  };

  return (
    <>
      <WorklistShell
        header={header}
        worklistKey="cmp"
        // Always passed: when closed, the bar shows just the applied filters.
        showFilters
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
            users={assignableUsers}
            onSetCareTeam={setCareTeam}
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
        onChangeAssignee={openAssign}
      />
      <SelectAssigneeModal
        open={assignOpen}
        title={`Change ${CMP_OWNER_ROLES.find(r => r.key === assignRole)?.label || 'Assignee'} · ${selectedIds.length} member${selectedIds.length === 1 ? '' : 's'}`}
        confirmLabel="Assign"
        onClose={() => setAssignOpen(false)}
        onConfirm={assignSelected}
        confirmDisabled={!assignSubPrograms.length}
      >
        <div className={styles.rolePick}>
          <Select
            label="Role to change"
            size="sm"
            portal
            options={CMP_OWNER_ROLES.map(r => ({ value: r.key, label: r.label }))}
            value={assignRole}
            onValueChange={setAssignRole}
          />
        </div>
        {subProgramCounts.length > 1 && (
          <fieldset className={styles.subProgramPick}>
            <legend className={styles.subProgramLegend}>Sub-programs to reassign</legend>
            {subProgramCounts.map(([sp, n]) => (
              <label key={sp} className={styles.subProgramRow}>
                <Checkbox checked={assignSubPrograms.includes(sp)} onCheckedChange={v => toggleAssignSubProgram(sp, !!v)} />
                <span className={styles.subProgramName}>{sp}</span>
                <span className={styles.subProgramCount}>{n} member{n === 1 ? '' : 's'}</span>
              </label>
            ))}
          </fieldset>
        )}
      </SelectAssigneeModal>
    </>
  );
}
