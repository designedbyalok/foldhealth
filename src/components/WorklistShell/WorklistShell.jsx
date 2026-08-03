import { useState } from 'react';
import { ActionButton } from '../ActionButton/ActionButton';
import { SearchIconButton } from '../SearchIconButton/SearchIconButton';
import { SearchBar } from '../SearchBar/SearchBar';
import { Checkbox } from '../ShadcnCheckbox/ShadcnCheckbox';
import { SortableHeader } from '../SortableHeader/SortableHeader';
import { Pagination } from '../Pagination/Pagination';
import { BulkBar } from '../BulkBar/BulkBar';
import { TableSkeleton } from '../TableSkeleton/TableSkeleton';
import styles from './WorklistShell.module.css';

/**
 * WorklistShell — the reusable outer chrome for every worklist in the app
 * (TOC, HCC, CCM, HEDIS, AWV, …). Composes the header (title as an active
 * tab, right-side Search / Filter / History / Export actions), an optional
 * filter chip row, a sticky-column table body, a floating BulkBar, and
 * Pagination.
 *
 * Callers supply the columns, the row renderer, the filter chips, and
 * bulk / pagination state. The column definitions drive the sticky-left /
 * sticky-right positioning and any sortable headers (via SortableHeader).
 *
 * Props
 * -----
 *  - title              Left-side header label (rendered like a TOC tab).
 *  - onHistory / onExport  Called by the right-side icons; icons are
 *                          hidden when the handler is omitted.
 *  - searchValue / onSearchChange  Controlled search — clicking the
 *                          Search icon expands a SearchBar in place.
 *  - showFilters / onToggleFilters + filters  Filter chip node rendered
 *                          only when `showFilters` is true.
 *  - columns              [{ key, label, sortKey?, sticky?: 'left'|'right',
 *                          width?, align?, showCheckbox? }]
 *                          The first column with `showCheckbox` gets a
 *                          select-all checkbox in the header.
 *  - sortKey / sortDir / onSort  Header sort state — passed through to
 *                          SortableHeader.
 *  - rows / renderRow     Row data + render function. renderRow receives
 *                          (row, index) and should return a `<tr>`.
 *  - loading / emptyState Rendered instead of `rows` when appropriate.
 *  - selectedIds          Array of selected row ids for BulkBar + select-
 *                          all state. When empty BulkBar stays hidden.
 *  - onSelectAll / onClearSelection  Wired to the header checkbox +
 *                          BulkBar's dismiss. onSelectAll receives the
 *                          new boolean checked state.
 *  - bulkActions          Optional custom BulkBar action buttons; when
 *                          omitted BulkBar uses its default set.
 *  - page / perPage / totalItems / onPageChange / onPageSizeChange
 *                          Pagination state. Omit `totalItems` to hide.
 *  - minTableWidth        Minimum table width in px so wide column sets
 *                          get a horizontal scroll instead of squishing.
 */
export function WorklistShell({
  title,
  onHistory,
  onExport,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search by member name…',
  showFilters,
  onToggleFilters,
  filters,
  columns = [],
  sortKey,
  sortDir,
  onSort,
  rows = [],
  renderRow,
  loading,
  emptyState,
  selectedIds = [],
  onSelectAll,
  onClearSelection,
  bulkActions,
  page,
  perPage,
  totalItems,
  onPageChange,
  onPageSizeChange,
  minTableWidth = 900,
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const checkboxCol = columns.find((c) => c.showCheckbox);

  return (
    <div className={styles.shell}>
      {/* Header (mirrors src/layouts/TabBar): title as an active tab
          on the left, right-side action icons with dividers. */}
      <div className={styles.header}>
        <div className={styles.left}>
          <div className={`${styles.tabItem} ${styles.tabActive}`}>{title}</div>
        </div>
        <div className={styles.right}>
          <div className={styles.searchWrap}>
            {searchOpen ? (
              <SearchBar
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onClose={() => {
                  setSearchOpen(false);
                  onSearchChange?.('');
                }}
              />
            ) : (
              <SearchIconButton title="Search" onClick={() => setSearchOpen(true)} />
            )}
          </div>
          {onToggleFilters && (
            <>
              <span className={styles.iconDivider} />
              <ActionButton
                icon="custom:filter"
                size="L"
                tooltip="Filter"
                className={showFilters ? styles.iconActive : ''}
                onClick={() => onToggleFilters(!showFilters)}
              />
            </>
          )}
          {onHistory && (
            <>
              <span className={styles.iconDivider} />
              <ActionButton icon="solar:history-linear" size="L" tooltip="History" onClick={onHistory} />
            </>
          )}
          {onExport && (
            <>
              <span className={styles.iconDivider} />
              <ActionButton icon="solar:upload-minimalistic-linear" size="L" tooltip="Export" onClick={onExport} />
            </>
          )}
        </div>
      </div>

      {/* Filter chip row — visible only when the caller toggles showFilters. */}
      {showFilters && filters && <div className={styles.filterBar}>{filters}</div>}

      {/* Table body — sticky-left checkbox + Members col, sticky-right
          Actions col by convention. Callers control which columns are
          sticky via `sticky: 'left' | 'right'` on the column def. */}
      <div className={styles.tableScroll}>
        {loading ? (
          <TableSkeleton rows={perPage || 10} columns={columns.length || 8} />
        ) : (
          <table className={styles.table} style={{ minWidth: minTableWidth }}>
            <thead>
              <tr className={styles.headRow}>
                {columns.map((col, idx) => {
                  const stickyStyle = col.sticky === 'left'
                    ? { position: 'sticky', left: col.left || 0, background: 'var(--neutral-0)', zIndex: 4 }
                    : col.sticky === 'right'
                    ? { position: 'sticky', right: 0, background: 'var(--neutral-0)', zIndex: 3 }
                    : undefined;

                  if (col.showCheckbox) {
                    return (
                      <th
                        key={col.key || idx}
                        className={styles.th}
                        style={{ ...stickyStyle, width: col.width || 36, textAlign: 'left' }}
                      >
                        <Checkbox
                          checked={someSelected ? 'indeterminate' : allSelected}
                          onCheckedChange={(v) => onSelectAll?.(!!v)}
                          aria-label="Select all rows"
                        />
                      </th>
                    );
                  }

                  if (col.sortKey && onSort) {
                    return (
                      // Pass styles.th so the sortable header inherits the
                      // WorklistShell font weight / size / color and matches
                      // the plain <th>s in the same row.
                      <SortableHeader
                        key={col.key || idx}
                        label={col.label}
                        sortKey={col.sortKey}
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={onSort}
                        align={col.align || 'left'}
                        className={styles.th}
                        style={{ ...stickyStyle, width: col.width }}
                      />
                    );
                  }

                  return (
                    <th
                      key={col.key || idx}
                      className={styles.th}
                      style={{ ...stickyStyle, width: col.width, textAlign: col.align || 'left' }}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && emptyState
                ? (<tr><td colSpan={columns.length}>{emptyState}</td></tr>)
                : rows.map((row, i) => renderRow(row, i))}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 && !emptyState && (
          <div className={styles.emptyDefault}>No results</div>
        )}
        {checkboxCol && selectedIds.length > 0 && (
          <BulkBar
            selectedIds={selectedIds}
            onClear={onClearSelection}
            actions={bulkActions}
          />
        )}
      </div>

      {typeof totalItems === 'number' && onPageChange && (
        <Pagination
          currentPage={page}
          totalItems={totalItems}
          pageSize={perPage}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
