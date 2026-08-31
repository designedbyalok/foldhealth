import { Icon } from '../../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import {
  BARRIER_COLUMNS,
  withSelectColumn,
  GbiCheckboxCell,
  LinkChip,
  GbiStatusButton,
  EditableInlineTitle,
} from './carePlanTableShared';
import styles from './carePlanTables.module.css';

export function CarePlanBarriersTable({
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
  onTitleCommit,
  linkCount,
  emptyState,
}) {
  return (
    <div className={styles.tableWrap}>
      <WorklistShell
        embedded
        header={null}
        hideBulkBar
        columns={withSelectColumn(BARRIER_COLUMNS, bulkMode)}
        rows={rows}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={emptyState}
        renderRow={(b) => (
          <tr key={b.id} className={styles.row}>
            {bulkMode && (
              <GbiCheckboxCell
                checked={selectedIds.includes(b.id)}
                onToggle={() => onToggleSelect(b.id)}
                label={`Select ${b.title}`}
                disabled={!canEdit}
              />
            )}
            <td className={styles.priorityTd}>
              <button
                type="button"
                className={styles.priorityBtn}
                onClick={(e) => canEdit && onPriorityMenu({ kind: 'barrier', item: b, rect: e.currentTarget.getBoundingClientRect() })}
                disabled={!canEdit}
                aria-label="Change priority"
              >
                <PriorityIcon priority={b.priority} size={16} />
              </button>
            </td>
            <td className={styles.titleTd}>
              <div className={styles.titleCell}>
                <span className={styles.rowIcon}><Icon name="solar:shield-warning-linear" size={16} color="var(--neutral-400)" /></span>
                <span className={styles.titleMain}>
                  <EditableInlineTitle
                    title={b.title}
                    editable={canEdit}
                    onCommit={(title) => onTitleCommit(b, title)}
                  />
                </span>
                <span
                  className={`${styles.linkChipWrap} ${canEdit ? styles.linkChipClickable : ''}`}
                  onClick={() => canEdit && onLinkOwner({ kind: 'barrier', item: b })}
                >
                  <LinkChip count={linkCount(b.id)} />
                </span>
              </div>
            </td>
            <td className={styles.valueTd}>
              {b.description
                ? <span className={styles.valueText}>{b.description}</span>
                : <span className={styles.muted}>—</span>}
            </td>
            <td className={styles.statusTd}>
              <GbiStatusButton
                value={b.status}
                disabled={!canEdit}
                onOpen={rect => onStatusMenu({ kind: 'barrier', item: b, rect })}
              />
            </td>
            <td className={styles.actionsTd}>
              <ActionButton
                icon="solar:menu-dots-linear"
                size="S"
                tooltip="More"
                disabled={!canEdit}
                onClick={(e) => onRowMenu({ kind: 'barrier-menu', item: b, rect: e.currentTarget.getBoundingClientRect() })}
              />
            </td>
          </tr>
        )}
      />
    </div>
  );
}
