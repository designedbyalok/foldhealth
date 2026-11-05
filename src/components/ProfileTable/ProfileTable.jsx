import { WorklistShell } from '../WorklistShell/WorklistShell';
import styles from './ProfileTable.module.css';

/**
 * A table inside a patient profile tab (Gaps, PAMI/Hx, Vitals/Labs): the
 * app's WorklistShell embedded with no header bar, outer border or scroller,
 * so it sits in its section and pickers inside cells open in full.
 *
 * With `firstColumnDivider`, a worklist divider follows the first column
 * (header included). The last row drops its divider so stacked sections
 * don't double up.
 *
 * @param {object[]} props.columns   – WorklistShell column defs ({ key, label, width? })
 * @param {object[]} props.rows
 * @param {function} props.renderRow – (row) => <tr>; use profileRowClass and
 *   profileCellClass (profileTableClasses.js) for the shared row and cell styles
 * @param {boolean}  [props.firstColumnDivider=false]
 * @param {string}   [props.className]
 * @param {Array}    [props.selectedIds]  – with a `showCheckbox` column: the
 *   checked row ids, driving the header's select-all checkbox
 * @param {function} [props.onSelectAll]  – (checked) => void, from that checkbox
 * @param {React.ReactNode} [props.emptyState] – shown in place of rows when there are none
 * @param {string}   [props.sortKey]  – with columns that set `sortKey`: the active sort field
 * @param {'asc'|'desc'} [props.sortDir]
 * @param {function} [props.onSort]   – (sortField) => void; makes those headers sortable
 */
export function ProfileTable({ columns, rows, renderRow, firstColumnDivider = false, className, selectedIds, onSelectAll, emptyState, sortKey, sortDir, onSort }) {
  return (
    <div className={[styles.root, firstColumnDivider ? styles.divided : '', className].filter(Boolean).join(' ')}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        minTableWidth={0}
        columns={columns}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        rows={rows}
        renderRow={renderRow}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        emptyState={emptyState}
        hideBulkBar
      />
    </div>
  );
}
