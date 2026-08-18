import { HccWorklistRow } from './HccWorklistRow';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { SubnavToggle } from '../../components/SubnavToggle/SubnavToggle';
import { SortPopover } from '../../components/SortPopover/SortPopover';
import { DUE_OPTIONS } from './DueDateChip.utils';
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
import { EmptyState, HccHeaderCell, ColumnsIcon } from './HccWorklistTableParts';
import { COL_CLASS } from './HccWorklistTableParts.constants';
import styles from './HccWorklistTable.module.css';
import rowStyles from './HccWorklistRow.module.css';

export function HccWorklistTableView({
  hccMembersLoading, activeSubnavList, hccDueDateFilter, setHccDueDateFilter,
  searchQuery, setSearchQuery, filterOpen, setFilterOpen, openHccHistoryDrawer, showToast,
  openIcdCreation, saveDialogOpen, setSaveDialogOpen, renameTarget, setRenameTarget,
  saveHccFilter, renameHccSavedFilter, filtered, memberThRef, setMemberSortPop,
  orderedColumns, hiddenSet, sortKey, sortDir, setSortPop, colCfgBtnRef, colCfgRect,
  setColCfgRect, paginated, someSelected, allSelected, handleSelectAll, selectedHccIds,
  clearHccSelected, bulkAssigneeOpen, setBulkAssigneeOpen, sortPop, setSort, clearSort,
  memberSortPop, toggleHccColumn, reorderHccColumns, clearHccColumnOrder, clearHccHiddenCols,
}) {
  return (
    <div className={styles.wrap}>
      <HccUploadProgressRibbon />
      {/* Header (SectionTitleBar · variant 2 · titleWithDropdown). Mirrors
          the main HCC worklist so both HCC surfaces share one chrome. */}
      <SectionTitleBar
        variant="titleWithDropdown"
        leadingElement={<SubnavToggle />}
        title={activeSubnavList}
        dropdownLabel="Due Date"
        dropdownOptions={DUE_OPTIONS}
        dropdownValue={hccDueDateFilter}
        onDropdownChange={setHccDueDateFilter}
        actions={['search', 'filter', 'history', 'download']}
        searchPlaceholder="Search by member name…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filterActive={filterOpen}
        onFilter={() => setFilterOpen(v => !v)}
        onHistory={openHccHistoryDrawer}
        onDownload={() => showToast('Export — coming soon')}
        rightExtras={
          <>
            <ActionButton
              icon="solar:upload-minimalistic-linear"
              size="L"
              tooltip="Upload Document"
              tooltipBelow
              onClick={() => openIcdCreation?.()}
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

      <div className={styles.scrollWrap}>
        <table className={styles.table}>
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
          <tbody>
            {paginated.map(m => <HccWorklistRow key={m.id} member={m} hiddenCols={hiddenSet} columns={orderedColumns} />)}
          </tbody>
        </table>

        {filtered.length === 0 && searchQuery?.trim() && (
          <EmptyState
            title="No results found"
            message={`No members match "${searchQuery.trim()}". Try a different search term.`}
          />
        )}
        {filtered.length === 0 && !searchQuery?.trim() && !hccMembersLoading && (
          <EmptyState
            title="No HCC members yet"
            message="Members will appear here once assigned."
            icon="solar:ghost-smile-linear"
          />
        )}
      </div>

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
