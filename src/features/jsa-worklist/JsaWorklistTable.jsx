import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { WorklistShell } from '../worklists/WorklistShell';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { SubnavToggle } from '../../components/SubnavToggle/SubnavToggle';
import { FilterBar } from '../worklists/FilterBar';
import { SavedFiltersChip } from '../hcc/SavedFiltersChip';
import { useSavedFilterActions } from '../hcc/useSavedFilterActions';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { JsaWorklistRow, JSA_MIDDLE_COLUMNS } from './JsaWorklistRow';

// FilterBar chip definitions: all seven are primary so they show on wide
// viewports; auto-fit trims the tail into More Filters on narrow screens.
const JSA_FILTER_DEFS = [
  { key: 'progSubStatus', label: 'Program Sub Status', primary: true },
  { key: 'progName',      label: 'Program Name',       primary: true },
  { key: 'ri',            label: 'Risk IQ',            primary: true },
  { key: 'dec',           label: 'Decile',             primary: true },
  { key: 'ad',            label: 'AdvIllness',         primary: true },
  { key: 'fr',            label: 'Frailty',            primary: true },
  { key: 'assignee',      label: 'Assignee',           primary: true },
];
const JSA_MORE_FILTER_ITEMS = JSA_FILTER_DEFS.map(fd => ({ k: fd.key, label: fd.label, primary: fd.primary }));

// WorklistShell column defs: sticky checkbox + sticky Members col on the
// left, all JSA data columns in the middle, sticky Actions on the right.
// Same shape TOC uses (once it migrates); keeps the sticky-column scroll
// behaviour consistent with HCC / TOC.
const JSA_SHELL_COLUMNS = [
  { key: 'select', showCheckbox: true, sticky: 'left', left: 0, width: 36 },
  { key: 'name',   label: 'Members', sortKey: 'name', sticky: 'left', left: 36, width: 240 },
  ...JSA_MIDDLE_COLUMNS,
  { key: 'actions', label: 'Actions', sticky: 'right', width: 120 },
];

export function JsaWorklistTable() {
  const members = useAppStore(s => s.jsaMembers);
  const loading = useAppStore(s => s.jsaMembersLoading);
  const fetchMembers = useAppStore(s => s.fetchJsaMembers);
  const filters = useAppStore(s => s.jsaFilters);
  const setFilter = useAppStore(s => s.setJsaFilter);
  const clearFilters = useAppStore(s => s.clearJsaFilters);
  // A selected saved filter stays selected while edited: Go Back / Save Changes / Copy Filter.
  const savedActions = useSavedFilterActions('JSA', filters, clearFilters);
  const selectedIds = useAppStore(s => s.selectedJsaIds);
  const selectMember = useAppStore(s => s.selectJsaMember);
  const selectAll = useAppStore(s => s.selectAllJsa);
  const clearSelected = useAppStore(s => s.clearJsaSelected);
  const showToast = useAppStore(s => s.showToast);
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
      collapsed={!filterBarOpen}
      autoFit
      pinPrimary
      multiSelect
      leading={null}
      filterDefs={JSA_FILTER_DEFS}
      filters={filters}
      onFilterChange={(k, vals) => setFilter(k, vals)}
      onClearAll={savedActions.onClearAll}
      clearAllLabel={savedActions.clearAllLabel}
      saveLabel={savedActions.saveLabel}
      saveMenuItems={savedActions.saveMenuItems}
      onSaveMenuSelect={savedActions.onSaveMenuSelect}
      hasActive={savedActions.edited || undefined}
      onSaveFilter={(name) => saveSavedFilter('JSA', name)}
      getOptions={(def) => filterOptions[def.key] || []}
      moreFilterItems={JSA_MORE_FILTER_ITEMS}
    />
  );

  const header = (
    <SectionTitleBar
      variant="titleOnly"
      leadingElement={<SubnavToggle />}
      title="JSA"
      actions={['search', 'filter', 'history', 'download']}
      searchPlaceholder="Search by name or Fold ID…"
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      filterActive={filterBarOpen}
      onFilter={() => setFilterBarOpen(v => !v)}
      onHistory={openHistoryDrawer}
      rightExtras={
        <>
          <SavedFiltersChip list="JSA" />
          <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
        </>
      }
      onDownload={() => showToast('Export: coming soon')}
    />
  );

  return (
    <WorklistShell
      header={header}
      // Always passed: when closed, the bar shows just the applied filters.
      showFilters
      filters={filterNode}
      worklistKey="jsa"
      columns={JSA_SHELL_COLUMNS}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={requestSort}
      rows={pageRows}
      renderRow={(m, _i, ctx) => (
        <JsaWorklistRow
          key={m.id}
          member={m}
          columns={ctx.orderedColumns}
          hiddenSet={ctx.hiddenSet}
          selected={selectedIds.includes(m.id)}
          onToggle={() => selectMember(m.id)}
          onView={() => showToast(`Program details for ${m.name}, coming soon`)}
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
