import { useMemo } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { AssigneeChange } from '../../../../../../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import {
  INTERVENTION_COLUMNS,
  withSelectColumn,
  GbiCheckboxCell,
  LinkChip,
  GoalProgressCell,
  GbiStatusButton,
} from './carePlanTableShared';
import styles from './carePlanTables.module.css';

export function CarePlanInterventionsTable({
  rows,
  canEdit,
  bulkMode,
  selectedIds,
  onSelectAll,
  onToggleSelect,
  onPriorityMenu,
  onLinkOwner,
  onStatusMenu,
  onRowMenu,
  onOpenIntervention,
  onAssigneeChange,
  linkCount,
  platformUsers,
  emptyState,
}) {
  // Bulk mode injects the shared checkbox column (with WorklistShell's built-in
  // select-all header checkbox). The actions header keeps its table-settings
  // affordance.
  const columns = useMemo(() => {
    const base = INTERVENTION_COLUMNS.map((col) => (col.key === 'actions'
      ? {
          ...col,
          thLabel: (
            <ActionButton
              icon="custom:filter"
              size="S"
              tooltip="Table settings"
              disabled
              aria-label="Table settings"
            />
          ),
        }
      : col));
    return withSelectColumn(base, bulkMode);
  }, [bulkMode]);

  return (
    <div className={styles.tableWrap}>
      <WorklistShell
        embedded
        header={null}
        hideBulkBar
        columns={columns}
        rows={rows}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={emptyState}
        renderRow={(i) => {
          const adherence = Number(i.adherence);
          const showAdherence = Number.isFinite(adherence) && i.adherence !== '-';
          return (
            <tr
              key={i.id}
              className={`${styles.row} ${styles.rowClickable} ${styles.intvRow}`}
              onClick={() => onOpenIntervention(i)}
            >
              {bulkMode && (
                <GbiCheckboxCell
                  checked={selectedIds.includes(i.id)}
                  onToggle={() => onToggleSelect(i.id)}
                  label={`Select ${i.title}`}
                  disabled={!canEdit}
                />
              )}
              <td className={styles.priorityTd} onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  className={styles.priorityBtn}
                  onClick={(e) => canEdit && onPriorityMenu({ kind: 'intv', item: i, rect: e.currentTarget.getBoundingClientRect() })}
                  disabled={!canEdit}
                  aria-label="Change priority"
                >
                  <PriorityIcon priority={i.priority} size={16} />
                </button>
              </td>
              <td className={styles.titleTd}>
                <div className={styles.intvNameCell}>
                  <span className={styles.rowIcon}>
                    <Icon name={i.icon} size={16} color="var(--neutral-400)" />
                  </span>
                  <div className={styles.intvTitleStack}>
                    <span className={styles.title}>{i.title}</span>
                    {i.duration && (
                      <Badge
                        className={styles.intvDurationBadge}
                        tone="grey"
                        size="S"
                        label={i.duration}
                        icon="solar:clock-circle-linear"
                        trailingIcon="solar:refresh-linear"
                      />
                    )}
                  </div>
                  <span
                    className={`${styles.linkChipWrap} ${canEdit ? styles.linkChipClickable : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) onLinkOwner({ kind: 'intervention', item: i });
                    }}
                  >
                    <LinkChip count={linkCount(i.id)} />
                  </span>
                </div>
              </td>
              <td className={styles.assigneeTd} onClick={e => e.stopPropagation()}>
                <AssigneeChange
                  size="S"
                  fillContainer
                  nameMuted
                  name={i.assignee.name}
                  initials={i.assignee.initials}
                  showRole={false}
                  unassigned={i.assignee.name === 'Unassigned'}
                  unassignedLabel="Unassigned"
                  users={platformUsers}
                  pickerTitle="Change assignee"
                  onSelect={(u) => onAssigneeChange(i, u)}
                  disabled={!canEdit}
                />
              </td>
              <td className={styles.adherenceTd} onClick={e => e.stopPropagation()}>
                {showAdherence ? <GoalProgressCell progress={adherence} /> : <span className={styles.trendDash}>—</span>}
              </td>
              <td className={styles.statusTd} onClick={e => e.stopPropagation()}>
                <GbiStatusButton
                  value={i.status}
                  badgeSize="M"
                  disabled={!canEdit}
                  onOpen={rect => onStatusMenu({ kind: 'intv', item: i, rect })}
                />
              </td>
              <td className={styles.actionsTd} onClick={e => e.stopPropagation()}>
                <ActionButton
                  icon="solar:menu-dots-linear"
                  size="S"
                  tooltip="More"
                  disabled={!canEdit}
                  onClick={(e) => onRowMenu({ kind: 'intv-menu', item: i, rect: e.currentTarget.getBoundingClientRect() })}
                />
              </td>
            </tr>
          );
        }}
      />
    </div>
  );
}
