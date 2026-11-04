import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { Button } from '../../components/Button/Button';
import { BulkBar } from '../../components/BulkBar/BulkBar';
import { SelectAssigneeModal } from '../../components/SelectAssigneeModal/SelectAssigneeModal';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { SubnavToggle } from '../../components/SubnavToggle/SubnavToggle';
import { Pagination } from '../../components/Pagination/Pagination';
import { TableSkeleton } from '../../components/TableSkeleton/TableSkeleton';
import { HeaderCell } from '../../components/HeaderCell/HeaderCell';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { ColumnsHeaderButton } from '../../components/WorklistColumns/ColumnsHeaderButton';
import { useWorklistColumns } from '../../components/WorklistColumns/useWorklistColumns';
import { PharmacyWorklistRow } from './PharmacyWorklistRow';
import { PharmacyGapDetailDrawer } from './PharmacyGapDetailDrawer';
import { SavedFiltersChip } from '../hcc/SavedFiltersChip';
import { FilterChipBar } from '../hcc/FilterChipBar';
import { FilterNameDialog } from '../hcc/FilterNameDialog';
import { CareGapDetailDrawer } from '../hedis-worklist/CareGapDetailDrawer';
import { PHARMACY_MIDDLE_COLUMNS, PHARMACY_HIDDEN_BY_DEFAULT } from './pharmacyColumns';
import { enrichPharmacyMember, measureDrugs, normMemberId } from './pharmacyWorklist.utils';
import { FILTER_DEF_MAP, MORE_FILTER_ITEMS, PRIMARY_FILTER_KEYS, dynamicFilterOptions, memberMatchesFilters } from './pharmacyFilters';
import { MEASURE_NAMES as HEDIS_MEASURE_NAMES } from '../hedis-worklist/CareGapDetailDrawer.utils';
import styles from './PharmacyWorklistTable.module.css';

// Default order is triage order: priority, then the soonest fail date.
// A header sort overrides it; clearing the sort returns here.
const byTriage = (a, b) =>
  a.priorityRank - b.priorityRank
  || (a.failDateSort ?? Infinity) - (b.failDateSort ?? Infinity);

const thStyle = {
  padding: '8px 14px',
  fontSize: 'var(--font-sm)',
  fontWeight: 500,
  color: 'var(--neutral-300)',
  borderBottom: '1px solid var(--neutral-150)',
  background: 'var(--neutral-0)',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  textAlign: 'left',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

export function PharmacyWorklistTable() {
  const members = useAppStore(s => s.pharmacyWorklistMembers);
  const loading = useAppStore(s => s.pharmacyWorklistLoading);
  const loadError = useAppStore(s => s.pharmacyWorklistError);
  const fetchMembers = useAppStore(s => s.fetchPharmacyWorklistMembers);
  const ensureClaimFollowUpTasks = useAppStore(s => s.ensureClaimFollowUpTasks);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const fetchHedisMembers = useAppStore(s => s.fetchHedisMembers);
  const showToast = useAppStore(s => s.showToast);
  const setPharmacyAssignee = useAppStore(s => s.setPharmacyAssignee);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const filters = useAppStore(s => s.pharmacyFilters);
  const clearFilters = useAppStore(s => s.clearPharmacyFilters);
  const saveSavedFilter = useAppStore(s => s.saveSavedFilter);
  const authUserId = useAppStore(s => s.authUserId);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarOpen, setFilterBarOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  // Any filter change goes back to page 1, including a saved filter applied
  // or reset from the chip (outside onFilterChange).
  const [pageFilters, setPageFilters] = useState(filters);
  if (pageFilters !== filters) {
    setPageFilters(filters);
    setPage(1);
  }
  // Care Gap Details for an Open Care Gap picked from a row's hover card.
  const [careGap, setCareGap] = useState(null); // { hedisMemberId, code }
  const careGapMember = careGap ? (hedisMembers || []).find(h => h.id === careGap.hedisMemberId) : null;

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  // Overdue claims get a pharmacy follow-up task automatically.
  useEffect(() => { if (members.length) ensureClaimFollowUpTasks(); }, [members, ensureClaimFollowUpTasks]);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);
  // Other Care Gaps come from the member's live HEDIS gaps (one patient, one
  // story); superseded gaps were closed and re-added, so they don't count.
  useEffect(() => { fetchHedisMembers(); }, [fetchHedisMembers]);
  const hedisGapsByMember = useMemo(() => new Map((hedisMembers || []).map(h => [
    normMemberId(h.memberId || h.id),
    (h.gaps || []).filter(g => !g.supersededAt).map(g => ({ code: g.code, name: HEDIS_MEASURE_NAMES[g.code], status: g.status, hedisMemberId: h.id })),
  ])), [hedisMembers]);

  const enriched = useMemo(
    // A member whose gaps are all First Fill or Not Eligible stays off the worklist.
    () => members.map(m => enrichPharmacyMember(m, { hedisGapsByMember }))
      .filter(m => m.gaps.length || !m.measures?.length)
      .toSorted(byTriage),
    [members, hedisGapsByMember],
  );

  const filterCtx = useMemo(() => ({ authUserId }), [authUserId]);
  const dynamicOpts = useMemo(() => dynamicFilterOptions(enriched, filterCtx), [enriched, filterCtx]);

  const filtered = useMemo(() => {
    let rows = enriched;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.memberId || '').toLowerCase().includes(q) ||
        (m.assigneeName || '').toLowerCase().includes(q) ||
        (m.measures || []).some(x => measureDrugs(x).toLowerCase().includes(q)),
      );
    }
    return rows.filter(m => memberMatchesFilters(m, filters, filterCtx));
  }, [enriched, searchQuery, filters, filterCtx]);

  const { sorted: bySort, sortKey, sortDir, setSort, clearSort } = useTableSort(filtered);
  // Gaps a claim reversal reopened stay on top whatever the sort, since
  // their compliance window keeps running (Monique: "a big neon sign").
  const sorted = useMemo(() => [...bySort.filter(m => m.reopenedByReversal), ...bySort.filter(m => !m.reopenedByReversal)], [bySort]);
  // The drawer's previous / next follow the rows as shown.
  const setWorklistOrder = useAppStore(s => s.setPharmacyWorklistOrder);
  useEffect(() => { setWorklistOrder(sorted.map(m => m.id)); }, [sorted, setWorklistOrder]);
  const handleSort = (field) => {
    if (sortKey !== field) setSort(field, 'asc');
    else if (sortDir === 'asc') setSort(field, 'desc');
    else clearSort();
  };

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page, perPage]);

  const pageIds = paginated.map(r => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
  const someSelected = !allSelected && pageIds.some(id => selectedIds.has(id));
  const toggleSelected = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const handleSelectAll = (checked) => setSelectedIds(prev => {
    const next = new Set(prev);
    for (const id of pageIds) { if (checked) next.add(id); else next.delete(id); }
    return next;
  });

  const columnPrefs = useWorklistColumns('pharmacy', PHARMACY_MIDDLE_COLUMNS, { hiddenByDefault: PHARMACY_HIDDEN_BY_DEFAULT });
  const visibleMiddle = columnPrefs.visibleColumns;
  const colCount = 2 + visibleMiddle.length + 1;

  return (
    <div className={styles.wrap}>
      <SectionTitleBar
        variant="titleWithToggle"
        leadingElement={<SubnavToggle />}
        title="Pharmacy"
        toggleItems={[]}
        actions={['search', 'filter', 'history']}
        searchPlaceholder="Search members, drugs or coordinators"
        searchValue={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
        filterActive={filterBarOpen}
        onFilter={() => setFilterBarOpen(v => !v)}
        onHistory={() => showToast('History – coming soon')}
        rightExtras={
          <>
            <SavedFiltersChip list="Pharmacy" />
            <span className={styles.titleDivider} />
          </>
        }
      />

      {filterBarOpen && (
        <FilterChipBar
          list="Pharmacy"
          filterDefMap={FILTER_DEF_MAP}
          moreFilterItems={MORE_FILTER_ITEMS}
          primaryFilterKeys={PRIMARY_FILTER_KEYS}
          dynamicOpts={dynamicOpts}
          onSaveFilter={() => setSaveDialogOpen(true)}
        />
      )}
      <FilterNameDialog
        open={saveDialogOpen}
        title="Save Filter"
        submitLabel="Save"
        onSubmit={(name) => { saveSavedFilter('Pharmacy', name); setSaveDialogOpen(false); }}
        onCancel={() => setSaveDialogOpen(false)}
      />
      {/* Selected rows get the shared floating bar; Change Assignee sets one
          coordinator on every selected member (each logs its own change). */}
      <BulkBar
        selectedIds={[...selectedIds]}
        onClear={() => setSelectedIds(new Set())}
        onChangeAssignee={() => setBulkAssignOpen(true)}
        noun={selectedIds.size === 1 ? 'Member' : 'Members'}
        className={styles.bulkBar}
      />
      <SelectAssigneeModal
        open={bulkAssignOpen}
        title={`Assign ${selectedIds.size} member${selectedIds.size === 1 ? '' : 's'}`}
        confirmLabel="Assign"
        onClose={() => setBulkAssignOpen(false)}
        onConfirm={(user) => {
          for (const id of selectedIds) setPharmacyAssignee(id, user);
          showToast(`${selectedIds.size} member${selectedIds.size === 1 ? '' : 's'} assigned to ${user.name}`);
          setBulkAssignOpen(false);
          setSelectedIds(new Set());
        }}
      />

      <div className={styles.tableScroll}>
        {loading && members.length === 0 ? (
          <TableSkeleton rows={perPage} columns={colCount} />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 36, padding: '8px 10px', left: 0, zIndex: 4 }}>
                  <Checkbox checked={someSelected ? 'indeterminate' : allSelected} onCheckedChange={handleSelectAll} aria-label="Select all members on this page" />
                </th>
                <HeaderCell
                  label="Members"
                  sortField="name"
                  sortType="alpha"
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={{ ...thStyle, padding: '8px 12px 8px 4px', left: 36, zIndex: 4, borderRight: '0.5px solid var(--neutral-150)' }}
                />
                {visibleMiddle.map(col => (
                  col.sortKey
                    ? <HeaderCell
                        key={col.key}
                        label={col.label}
                        sortField={col.sortKey}
                        sortType={col.sortType || 'alpha'}
                        activeKey={sortKey}
                        activeDir={sortDir}
                        onSort={handleSort}
                        style={thStyle}
                      />
                    : <HeaderCell key={col.key} label={col.label} style={thStyle} />
                ))}
                <th style={{ ...thStyle, width: 140, right: 0, zIndex: 3 }}>
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
              {paginated.map(m => (
                <PharmacyWorklistRow
                  key={m.id}
                  member={m}
                  columns={columnPrefs.orderedColumns}
                  hiddenSet={columnPrefs.hiddenSet}
                  isSelected={selectedIds.has(m.id)}
                  onSelect={toggleSelected}
                  onOpenCareGap={(hedisMemberId, code) => setCareGap({ hedisMemberId, code })}
                />
              ))}
            </tbody>
          </table>
        )}
        {!loading && loadError && members.length === 0 && (
          <div className={styles.emptySearch} role="alert">
            <Icon name="solar:danger-circle-linear" size={40} color="var(--neutral-200)" />
            <p className={styles.emptyTitle}>Couldn't load the pharmacy worklist</p>
            <p className={styles.emptyText}>The member list didn't load. Check your connection and try again.</p>
            <Button variant="outline" leadingIcon="solar:refresh-linear" onClick={() => fetchMembers()}>Retry</Button>
          </div>
        )}
        {!loading && !loadError && members.length === 0 && (
          <div className={styles.emptySearch}>
            <Icon name="solar:pill-linear" size={40} color="var(--neutral-200)" />
            <p className={styles.emptyTitle}>No members on this worklist yet</p>
            <p className={styles.emptyText}>Members with open MAC, MAD or MAH gaps appear here once the plan file is loaded.</p>
          </div>
        )}
        {!loading && members.length > 0 && filtered.length === 0 && (
          <div className={styles.emptySearch}>
            <Icon name="solar:magnifer-linear" size={40} color="var(--neutral-200)" />
            <p className={styles.emptyTitle}>No results found</p>
            <p className={styles.emptyText}>No pharmacy members match your search or filters.</p>
            <Button variant="outline" onClick={() => { clearFilters(); setSearchQuery(''); setPage(1); }}>Clear search and filters</Button>
          </div>
        )}
      </div>

      <PharmacyGapDetailDrawer />
      {careGapMember && (
        <CareGapDetailDrawer
          member={careGapMember}
          gapCode={careGap.code}
          year={new Date().getFullYear()}
          onClose={() => setCareGap(null)}
        />
      )}

      <Pagination
        currentPage={page}
        totalItems={filtered.length}
        perPage={perPage}
        onPageChange={setPage}
        onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
      />
    </div>
  );
}
