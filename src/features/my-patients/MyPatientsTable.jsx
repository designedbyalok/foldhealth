import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { WorklistShell } from '../worklists/WorklistShell';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { SubnavToggle } from '../../components/SubnavToggle/SubnavToggle';
import { FilterBar } from '../worklists/FilterBar';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { ADHERENCE_BANDS, adherenceBand, bandCounts, minutesState, reviewState } from './myPatientsModel';
import { AdherenceStrip } from './AdherenceStrip';
import { MyPatientsRow } from './MyPatientsRow';

const FILTER_DEFS = [
  { key: 'program', label: 'Program', primary: true },
  { key: 'band', label: 'Plan Adherence', primary: true },
  { key: 'assignee', label: 'Assignee', primary: true },
  { key: 'payer', label: 'Payer', primary: true },
];
// Does the row match one of the picked values (a Set) for this filter?
const MATCH = {
  program: (r, picked) => r.programs.some(p => picked.has(p)),
  band: (r, picked) => picked.has(adherenceBand(r.adherence).label),
  assignee: (r, picked) => picked.has(r.assignee || 'Unassigned'),
  payer: (r, picked) => picked.has(r.payer),
};

const mdyTime = (mdy) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy || '');
  return m ? new Date(+m[3], +m[1] - 1, +m[2]).getTime() : null;
};

const COLUMNS = [
  { key: 'select', showCheckbox: true, sticky: 'left', left: 0, width: 36 },
  { key: 'name', label: 'Patients', sortKey: 'name', sticky: 'left', left: 36, width: 240 },
  { key: 'programs', label: 'Programs', width: 170 },
  { key: 'payer', label: 'Payer', sortKey: 'payer', sortType: 'alpha', width: 180 },
  { key: 'adherence', label: 'Plan Adherence', sortKey: 'adherence', width: 190 },
  { key: 'why', label: 'Why Prioritized', width: 320 },
  { key: 'lastReview', label: 'Last Review', sortKey: 'reviewOverdueDays', width: 150 },
  { key: 'minutes', label: 'Program Time', sortKey: 'minutesPct', width: 170 },
  { key: 'lastTouch', label: 'Last Touch', sortKey: 'lastTouchSort', width: 170 },
  { key: 'assignee', label: 'Assignee', sortKey: 'assignee', width: 190 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 96 },
];

/**
 * My Patients (care management redesign prototype): the patients a care
 * manager works, lowest plan adherence first, each with why they're
 * prioritized, where the care plan review stands, program minutes and the
 * last touch. Rows come from my_patients_worklist.
 */
export function MyPatientsTable() {
  const rows = useAppStore(s => s.myPatients);
  const loading = useAppStore(s => s.myPatientsLoading);
  const fetchMyPatients = useAppStore(s => s.fetchMyPatients);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  const showToast = useAppStore(s => s.showToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarOpen, setFilterBarOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  useEffect(() => { fetchMyPatients(); }, [fetchMyPatients]);

  const setFilter = (key, vals) => {
    setFilters(prev => {
      const next = { ...prev };
      if (vals?.length) next[key] = vals; else delete next[key];
      return next;
    });
    setPage(1);
  };

  const options = useMemo(() => ({
    program: [...new Set(rows.flatMap(r => r.programs))].toSorted(),
    band: ADHERENCE_BANDS.map(b => b.label),
    assignee: [...new Set(rows.map(r => r.assignee || 'Unassigned'))].toSorted(),
    payer: [...new Set(rows.map(r => r.payer).filter(Boolean))].toSorted(),
  }), [rows]);

  const enriched = useMemo(() => rows.map(r => ({
    ...r,
    reviewOverdueDays: reviewState(r.lastReview, r.reviewCadenceDays).overdueDays,
    minutesPct: minutesState(r)?.pct ?? -1,
    lastTouchSort: mdyTime(r.lastTouchDate),
  })), [rows]);

  // Search and every filter but Plan Adherence: the strip counts what the
  // other filters leave, so its numbers stay meaningful while a band is picked.
  const scoped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const picked = Object.entries(filters).filter(([k]) => k !== 'band').map(([k, vals]) => [MATCH[k], new Set(vals)]);
    return enriched.filter(r => (!q || r.name.toLowerCase().includes(q) || String(r.memberId).includes(q))
      && picked.every(([match, set]) => match(r, set)));
  }, [enriched, searchQuery, filters]);
  const filtered = useMemo(() => {
    if (!filters.band) return scoped;
    const bands = new Set(filters.band);
    return scoped.filter(r => MATCH.band(r, bands));
  }, [scoped, filters.band]);

  const { sorted, sortKey, sortDir, requestSort } = useTableSort(filtered, 'adherence', 'asc');
  const pageRows = useMemo(() => sorted.slice((page - 1) * perPage, page * perPage), [sorted, page, perPage]);

  const toggleBand = (label) => {
    const cur = filters.band || [];
    setFilter('band', cur.includes(label) ? cur.filter(x => x !== label) : [...cur, label]);
  };
  const openPrograms = row => navigateToPatient(row.memberId, { profileTab: 'Care Programs' });

  const header = (
    <SectionTitleBar
      variant="titleOnly"
      leadingElement={<SubnavToggle />}
      title="My Patients"
      actions={['search', 'filter', 'download']}
      searchPlaceholder="Search by name or member ID…"
      searchValue={searchQuery}
      onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
      filterActive={filterBarOpen}
      onFilter={() => setFilterBarOpen(v => !v)}
      onDownload={() => showToast('Export is coming soon')}
    />
  );

  const filterNode = (
    <>
      <FilterBar
        collapsed={!filterBarOpen}
        autoFit
        pinPrimary
        multiSelect
        leading={null}
        filterDefs={FILTER_DEFS}
        filters={filters}
        onFilterChange={setFilter}
        onClearAll={() => { setFilters({}); setPage(1); }}
        renderChip={(k) => {
          const def = FILTER_DEFS.find(d => d.key === k);
          if (!def) return null;
          return (
            <FilterChip
              label={def.label}
              options={options[k] || []}
              selected={filters[k] || []}
              onChange={vals => setFilter(k, vals)}
              searchable={k === 'payer' || k === 'assignee'}
            />
          );
        }}
      />
      <AdherenceStrip counts={bandCounts(scoped)} active={filters.band || []} onPick={toggleBand} />
    </>
  );

  return (
    <WorklistShell
      header={header}
      worklistKey="my-patients"
      showFilters
      filters={filterNode}
      columns={COLUMNS}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={requestSort}
      rows={pageRows}
      renderRow={(r, _i, ctx) => (
        <MyPatientsRow
          key={r.id}
          row={r}
          hiddenSet={ctx.hiddenSet}
          selected={selectedIds.includes(r.id)}
          onToggle={() => setSelectedIds(prev => (prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id]))}
          onOpenPrograms={openPrograms}
          showToast={showToast}
        />
      )}
      loading={loading && pageRows.length === 0}
      emptyState="No patients match the current filters."
      selectedIds={selectedIds}
      onSelectAll={(checked) => setSelectedIds(checked ? pageRows.map(r => r.id) : [])}
      onClearSelection={() => setSelectedIds([])}
      page={page}
      perPage={perPage}
      totalItems={filtered.length}
      totalCount={rows.length}
      filtered={filtered.length !== rows.length}
      onPageChange={setPage}
      onPageSizeChange={(p) => { setPerPage(p); setPage(1); }}
      minTableWidth={1800}
    />
  );
}
