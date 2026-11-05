import { useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { AssigneeChange } from '../../../../../../../../components/AssigneeChange/AssigneeChange';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { Tooltip } from '../../../../../../../../components/Tooltip/Tooltip';
import { DatePickerPopover } from '../../../../../../../../components/DatePicker/DatePickerPopover';
import { RepeatEditor } from '../../../../../../../../components/RepeatEditor/RepeatEditor';
import { GbiStatusButton } from '../../tables/carePlanTableShared';
import { GbiLinkButton } from '../../tables/CarePlanLinkedPreview';
import { computeDueDate, computeOccurrenceDates, formatRecurrenceLabel } from '../../tables/CarePlanInterventionsTable';
import styles from './GoalPreviewDrawer.module.css';

/**
 * Linked interventions inside the Goal Details drawer.
 *
 * Row shape borrowed from BarrierDetailDrawer's Linked Goals list:
 *   [ icon ]  [ title / subtitle ]  [ priority | assignee | status | unlink | more ]
 *
 * The subtitle carries the intervention's Due Date (inline editable
 * via a DatePickerPopover) and, when the intervention repeats, a
 * recurring glyph with a hover tooltip explaining the cadence.
 */
export function GoalLinkedInterventionsList({
  interventions,
  canEdit,
  platformUsers,
  patient,
  onOpen,
  onPriorityMenu,
  onAssigneeChange,
  onStatusMenu,
  onDueDateChange,
  onRecurrenceChange,
  onRowMenu,
}) {
  // Shared inline due-date popover state: one anchor at a time so
  // opening a different row's date button dismisses the previous one.
  const [duePicker, setDuePicker] = useState(null); // { intv, rect } | null
  const commitDueDate = (iso) => {
    if (duePicker?.intv && onDueDateChange) onDueDateChange(duePicker.intv, iso);
    setDuePicker(null);
  };

  return (
    <ul className={styles.intvLinkList}>
      {interventions.map((i) => {
        // Patient tasks: every intervention kind except internal-task
        // is owned by the patient: pre-populate the assignee.
        const isMemberTask = i.kind !== 'internal-task';
        const rawName = i.assignee?.name || '';
        const rawInitials = i.assignee?.initials || '';
        const effectiveName = isMemberTask ? (patient?.name || rawName) : rawName;
        const effectiveInitials = isMemberTask ? (patient?.initials || rawInitials) : rawInitials;
        const isUnassigned = !isMemberTask
          && (!effectiveName || effectiveName === 'Unassigned');
        const due = computeDueDate(i);
        const dueLabel = due.formatted || 'Set due date';
        const isRecurring = !!i.config?.repeat;
        const editableDue = canEdit && !!onDueDateChange;
        return (
          <li
            key={i.id}
            className={styles.intvLinkRow}
          >
            <span className={styles.intvLinkIcon}>
              <Icon name={i.icon || 'solar:clipboard-list-linear'} size={16} color="var(--neutral-400)" />
            </span>
            <div className={styles.intvLinkStack}>
              <button type="button" className={styles.intvLinkTitle} onClick={() => onOpen?.(i)}>
                {i.title}
              </button>
              <span
                className={styles.intvLinkSubtitle}
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                {editableDue ? (
                  <button
                    type="button"
                    className={styles.intvDueBtn}
                    onClick={(e) => setDuePicker({ intv: i, rect: e.currentTarget.getBoundingClientRect() })}
                    aria-label={due.iso ? `Change due date (${dueLabel})` : 'Set due date'}
                  >
                    Due {dueLabel}
                  </button>
                ) : (
                  <span>Due {dueLabel}</span>
                )}
                {isRecurring && (
                  <Tooltip label={formatRecurrenceLabel(i)}>
                    <span aria-label={formatRecurrenceLabel(i)} style={{ display: 'inline-flex' }}>
                      <Icon name="solar:refresh-linear" size={14} color="var(--neutral-300)" />
                    </span>
                  </Tooltip>
                )}
              </span>
            </div>
            <div
              className={styles.intvLinkActions}
              style={{ gap: 'var(--space-2)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.intvPriorityBtn}
                aria-label="Change priority"
                disabled={!canEdit}
                onClick={(e) => canEdit && onPriorityMenu?.({ kind: 'intv', item: i, rect: e.currentTarget.getBoundingClientRect() })}
              >
                <PriorityIcon priority={i.priority} size={16} />
              </button>
              <span className={styles.intvLinkActionsDivider} aria-hidden style={{ margin: 0 }} />
              <AssigneeChange
                size="S"
                avatarOnly
                name={effectiveName}
                initials={effectiveInitials}
                unassigned={isUnassigned}
                users={platformUsers}
                avatarVariant={isMemberTask ? 'patient' : undefined}
                pickerTitle="Change assignee"
                onSelect={(u) => onAssigneeChange?.(i, u)}
                disabled={!canEdit || isMemberTask}
              />
              {(i.linkedPreview?.goals?.length || 0) > 0 && (
                <>
                  <span className={styles.intvLinkActionsDivider} aria-hidden style={{ margin: 0 }} />
                  <GbiLinkButton data={i.linkedPreview} />
                </>
              )}
              <span className={styles.intvLinkActionsDivider} aria-hidden style={{ margin: 0 }} />
              <GbiStatusButton
                value={i.status || 'Not Started'} reason={i.statusReason}
                disabled={!canEdit}
                onOpen={(rect) => onStatusMenu?.({ kind: 'intv', item: i, rect })}
              />
              <span className={styles.intvLinkActionsDivider} aria-hidden style={{ margin: 0 }} />
              <ActionButton
                icon="solar:menu-dots-linear"
                size="sm"
                tooltip="More"
                disabled={!onRowMenu}
                onClick={(e) => onRowMenu?.({ item: i, rect: e.currentTarget.getBoundingClientRect() })}
              />
            </div>
          </li>
        );
      })}
      {/* Shared inline due-date picker: identical config to the one
          rendered by the intervention Due Date cell in the plan table
          (see CarePlanInterventionsTable). RepeatEditor footer,
          highlighted future occurrences, and ISO-day value all mirror
          that surface so both pickers behave the same. */}
      {duePicker && (
        <DatePickerPopover
          open
          anchorRect={duePicker.rect}
          value={(() => {
            const iso = computeDueDate(duePicker.intv).iso;
            if (!iso) return null;
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return null;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          })()}
          onChange={commitDueDate}
          onClose={() => setDuePicker(null)}
          highlightedDates={computeOccurrenceDates(duePicker.intv)}
          footer={(
            <RepeatEditor
              value={{
                repeat: !!duePicker.intv?.config?.repeat,
                repeatCount: duePicker.intv?.config?.repeatCount ?? '1',
                repeatEvery: duePicker.intv?.config?.repeatEvery ?? '1',
                repeatEveryUnit: duePicker.intv?.config?.repeatEveryUnit || 'Weeks',
                repeatEnds: duePicker.intv?.config?.repeatEnds ?? '0',
                repeatEndsUnit: duePicker.intv?.config?.repeatEndsUnit || 'Days',
              }}
              onChange={(next) => {
                if (onRecurrenceChange) onRecurrenceChange(duePicker.intv, next);
                setDuePicker(prev => prev ? ({
                  ...prev,
                  intv: {
                    ...prev.intv,
                    config: { ...(prev.intv.config || {}), ...next },
                  },
                }) : prev);
              }}
            />
          )}
        />
      )}
    </ul>
  );
}
