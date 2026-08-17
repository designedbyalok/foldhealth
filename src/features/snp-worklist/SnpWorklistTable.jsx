import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { FilterBar } from '../../components/FilterBar/FilterBar';
import { Pagination } from '../../components/Pagination/Pagination';
import { TableSkeleton } from '../../components/TableSkeleton/TableSkeleton';
import { HeaderCell } from '../../components/HeaderCell/HeaderCell';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { SavedFiltersChip } from '../hcc/SavedFiltersChip';
import { SnpWorklistRow } from './SnpWorklistRow';
import styles from './SnpWorklistTable.module.css';

// Sortable columns — each maps to a field on the enriched row. Tags and
// Outreach are intentionally omitted (visual composite cells with no natural
// ordering). Dates surface as `<field>Sort` timestamps computed in enrichment
// so MM/DD/YYYY strings sort chronologically instead of lexicographically.
const SORTABLE_COLS = {
  name:              { field: 'name',            type: 'alpha' },
  programSubStatus:  { field: 'programSubStatus', type: 'generic' },
  carePlanStatus:    { field: 'carePlanStatus',  type: 'generic' },
  nextActionDue:     { field: 'nextActionDueSort', type: 'date' },
  assigneeName:      { field: 'assigneeName',    type: 'alpha' },
  triggerDate:       { field: 'triggerDateSort', type: 'date' },
  lastAdmission:     { field: 'lastAdmissionSort', type: 'date' },
  trigger:           { field: 'trigger',         type: 'generic' },
  riskIq:            { field: 'riskIq',          type: 'generic' },
  taskCount:         { field: 'taskCount',       type: 'number' },
};

const parseMdy = (s) => {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (!m) return null;
  return Date.UTC(+m[3], +m[1] - 1, +m[2]);
};

// Filter chips — each is a multi-select of string buckets derived per row.
// `primary: true` chips render by default; extended chips are opt-in via the
// More Filters popover. The extended set mirrors the full SNP-filter roster
// (Member Status → Tags) even when the underlying member data doesn't yet
// carry those fields — filtering on those is a no-op today.
const FILTER_KEYS = [
  { key: 'programSubStatus', label: 'Program Sub Status', primary: true },
  { key: 'carePlanStatus',   label: 'Care Plan Status',   primary: true },
  { key: 'assignee',         label: 'Assigned to',        primary: true },
  { key: 'trigger',          label: 'Trigger',            primary: true },
  { key: 'riskIq',           label: 'Risk IQ',            primary: true },
  { key: 'outreach',         label: 'Outreach',           primary: true },
  // Extended (hidden by default — opt in via More Filters).
  { key: 'memberStatus',      label: 'Member Status',        primary: false },
  { key: 'phone',             label: 'Phone Number',         primary: false },
  { key: 'dob',               label: 'DOB',                  primary: false },
  { key: 'gender',            label: 'Gender',               primary: false },
  { key: 'language',          label: 'Language',             primary: false },
  { key: 'programDueDate',    label: 'Program Due Date',     primary: false },
  { key: 'nextActionDueDate', label: 'Next Action Due Date', primary: false },
  { key: 'triggerDate',       label: 'Trigger Date',         primary: false },
  { key: 'triggerType',       label: 'Trigger Type',         primary: false },
  { key: 'lastOutreachDate',  label: 'Last Outreach Date',   primary: false },
  { key: 'lastOutreachOutcome', label: 'Last Outreach Outcome', primary: false },
  { key: 'programStartDate',  label: 'Program Start Date',   primary: false },
  { key: 'lastAdmissionDate', label: 'Last Admission Date',  primary: false },
  { key: 'ipa',               label: 'IPA',                  primary: false },
  { key: 'hpCodes',           label: 'HP Codes',             primary: false },
  { key: 'isOwnedIpa',        label: 'Is Owned IPA',         primary: false },
  { key: 'lob',               label: 'LOB',                  primary: false },
  { key: 'hpGroup',           label: 'HP Group',             primary: false },
  { key: 'contractType',      label: 'Contract Type',        primary: false },
  { key: 'snpType',           label: 'SNP Type',             primary: false },
  { key: 'networkMarket',     label: 'Network Market',       primary: false },
  { key: 'zipCode',           label: 'Zip Code',             primary: false },
  { key: 'city',              label: 'City',                 primary: false },
  { key: 'preferredCallTime', label: 'Preferred Call Time',  primary: false },
  { key: 'pcp',               label: 'PCP',                  primary: false },
  { key: 'pcpCounty',         label: 'PCP County',           primary: false },
  { key: 'pcpState',          label: 'PCP State',            primary: false },
  { key: 'pcpPod',            label: 'PCP Pod',              primary: false },
  { key: 'pcpVendor',         label: 'PCP Vendor',           primary: false },
  { key: 'tags',              label: 'Tags',                 primary: false },
];

// Only the six primary keys have live bucket functions today; extended keys
// return empty option pools so their chips render but don't filter yet.
const BUCKET_FN = {
  programSubStatus: (m) => m.programSubStatus || 'None',
  carePlanStatus:   (m) => m.carePlanStatus || 'None',
  assignee:         (m) => m.assigneeName || 'Unassigned',
  trigger:          (m) => m.trigger || 'None',
  riskIq:           (m) => m.riskIq || 'Undetermined',
  outreach:         (m) => (m.outreach ? m.outreach.status : 'None'),
  gender:           (m) => m.gender || null,
  language:         (m) => m.language || null,
};

const MORE_FILTER_ITEMS = FILTER_KEYS.map(f => ({ k: f.key, label: f.label, primary: f.primary }));
const PRIMARY_FILTER_KEYS = [];
for (const f of FILTER_KEYS) {
  if (f.primary) PRIMARY_FILTER_KEYS.push(f.key);
}
const KEY_ORDER = Object.fromEntries(FILTER_KEYS.map((f, i) => [f.key, i]));

function orderKeys(keys) {
  return [...new Set(keys)].toSorted(
    (a, b) => (KEY_ORDER[a] ?? 99) - (KEY_ORDER[b] ?? 99),
  );
}

const thStyle = {
  padding: '8px 14px',
  fontSize: 12,
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

function EmptySearch() {
  return (
    <div className={styles.emptySearch}>
      <Icon name="solar:magnifer-linear" size={40} color="var(--neutral-200)" />
      <p className={styles.emptyTitle}>No results found</p>
      <p className={styles.emptyText}>
        No SNP members match your current filters. Try adjusting them or clearing all filters.
      </p>
    </div>
  );
}

export function SnpWorklistTable() {
  const members = useAppStore(s => s.snpWorklistMembers);
  const loading = useAppStore(s => s.snpWorklistLoading);
  const fetchMembers = useAppStore(s => s.fetchSnpWorklistMembers);
  const showToast = useAppStore(s => s.showToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarOpen, setFilterBarOpen] = useState(true);
  // SNP filters live in the store now (matches HCC/HEDIS shape) so save/apply/
  // clear routes through the shared saveSavedFilter flow. Local state remains
  // only for view-only chrome (search, pagination, selection).
  const filters = useAppStore(s => s.snpFilters);
  const setFilter = useAppStore(s => s.setSnpFilter);
  const clearFilters = useAppStore(s => s.clearSnpFilters);
  const storedVisible = useAppStore(s => s.snpVisibleFilterKeys);
  const setVisibleFilterKeys = useAppStore(s => s.setSnpVisibleFilterKeys);
  const clearVisibleFilters = useAppStore(s => s.clearSnpVisibleFilters);
  const saveSnpFilter = useAppStore(s => s.saveSnpFilter);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Ensure the row-level assignee picker has users to show — one-shot
  // fetch, guarded in the store so repeat mounts don't re-round-trip.
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);

  const filterOptions = useMemo(() => {
    const sets = {};
    for (const { key } of FILTER_KEYS) {
      if (BUCKET_FN[key]) sets[key] = new Set();
    }
    for (const m of members) {
      for (const { key } of FILTER_KEYS) {
        const bucket = BUCKET_FN[key];
        if (!bucket) continue;
        const val = bucket(m);
        if (val) sets[key].add(val);
      }
    }
    const opts = {};
    for (const { key } of FILTER_KEYS) {
      opts[key] = sets[key] ? [...sets[key]].toSorted() : [];
    }
    return opts;
  }, [members]);

  // Enrich rows with parsed date timestamps so the shared useTableSort
  // comparator can order MM/DD/YYYY strings chronologically. Undated rows
  // land at 0 which the null-handling path in useTableSort would push last;
  // we sub in a null instead so sorted asc places them at the end.
  const enriched = useMemo(() => members.map(m => ({
    ...m,
    nextActionDueSort: parseMdy(m.nextActionDue),
    triggerDateSort:   parseMdy(m.triggerDate),
    lastAdmissionSort: parseMdy(m.lastAdmission),
  })), [members]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.memberId || '').toLowerCase().includes(q) ||
        (m.assigneeName || '').toLowerCase().includes(q),
      );
    }
    for (const { key } of FILTER_KEYS) {
      const vals = filters[key];
      const bucket = BUCKET_FN[key];
      if (!bucket || !vals || !vals.length) continue;
      const valSet = new Set(vals);
      rows = rows.filter(m => valSet.has(bucket(m)));
    }
    return rows;
  }, [enriched, searchQuery, filters]);

  // Shared sort hook — click cycles asc → desc → cleared, same as HCC.
  const { sorted, sortKey, sortDir, setSort, clearSort } = useTableSort(filtered);
  const handleSort = (field) => {
    if (sortKey === field) {
      if (sortDir === 'asc') setSort(field, 'desc');
      else if (sortDir === 'desc') clearSort();
      else setSort(field, 'asc');
    } else {
      setSort(field, 'asc');
    }
  };

  // Visible chips = primary set (or user-customised set) plus any chip that
  // has an active value — otherwise applying a saved filter could hide the
  // very chip whose value it just set.
  const activeKeys = useMemo(() => {
    const keys = [];
    for (const { key } of FILTER_KEYS) {
      if ((filters[key] || []).length > 0) keys.push(key);
    }
    return keys;
  }, [filters]);
  const visibleKeys = useMemo(() => {
    const base = storedVisible ?? PRIMARY_FILTER_KEYS;
    return orderKeys([...base, ...activeKeys]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedVisible, activeKeys]);

  const toggleVisible = (k) => {
    const next = new Set(storedVisible ?? PRIMARY_FILTER_KEYS);
    if (next.has(k)) next.delete(k); else next.add(k);
    setVisibleFilterKeys([...next]);
  };

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page, perPage]);

  const allIds = paginated.map(r => r.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = paginated.some(r => selectedIds.has(r.id)) && !allSelected;

  const handleSelectAll = (checked) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (checked) allIds.forEach(id => next.add(id));
    else allIds.forEach(id => next.delete(id));
    return next;
  });
  const toggleOne = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const colCount = 14;

  return (
    <div className={styles.wrap}>
      {/* Header (SectionTitleBar · variant 3). Mirrors the HCC/HEDIS right-side
          layout so every worklist reads with one chrome:
          rightExtras (SavedFiltersChip + Upload) → Search → Filter → History. */}
      <SectionTitleBar
        variant="titleWithToggle"
        title="SNP"
        toggleItems={[]}
        actions={['search', 'filter', 'history']}
        searchPlaceholder="Search patients or members"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filterActive={filterBarOpen}
        onFilter={() => setFilterBarOpen(v => !v)}
        onHistory={() => showToast('History – coming soon')}
        rightExtras={
          <>
            <SavedFiltersChip list="SNP" />
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
            <ActionButton
              icon="solar:upload-minimalistic-linear"
              size="L"
              tooltip="Upload Document"
              tooltipBelow
              onClick={() => showToast('Upload Document – coming soon')}
            />
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          </>
        }
      />

      {filterBarOpen && (
        <FilterBar
          filterDefs={FILTER_KEYS}
          filters={filters}
          onFilterChange={(k, vals) => setFilter(k, vals)}
          onClearAll={clearFilters}
          onSaveFilter={(name) => saveSnpFilter(name)}
          getOptions={(def) => filterOptions[def.key] || []}
          multiSelect
          visibleKeys={visibleKeys}
          onToggleVisible={toggleVisible}
          onClearVisible={clearVisibleFilters}
          moreFilterItems={MORE_FILTER_ITEMS}
          leading={null}
        />
      )}

      <div className={styles.tableScroll}>
        {loading && members.length === 0 ? (
          <TableSkeleton rows={perPage} columns={colCount} />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 36, padding: '8px 10px', left: 0, zIndex: 4 }}>
                  <Checkbox checked={someSelected ? 'indeterminate' : allSelected} onCheckedChange={handleSelectAll} />
                </th>
                <HeaderCell
                  label="Members"
                  sortField={SORTABLE_COLS.name.field}
                  sortType={SORTABLE_COLS.name.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={{ ...thStyle, padding: '8px 12px', left: 36, zIndex: 4, borderRight: '1px solid var(--neutral-150)' }}
                />
                <HeaderCell
                  label="Program Sub Status"
                  sortField={SORTABLE_COLS.programSubStatus.field}
                  sortType={SORTABLE_COLS.programSubStatus.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={thStyle}
                />
                <HeaderCell
                  label="Care Plan Status"
                  sortField={SORTABLE_COLS.carePlanStatus.field}
                  sortType={SORTABLE_COLS.carePlanStatus.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={thStyle}
                />
                <HeaderCell
                  label="Next Action Due"
                  sortField={SORTABLE_COLS.nextActionDue.field}
                  sortType={SORTABLE_COLS.nextActionDue.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={thStyle}
                />
                {/* Outreach — composite cell (icon + status + attempt dots),
                    no natural ordering, per requirement not sortable. */}
                <HeaderCell label="Outreach" style={thStyle} />
                <HeaderCell
                  label="Assignee"
                  sortField={SORTABLE_COLS.assigneeName.field}
                  sortType={SORTABLE_COLS.assigneeName.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={thStyle}
                />
                <HeaderCell
                  label="Trigger Date"
                  sortField={SORTABLE_COLS.triggerDate.field}
                  sortType={SORTABLE_COLS.triggerDate.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={thStyle}
                />
                <HeaderCell
                  label="Last Admission"
                  sortField={SORTABLE_COLS.lastAdmission.field}
                  sortType={SORTABLE_COLS.lastAdmission.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={thStyle}
                />
                <HeaderCell
                  label="Trigger"
                  sortField={SORTABLE_COLS.trigger.field}
                  sortType={SORTABLE_COLS.trigger.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={thStyle}
                />
                <HeaderCell
                  label="Risk IQ"
                  sortField={SORTABLE_COLS.riskIq.field}
                  sortType={SORTABLE_COLS.riskIq.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={thStyle}
                />
                {/* Tags — visual chip set, no natural ordering, not sortable. */}
                <HeaderCell label="Tags" style={thStyle} />
                <HeaderCell
                  label="Tasks"
                  sortField={SORTABLE_COLS.taskCount.field}
                  sortType={SORTABLE_COLS.taskCount.type}
                  activeKey={sortKey}
                  activeDir={sortDir}
                  onSort={handleSort}
                  style={thStyle}
                />
                <th style={{ ...thStyle, width: 80, right: 0, zIndex: 3, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(m => (
                <SnpWorklistRow
                  key={m.id}
                  member={m}
                  isSelected={selectedIds.has(m.id)}
                  onSelect={toggleOne}
                />
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <EmptySearch />}
      </div>

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
