import { useMemo, useState } from 'react';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { DownChevronIcon } from '../../../../../../../components/Icon/DownChevronIcon';
import { useTableSort } from '../../../../../../../components/HeaderCell/useTableSort';
import {
  BARRIER_COLUMNS,
  withSelectColumn,
  GbiCheckboxCell,
  GbiNameCell,
  GbiStatusButton,
  isClosedBarrier,
  GBI_COL_WIDTH,
} from './carePlanTableShared';
import styles from './carePlanTables.module.css';

function BarrierRow({
  barrier: b,
  bulkMode,
  selectedIds,
  canEdit,
  onToggleSelect,
  onStatusMenu,
  onRowMenu,
  onOpenBarrier,
  linked,
  template,
}) {
  return (
    <tr
      key={b.id}
      className={`${styles.row} ${styles.gbiRow} ${onOpenBarrier ? styles.rowClickable : ''}`}
      onClick={() => onOpenBarrier?.(b)}
    >
      {bulkMode && (
        <GbiCheckboxCell
          checked={selectedIds.includes(b.id)}
          onToggle={() => onToggleSelect(b.id)}
          label={`Select ${b.title}`}
          disabled={!canEdit}
        />
      )}
      <td className={styles.priorityTd} aria-hidden="true" />
      <td className={styles.titleTd}>
        <GbiNameCell
          icon="custom:barrier"
          title={b.title}
          meta={b.description || null}
          linked={linked(b)}
          canEdit={canEdit}
        />
      </td>
      {!template && (
        <>
          <td className={styles.barrierStatusTd} onClick={e => e.stopPropagation()}>
            <GbiStatusButton
              value={b.status}
              disabled={!canEdit}
              onOpen={rect => onStatusMenu({ kind: 'barrier', item: b, rect })}
            />
          </td>
          <td className={styles.actionsTd} onClick={e => e.stopPropagation()}>
            <ActionButton
              icon="solar:menu-dots-linear"
              size="S"
              tooltip="More"
              tooltipBelow
              tooltipLeft
              disabled={!canEdit}
              onClick={(e) => onRowMenu({ kind: 'barrier-menu', item: b, rect: e.currentTarget.getBoundingClientRect() })}
            />
          </td>
        </>
      )}
    </tr>
  );
}

export function CarePlanBarriersTable({
  rows,
  canEdit,
  bulkMode,
  selectedIds,
  onSelectAll,
  onToggleSelect,
  onStatusMenu,
  onRowMenu,
  onOpenBarrier,
  linked,
  template = false,
  emptyState,
}) {
  const [closedOpen, setClosedOpen] = useState(false);
  // Bridge for pre-migration data: consolidate title-clone barrier rows
  // into a single logical row whose `goalIds` merges every clone's
  // goal_id. Post-migration each barrier is already unique per title,
  // so this pass is a no-op then.
  const consolidatedRows = useMemo(() => {
    const groups = new Map();
    for (const row of (rows || [])) {
      const key = (row.title || '').trim().toLowerCase();
      const existing = groups.get(key);
      const rowGoalIds = Array.isArray(row.goalIds) && row.goalIds.length > 0
        ? row.goalIds
        : (row.goalId ? [row.goalId] : []);
      if (!existing) {
        groups.set(key, { ...row, goalIds: [...new Set(rowGoalIds)] });
      } else {
        // Prefer the oldest row's id as the canonical id (matches the
        // migration's keep-the-oldest strategy).
        const keepOlder = new Date(existing.createdAt || 0) <= new Date(row.createdAt || 0);
        groups.set(key, {
          ...(keepOlder ? existing : row),
          goalIds: [...new Set([...(existing.goalIds || []), ...rowGoalIds])],
        });
      }
    }
    return Array.from(groups.values());
  }, [rows]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(consolidatedRows, 'title', 'asc');
  const columns = template
    ? BARRIER_COLUMNS.filter(c => c.key === 'priority' || c.key === 'title')
    : BARRIER_COLUMNS;

  const { openRows, closedRows } = useMemo(() => {
    const open = [];
    const closed = [];
    for (const row of sorted) {
      if (isClosedBarrier(row.status)) closed.push(row);
      else open.push(row);
    }
    return { openRows: open, closedRows: closed };
  }, [sorted]);

  return (
    <div className={styles.tableWrap}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        hideBulkBar
        columns={withSelectColumn(columns, bulkMode)}
        rows={openRows}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={openRows.length === 0 && closedRows.length === 0 ? emptyState : null}
        renderRow={(b) => (
          <BarrierRow
            barrier={b}
            bulkMode={bulkMode}
            selectedIds={selectedIds}
            canEdit={canEdit}
            onToggleSelect={onToggleSelect}
            onStatusMenu={onStatusMenu}
            onRowMenu={onRowMenu}
            onOpenBarrier={onOpenBarrier}
            linked={linked}
            template={template}
          />
        )}
      />
      {closedRows.length > 0 && (
        <div className={styles.closedBarriers}>
          <button
            type="button"
            className={styles.closedBarriersToggle}
            onClick={() => setClosedOpen(v => !v)}
            aria-expanded={closedOpen}
          >
            <DownChevronIcon
              size={6}
              color="var(--neutral-300)"
              className={`${styles.closedBarriersChevron} ${closedOpen ? '' : styles.closedBarriersChevronClosed}`}
            />
            <span className={styles.closedBarriersLabel}>Closed Barriers</span>
          </button>
          {closedOpen && (
            <table className={styles.closedBarriersTable}>
              <colgroup>
                <col style={{ width: GBI_COL_WIDTH.priority }} />
                <col />
                {!template && <col style={{ width: GBI_COL_WIDTH.status }} />}
                {!template && <col style={{ width: GBI_COL_WIDTH.actions }} />}
              </colgroup>
              <tbody>
                {closedRows.map(b => (
                  <BarrierRow
                    key={b.id}
                    barrier={b}
                    bulkMode={bulkMode}
                    selectedIds={selectedIds}
                    canEdit={canEdit}
                    onToggleSelect={onToggleSelect}
                            onStatusMenu={onStatusMenu}
                    onRowMenu={onRowMenu}
                    onOpenBarrier={onOpenBarrier}
                    linked={linked}
                    template={template}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
