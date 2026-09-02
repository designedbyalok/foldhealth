import { useMemo } from 'react';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { AssigneeChange } from '../../../../../../../components/AssigneeChange/AssigneeChange';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { useTableSort } from '../../../../../../../components/HeaderCell/useTableSort';
import {
  INTERVENTION_COLUMNS,
  withSelectColumn,
  GbiCheckboxCell,
  GbiNameCell,
  GbiProgressCell,
  GbiStatusButton,
} from './carePlanTableShared';
import { enrichInterventionRows } from './carePlanTableSort';
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
  linked,
  platformUsers,
  emptyState,
}) {
  const columns = useMemo(() => {
    const base = INTERVENTION_COLUMNS.map((col) => (col.key === 'actions'
      ? {
          ...col,
          thLabel: (
            <ActionButton
              icon="custom:filter"
              size="S"
              tooltip="Table settings"
              tooltipBelow
              tooltipLeft
              disabled
              aria-label="Table settings"
            />
          ),
        }
      : col));
    return withSelectColumn(base, bulkMode);
  }, [bulkMode]);

  const sortableRows = useMemo(() => enrichInterventionRows(rows), [rows]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(sortableRows, 'title', 'asc');

  return (
    <div className={styles.tableWrap}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        hideBulkBar
        columns={columns}
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={emptyState}
        renderRow={(i) => (
            <tr
              key={i.id}
              className={`${styles.row} ${styles.rowClickable} ${styles.gbiRow}`}
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
                <GbiNameCell
                  icon={i.icon}
                  title={i.title}
                  meta={i.duration || null}
                  linked={linked(i)}
                  canEdit={canEdit}
                  onLinkClick={() => onLinkOwner({ kind: 'intervention', item: i })}
                />
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
                <GbiProgressCell progress={i.adherence} />
              </td>
              <td className={styles.statusTd} onClick={e => e.stopPropagation()}>
                <GbiStatusButton
                  value={i.status}
                  disabled={!canEdit}
                  onOpen={rect => onStatusMenu({ kind: 'intv', item: i, rect })}
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
                  onClick={(e) => onRowMenu({ kind: 'intv-menu', item: i, rect: e.currentTarget.getBoundingClientRect() })}
                />
              </td>
            </tr>
        )}
      />
    </div>
  );
}
