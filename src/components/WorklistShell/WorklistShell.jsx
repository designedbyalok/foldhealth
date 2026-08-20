import { useMemo, useState } from 'react';
import { ActionButton } from '../ActionButton/ActionButton';
import { SearchIconButton } from '../SearchIconButton/SearchIconButton';
import { SearchBar } from '../SearchBar/SearchBar';
import { Checkbox } from '../ShadcnCheckbox/ShadcnCheckbox';
import { HeaderCell } from '../HeaderCell/HeaderCell';
import { Pagination } from '../Pagination/Pagination';
import { BulkBar } from '../BulkBar/BulkBar';
import { TableSkeleton } from '../TableSkeleton/TableSkeleton';
import { ColumnsHeaderButton } from '../WorklistColumns/ColumnsHeaderButton';
import { useWorklistColumns } from '../WorklistColumns/useWorklistColumns';
import styles from './WorklistShell.module.css';

const EMPTY_SELECTED_IDS = [];

/**
 * WorklistShell — the reusable outer chrome for every worklist in the app
 * (TOC, HCC, CCM, HEDIS, AWV, …). Composes the header (title as an active
 * tab, right-side Search / Filter / History / Export actions), an optional
 * filter chip row, a sticky-column table body, a floating BulkBar, and
 * Pagination.
 *
 * Callers supply the columns, the row renderer, the filter chips, and
 * bulk / pagination state. The column definitions drive the sticky-left /
 * sticky-right positioning and any sortable headers (via HeaderCell).
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
 *                          HeaderCell.
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
// Stable identities for omitted array props. An inline `= []` default allocates
// a fresh array on every render, which breaks the referential-equality checks
// in the memos below that list these in their dependency arrays.
const EMPTY_COLUMNS = [];
const EMPTY_ROWS = [];

export function WorklistShell({
  title,
  onHistory,
  onExport,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search by member name…',
  // Optional header override — when a caller passes their own header
  // (e.g. <SectionTitleBar variant="titleOnly" …/>), that node renders
  // in place of the built-in TabBar-style header. The shell's other
  // built-in header props (title, onHistory, onExport, search*) are then
  // ignored — the caller owns those handlers on its own header. Filter
  // chip row + table + bulk bar + pagination stay unchanged.
  header,
  showFilters,
  onToggleFilters,
  filters,
  columns = EMPTY_COLUMNS,
  sortKey,
  sortDir,
  onSort,
  rows = EMPTY_ROWS,
  renderRow,
  loading,
  emptyState,
  selectedIds = EMPTY_SELECTED_IDS,
  onSelectAll,
  onClearSelection,
  bulkActions,
  page,
  perPage,
  totalItems,
  onPageChange,
  onPageSizeChange,
  minTableWidth = 900,
  // When provided, WorklistShell handles column preferences end-to-end:
  //   • orders/filters `columns` per the user's saved prefs
  //   • injects a "Show / hide columns" button into the last column's header
  //     (typically the sticky-right "Actions" column)
  //   • passes { visibleColumns, hiddenSet } to renderRow so callers can
  //     skip hidden cells / render cells in the ordered sequence
  // Sticky columns (checkbox, sticky-left member, sticky-right actions) are
  // never reordered/hidden — they're locked in the popover.
  worklistKey,
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  // Only non-sticky columns are user-customisable. The sticky columns keep
  // their fixed position around the customisable band.
  const { customisableColumns, lockedTop, lockedBottom } = useMemo(() => {
    const top = [];
    const bot = [];
    const mid = [];
    for (const c of columns) {
      if (c.sticky === 'left' && !c.showCheckbox) top.push(c);
      else if (c.sticky === 'right') bot.push(c);
      else if (!c.showCheckbox) mid.push(c);
    }
    return {
      customisableColumns: mid,
      lockedTop: top.map(c => ({ k: c.key, lb: c.label })),
      lockedBottom: bot.map(c => ({ k: c.key, lb: c.label })),
    };
  }, [columns]);

  // `prefs` is only wired when the caller opts in with worklistKey. Otherwise
  // pass through the raw column list so existing worklists keep working.
  const prefs = useWorklistColumns(worklistKey || '__off__', customisableColumns);
  const activeCustomisable = worklistKey ? prefs.visibleColumns : customisableColumns;
  const hiddenSet = worklistKey ? prefs.hiddenSet : null;
  const orderedColumnsForRow = worklistKey
    ? [
        ...columns.filter(c => c.showCheckbox),
        ...columns.filter(c => c.sticky === 'left' && !c.showCheckbox),
        ...activeCustomisable,
        ...columns.filter(c => c.sticky === 'right'),
      ]
    : columns;

  const allIds = rows.map((r) => r.id);
  const selectedIdSet = new Set(selectedIds);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIdSet.has(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const checkboxCol = columns.find((c) => c.showCheckbox);

  const columnsToRender = orderedColumnsForRow;
  // The last sticky-right column hosts the columns button when worklistKey
  // is provided. If none, we still let the caller pass one manually via
  // their header render (existing HCC pattern).
  const actionsColKey = worklistKey
    ? [...columns].reverse().find(c => c.sticky === 'right')?.key
    : null;
  const rowCtx = { visibleColumns: activeCustomisable, hiddenSet, orderedColumns: orderedColumnsForRow };

  return (
    <div className={styles.shell}>
      {header !== undefined ? header : (
        /* Default header (mirrors src/layouts/TabBar): title as an active
           tab on the left, right-side action icons with dividers. Callers
           can pass a `header` prop (e.g. <SectionTitleBar>) to replace
           this entire block with their own chrome — pass `null` to skip
           the header entirely (e.g. when the parent already renders one). */
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
      )}

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
                {columnsToRender.map((col, idx) => {
                  const stickyStyle = col.sticky === 'left'
                    ? { position: 'sticky', left: col.left || 0, background: 'var(--neutral-0)', zIndex: 4 }
                    : col.sticky === 'right'
                    // `col.right` lets a caller stack multiple sticky-right
                    // cells (e.g. Status pinned next to Actions in the
                    // Agents table). Defaults to 0 so single-column callers
                    // keep working unchanged.
                    ? { position: 'sticky', right: col.right || 0, background: 'var(--neutral-0)', zIndex: 3 }
                    : undefined;

                  if (col.showCheckbox) {
                    return (
                      <th
                        key={col.key || idx}
                        className={`${styles.th} ${styles.thCheck}`}
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
                      // the plain <th>s in the same row. `col.sortType`
                      // drives the tooltip copy (alpha / date / number /
                      // priority / generic); default is alpha.
                      <HeaderCell
                        key={col.key || idx}
                        label={col.label}
                        sortField={col.sortKey}
                        sortType={col.sortType}
                        activeKey={sortKey}
                        activeDir={sortDir}
                        onSort={onSort}
                        align={col.align || 'left'}
                        className={styles.th}
                        style={{ ...stickyStyle, width: col.width, ...col.thStyle }}
                      />
                    );
                  }

                  // Sticky-right "Actions" column hosts the columns button
                  // whenever the caller opted into column prefs. Replaces the
                  // plain label with a { label · button } cluster so every
                  // WorklistShell caller gets the popover for free.
                  const isColumnsAnchor = worklistKey && col.key === actionsColKey;
                  return (
                    <th
                      key={col.key || idx}
                      className={styles.th}
                      // `thStyle` lets a caller give a column band its own header
                      // treatment (e.g. the TOC queue's agent columns) without a
                      // shell fork.
                      style={{ ...stickyStyle, width: col.width, textAlign: col.align || 'left', ...col.thStyle }}
                    >
                      {isColumnsAnchor ? (
                        <ColumnsHeaderButton
                          columns={prefs.orderedColumns}
                          hiddenSet={prefs.hiddenSet}
                          onToggle={prefs.onToggle}
                          onReorder={prefs.onReorder}
                          onReset={prefs.onReset}
                          label={col.thLabel ?? col.label}
                          lockedTop={lockedTop}
                          lockedBottom={lockedBottom}
                        />
                      ) : (col.thLabel ?? col.label)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && emptyState
                ? (<tr><td colSpan={columnsToRender.length}>{emptyState}</td></tr>)
                : rows.map((row, i) => renderRow(row, i, rowCtx))}
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
          perPage={perPage}
          onPageChange={onPageChange}
          onPerPageChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
