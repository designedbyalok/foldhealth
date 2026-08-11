import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { CheckboxTick } from '../../components/CheckboxTick/CheckboxTick';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Avatar } from '../../components/Avatar/Avatar';
import { useAppStore } from '../../store/useAppStore';
import { toast } from '../../components/Toast/sonnerToast';
import {
  STATUS_ORDER, STATUS_LABELS, STATUS_BADGE_VARIANTS, PRIORITY_ORDER, PRIORITY_LABELS,
  getInitials, isOverdue, formatDateFriendly, PAGE_SIZE,
} from './TasksView.utils';
import { SubtaskIcon, PriorityIcon } from './TasksViewIcons';
import { TaskDatePicker } from './TasksViewDropdowns';
import styles from './TasksView.module.css';

export function RowLabelDropdown({ task, children }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  const taskLabels = useAppStore(s => s.taskLabels);
  const createTaskLabel = useAppStore(s => s.createTaskLabel);
  const labels = Array.isArray(task.labels) ? task.labels : [];
  const labelSet = useMemo(() => new Set(labels), [labels]);
  const filtered = taskLabels.filter(l => !search || l.toLowerCase().includes(search.toLowerCase()));
  const exact = taskLabels.find(l => l.toLowerCase() === search.trim().toLowerCase());
  const canCreate = search.trim() && !exact;

  const toggle = (l) => {
    const next = labels.includes(l) ? labels.filter(x => x !== l) : [...labels, l];
    updateTask(task.id, { labels: next });
    showToast(labels.includes(l) ? `Label "${l}" removed` : `Label "${l}" added`);
  };

  const handleCreate = async () => {
    const created = await createTaskLabel(search.trim());
    if (created) {
      showToast(`Label "${created}" created`);
      const next = [...labels, created];
      updateTask(task.id, { labels: next });
      setSearch('');
    }
  };

  return (
    <div ref={btnRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
      {children || (
        <button className={styles.addLabel}>
          <Icon name="solar:tag-linear" size={13} color="var(--neutral-200)" />
          Add Label
        </button>
      )}
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setOpen(false); setSearch(''); }}>
          <div
            className={styles.simpleDropdown}
            style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.dropdownSearch}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input
                className={styles.dropdownSearchInput}
                placeholder="Search or create..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
                autoFocus
              />
            </div>
            {filtered.map(l => (
              <button key={l} type="button" role="menuitemcheckbox" aria-checked={labelSet.has(l)} className={styles.simpleDropItem} onClick={() => toggle(l)}>
                <CheckboxTick checked={labelSet.has(l)} size={15} />
                {l}
              </button>
            ))}
            {canCreate && (
              <button className={styles.simpleDropItem} style={{ color: 'var(--primary-300)', fontWeight: 500 }} onClick={handleCreate}>
                <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
                Create "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <div className={styles.simpleDropItem} style={{ color: 'var(--neutral-200)', cursor: 'default' }}>No results</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Three-dot Action Menu for rows and kanban cards ── */
import { RowActionMenu, RowStatusDropdown, RowAssignDropdown } from './TasksViewRowDropdowns';
export function SkeletonRow() {
  return (
    <div className={styles.taskRow}>
      <div className={styles.cellCheck}>
        <div className={`${styles.skeleton} ${styles.skeletonCircle}`} />
      </div>
      <div className={styles.cellTask}>
        <div className={styles.taskInfo}>
          <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '70%' }} />
          <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '40%', height: 10 }} />
        </div>
      </div>
      <div className={styles.cellP}>
        <div className={`${styles.skeleton} ${styles.skeletonSmall}`} />
      </div>
      <div className={styles.cellStatus}>
        <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
      </div>
      <div className={styles.cellDue}>
        <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '80%' }} />
      </div>
      <div className={styles.cellMember}>
        <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '60%' }} />
      </div>
      <div className={styles.cellLabels}>
        <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
      </div>
    </div>
  );
}

/* ── List View: Task Row ── */
export function TaskRow({ task, onToggle, onTaskClick, hideAssignedTo, hideMember, pinnedEnds }) {
  const isCompleted = task.status === 'completed';
  const labels = Array.isArray(task.labels) ? task.labels : [];
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);

  return (
    <div className={styles.taskRow} onClick={() => onTaskClick?.(task)}>
      <div className={`${styles.cellCheck} ${pinnedEnds ? styles.pinLeft0 : ''}`}>
        <button
          className={`${styles.taskCheckbox} ${isCompleted ? styles.taskCheckboxChecked : ''}`}
          onClick={e => { e.stopPropagation(); onToggle(task); }}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          <span className={styles.taskCheckIcon}>
            <Icon name="solar:check-read-linear" size={13} color="var(--neutral-0)" />
          </span>
        </button>
      </div>

      <div className={`${styles.cellTask} ${pinnedEnds ? styles.pinLeftCheck : ''}`}>
        <div className={styles.taskInfo}>
          {task.parent_task && (
            <span className={styles.parentLabel}>Parent Task : {task.parent_task}</span>
          )}
          {task.is_subtask ? (
            <div className={styles.subtaskRow}>
              <SubtaskIcon size={14} color="var(--primary-300)" />
              <span className={`${styles.taskName} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>
            </div>
          ) : (
            <span className={`${styles.taskName} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>
          )}
          <span className={styles.taskMeta}>
            {`By : ${task.created_by?.trim() || 'System Automation'}${task.meta ? ` • ${task.meta}` : ''}`}
          </span>
        </div>
        <div className={styles.taskAttachments}>
          {task.attachments > 0 && (
            <span className={styles.attachBadge}>
              <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
              {task.attachments}
            </span>
          )}
          {task.comments > 0 && (
            <span className={styles.attachBadge}>
              <Icon name="solar:chat-round-line-linear" size={14} color="var(--neutral-300)" />
              {task.comments}
            </span>
          )}
        </div>
      </div>

      <div className={styles.cellP}>
        <PriorityIcon priority={task.priority} size={16} />
      </div>

      <div className={styles.cellStatus} onClick={e => e.stopPropagation()}>
        <RowStatusDropdown task={task} />
      </div>

      <div className={`${styles.cellDue} ${isOverdue(task) ? styles.dueMissed : ''}`} onClick={e => e.stopPropagation()}>
        <TaskDatePicker value={task.due_date} overdue={isOverdue(task)} onSelect={v => { updateTask(task.id, { due_date: v }); showToast('Due date updated'); }} />
      </div>

      {!hideAssignedTo && (
        <div className={styles.cellAssigned} onClick={e => e.stopPropagation()}>
          <RowAssignDropdown task={task} />
        </div>
      )}

      {!hideMember && (
        <div className={styles.cellMember}>
          <Icon name="solar:user-linear" size={14} color="var(--neutral-300)" />
          <button
            type="button"
            className={styles.memberLink}
            onClick={(e) => {
              e.stopPropagation();
              const state = useAppStore.getState();
              const match = state.patients.find(p => p.name === task.member)
                || (state.allPatients || []).find(p => p.name === task.member);
              if (match) state.openQuickView(match);
            }}
          >
            {task.member}
          </button>
        </div>
      )}

      <div className={styles.cellLabels} onClick={e => e.stopPropagation()}>
        <RowLabelDropdown task={task}>
          {labels.length > 0 ? (
            <>
              {labels.slice(0, 2).map(l => (
                <Badge key={l} variant="overflow" label={l} />
              ))}
              {labels.length > 2 && (
                <span className={styles.labelOverflow} title={labels.slice(2).join(', ')}>+{labels.length - 2}</span>
              )}
            </>
          ) : (
            <button className={styles.addLabel}>
              <Icon name="solar:tag-linear" size={13} color="var(--neutral-200)" />
              Add Label
            </button>
          )}
        </RowLabelDropdown>
      </div>

      <div className={`${styles.cellActions} ${pinnedEnds ? styles.pinRight0 : ''}`} onClick={e => e.stopPropagation()}>
        <RowActionMenu task={task} />
      </div>
    </div>
  );
}

/* ── List View: Status Group ── */

export { StatusGroup } from './TasksViewStatusGroup';

