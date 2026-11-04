import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { WorklistShell } from '../worklists/WorklistShell';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { SubnavToggle } from '../../components/SubnavToggle/SubnavToggle';
import { FilterBar } from '../../components/FilterBar/FilterBar';
import { SavedFiltersChip } from '../hcc/SavedFiltersChip';
import { useSavedFilterActions } from '../hcc/useSavedFilterActions';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { AwvWorklistRow, AWV_MIDDLE_COLUMNS } from './AwvWorklistRow';

// FilterBar chip definitions, per the worklist filter spec: always-primary
// (Assignee; the others aren't on Annual Visit yet), then Program Name and
// Program Sub Status. The risk scores are secondary, under Clinical in More
// Filters. Every primary always shows (FilterBar `pinPrimary`).
const AWV_FILTER_DEFS = [
  { key: 'assignee',      label: 'Assignee',           primary: true },
  { key: 'progName',      label: 'Program Name',       primary: true },
  { key: 'progSubStatus', label: 'Program Sub Status', primary: true },
  { key: 'dec',           label: 'Decile',             primary: false, group: 'Clinical' },
  { key: 'ri',            label: 'Risk IQ',            primary: false, group: 'Clinical' },
  { key: 'ad',            label: 'Advanced Illness',   primary: false, group: 'Clinical' },
  { key: 'fr',            label: 'Frailty',            primary: false, group: 'Clinical' },
];
const AWV_MORE_FILTER_ITEMS = AWV_FILTER_DEFS.map(fd => ({ k: fd.key, label: fd.label, primary: fd.primary, group: fd.group }));

// WorklistShell column defs: sticky checkbox + sticky Members col on the
// left, AWV middle columns from AwvWorklistRow (each carries `renderCell`
// so hide/reorder in the Show Columns popover ripples through the body),
// sticky Actions on the right.
const AWV_SHELL_COLUMNS = [
  { key: 'select', showCheckbox: true, sticky: 'left', left: 0, width: 36 },
  { key: 'name',   label: 'Members', sortKey: 'name', sticky: 'left', left: 36, width: 240 },
  ...AWV_MIDDLE_COLUMNS,
  { key: 'actions', label: 'Actions', sticky: 'right', width: 120 },
];

export function AwvWorklistTable() {
  const members = useAppStore(s => s.awvMembers);
  const loading = useAppStore(s => s.awvMembersLoading);
  const fetchMembers = useAppStore(s => s.fetchAwvMembers);
  const filters = useAppStore(s => s.awvFilters);
  const setFilter = useAppStore(s => s.setAwvFilter);
  const clearFilters = useAppStore(s => s.clearAwvFilters);
  // A selected saved filter stays selected while edited: Go Back / Save Changes / Copy Filter.
  const savedActions = useSavedFilterActions('AWV', filters, clearFilters);
  const selectedIds = useAppStore(s => s.selectedAwvIds);
  const selectMember = useAppStore(s => s.selectAwvMember);
  const selectAll = useAppStore(s => s.selectAllAwv);
  const clearSelected = useAppStore(s => s.clearAwvSelected);
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
    const progSubStatus = new Set();
    const progName = new Set();
    const ri = new Set();
    const dec = new Set();
    const ad = new Set();
    const fr = new Set();
    const assignee = new Set();
    for (const m of members) {
      if (m.progSubStatus) progSubStatus.add(m.progSubStatus);
      if (m.progName) progName.add(m.progName);
      if (m.ri) ri.add(m.ri);
      if (m.dec) dec.add(m.dec);
      if (m.ad) ad.add(m.ad);
      if (m.fr) fr.add(m.fr);
      if (m.assignee) assignee.add(m.assignee);
    }
    return {
      progSubStatus: [...progSubStatus],
      progName:      [...progName],
      ri:            [...ri].toSorted(),
      dec:           [...dec].toSorted((a, b) => Number(a) - Number(b)),
      ad:            [...ad].toSorted(),
      fr:            [...fr].toSorted(),
      assignee:      [...assignee].toSorted(),
    };
  }, [members]);

  const filtered = useMemo(() => {
    let rows = members;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.memberId || '').toLowerCase().includes(q),
      );
    }
    Object.entries(filters).forEach(([k, vals]) => {
      if (!vals || vals.length === 0) return;
      rows = rows.filter(m => vals.includes(m[k]));
    });
    return rows;
  }, [members, searchQuery, filters]);

  const { sorted, sortKey, sortDir, requestSort } = useTableSort(filtered, 'due', 'asc');

  const pageRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page, perPage]);

  const handleSelectAll = (checked) => {
    if (checked) selectAll([...new Set([...selectedIds, ...pageRows.map(r => r.id)])]);
    else         selectAll(selectedIds.filter(id => !pageRows.find(r => r.id === id)));
  };

  const filterNode = (
    <FilterBar
      autoFit
      pinPrimary
      multiSelect
      leading={null}
      filterDefs={AWV_FILTER_DEFS}
      filters={filters}
      onFilterChange={(k, vals) => setFilter(k, vals)}
      onClearAll={savedActions.onClearAll}
      clearAllLabel={savedActions.clearAllLabel}
      saveLabel={savedActions.saveLabel}
      saveMenuItems={savedActions.saveMenuItems}
      onSaveMenuSelect={savedActions.onSaveMenuSelect}
      hasActive={savedActions.edited || undefined}
      onSaveFilter={(name) => saveSavedFilter('AWV', name)}
      getOptions={(def) => filterOptions[def.key] || []}
      moreFilterItems={AWV_MORE_FILTER_ITEMS}
    />
  );

  const header = (
    <SectionTitleBar
      variant="titleOnly"
      leadingElement={<SubnavToggle />}
      title="Annual Visit"
      actions={['search', 'filter', 'history', 'download']}
      searchPlaceholder="Search by name or Fold ID…"
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      filterActive={filterBarOpen}
      onFilter={() => setFilterBarOpen(v => !v)}
      onHistory={openHistoryDrawer}
      rightExtras={
        <>
          <SavedFiltersChip list="AWV" />
          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
        </>
      }
      onDownload={() => showToast('Export: coming soon')}
    />
  );

  return (
    <WorklistShell
      header={header}
      worklistKey="awv"
      showFilters={filterBarOpen}
      filters={filterNode}
      columns={AWV_SHELL_COLUMNS}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={requestSort}
      rows={pageRows}
      renderRow={(m, _i, ctx) => (
        <AwvWorklistRow
          key={m.id}
          member={m}
          columns={ctx.orderedColumns}
          hiddenSet={ctx.hiddenSet}
          selected={selectedIds.includes(m.id)}
          onToggle={() => selectMember(m.id)}
          onView={() => {
            const programCode = m.progName === 'APE' ? 'APE' : 'AWV';
            navigateToPatient(m.patientId || m.id, {
              profileTab: 'Care Programs',
              programCode,
            });
          }}
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
      totalItems={filtered.length}
      onPageChange={setPage}
      onPageSizeChange={(p) => { setPerPage(p); setPage(1); }}
      minTableWidth={1900}
    />
  );
}
