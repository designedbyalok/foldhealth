import { useMemo } from 'react';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { useTableSort } from '../../../../../../../components/HeaderCell/useTableSort';
import {
  GOAL_COLUMNS,
  withSelectColumn,
  GbiCheckboxCell,
  GbiNameCell,
  GbiProgressCell,
  GbiStatusButton,
} from './carePlanTableShared';
import { enrichGoalRows } from './carePlanTableSort';
import styles from './carePlanTables.module.css';

export function CarePlanGoalsTable({
  rows,
  canEdit,
  bulkMode,
  selectedIds,
  onSelectAll,
  onToggleSelect,
  onOpenGoal,
  onPriorityMenu,
  onStatusMenu,
  onRowMenu,
  linked,
  template = false,
  emptyState,
}) {
  const sortableRows = useMemo(() => enrichGoalRows(rows), [rows]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(sortableRows, 'title', 'asc');
  const columns = template
    ? GOAL_COLUMNS.filter(c => c.key === 'priority' || c.key === 'title')
    : GOAL_COLUMNS;

  return (
    <div className={styles.tableWrap}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        hideBulkBar
        columns={withSelectColumn(columns, bulkMode)}
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={emptyState}
        renderRow={(g) => (
          <tr
            key={g.id}
            className={`${styles.row} ${styles.rowClickable} ${styles.gbiRow}`}
            onClick={() => onOpenGoal(g)}
          >
            {bulkMode && (
              <GbiCheckboxCell
                checked={selectedIds.includes(g.id)}
                onToggle={() => onToggleSelect(g.id)}
                label={`Select ${g.title}`}
                disabled={!canEdit}
              />
            )}
            <td className={styles.priorityTd} onClick={e => e.stopPropagation()}>
              {canEdit ? (
                <button
                  type="button"
                  className={styles.priorityBtn}
                  onClick={(e) => onPriorityMenu({ kind: 'goal', item: g, rect: e.currentTarget.getBoundingClientRect() })}
                  aria-label="Change priority"
                >
                  <PriorityIcon priority={g.priority} size={16} />
                </button>
              ) : (
                <PriorityIcon priority={g.priority} size={16} />
              )}
            </td>
            <td className={styles.titleTd}>
              <GbiNameCell
                icon={g.icon}
                title={g.title}
                meta={g.subtitle || null}
                layout="stacked"
                linked={linked(g)}
                canEdit={canEdit}
              />
            </td>
            {!template && (
              <>
                <td className={styles.valueTd} onClick={e => e.stopPropagation()}>
                  <span className={`${styles.valueText} ${g.currentValue === 'No Data' ? styles.muted : ''}`}>
                    {g.currentValue}
                  </span>
                </td>
                <td className={styles.progressTd} onClick={e => e.stopPropagation()}>
                  <GbiProgressCell progress={g.progress} />
                </td>
                <td className={styles.statusTd} onClick={e => e.stopPropagation()}>
                  <GbiStatusButton
                    value={g.status}
                    disabled={!canEdit}
                    onOpen={rect => onStatusMenu({ kind: 'goal', item: g, rect })}
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
                    onClick={(e) => onRowMenu({ kind: 'goal-menu', item: g, rect: e.currentTarget.getBoundingClientRect() })}
                  />
                </td>
              </>
            )}
          </tr>
        )}
      />
    </div>
  );
}
