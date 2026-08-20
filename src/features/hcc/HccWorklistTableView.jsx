import { HccWorklistRow, HccEmptyPatientRow } from './HccWorklistRow';
import { HeaderCell } from '../../components/HeaderCell/HeaderCell';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { SubnavToggle } from '../../components/SubnavToggle/SubnavToggle';
import { SortPopover } from '../../components/SortPopover/SortPopover';
import { DUE_OPTIONS } from './DueDateChip.utils';
import { SavedFiltersChip } from './SavedFiltersChip';
import { FilterChipBar } from './FilterChipBar';
import { FilterNameDialog } from './FilterNameDialog';
import { ColumnConfigPopover } from '../../components/ColumnConfigPopover/ColumnConfigPopover';
import { MEMBER_SORT_ITEMS } from './columns';
import { Pagination } from '../../components/Pagination/Pagination';
import { BulkBar } from '../../components/BulkBar/BulkBar';
import { BulkChangeAssigneesDialog } from './BulkChangeAssigneesDialog';
import { HccUploadProgressRibbon } from './upload/HccUploadProgressRibbon';
import { HccHistoryDrawer } from './HccHistoryDrawer';
import { StatusLegend } from './StatusLegend';
import { HorizontalScrollbar } from '../../components/HorizontalScrollbar/HorizontalScrollbar';
import { UploadMenuButton, EmptyState, ColumnsIcon } from './HccWorklistTableParts';
import { COL_CLASS } from './HccWorklistTableParts.constants';
import styles from './HccWorklistTable.module.css';
import rowStyles from './HccWorklistRow.module.css';

export function HccWorklistTableView({
  activeSubnavList, hccDueDateFilter, setHccDueDateFilter, searchQuery, setSearchQuery,
  filterOpen, setFilterOpen, activeFilterCount, openHccHistoryDrawer, showToast,
  startHccUpload, setHccUploadPhase, saveDialogOpen, setSaveDialogOpen, renameTarget, setRenameTarget,
  saveHccFilter, renameHccSavedFilter, combinedRows, filtered, patientsWithoutGaps, filtersActive,
  hccMembersLoading, clearHccFilters, scrollWrapRef, someSelected, allSelected, handleSelectAll,
  setMemberSortPop, orderedColumns, hiddenSet, sortKey, sortDir, setSortPop,
  colCfgBtnRef, colCfgRect, setColCfgRect, paginated, selectedHccIds, clearHccSelected,
  bulkAssigneeOpen, setBulkAssigneeOpen, sortPop, setSort, clearSort, memberSortPop,
  toggleHccColumn, reorderHccColumns, clearHccColumnOrder, clearHccHiddenCols,
}) {
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
        leadingElement={<SubnavToggle />}
        title={activeSubnavList}
        dropdownLabel="Due Date"
        dropdownOptions={DUE_OPTIONS}
        dropdownValue={hccDueDateFilter}
        onDropdownChange={setHccDueDateFilter}
        actions={['search', 'filter', 'history']}
        searchPlaceholder="Search by member name…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filterActive={filterOpen}
        filterBadgeCount={activeFilterCount}
        onFilter={() => setFilterOpen(v => !v)}
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
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
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
        {/* Empty states check the COMBINED list — if the secondary section
            still has patients that match the search, don't tell the user
            there are no results. */}
        {combinedRows.length === 0 && searchQuery?.trim() && (
          <EmptyState
            title="No results found"
            message={`No members match "${searchQuery.trim()}". Try a different search term.`}
          />
        )}
        {/* Filters (chips or Due Date) scoped primary rows out — prompt the
            user to adjust them. Only shown when the secondary section is
            also empty, otherwise the table still has meaningful content. */}
        {filtered.length === 0 && patientsWithoutGaps.length === 0 && !searchQuery?.trim() && filtersActive && !hccMembersLoading && (
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
        {combinedRows.length === 0 && !searchQuery?.trim() && !filtersActive && !hccMembersLoading && (
          <EmptyState
            title="No HCC members yet"
            message="Members will appear here once assigned."
            icon="solar:ghost-smile-linear"
          />
        )}
        <table className={styles.table} hidden={combinedRows.length === 0 && !hccMembersLoading}>
          <thead>
            <tr>
              <th className={`${rowStyles.stickyLeft} ${rowStyles.stickyCheck} ${styles.checkTh}`}>
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all members"
                />
              </th>
              <HeaderCell
                label="Member"
                sortField="member"
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={(_field, rect) => setMemberSortPop(rect)}
                className={`${rowStyles.stickyLeft} ${rowStyles.stickyMember} ${rowStyles.colMember} ${styles.memberTh}`}
              />

              {orderedColumns.map((col) => (
                hiddenSet.has(col.k) ? null : (
                  <HeaderCell
                    key={col.k}
                    label={col.lb}
                    sortField={col.sortable ? (col.sortField || col.k) : undefined}
                    sortType={col.sortType}
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={col.sortable ? ((field) => {
                      // Cycle asc → desc → cleared on the active column, or
                      // start fresh at asc when switching to a new column.
                      // No popover — the header morphs its own icon to show
                      // the current direction.
                      if (sortKey === field) {
                        if (sortDir === 'asc') setSort(field, 'desc');
                        else if (sortDir === 'desc') clearSort();
                        else setSort(field, 'asc');
                      } else {
                        setSort(field, 'asc');
                      }
                    }) : undefined}
                    className={COL_CLASS[col.k]}
                  />
                )
              ))}

              <th
                ref={colCfgBtnRef}
                className={`${rowStyles.stickyRight} ${rowStyles.colActions} ${styles.actionsTh}`}
              >
                <div className={styles.actionsHeaderInner}>
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
                </div>
              </th>
            </tr>
          </thead>
          <tbody className={rowStyles.tbody}>
            {paginated.map((row, index) => {
              if (row.kind === 'primary') {
                return (
                  <HccWorklistRow
                    key={row.key}
                    member={row.member}
                    hiddenCols={hiddenSet}
                    columns={orderedColumns}
                    staggerIndex={index}
                  />
                );
              }
              // empty
              return (
                <HccEmptyPatientRow
                  key={row.key}
                  patient={row.patient}
                  hiddenCols={hiddenSet}
                  columns={orderedColumns}
                  staggerIndex={index}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <HorizontalScrollbar targetRef={scrollWrapRef} />

      <StatusLegend />

      <Pagination totalItems={combinedRows.length} />

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