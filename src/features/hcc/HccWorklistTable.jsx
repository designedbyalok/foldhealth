import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { HccWorklistRow, resolveCurrentAssignee } from './HccWorklistRow';
import { TableSkeleton } from '../../components/TableSkeleton/TableSkeleton';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { useTableSort } from '../../components/SortableHeader/useTableSort';
import { SortPopover } from '../../components/SortPopover/SortPopover';
import { DUE_OPTIONS } from './DueDateChip';
import { slaDueCategory } from './sla';
import { SavedFiltersChip } from './SavedFiltersChip';
import { FilterChipBar } from './FilterChipBar';
import { FilterNameDialog } from './FilterNameDialog';
import { ColumnConfigPopover } from './ColumnConfigPopover';
import { HCC_COLUMNS, HCC_COL_MAP, MEMBER_SORT_ITEMS, orderColumns } from './columns';
import { memberMatchesFilters, countActiveFilters } from './filters';
import { Pagination } from '../../components/Pagination/Pagination';
import { BulkBar } from '../../components/BulkBar/BulkBar';
import { BulkChangeAssigneesDialog } from './BulkChangeAssigneesDialog';
import { HccUploadProgressRibbon } from './upload/HccUploadProgressRibbon';
import { HccHistoryDrawer } from './HccHistoryDrawer';
import { StatusLegend } from './StatusLegend';
import { HorizontalScrollbar } from '../../components/HorizontalScrollbar/HorizontalScrollbar';
import styles from './HccWorklistTable.module.css';
import rowStyles from './HccWorklistRow.module.css';

/**
 * Upload toolbar button — clicking it opens a menu with two ways to
 * add a record: upload a PDF (routes through the OCR / Add Records
 * drawer's picker phase) or add manually (opens the same drawer in
 * SinglePhase — patient search + ICDs + DOS/POS/Provider form).
 * Restores the manual-entry entry point that lived on the chooser
 * screen before the upload-icon shortcut skipped past it.
 */
function UploadMenuButton({ onUploadDocument, onAddManually }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <span ref={wrapRef} style={{ display: 'inline-flex', position: 'relative' }}>
      <ActionButton
        icon="custom:upload"
        size="L"
        tooltip="Upload"
        tooltipBelow
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      />
      {open && (
        <MenuPopover
          anchorRef={wrapRef}
          onClose={() => setOpen(false)}
          width={220}
          items={[
            { key: 'upload',   label: 'Upload Document', icon: 'solar:upload-minimalistic-linear' },
            { key: 'manual',   label: 'Add Manually',    icon: 'solar:pen-linear' },
          ]}
          onSelect={(key) => {
            if (key === 'upload') onUploadDocument();
            else if (key === 'manual') onAddManually();
          }}
        />
      )}
    </span>
  );
}

function EmptyState({ title, message, icon = 'solar:magnifer-linear', action = null }) {
  return (
    <div className={styles.empty}>
      <Icon name={icon} size={40} color="var(--neutral-200)" />
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyMessage}>{message}</p>
      {action}
    </div>
  );
}

// ── Header cell — opens a SortPopover on click for sortable columns. ──────
function HccHeaderCell({ column, className, sortKey, sortDir, onOpenSort }) {
  const ref = useRef(null);
  const sortField = column.sortField || column.k;
  const isActive = column.sortable && sortField === sortKey;
  const handleClick = () => {
    if (!column.sortable) return;
    const rect = ref.current?.getBoundingClientRect();
    if (rect) onOpenSort(column, rect);
  };
  return (
    <th
      ref={ref}
      className={[
        className || '',
        styles.headerCell,
        column.sortable ? styles.headerCellSortable : '',
        isActive ? styles.headerCellActive : '',
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      data-col={column.k}
    >
      <span className={styles.headerLabel}>
        {column.lb}
        {column.sortable && (
          <span className={styles.sortIcon}>
            {isActive ? (
              <Icon
                name={sortDir === 'asc' ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'}
                size={12}
                color="var(--primary-300)"
              />
            ) : (
              <Icon name="solar:sort-vertical-linear" size={12} color="var(--neutral-200)" />
            )}
          </span>
        )}
      </span>
    </th>
  );
}

// ── Class map per column (preserves existing sticky/width treatments) ─────
const COL_CLASS = {
  dos:      rowStyles.colLastVisit,
  open:     rowStyles.colOpen,
  vt:       rowStyles.colVt,
  date:     rowStyles.colDate,
  evidence: rowStyles.colEvidence,
  sup:      rowStyles.colRole,
  cdr:      rowStyles.colRole,
  r1:       rowStyles.colRole,
  r2:       rowStyles.colRole,
  r3:       rowStyles.colRole,
  rp:       rowStyles.colProvider,
  pos:      rowStyles.colPos,
  posDesc:  rowStyles.colPosDesc,
  raf:      rowStyles.colRaf,
  ri:       rowStyles.colRi,
  ipa:      rowStyles.colIpa,
  hp:       rowStyles.colHp,
  pcp:      rowStyles.colPcp,
  dec:      rowStyles.colDec,
  coh:      rowStyles.colCoh,
  rl:       rowStyles.colRl,
  ad:       rowStyles.colAd,
  fr:       rowStyles.colFr,
};

export function HccWorklistTable() {
  const hccMembers = useAppStore(s => s.hccMembers);
  const hccMembersLoading = useAppStore(s => s.hccMembersLoading);
  const fetchHccMembers = useAppStore(s => s.fetchHccMembers);
  const fetchHccAddedCharts = useAppStore(s => s.fetchHccAddedCharts);
  const fetchHccChartStatus = useAppStore(s => s.fetchHccChartStatus);
  const fetchHccRemovedCharts = useAppStore(s => s.fetchHccRemovedCharts);
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
  const hccHiddenCols = useAppStore(s => s.hccHiddenCols);
  const toggleHccColumn = useAppStore(s => s.toggleHccColumn);
  const hccColumnOrder = useAppStore(s => s.hccColumnOrder);
  const reorderHccColumns = useAppStore(s => s.reorderHccColumns);
  const setHccDefaultColumnKeys = useAppStore(s => s.setHccDefaultColumnKeys);
  const clearHccColumnOrder = useAppStore(s => s.clearHccColumnOrder);
  const clearHccHiddenCols = useAppStore(s => s.clearHccHiddenCols);

  // Seed the store's default-key snapshot once so reorderHccColumns has
  // something to start from before the user has set any custom order.
  useEffect(() => {
    setHccDefaultColumnKeys(HCC_COLUMNS.map(c => c.k));
  }, [setHccDefaultColumnKeys]);

  const orderedColumns = useMemo(
    () => orderColumns(HCC_COLUMNS, hccColumnOrder),
    [hccColumnOrder],
  );

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

  // Decorate members with derived sort fields so the Member-column sort axes
  // (First Name / Last Name / Gender / DOB Year) and a few special table sorts
  // work with the generic useTableSort comparator.
  const hccDosAssignments = useAppStore(s => s.hccDosAssignments);
  const enriched = useMemo(() => hccMembers.map(m => {
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
    return {
      ...m,
      name_first: parts[0] || '',
      name_last: parts[parts.length - 1] || '',
      dob: ageNum, // proxy: older age = earlier DOB; matches prototype sort semantics
      assigneeName,
    };
  }), [hccMembers, hccDosAssignments]);

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

  // Flat table — one row per record (Figma 4680:138476). A record whose
  // dos_list bundles multiple visits shows a "View More N" expander in
  // its own row (handled inside HccWorklistRow); the table itself just
  // paginates the record list.
  const startIdx = (currentPage - 1) * perPage;
  const paginated = sorted.slice(startIdx, startIdx + perPage);

  const visibleIds = paginated.map(m => m.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedHccIds.includes(id));
  const someSelected = selectedHccIds.length > 0 && !allSelected;

  const handleSelectAll = (checked) => {
    if (checked) selectAllHcc(visibleIds);
    else clearHccSelected();
  };

  const hiddenSet = useMemo(() => new Set(hccHiddenCols), [hccHiddenCols]);
  const activeFilterCount = countActiveFilters(hccFilters);

  if (hccMembersLoading) return <TableSkeleton rows={perPage} />;

  return (
    <div className={styles.wrap}>
      <HccUploadProgressRibbon />
      {/* Header (SectionTitleBar · variant 2 · titleWithDropdown).
          `activeSubnavList` (from SubNav) drives the title so renaming a
          worklist in the SubNav ripples here without a second source of
          truth. Due Date routes through FilterChip singleSelect via the
          shared component; SavedFiltersChip / Export / UploadMenu / History
          keep their HCC-specific popovers via rightExtras. */}
      <SectionTitleBar
        variant="titleWithDropdown"
        title={activeSubnavList}
        dropdownLabel="Due Date"
        dropdownOptions={DUE_OPTIONS}
        dropdownValue={hccDueDateFilter}
        onDropdownChange={setHccDueDateFilter}
        showSearch
        searchPlaceholder="Search by member name…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        showFilter
        filterActive={filterOpen}
        filterBadgeCount={activeFilterCount}
        onFilter={() => setFilterOpen(v => !v)}
        showHistory
        onHistory={openHccHistoryDrawer}
        rightExtras={
          <>
            <SavedFiltersChip />
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
            <ActionButton
              icon="custom:export"
              size="L"
              tooltip="Export"
              tooltipBelow
              onClick={() => showToast('Export — coming soon')}
            />
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
            <UploadMenuButton
              onUploadDocument={() => { startHccUpload(null); setHccUploadPhase('picker'); }}
              onAddManually={() => { startHccUpload(null); setHccUploadPhase('single'); }}
            />
          </>
        }
      />

      {filterOpen && <FilterChipBar onSaveFilter={() => setSaveDialogOpen(true)} />}
      {/* Saved filters live exclusively in the left SubNav (under HCC).
          Inline chip strip removed per UX; rename/delete handled in-sidebar. */}

      <FilterNameDialog
        open={saveDialogOpen}
        title="Save Filter"
        submitLabel="Save & Apply"
        initialName=""
        onSubmit={(name) => { saveHccFilter(name); setSaveDialogOpen(false); }}
        onCancel={() => setSaveDialogOpen(false)}
      />
      <FilterNameDialog
        open={!!renameTarget}
        title="Rename Filter"
        submitLabel="Save"
        initialName={renameTarget?.name || ''}
        onSubmit={(name) => { renameHccSavedFilter(renameTarget.id, name); setRenameTarget(null); }}
        onCancel={() => setRenameTarget(null)}
      />

      <div className={styles.scrollWrap} ref={scrollWrapRef}>
        {filtered.length === 0 && searchQuery?.trim() && (
          <EmptyState
            title="No results found"
            message={`No members match "${searchQuery.trim()}". Try a different search term.`}
          />
        )}
        {/* Filters (chips or Due Date) scoped everything out — prompt the
            user to adjust them instead of implying the list is empty. */}
        {filtered.length === 0 && !searchQuery?.trim() && filtersActive && !hccMembersLoading && (
          <EmptyState
            title="No records match your filters"
            message="Try changing or removing some filters to see more records."
            icon="solar:filter-linear"
            action={
              <Button
                variant="secondary"
                size="S"
                leadingIcon="solar:close-circle-linear"
                onClick={() => { clearHccFilters(); setHccDueDateFilter(null); }}
              >
                Clear All Filters
              </Button>
            }
          />
        )}
        {filtered.length === 0 && !searchQuery?.trim() && !filtersActive && !hccMembersLoading && (
          <EmptyState
            title="No HCC members yet"
            message="Members will appear here once assigned."
            icon="solar:ghost-smile-linear"
          />
        )}
        <table className={styles.table} hidden={filtered.length === 0 && !hccMembersLoading}>
          <thead>
            <tr>
              <th className={`${rowStyles.stickyLeft} ${rowStyles.stickyCheck} ${styles.checkTh}`}>
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all members"
                />
              </th>
              <th
                ref={memberThRef}
                className={`${rowStyles.stickyLeft} ${rowStyles.stickyMember} ${rowStyles.colMember} ${styles.memberTh} ${styles.headerCellSortable}`}
                onClick={() => {
                  const rect = memberThRef.current?.getBoundingClientRect();
                  if (rect) setMemberSortPop(rect);
                }}
              >
                <span className={styles.headerLabel}>
                  Member
                  <span className={styles.sortIcon}>
                    <Icon name="solar:sort-vertical-linear" size={12} color="var(--neutral-200)" />
                  </span>
                </span>
              </th>

              {orderedColumns.map((col) => (
                hiddenSet.has(col.k) ? null : (
                  <HccHeaderCell
                    key={col.k}
                    column={col}
                    className={COL_CLASS[col.k]}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onOpenSort={(c, rect) => setSortPop({
                      items: [{ key: c.sortField || c.k, label: c.lb }],
                      rect,
                    })}
                  />
                )
              ))}

              <th
                ref={colCfgBtnRef}
                className={`${rowStyles.stickyRight} ${rowStyles.colActions} ${styles.actionsTh}`}
              >
                <span className={styles.actionsHeaderLabel}>Actions</span>
                <button
                  type="button"
                  className={[styles.colCfgBtn, colCfgRect ? styles.colCfgBtnActive : ''].join(' ')}
                  title="Show / hide columns"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (colCfgRect) { setColCfgRect(null); return; }
                    setColCfgRect(e.currentTarget.getBoundingClientRect());
                  }}
                >
                  <ColumnsIcon
                    size={16}
                    color={colCfgRect ? 'var(--primary-300)' : 'var(--neutral-300)'}
                  />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className={rowStyles.tbody}>
            {paginated.map(m => (
              <HccWorklistRow
                key={m.id}
                member={m}
                hiddenCols={hiddenSet}
                columns={orderedColumns}
              />
            ))}
          </tbody>
        </table>
      </div>
      <HorizontalScrollbar targetRef={scrollWrapRef} />

      <StatusLegend />

      <Pagination totalItems={filtered.length} />

      <BulkBar
        selectedIds={selectedHccIds}
        onClear={clearHccSelected}
        onChangeAssignee={() => setBulkAssigneeOpen(true)}
      />
      <BulkChangeAssigneesDialog
        open={bulkAssigneeOpen}
        selectedIds={selectedHccIds}
        onClose={() => setBulkAssigneeOpen(false)}
        onApplied={() => { setBulkAssigneeOpen(false); clearHccSelected(); }}
      />
      <HccHistoryDrawer />

      {sortPop && (
        <SortPopover
          anchorRect={sortPop.rect}
          items={sortPop.items}
          currentKey={sortKey}
          currentDir={sortDir}
          onSort={(k, dir) => setSort(k, dir)}
          onClear={clearSort}
          onClose={() => setSortPop(null)}
        />
      )}
      {memberSortPop && (
        <SortPopover
          anchorRect={memberSortPop}
          items={MEMBER_SORT_ITEMS}
          currentKey={sortKey}
          currentDir={sortDir}
          onSort={(k, dir) => setSort(k, dir)}
          onClear={clearSort}
          onClose={() => setMemberSortPop(null)}
        />
      )}
      {colCfgRect && (
        <ColumnConfigPopover
          anchorRect={colCfgRect}
          columns={orderedColumns}
          hidden={hiddenSet}
          onToggle={toggleHccColumn}
          onReorder={reorderHccColumns}
          onReset={() => { clearHccColumnOrder(); clearHccHiddenCols(); }}
          onClose={() => setColCfgRect(null)}
        />
      )}
    </div>
  );
}

// Custom "columns" glyph — three vertical sections — used by the
// Show/Hide columns header button. No matching Solar icon, so we inline it.
function ColumnsIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10.0007 5.37023L9.97576 4.87085L10.0007 5.37023ZM10.0007 18.6301L9.97576 19.1295L10.0007 18.6301ZM14.0007 5.37023L14.0255 4.87085L14.0007 5.37023ZM14.0007 18.6301L14.0255 19.1295L14.0007 18.6301ZM5.33398 12.0002H4.83398C4.83398 13.5574 4.83292 14.7756 4.96048 15.7244C5.08997 16.6875 5.3602 17.4475 5.95674 18.0441L6.3103 17.6905L6.66385 17.337C6.28408 16.9572 6.06615 16.4434 5.95156 15.5911C5.83505 14.7245 5.83398 13.5856 5.83398 12.0002H5.33398ZM18.6673 12.0002H18.1673C18.1673 13.5856 18.1663 14.7245 18.0497 15.5911C17.9352 16.4434 17.7172 16.9572 17.3375 17.337L17.691 17.6905L18.0446 18.0441C18.6411 17.4475 18.9113 16.6875 19.0408 15.7244C19.1684 14.7756 19.1673 13.5574 19.1673 12.0002H18.6673ZM18.6673 12.0002H19.1673C19.1673 10.4429 19.1684 9.22474 19.0408 8.27597C18.9113 7.31281 18.6411 6.55279 18.0446 5.95625L17.691 6.30981L17.3375 6.66336C17.7172 7.04313 17.9352 7.55694 18.0497 8.40921C18.1663 9.27587 18.1673 10.4147 18.1673 12.0002H18.6673ZM5.33398 12.0002H5.83398C5.83398 10.4147 5.83505 9.27587 5.95156 8.40921C6.06615 7.55694 6.28408 7.04313 6.66385 6.66336L6.3103 6.30981L5.95674 5.95625C5.3602 6.55279 5.08997 7.31281 4.96048 8.27597C4.83292 9.22474 4.83398 10.4429 4.83398 12.0002H5.33398ZM12.0007 5.3335V4.8335C10.9457 4.8335 10.7256 4.83347 9.97576 4.87085L10.0007 5.37023L10.0255 5.86961C10.7496 5.83352 10.9494 5.8335 12.0007 5.8335V5.3335ZM10.0007 5.37023L9.97576 4.87085C9.23298 4.90787 8.44121 4.9823 7.7433 5.13555C7.06562 5.28437 6.38768 5.52531 5.95674 5.95625L6.3103 6.30981L6.66385 6.66336C6.88207 6.44514 7.31816 6.25274 7.95779 6.11228C8.57719 5.97626 9.30602 5.90548 10.0255 5.86961L10.0007 5.37023ZM12.0007 18.6668V18.1668C10.9494 18.1668 10.7496 18.1668 10.0255 18.1307L10.0007 18.6301L9.97576 19.1295C10.7256 19.1669 10.9457 19.1668 12.0007 19.1668V18.6668ZM10.0007 18.6301L10.0255 18.1307C9.30602 18.0948 8.57719 18.0241 7.95779 17.888C7.31816 17.7476 6.88207 17.5552 6.66385 17.337L6.3103 17.6905L5.95674 18.0441C6.38768 18.475 7.06562 18.716 7.7433 18.8648C8.44121 19.018 9.23298 19.0924 9.97576 19.1295L10.0007 18.6301ZM10.0007 5.37023H9.50065V18.6301H10.0007H10.5007V5.37023H10.0007ZM12.0007 5.3335V5.8335C13.0519 5.8335 13.2517 5.83352 13.9758 5.86961L14.0007 5.37023L14.0255 4.87085C13.2757 4.83347 13.0556 4.8335 12.0007 4.8335V5.3335ZM14.0007 5.37023L13.9758 5.86961C14.6953 5.90548 15.4241 5.97626 16.0435 6.11228C16.6831 6.25274 17.1192 6.44514 17.3375 6.66336L17.691 6.30981L18.0446 5.95625C17.6136 5.52531 16.9357 5.28437 16.258 5.13555C15.5601 4.9823 14.7683 4.90787 14.0255 4.87085L14.0007 5.37023ZM12.0007 18.6668V19.1668C13.0556 19.1668 13.2757 19.1669 14.0255 19.1295L14.0007 18.6301L13.9758 18.1307C13.2517 18.1668 13.0519 18.1668 12.0007 18.1668V18.6668ZM14.0007 18.6301L14.0255 19.1295C14.7683 19.0924 15.5601 19.018 16.258 18.8648C16.9357 18.716 17.6136 18.475 18.0446 18.0441L17.691 17.6905L17.3375 17.337C17.1192 17.5552 16.6831 17.7476 16.0435 17.888C15.4241 18.0241 14.6953 18.0948 13.9758 18.1307L14.0007 18.6301ZM14.0007 5.37023L13.5007 5.37023L13.5007 18.6301H14.0007H14.5007L14.5007 5.37023L14.0007 5.37023Z"
        fill={color}
      />
    </svg>
  );
}
