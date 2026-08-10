import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { HedisWorklistRow } from './HedisWorklistRow';
import { CareGapDetailDrawer } from './CareGapDetailDrawer';
import { TableSkeleton } from '../../components/TableSkeleton/TableSkeleton';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../components/Icon/Icon';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { HeaderCell } from '../../components/HeaderCell/HeaderCell';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { Pagination } from '../../components/Pagination/Pagination';
import { FilterChipBar } from '../hcc/FilterChipBar';
import { SavedFiltersChip } from '../hcc/SavedFiltersChip';
import { FilterNameDialog } from '../hcc/FilterNameDialog';
import {
  FILTER_DEF_MAP as HEDIS_FILTER_DEF_MAP,
  MORE_FILTER_ITEMS as HEDIS_MORE_FILTER_ITEMS,
  PRIMARY_FILTER_KEYS as HEDIS_PRIMARY_FILTER_KEYS,
  memberMatchesFilters as hedisMemberMatchesFilters,
  countActiveFilters as countActiveHedisFilters,
} from './hedisFilters';
import styles from './HedisWorklistTable.module.css';
import rowStyles from './HedisWorklistRow.module.css';

const YEARS = [2024, 2025, 2026];

export function HedisWorklistTable() {
  const currentPage = useAppStore(s => s.currentPage);
  const perPage = useAppStore(s => s.perPage);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);
  const setPerPage = useAppStore(s => s.setPerPage);
  const showToast = useAppStore(s => s.showToast);
  const hedisMembers = useAppStore(s => s.hedisMembers);

  // HEDIS filter state now lives in the store (same shape as HCC's hccFilters
  // — `{ [k]: string[] }`) so the shared FilterChipBar + SavedFiltersChip
  // and the saveSavedFilter / applySavedFilter machinery drive it directly.
  const hedisFilters = useAppStore(s => s.hedisFilters);
  const saveHedisFilter = useAppStore(s => s.saveHedisFilter);

  const [year, setYear] = useState(2026);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarOpen, setFilterBarOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [drawerMemberId, setDrawerMemberId] = useState(null);
  const [drawerGapCode, setDrawerGapCode] = useState(null);

  // Read the live member from the store so store mutations re-render the drawer.
  const drawerMember = useMemo(
    () => (drawerMemberId ? hedisMembers.find(m => m.id === drawerMemberId) : null),
    [drawerMemberId, hedisMembers]
  );

  const openGapDrawer = (member, gapCode) => {
    setDrawerMemberId(member.id);
    setDrawerGapCode(gapCode);
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
    return result.filter(m => hedisMemberMatchesFilters(m, hedisFilters));
  }, [searchQuery, hedisFilters, hedisMembers]);

  // Data-derived option pools passed to the FilterChipBar so `dynamic` chips
  // (Assignee, State, City, IPA, HP Code) enumerate only what the loaded
  // members actually carry — same pattern HCC's FilterChipBar uses.
  const platformUsers = useAppStore(s => s.platformUsers);
  const dynamicOpts = useMemo(() => {
    const state = new Set();
    const city = new Set();
    const ipa = new Set();
    const hpCode = new Set();
    const assignee = new Set();
    for (const m of (hedisMembers || [])) {
      if (m.state) state.add(m.state);
      if (m.city) city.add(m.city);
      if (m.ipa) ipa.add(m.ipa);
      if (m.hpCode) hpCode.add(m.hpCode);
      if (m.assignee) assignee.add(m.assignee);
    }
    return {
      assignee: platformUsers?.length ? platformUsers.map(u => u.name) : assignee.toSorted(),
      state:    state.toSorted(),
      city:     city.toSorted(),
      ipa:      ipa.toSorted(),
      hpCode:   hpCode.toSorted(),
    };
  }, [hedisMembers, platformUsers]);

  const activeFilterCount = countActiveHedisFilters(hedisFilters);

  const { sorted, sortKey, sortDir, requestSort } = useTableSort(filtered, 'startDate', 'desc');

  // Reset to page 1 whenever the filtered result set changes size.
  useEffect(() => { setCurrentPage(1); }, [filtered.length, setCurrentPage]);

  const startIdx = (currentPage - 1) * perPage;
  const paginated = sorted.slice(startIdx, startIdx + perPage);

  const allIds = paginated.map(m => m.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? allIds : []);
  };

  const thStyle = `${rowStyles.stickyLeft}`;

  return (
    <>
    <div className={styles.wrap}>
      {/* ── Header bar (SectionTitleBar · variant 2 · titleWithDropdown) ── */}
      <SectionTitleBar
        variant="titleWithDropdown"
        title="HEDIS"
        dropdownLabel="Year"
        dropdownOptions={YEARS.map(String)}
        dropdownValue={String(year)}
        onDropdownChange={(v) => setYear(Number(v) || 2026)}
        showSearch
        searchPlaceholder="Search by member name…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        showFilter
        filterActive={filterBarOpen}
        filterBadgeCount={activeFilterCount}
        onFilter={() => setFilterBarOpen(v => !v)}
        showDownload
        onDownload={() => showToast('Export — coming soon')}
        showHistory
        onHistory={() => showToast('History — coming soon')}
        rightExtras={
          <>
            <SavedFiltersChip list="HEDIS" />
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          </>
        }
      />

      {/* ── Filter chip bar (shared with HCC) ── */}
      {filterBarOpen && (
        <FilterChipBar
          list="HEDIS"
          filterDefMap={HEDIS_FILTER_DEF_MAP}
          moreFilterItems={HEDIS_MORE_FILTER_ITEMS}
          primaryFilterKeys={HEDIS_PRIMARY_FILTER_KEYS}
          dynamicOpts={dynamicOpts}
          onSaveFilter={() => setSaveDialogOpen(true)}
        />
      )}

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
              <th className={`${rowStyles.stickyLeft} ${rowStyles.stickyMember} ${styles.memberTh}`}>
                Member
              </th>
              <th style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                Total Gaps
              </th>
              <th style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                Gap Status
              </th>
              <th style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', textAlign: 'left', whiteSpace: 'nowrap', minWidth: 200 }}>
                Assignee
              </th>
              <th style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                Start Date
              </th>
              <th style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                Outreach
              </th>
              <HeaderCell label="AdvIllness" sortField="advIllness" activeKey={sortKey} activeDir={sortDir} onSort={requestSort} />
              <HeaderCell label="Frailty" sortField="frailty" activeKey={sortKey} activeDir={sortDir} onSort={requestSort} />
              <HeaderCell label="Risk Level" sortField="riskLevel" activeKey={sortKey} activeDir={sortDir} onSort={requestSort} />
              <HeaderCell label="Tasks" sortField="tasks" activeKey={sortKey} activeDir={sortDir} onSort={requestSort} />
              <th className={rowStyles.stickyRight} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={12}>
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
                  isSelected={selectedIds.includes(m.id)}
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
        />
      </div>
    </div>

    {drawerMember && (
      <CareGapDetailDrawer
        member={drawerMember}
        gapCode={drawerGapCode}
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
    </>
  );
}
