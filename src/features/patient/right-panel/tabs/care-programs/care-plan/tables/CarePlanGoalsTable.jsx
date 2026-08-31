import { Icon } from '../../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import {
  GOAL_COLUMNS,
  withSelectColumn,
  GbiCheckboxCell,
  LinkChip,
  GoalProgressCell,
  TrendCell,
  GbiStatusButton,
} from './carePlanTableShared';
import styles from './carePlanTables.module.css';

function GoalTitle({ title, subtitle }) {
  return (
    <span className={styles.titleText}>
      <span className={styles.title}>{title}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </span>
  );
}

export function CarePlanGoalsTable({
  rows,
  canEdit,
  bulkMode,
  selectedIds,
  onSelectAll,
  onToggleSelect,
  onOpenGoal,
  onPriorityMenu,
  onLinkOwner,
  onStatusMenu,
  onRowMenu,
  linkCount,
  emptyState,
}) {
  return (
    <div className={styles.tableWrap}>
      <WorklistShell
        embedded
        header={null}
        hideBulkBar
        columns={withSelectColumn(GOAL_COLUMNS, bulkMode)}
        rows={rows}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={emptyState}
        renderRow={(g) => (
          <tr
            key={g.id}
            className={`${styles.row} ${styles.rowClickable}`}
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
              <button
                type="button"
                className={styles.priorityBtn}
                onClick={(e) => canEdit && onPriorityMenu({ kind: 'goal', item: g, rect: e.currentTarget.getBoundingClientRect() })}
                disabled={!canEdit}
                aria-label="Change priority"
              >
                <PriorityIcon priority={g.priority} size={16} />
              </button>
            </td>
            <td className={styles.titleTd}>
              <div className={styles.titleCell}>
                <span className={styles.rowIcon}><Icon name={g.icon} size={16} color="var(--neutral-400)" /></span>
                <span className={styles.titleMain}>
                  <GoalTitle title={g.title} subtitle={g.subtitle} />
                </span>
                <span
                  className={`${styles.linkChipWrap} ${canEdit ? styles.linkChipClickable : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canEdit) onLinkOwner({ kind: 'goal', item: g });
                  }}
                >
                  <LinkChip count={linkCount(g.id)} />
                </span>
              </div>
            </td>
            <td className={styles.valueTd} onClick={e => e.stopPropagation()}>
              <span className={`${styles.valueText} ${g.currentValue === 'No Data' ? styles.muted : ''}`}>
                {g.currentValue}
              </span>
            </td>
            <td className={styles.trendTd} onClick={e => e.stopPropagation()}>
              <TrendCell trend={g.trend} />
            </td>
            <td className={styles.progressTd} onClick={e => e.stopPropagation()}>
              <GoalProgressCell progress={g.progress} />
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
                disabled={!canEdit}
                onClick={(e) => onRowMenu({ kind: 'goal-menu', item: g, rect: e.currentTarget.getBoundingClientRect() })}
              />
            </td>
          </tr>
        )}
      />
    </div>
  );
}
