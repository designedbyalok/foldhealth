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
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { BulkSelectToggle } from '../BulkSelect/BulkSelectToggle';
import { useBulkSelect } from '../BulkSelect/useBulkSelect';
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

// Capitalise the first letter — used for the bulk-delete confirm button label.
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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
  // A node, OR — when using the built-in `bulkSelect` below — a render function
  // `(bulk) => node` that receives `{ bulkToggle, bulkActive, toggleBulk }` so
  // the caller can drop `bulk.bulkToggle` into its SectionTitleBar's
  // rightExtras. Passing a node keeps every existing caller working unchanged.
  header: headerProp,
  showFilters,
  onToggleFilters,
  filters,
  columns: columnsProp = EMPTY_COLUMNS,
  sortKey,
  sortDir,
  onSort,
  rows = EMPTY_ROWS,
  renderRow,
  loading,
  emptyState,
  selectedIds: selectedIdsProp = EMPTY_SELECTED_IDS,
  onSelectAll: onSelectAllProp,
  onClearSelection: onClearSelectionProp,
  bulkActions: bulkActionsProp,
  // Opt-in, self-contained bulk-select + bulk-delete. When provided, the shell
  // OWNS the whole interaction: a toggle button (exposed to `header` as
  // `bulk.bulkToggle`), the sticky select column (auto-injected — the caller's
  // `columns` stay bulk-agnostic), the per-row checkbox context (`ctx.bulk`
  // passed to renderRow), the floating BulkBar, and a Delete confirm dialog.
  // Shape:
  //   {
  //     onDelete: (ids) => Promise|void,   // required
  //     getRowId?: (row) => id,            // default row => row.id
  //     entityLabel?: 'agent',             // confirm-dialog copy
  //     entityLabelPlural?: 'agents',
  //     resetKey?: any,                    // reset mode+selection when it changes
  //     extraActions?: [...BulkBar actions] // besides Delete
  //   }
  // Callers that manage their own selection (QueueTable, HCC, …) simply omit
  // `bulkSelect` and keep using selectedIds / onSelectAll / bulkActions.
  bulkSelect,
  page,
  perPage,
  totalItems,
  onPageChange,
  onPageSizeChange,
  minTableWidth = 900,
  // Auto-height mode. The default shell fills its pane (flex: 1) and owns an
  // internal scroller — correct for a full-page worklist, wrong for a table
  // stacked with siblings inside a parent that already scrolls (care-gap
  // sections, pre-visit blocks). `embedded` drops the flex/overflow so the
  // table grows to its content and the parent keeps the scroll.
  embedded = false,
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

  // ── Built-in bulk-select (opt-in via the `bulkSelect` prop) ──────────────
  // The hook is always called (rules of hooks); it stays inert unless a caller
  // opts in. A caller whose toggle lives OUTSIDE the shell's header (e.g. a
  // SectionTitleBar shared across sibling tabs) can pass its own
  // `bulkSelect.controller` from useBulkSelect and render the toggle itself;
  // the shell then drives its column/bar/dialog off that shared controller.
  // Otherwise the shell owns the controller and exposes a ready toggle to a
  // render-prop `header`. `bulkActive` gates every bulk branch below.
  const internalBulk = useBulkSelect(bulkSelect?.resetKey);
  const bulk = bulkSelect?.controller || internalBulk;
  const bulkActive = !!bulkSelect && bulk.bulkMode;
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const getRowId = useMemo(() => bulkSelect?.getRowId || ((r) => r.id), [bulkSelect]);

  // Effective values — the built-in bulk state takes over the selection props
  // when `bulkSelect` is set, otherwise the caller's props pass through.
  const columns = useMemo(() => {
    if (!bulkActive) return columnsProp;
    // Inject the sticky select column and shift the caller's sticky-left
    // columns right by its width so nothing overlaps.
    return [
      { key: '__bulkSelect', showCheckbox: true, sticky: 'left', left: 0, width: 36 },
      ...columnsProp.map((c) => (c.sticky === 'left' ? { ...c, left: (c.left || 0) + 36 } : c)),
    ];
  }, [bulkActive, columnsProp]);

  const pageIds = useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const selectedIds = bulkSelect ? bulk.selectedIdList : selectedIdsProp;
  const onSelectAll = bulkSelect
    ? (checked) => bulk.setMany(pageIds, checked)
    : onSelectAllProp;
  const onClearSelection = bulkSelect ? bulk.clearSelection : onClearSelectionProp;
  const bulkActions = bulkSelect
    ? [
        { label: 'Delete', icon: 'solar:trash-bin-trash-linear', variant: 'secondary', onClick: () => setBulkDeleteOpen(true) },
        ...(bulkSelect.extraActions || []),
      ]
    : bulkActionsProp;

  // The context each row reads in renderRow to draw its own checkbox cell.
  const bulkRowCtx = bulkSelect
    ? { active: bulkActive, isSelected: (id) => bulk.isSelected(id), toggle: (id) => bulk.toggleId(id), getRowId }
    : null;

  // `header` may be a render function when bulkSelect is used, so it can place
  // the toggle in its own SectionTitleBar.
  const bulkToggle = bulkSelect ? <BulkSelectToggle active={bulk.bulkMode} onToggle={bulk.toggleBulk} /> : null;
  const header = typeof headerProp === 'function'
    ? headerProp({ bulkToggle, bulkActive: bulk.bulkMode, toggleBulk: bulk.toggleBulk })
    : headerProp;

  const handleBulkDelete = async () => {
    const ids = bulk.selectedIdList;
    if (!ids.length) { setBulkDeleteOpen(false); return; }
    setBulkDeleting(true);
    try {
      await bulkSelect.onDelete?.(ids);
    } finally {
      setBulkDeleting(false);
    }
    setBulkDeleteOpen(false);
    bulk.exitBulk();
  };

  const entity = bulkSelect?.entityLabel || 'item';
  const entityPlural = bulkSelect?.entityLabelPlural || `${entity}s`;

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
  const rowCtx = { visibleColumns: activeCustomisable, hiddenSet, orderedColumns: orderedColumnsForRow, bulk: bulkRowCtx };

  return (
    <div className={embedded ? `${styles.shell} ${styles.shellEmbedded}` : styles.shell}>
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
      <div className={embedded ? `${styles.tableScroll} ${styles.tableScrollEmbedded}` : styles.tableScroll}>
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

      {bulkSelect && bulkDeleteOpen && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={bulkSelect.confirmTitle
            ? bulkSelect.confirmTitle(bulk.count)
            : `Delete ${bulk.count} ${bulk.count === 1 ? entity : entityPlural}`}
          description={bulkSelect.confirmDescription
            || `Are you sure you want to delete the selected ${entityPlural}? This action cannot be undone.`}
          confirmLabel={`Delete ${cap(bulk.count === 1 ? entity : entityPlural)}`}
          cancelLabel="Cancel"
          variant="error"
          loading={bulkDeleting}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  );
}
