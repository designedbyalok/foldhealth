import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { resolveCurrentAssignee } from './HccWorklistRow.utils';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { useWorklistColumns } from '../../components/WorklistColumns/useWorklistColumns';
import { HCC_COLUMNS } from './columns';
import { memberMatchesFilters, countActiveFilters } from './filters';
import { getChartDocs } from './data/chartDocs';
import { slaDueCategory } from './sla';
import { GAP_ONLY_FILTER_KEYS } from './HccWorklistTableParts.constants';

const normFoldId = (v) => (v == null ? '' : String(v).replace(/^#/, '').trim().toLowerCase());

export function useHccWorklistTable() {
  const hccMembers = useAppStore(s => s.hccMembers);
  const hccMembersLoading = useAppStore(s => s.hccMembersLoading);
  const fetchHccMembers = useAppStore(s => s.fetchHccMembers);
  // Patient slices — drive the "Patients Without Open Gaps" secondary section
  // (every patient in the system that isn't already in hccMembers). We union
  // every worklist's patient list because the standalone `patients` /
  // `all_patients` Supabase tables can be empty in some environments — SubNav
  // already unions these same slices for its "All Patients" count, so the HCC
  // empty-rows source has to match to stay in sync.
  const patients = useAppStore(s => s.patients);
  const awvMembers = useAppStore(s => s.awvMembers);
  const ccmWorklistMembers = useAppStore(s => s.ccmWorklistMembers);
  const snpWorklistMembers = useAppStore(s => s.snpWorklistMembers);
  const allPatients = useAppStore(s => s.allPatients);
  const fetchPatients = useAppStore(s => s.fetchPatients);
  const fetchAwvMembers = useAppStore(s => s.fetchAwvMembers);
  const fetchCcmWorklistMembers = useAppStore(s => s.fetchCcmWorklistMembers);
  const fetchSnpWorklistMembers = useAppStore(s => s.fetchSnpWorklistMembers);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const fetchHccAddedCharts = useAppStore(s => s.fetchHccAddedCharts);
  const fetchHccChartStatus = useAppStore(s => s.fetchHccChartStatus);
  const fetchHccRemovedCharts = useAppStore(s => s.fetchHccRemovedCharts);
  // Chart slices — source of truth for a record's LIVE document count (seeded
  // defaults + uploads/added, minus removed). The static `m.ch` seed doesn't
  // track later attachments, so the enriched memo below computes the real
  // count from these and exposes it as `docCount` for the doc-count filter.
  // Grouped with the other store selectors (not read mid-hook) to keep hook
  // order stable.
  const hccAddedCharts = useAppStore(s => s.hccAddedCharts);
  const hccChartStatus = useAppStore(s => s.hccChartStatus);
  const hccRemovedCharts = useAppStore(s => s.hccRemovedCharts);
  const selectedHccIds = useAppStore(s => s.selectedHccIds);
  const selectAllHcc = useAppStore(s => s.selectAllHcc);
  const clearHccSelected = useAppStore(s => s.clearHccSelected);
  const searchQuery = useAppStore(s => s.searchQuery);
  const setSearchQuery = useAppStore(s => s.setSearchQuery);
  const currentPage = useAppStore(s => s.currentPage);
  const perPage = useAppStore(s => s.perPage);
  const showToast = useAppStore(s => s.showToast);
  const activeSubnavList = useAppStore(s => s.activeSubnavList);
  const hccDueDateFilter = useAppStore(s => s.hccDueDateFilter);
  const setHccDueDateFilter = useAppStore(s => s.setHccDueDateFilter);
  const hccFilters = useAppStore(s => s.hccFilters);
  const clearHccFilters = useAppStore(s => s.clearHccFilters);
  const saveHccFilter = useAppStore(s => s.saveHccFilter);
  const renameHccSavedFilter = useAppStore(s => s.renameHccSavedFilter);
  const openHccHistoryDrawer = useAppStore(s => s.openHccHistoryDrawer);
  // HCC column prefs now flow through the shared worklistColumnPrefs slice
  // (Supabase-backed, keyed by worklist_key='hcc'). The hook still exposes
  // toggleHccColumn / reorderHccColumns / clearHccColumnOrder /
  // clearHccHiddenCols under their historical names so HccWorklistTableView
  // doesn't need to change. Under the hood they call into the shared slice.
  const columnPrefs = useWorklistColumns('hcc', HCC_COLUMNS);
  const orderedColumns = columnPrefs.orderedColumns;
  const toggleHccColumn = columnPrefs.onToggle;
  const reorderHccColumns = columnPrefs.onReorder;
  const clearHccColumnOrder = columnPrefs.onReset;
  // Historically HCC had separate `clearHccColumnOrder` and
  // `clearHccHiddenCols` calls; the shared slice resets both at once, so we
  // alias the second call to a no-op — the first `onReset` already cleared
  // hidden + order.
  const clearHccHiddenCols = () => {};

  const [filterOpen, setFilterOpen] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [sortPop, setSortPop] = useState(null); // { items, rect }
  const [memberSortPop, setMemberSortPop] = useState(null); // rect
  const [colCfgRect, setColCfgRect] = useState(null);
  const [bulkAssigneeOpen, setBulkAssigneeOpen] = useState(false);
  const startHccUpload = useAppStore(s => s.startHccUpload);
  const setHccUploadPhase = useAppStore(s => s.setHccUploadPhase);
  const memberThRef = useRef(null);
  const colCfgBtnRef = useRef(null);
  // Ref for the horizontal scroll container so <HorizontalScrollbar />
  // can read scrollLeft / scrollWidth and drive the custom sticky bar.
  const scrollWrapRef = useRef(null);

  useEffect(() => { fetchHccMembers(); }, [fetchHccMembers]);
  useEffect(() => { fetchHccAddedCharts(); }, [fetchHccAddedCharts]);
  useEffect(() => { fetchHccChartStatus(); }, [fetchHccChartStatus]);
  useEffect(() => { fetchHccRemovedCharts(); }, [fetchHccRemovedCharts]);
  // The five patient slices below feed exactly one thing: the "Patients
  // Without Open Gaps" section, which returns [] unless the user is actively
  // searching (see `patientsWithoutGaps` — `if (!q) return []`). They used to
  // be fetched on mount, five separate effects, which cost ~183 KB
  // (all_patients 100.6 + patients 51.3 + awv 14.7 + snp 9.4 + ccm 6.6) to
  // populate a section that renders nothing on arrival. It was the single
  // biggest item in HCC's load and the reason HCC issued 38 requests where
  // the other worklists issued ~25.
  //
  // Now they load on the first keystroke. Every one of these fetchers is
  // store-guarded single-fire, so re-running this effect as the query changes
  // costs nothing after the first pass, and the length checks they used to
  // carry (read before the fetch resolves, so two callers both fired) are
  // gone with them.
  const needsPatientSources = (searchQuery?.trim().length || 0) > 0;
  useEffect(() => {
    if (!needsPatientSources) return;
    fetchPatients();
    fetchAwvMembers?.();
    fetchCcmWorklistMembers?.();
    fetchSnpWorklistMembers?.();
    fetchAllPatients?.();
  }, [needsPatientSources, fetchPatients, fetchAwvMembers, fetchCcmWorklistMembers,
      fetchSnpWorklistMembers, fetchAllPatients]);

  // If we landed on the HCC tab via the router (hash sync) rather than
  // through setActiveSubnavList, no default filter was applied. Seed the
  // role-scoped default (assignee = me + status ∈ {New, In Progress}) on
  // mount if the user has no filters/saved-list active yet.
  const applyHccRoleDefaultFilters = useAppStore(s => s.applyHccRoleDefaultFilters);
  useEffect(() => {
    const s = useAppStore.getState();
    const hasNoFilters = !s.hccFilters || Object.keys(s.hccFilters).length === 0;
    const hasNoSaved = !s.activeSavedIdByList?.HCC;
    if (hasNoFilters && hasNoSaved) applyHccRoleDefaultFilters();
  }, [applyHccRoleDefaultFilters]);

  // "Reset to page 1 on filter change" was previously done via a useEffect
  // watching [hccDueDateFilter, hccFilters, searchQuery]. Every harmless
  // hccFilters ref-change (e.g. fetchTaskProfiles backfilling `asgn` after
  // mount) fired it, resetting currentPage to 1 while the user was
  // mid-navigation. When it ran during a Pagination render, React 18
  // logged "Cannot update Pagination while rendering OpenIcdsCell" and,
  // on pages containing spawned rows that re-triggered profile fetches,
  // livelocked the renderer — the pagination click never committed and
  // the app appeared to crash on page 5. The reset is now atomic inside
  // the store setters (setHccFilter / clearHccFilters / setHccDueDateFilter /
  // setSearchQuery), so no effect is needed here.

  // Deduplicate hccMembers by patient (fold ID) BEFORE enrichment. The local
  // data model has one row per coding record — a patient with multiple
  // records shows up multiple times (e.g. Annette Brave appears 4x, once per
  // record). Prod's worklist is one row per patient with all DOS entries
  // nested inside a single dos_list, so we mirror that by keeping the first
  // occurrence for each fold ID and merging every other record's dos_list
  // into it. Downstream sort/filter/pagination all operate on the deduped
  // list — the count in SubNav matches this same rule.
  const dedupedMembers = useMemo(() => {
    const byKey = new Map();
    for (const m of hccMembers) {
      const k = normFoldId(m.memberId || m.id);
      if (!k) continue;
      const existing = byKey.get(k);
      if (!existing) {
        byKey.set(k, { ...m, dos_list: [...(m.dos_list || [])] });
        continue;
      }
      // Merge this record's DOS entries onto the first row we saw for the
      // patient, deduped on (date, pos) so overlapping visits don't repeat.
      const seenDos = new Set(existing.dos_list.map(d => `${d.date || ''}|${d.pos || ''}`));
      for (const d of (m.dos_list || [])) {
        const key = `${d.date || ''}|${d.pos || ''}`;
        if (seenDos.has(key)) continue;
        seenDos.add(key);
        existing.dos_list.push(d);
      }
    }
    return [...byKey.values()];
  }, [hccMembers]);

  // Decorate members with derived sort fields so the Member-column sort axes
  // (First Name / Last Name / Gender / DOB Year) and a few special table sorts
  // work with the generic useTableSort comparator.
  const hccDosAssignments = useAppStore(s => s.hccDosAssignments);
  const enriched = useMemo(() => dedupedMembers.map(m => {
    const parts = (m.name || '').trim().split(/\s+/);
    const ageNum = parseInt(String(m.age || '').match(/(\d+)/)?.[1] || '0', 10);
    // assigneeName drives sort on the Assignee column. Reuse the same
    // sequential resolver the cell uses so sort + display agree.
    const key = m.id && m.dos ? `${m.id}::${m.dos}` : null;
    const ds = key ? hccDosAssignments[key] : null;
    const resolved = resolveCurrentAssignee(m, ds);
    const assigneeName =
      resolved?.kind === 'active'     ? (resolved.name || '')        :
      resolved?.kind === 'unassigned' ? `~Awaiting ${resolved.role}` :  // ~ pushes to end of A-Z sort
      resolved?.kind === 'billing'    ? '~Billing Ready'             :
      '';
    // Live document count — matches exactly what the Documents column renders
    // (getChartDocs), so the doc-count filter agrees with what the user sees.
    // Passes the original `m` (not a mutated ch) so getChartDocs' own
    // `ch == null` seed-suppression sentinel keeps working.
    const docCount = getChartDocs(
      m,
      hccAddedCharts[m.id] || [],
      hccChartStatus[m.id] || {},
      hccRemovedCharts[m.id] || [],
    ).length;
    return {
      ...m,
      name_first: parts[0] || '',
      name_last: parts[parts.length - 1] || '',
      dob: ageNum, // proxy: older age = earlier DOB; matches prototype sort semantics
      assigneeName,
      docCount,
    };
  }), [dedupedMembers, hccDosAssignments, hccAddedCharts, hccChartStatus, hccRemovedCharts]);

  const filtered = useMemo(() => {
    let rows = enriched;
    // SLA-based Due Date filter — matches the computed Created-Date colours.
    if (hccDueDateFilter) rows = rows.filter(m => slaDueCategory(m) === hccDueDateFilter);
    if (Object.keys(hccFilters).length) rows = rows.filter(m => memberMatchesFilters(m, hccFilters));
    const q = searchQuery?.trim().toLowerCase();
    if (q) rows = rows.filter(m =>
      m.name?.toLowerCase().includes(q) ||
      m.in?.toLowerCase().includes(q) ||
      m.id?.toLowerCase().includes(q)
    );
    return rows;
  }, [enriched, searchQuery, hccDueDateFilter, hccFilters]);

  // Any filter that can scope rows out — chip filters or the Due Date chip.
  // Drives the "change your filters" empty state vs the true-empty one.
  const filtersActive = !!hccDueDateFilter || countActiveFilters(hccFilters) > 0;

  // SLA default (Astrana DOS worklist): Created Date ascending — oldest first,
  // so records closest to breaching the 14-day window surface at the top.
  const { sorted, sortKey, sortDir, setSort, clearSort } = useTableSort(filtered, 'date', 'asc');

  // "Patients Without Open Gaps" — every patient not represented in
  // hccMembers gets a compact row. Linking key: the shared Fold ID that
  // lives on both `patients.memberId` and `hccMembers.memberId` (post-
  // unification, id === memberId on both slices — see
  // supabase/patient_id_unification_migration.sql). Falls back to the
  // row's `id` for any legacy row that hasn't been backfilled yet.
  const hccMemberIds = useMemo(() => {
    const s = new Set();
    for (const m of hccMembers) {
      const k = normFoldId(m.memberId || m.id);
      if (k) s.add(k);
    }
    return s;
  }, [hccMembers]);

  // Any of these filters is gap-specific — a patient with no open gaps or
  // DOS can't possibly match, so we hide the "Patients Without Open Gaps"
  // section whenever any of them has a value. The primary section's own
  // filter path handles the actual row filtering; this set exists only to
  // decide whether the secondary section is meaningful.
  const gapOnlyFilterActive = useMemo(() => {
    if (hccDueDateFilter) return true;
    for (const k of Object.keys(hccFilters)) {
      if (!GAP_ONLY_FILTER_KEYS.has(k)) continue;
      const v = hccFilters[k];
      if (Array.isArray(v) ? v.length > 0 : v != null) return true;
    }
    return false;
  }, [hccFilters, hccDueDateFilter]);

  const patientsWithoutGaps = useMemo(() => {
    if (gapOnlyFilterActive) return [];
    const q = searchQuery?.trim().toLowerCase() || '';
    // Only surface the "Patients Without Open Gaps" section while the user is
    // actively searching. Without a query the primary HCC rows filled the
    // paginated list; mixing empty "Add DOS" rows in with the last primary
    // page (3 primary + 7 empty on page 6) reads as broken — the empty rows
    // are a search-scoped "did you mean this patient? add DOS for them"
    // affordance, not part of the default HCC worklist. Prod behaves this
    // way too.
    if (!q) return [];
    // Union every known patient source, deduped on the shared Fold ID key.
    // First-source-wins on collisions so the richer `patients` / `allPatients`
    // rows beat the worklist-scoped rows when both exist.
    const combined = [];
    const seen = new Set();
    const push = (row) => {
      const k = normFoldId(row?.memberId || row?.id);
      if (!k || seen.has(k)) return;
      seen.add(k);
      combined.push(row);
    };
    (patients || []).forEach(push);
    (allPatients || []).forEach(push);
    (awvMembers || []).forEach(push);
    (ccmWorklistMembers || []).forEach(push);
    (snpWorklistMembers || []).forEach(push);
    const list = combined.filter(p => {
      const k = normFoldId(p.memberId || p.id);
      if (!k || hccMemberIds.has(k)) return false;
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.memberId || '').toString().toLowerCase().includes(q) ||
        (p.id || '').toString().toLowerCase().includes(q)
      );
    });
    // Sort by patient name ascending — HCC-specific sort keys don't apply here.
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return list;
  }, [patients, allPatients, awvMembers, ccmWorklistMembers, snpWorklistMembers, hccMemberIds, searchQuery, gapOnlyFilterActive]);

  // Flat combined row list: primary records, then a section-header sentinel
  // Empty-patient rows follow the primary rows directly — no section header.
  const combinedRows = useMemo(() => {
    const rows = sorted.map(m => ({ kind: 'primary', key: m.id, member: m }));
    for (const p of patientsWithoutGaps) {
      rows.push({ kind: 'empty', key: `empty-${p.id}`, patient: p });
    }
    return rows;
  }, [sorted, patientsWithoutGaps]);

  // Flat table — one row per record (Figma 4680:138476). A record whose
  // dos_list bundles multiple visits shows a "View More N" expander in
  // its own row (handled inside HccWorklistRow); the table itself just
  // paginates the record list.
  const startIdx = (currentPage - 1) * perPage;
  const paginated = combinedRows.slice(startIdx, startIdx + perPage);

  // Selection lives only on primary rows — empty-patient rows have no
  // bulk actions, so header select-all should ignore them.
  const visibleIds = useMemo(() => {
    const ids = [];
    for (const r of paginated) {
      if (r.kind === 'primary') ids.push(r.member.id);
    }
    return ids;
  }, [paginated]);
  const selectedIdSet = useMemo(() => new Set(selectedHccIds), [selectedHccIds]);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIdSet.has(id));
  const someSelected = selectedHccIds.length > 0 && !allSelected;

  const handleSelectAll = (checked) => {
    if (checked) selectAllHcc(visibleIds);
    else clearHccSelected();
  };

  const hiddenSet = columnPrefs.hiddenSet;
  const activeFilterCount = countActiveFilters(hccFilters);

  return {
    hccMembersLoading,
    perPage,
    activeSubnavList,
    hccDueDateFilter,
    setHccDueDateFilter,
    searchQuery,
    setSearchQuery,
    filterOpen,
    setFilterOpen,
    activeFilterCount,
    openHccHistoryDrawer,
    showToast,
    startHccUpload,
    setHccUploadPhase,
    saveDialogOpen,
    setSaveDialogOpen,
    renameTarget,
    setRenameTarget,
    saveHccFilter,
    renameHccSavedFilter,
    combinedRows,
    filtered,
    patientsWithoutGaps,
    filtersActive,
    clearHccFilters,
    scrollWrapRef,
    someSelected,
    allSelected,
    handleSelectAll,
    memberThRef,
    setMemberSortPop,
    orderedColumns,
    hiddenSet,
    sortKey,
    sortDir,
    setSortPop,
    colCfgBtnRef,
    colCfgRect,
    setColCfgRect,
    paginated,
    selectedHccIds,
    clearHccSelected,
    bulkAssigneeOpen,
    setBulkAssigneeOpen,
    sortPop,
    setSort,
    clearSort,
    memberSortPop,
    toggleHccColumn,
    reorderHccColumns,
    clearHccColumnOrder,
    clearHccHiddenCols,
  };
}
