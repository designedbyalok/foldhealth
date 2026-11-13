import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { HedisWorklistRow, HEDIS_MIDDLE_COLUMNS } from './HedisWorklistRow';
import { CareGapDetailDrawer } from './CareGapDetailDrawer';
import { TableSkeleton } from '../../components/TableSkeleton/TableSkeleton';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { Icon } from '../../components/Icon/Icon';
import { Badge } from '../../components/Badge/Badge';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { SubnavToggle } from '../../components/SubnavToggle/SubnavToggle';
import { HeaderCell } from '../../components/HeaderCell/HeaderCell';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { Pagination } from '../../components/Pagination/Pagination';
import { ColumnsHeaderButton } from '../../components/WorklistColumns/ColumnsHeaderButton';
import { useWorklistColumns } from '../worklists/useWorklistColumns';
import { FilterChipBar } from '../hcc/FilterChipBar';
import { SavedFiltersChip } from '../hcc/SavedFiltersChip';
import { FilterNameDialog } from '../../components/FilterBar/FilterNameDialog';
import { BulkBar } from '../../components/BulkBar/BulkBar';
import { BulkChangeHedisAssigneeDialog } from './BulkChangeHedisAssigneeDialog';
import { SortPopover } from '../../components/SortPopover/SortPopover';
import { useCovering } from '../ooo/useCovering';

// Axes the reviewer can sort the Member column on. Age is stored as
// "48y 4m", useTableSort's number path would collapse that to 484
// via a non-digit strip, so we sort on `_ageYears` (decorated below).
const HEDIS_MEMBER_SORT_ITEMS = [
  { key: 'name',      label: 'Name' },
  { key: '_ageYears', label: 'Age' },
  { key: 'gender',    label: 'Gender' },
  { key: 'memberId',  label: 'ID' },
];
import {
  FILTER_DEF_MAP as HEDIS_FILTER_DEF_MAP,
  MORE_FILTER_ITEMS as HEDIS_MORE_FILTER_ITEMS,
  PRIMARY_FILTER_KEYS as HEDIS_PRIMARY_FILTER_KEYS,
  memberMatchesFilters as hedisMemberMatchesFilters,
  countActiveFilters as countActiveHedisFilters,
  GAP_LEVEL_FILTER_KEYS,
  gapMatchesGapFilters,
} from './hedisFilters';
import { CIS_CODE } from './cis/cisRules';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import styles from './HedisWorklistTable.module.css';
import rowStyles from './HedisWorklistRow.module.css';

const YEARS = [2024, 2025, 2026];
const NO_PICKS = [];
// Same owners the Assignee filter matches: the member's and each gap's.
const assigneeNamesOf = (m) => [m.assignee, ...(m.gaps || []).map(g => g.assignee)];

export function HedisWorklistTable() {
  const currentPage = useAppStore(s => s.currentPage);
  const perPage = useAppStore(s => s.perPage);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);
  const setPerPage = useAppStore(s => s.setPerPage);
  const showToast = useAppStore(s => s.showToast);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const openAddCareGapsPicker = useAppStore(s => s.openAddCareGapsPicker);

  // HEDIS filter state now lives in the store (same shape as HCC's hccFilters,
  // `{ [k]: string[] }`) so the shared FilterChipBar + SavedFiltersChip
  // and the saveSavedFilter / applySavedFilter machinery drive it directly.
  const hedisFilters = useAppStore(s => s.hedisFilters);
  const saveHedisFilter = useAppStore(s => s.saveHedisFilter);

  // Ensure the platformUsers slice is populated so the inline assignee picker
  // in HedisWorklistRow renders a real user list on first mount.
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  const [year, setYear] = useState(2026);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarOpen, setFilterBarOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAssigneeOpen, setBulkAssigneeOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [drawerMemberId, setDrawerMemberId] = useState(null);
  const [drawerGapCode, setDrawerGapCode] = useState(null);
  const [drawerInstanceNo, setDrawerInstanceNo] = useState(null);
  // "Covering for" filter: local, not in hedisFilters, so saved filters never carry it.
  const { names: coveringNames, coveringOn } = useCovering();
  const [coveringPicked, setCoveringPicked] = useState([]);
  const covering = coveringNames.length > 0 ? coveringPicked : NO_PICKS;
  const coveringChip = useMemo(
    () => ({ names: coveringNames, selected: coveringPicked, onChange: setCoveringPicked }),
    [coveringNames, coveringPicked],
  );

  // Read the live member from the store so store mutations re-render the drawer.
  const drawerMember = useMemo(
    () => (drawerMemberId ? hedisMembers.find(m => m.id === drawerMemberId) : null),
    [drawerMemberId, hedisMembers]
  );

  // `instanceNo` opens a specific instance (e.g. a manual gap's parent).
  const openGapDrawer = (member, gapCode, instanceNo = null) => {
    setDrawerMemberId(member.id);
    setDrawerGapCode(gapCode);
    setDrawerInstanceNo(instanceNo);
  };
  const closeGapDrawer = () => { setDrawerMemberId(null); setDrawerGapCode(null); };

  const fetchHedisMembers = useAppStore(s => s.fetchHedisMembers);
  const hedisLoading = useAppStore(s => s.hedisLoading);

  // Fetch from Supabase on first mount; falls back to local mock on error.
  useEffect(() => {
    if (hedisMembers.length === 0 && !hedisLoading) {
      fetchHedisMembers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let result = hedisMembers || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        m.in.toLowerCase().includes(q)
      );
    }
    const matched = result.filter(m => hedisMemberMatchesFilters(m, hedisFilters)
      && (!covering.length || coveringOn(assigneeNamesOf(m), covering).length > 0));
    // Source, Instance, Compliance and Operational Status are per-gap: a
    // matching member shows only the gaps that match, not all of its gaps.
    // `allGaps` keeps the rest for context (a gap's other instances).
    if (!GAP_LEVEL_FILTER_KEYS.some(k => hedisFilters?.[k]?.length)) return matched;
    return matched.map(m => ({
      ...m,
      allGaps: m.gaps,
      gaps: (m.gaps || []).filter(g => gapMatchesGapFilters(g, hedisFilters)),
    }));
  }, [searchQuery, hedisFilters, hedisMembers, covering, coveringOn]);
  const isFiltered = !!searchQuery.trim() || Object.values(hedisFilters || {}).some(v => v?.length) || covering.length > 0;

  // Data-derived option pools passed to the FilterChipBar so `dynamic` chips
  // (Assignee, State, City, IPA, HP Code) enumerate only what the loaded
  // members actually carry: same pattern HCC's FilterChipBar uses.
  const platformUsers = useAppStore(s => s.platformUsers);
  const dynamicOpts = useMemo(() => {
    const state = new Set();
    const city = new Set();
    const ipa = new Set();
    const hpCode = new Set();
    const assignee = new Set();
    // Care Gaps: enumerate every unique gap CODE the loaded members
    // carry so the popover doubles as a live measure catalog. Codes are
    // rendered as "CODE: Measure Name" via `careGapsLabelMap` below.
    const careGaps = new Set();
    for (const m of (hedisMembers || [])) {
      if (m.state) state.add(m.state);
      if (m.city) city.add(m.city);
      if (m.ipa) ipa.add(m.ipa);
      if (m.hpCode) hpCode.add(m.hpCode);
      if (m.assignee) assignee.add(m.assignee);
      for (const g of (m.gaps || [])) {
        if (g?.code) careGaps.add(g.code);
      }
    }
    return {
      assignee: platformUsers?.length ? platformUsers.map(u => u.name) : [...assignee].toSorted(),
      state:    [...state].toSorted(),
      city:     [...city].toSorted(),
      ipa:      [...ipa].toSorted(),
      hpCode:   [...hpCode].toSorted(),
      careGaps: [...careGaps].toSorted(),
    };
  }, [hedisMembers, platformUsers]);

  const activeFilterCount = countActiveHedisFilters(hedisFilters) + (covering.length ? 1 : 0);

  // Decorate members with `_ageYears` (leading integer of "48y 4m")
  // so the SortPopover's Age axis ranks by actual years instead of the
  // digit-concat useTableSort's number path would otherwise produce.
  const filteredWithAge = useMemo(
    () => filtered.map(m => ({
      ...m,
      _ageYears: parseInt(String(m.age || '').split('y')[0], 10) || 0,
    })),
    [filtered],
  );
  const { sorted, sortKey, sortDir, requestSort, setSort, clearSort } = useTableSort(filteredWithAge, 'startDate', 'desc');
  // Anchor rect for the Member-column axis picker (opened by clicking
  // the HeaderCell's sort icon).
  const [memberSortPop, setMemberSortPop] = useState(null);

  // Reset to page 1 whenever the filtered result set changes size.
  useEffect(() => { setCurrentPage(1); }, [filtered.length, setCurrentPage]);

  const startIdx = (currentPage - 1) * perPage;
  const paginated = sorted.slice(startIdx, startIdx + perPage);

  const allIds = paginated.map(m => m.id);

  // CIS-CMB10 rows show a dose countdown under Start Date, evaluated from
  // the child's immunizations.
  const fetchImmunizationsForPatients = useAppStore(s => s.fetchImmunizationsForPatients);
  const cisPageIds = paginated
    .filter(m => (m.gaps || []).some(g => g.code === CIS_CODE))
    .map(m => m.id).join(',');
  useEffect(() => {
    if (cisPageIds) fetchImmunizationsForPatients(cisPageIds.split(','));
  }, [cisPageIds, fetchImmunizationsForPatients]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedSet.has(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? allIds : []);
  };

  const thStyle = `${rowStyles.stickyLeft}`;

  // Column prefs: HedisWorklistTable renders a bespoke table, so we wire
  // useWorklistColumns directly. The sticky checkbox / Member / Actions
  // columns bracket the customisable middle band.
  const columnPrefs = useWorklistColumns('hedis', HEDIS_MIDDLE_COLUMNS);
  const visibleMiddle = columnPrefs.visibleColumns;
  const orderedColumnsForRow = useMemo(() => (
    [{ key: 'select', showCheckbox: true, sticky: 'left' },
     { key: 'members', label: 'Member', sticky: 'left' },
     ...columnPrefs.orderedColumns,
     { key: 'actions', label: 'Actions', sticky: 'right' }]
  ), [columnPrefs.orderedColumns]);
  const emptyColSpan = 2 + visibleMiddle.length + 1;

  return (
    <>
    <div className={styles.wrap}>
      {/* ── Header bar (SectionTitleBar · variant 2 · titleWithDropdown) ── */}
      <SectionTitleBar
        variant="titleWithDropdown"
        leadingElement={<SubnavToggle />}
        title="HEDIS"
        // Empty dropdown label collapses the chip to just its value
        // ("2026 ⌄"): the worklist heading beside it already tells
        // the reader what year picker they're looking at.
        dropdownLabel=""
        dropdownOptions={YEARS.map(String)}
        dropdownValue={String(year)}
        onDropdownChange={(v) => setYear(Number(v) || 2026)}
        // Year is a never-empty picker: clearing "2026" makes no sense,
        // so the trailing glyph stays a chevron. Regular size aligns with
        // the primary chip row below. Keep the primary purple palette
        // (dropdownNoClearNeutral={false}) because this is a headline
        // control next to the worklist title, not an ambient info chip.
        dropdownNoClear
        dropdownNoClearNeutral={false}
        dropdownSize="M"
        actions={['search', 'filter', 'download', 'history']}
        searchPlaceholder="Search by member name…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filterActive={filterBarOpen}
        filterBadgeCount={activeFilterCount}
        onFilter={() => setFilterBarOpen(v => !v)}
        onDownload={() => showToast('Export: coming soon')}
        onHistory={() => showToast('History: coming soon')}
        rightExtras={
          <>
            <SavedFiltersChip list="HEDIS" />
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
            {/* Add a gap for any patient: opens Add Care Gaps with a Member
                picker first, like HCC's Upload → Add Manually. */}
            <ActionButton
              icon="solar:clipboard-add-linear"
              tooltip="Add Gap"
              tooltipBelow
              onClick={openAddCareGapsPicker}
            />
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          </>
        }
      />

      {/* ── Filter chip bar (shared with HCC) ── */}
      <FilterChipBar
        collapsed={!filterBarOpen}
        list="HEDIS"
        filterDefMap={HEDIS_FILTER_DEF_MAP}
        moreFilterItems={HEDIS_MORE_FILTER_ITEMS}
        primaryFilterKeys={HEDIS_PRIMARY_FILTER_KEYS}
        dynamicOpts={dynamicOpts}
        onSaveFilter={() => setSaveDialogOpen(true)}
        covering={coveringChip}
      />

      {/* ── Table ── */}
      <div className={styles.scrollWrap} style={{ flex: 1 }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${rowStyles.stickyLeft} ${rowStyles.stickyCheck} ${styles.checkTh}`}>
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </th>
              {/* Member header uses the shared HeaderCell so the sort
                  icon chrome matches Start Date, but its click routes
                  to a SortPopover (the Member column has four valid
                  axes, Name / Age / Gender / ID, that a plain
                  asc/desc toggle can't express). Same pattern the HCC
                  worklist's Member header uses. */}
              <HeaderCell
                label="Member"
                sortField="name"
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={(_field, rect) => setMemberSortPop(rect)}
                className={`${rowStyles.stickyLeft} ${rowStyles.stickyMember} ${styles.memberTh}`}
              />
              {/* Every middle column renders as HeaderCell, sortable
                  ones (col.sortKey) get the click-to-sort chevron;
                  non-sortable ones fall through to HeaderCell's plain
                  label rendering so type + padding stay in sync with
                  the design system instead of inline styles. */}
              {visibleMiddle.map(col => (
                <HeaderCell
                  key={col.key}
                  label={col.label}
                  sortField={col.sortKey}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={col.sortKey ? requestSort : undefined}
                />
              ))}
              <th className={rowStyles.stickyRight} style={{ height: 32, padding: '0 12px', fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--neutral-300)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <ColumnsHeaderButton
                  columns={columnPrefs.orderedColumns}
                  hiddenSet={columnPrefs.hiddenSet}
                  onToggle={columnPrefs.onToggle}
                  onReorder={columnPrefs.onReorder}
                  onReset={columnPrefs.onReset}
                  label="Actions"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={emptyColSpan}>
                  <div className={styles.empty}>
                    <Icon name="solar:magnifer-linear" size={40} color="var(--neutral-200)" />
                    <p className={styles.emptyTitle}>No members found</p>
                    <p className={styles.emptyMsg}>No HEDIS members match your current filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(m => (
                <HedisWorklistRow
                  key={m.id}
                  member={m}
                  columns={orderedColumnsForRow}
                  hiddenSet={columnPrefs.hiddenSet}
                  isSelected={selectedSet.has(m.id)}
                  onSelect={toggleSelect}
                  onOpenGap={openGapDrawer}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination bar ── */}
      <div className={styles.paginationBar}>
        <Pagination
          totalItems={filtered.length}
          currentPage={currentPage}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
          totalCount={(hedisMembers || []).length}
          filtered={isFiltered}
        />
      </div>
    </div>

    {drawerMember && (
      <CareGapDetailDrawer
        member={drawerMember}
        gapCode={drawerGapCode}
        instanceNo={drawerInstanceNo}
        year={year}
        onClose={closeGapDrawer}
      />
    )}
    <FilterNameDialog
      open={saveDialogOpen}
      title="Save Filter"
      submitLabel="Save"
      onSubmit={(name) => { saveHedisFilter(name); setSaveDialogOpen(false); }}
      onCancel={() => setSaveDialogOpen(false)}
    />
    {/* Floating bulk-action bar: appears when one or more rows are
        selected via the sticky-left checkbox column. Change Assignee is
        the only wired verb for now; the rest of BulkBar's default cluster
        (Run Automation / More menu) stays on its shared "coming soon"
        toast until the HEDIS workflows for those actions exist. */}
    <BulkBar
      selectedIds={selectedIds}
      onClear={() => setSelectedIds([])}
      onChangeAssignee={() => setBulkAssigneeOpen(true)}
    />
    <BulkChangeHedisAssigneeDialog
      open={bulkAssigneeOpen}
      selectedIds={selectedIds}
      onClose={() => setBulkAssigneeOpen(false)}
      onApplied={() => { setBulkAssigneeOpen(false); setSelectedIds([]); }}
    />
    {memberSortPop && (
      <SortPopover
        anchorRect={memberSortPop}
        items={HEDIS_MEMBER_SORT_ITEMS}
        currentKey={sortKey}
        currentDir={sortDir}
        /* onSort no longer dismisses the popover, the picked
           direction should stay highlighted in primary so the
           reviewer can see the applied selection. Dismiss happens on
           overlay click / Escape / Clear Sort. */
        onSort={(k, dir) => setSort(k, dir)}
        onClear={() => { clearSort(); setMemberSortPop(null); }}
        onClose={() => setMemberSortPop(null)}
      />
    )}
    </>
  );
}
