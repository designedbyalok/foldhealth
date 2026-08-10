import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import {
  useDroppable,
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  pointerWithin,
  closestCenter,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../../components/Icon/Icon';
import { Badge } from '../../components/Badge/Badge';
import { Avatar } from '../../components/Avatar/Avatar';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { toast } from '../../components/Toast/sonnerToast';
import { useAppStore } from '../../store/useAppStore';
import { STATUS_LABELS, STATUS_BADGE_VARIANTS, PRIORITY_COLORS, isOverdue, formatDateFriendly } from './TasksView.utils';
import { PriorityIcon, SubtaskIcon } from './TasksViewIcons';
import { RowActionMenu } from './TasksViewRowDropdowns';
import styles from './TasksView.module.css';

export function KanbanCardContent({ task }) {
  const isCompleted = task.status === 'completed';
  const labels = Array.isArray(task.labels) ? task.labels : [];
  const memberInitials = task.member ? task.member.split(' ').map(w => w[0]).join('').slice(0, 2) : '';
  const assigneeInitials = task.assigned_to ? task.assigned_to.split(' ').map(w => w[0]).join('').slice(0, 2) : '';

  return (
    <>
      {/* Left priority color bar */}
      <div className={styles.cardBar}>
        <div
          className={styles.cardBarInner}
          style={{ background: PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.none }}
        />
      </div>

      {/* Card body */}
      <div className={styles.cardBody}>
        {/* Row 1: Priority icon + due date + checkbox */}
        <div className={styles.cardTop}>
          <div className={styles.cardTopLeft}>
            <PriorityIcon priority={task.priority} size={16} />
            <span className={`${styles.cardDue} ${isOverdue(task) ? styles.cardDueMissed : ''}`}>
              Due : {formatDateFriendly(task.due_date) === 'Today' || formatDateFriendly(task.due_date) === 'Tomorrow' || formatDateFriendly(task.due_date) === 'Yesterday' ? formatDateFriendly(task.due_date) : task.due_date}
            </span>
          </div>
          <button
            className={`${styles.taskCheckbox} ${isCompleted ? styles.taskCheckboxChecked : ''}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            <span className={styles.taskCheckIcon}>
            <Icon name="solar:check-read-linear" size={13} color="var(--neutral-0)" />
          </span>
          </button>
        </div>

        {/* Row 2: Parent task (if subtask) */}
        {task.is_subtask && task.parent_task && (
          <span className={styles.cardParent}>
            <SubtaskIcon size={12} color="var(--primary-300)" />
            {task.parent_task}
          </span>
        )}

        {/* Row 3: Task title */}
        <span className={`${styles.cardTitle} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>

        {/* Row 4: Labels */}
        {labels.length > 0 && (
          <div className={styles.cardLabels}>
            {labels.map(l => (
              <Badge key={l} variant="overflow" label={l} />
            ))}
          </div>
        )}

        {/* Row 5: Member (patient) + Assigned to (staff) */}
        <div className={styles.cardPeople}>
          <div className={styles.cardPerson}>
            <Avatar variant="patient" initials={memberInitials} className={styles.avatarXs} />
            <span
              className={`${styles.personName} ${styles.memberLink}`}
              onClick={(e) => {
                e.stopPropagation();
                const state = useAppStore.getState();
                const match = state.patients.find(p => p.name === task.member)
                  || (state.allPatients || []).find(p => p.name === task.member);
                if (match) state.openQuickView(match);
              }}
            >
              {task.member}
            </span>
            <Icon name="solar:arrow-right-up-linear" size={16} color="var(--neutral-200)" />
          </div>
          {task.assigned_to && (
            <div className={styles.cardPerson}>
              <Avatar variant="assignee" initials={assigneeInitials} className={styles.avatarXs} />
              <span className={styles.personName}>{task.assigned_to}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={styles.cardDivider} />

        {/* Row 6: Meta + linked counts */}
        <div className={styles.cardFooterRow}>
          <span className={styles.cardFooterMeta}>
            {`By : ${task.created_by?.trim() || 'System Automation'}${task.meta ? ` • ${task.meta}` : ''}`}
          </span>
          <div className={styles.cardLinked}>
            {task.is_subtask && (
              <span className={styles.linkedItem}>
                <SubtaskIcon size={16} color="var(--primary-300)" />
                1
              </span>
            )}
            {task.attachments > 0 && (
              <span className={styles.linkedItem}>
                <Icon name="solar:paperclip-linear" size={16} color="var(--neutral-300)" />
                {task.attachments}
              </span>
            )}
            {task.comments > 0 && (
              <span className={styles.linkedItem}>
                <Icon name="solar:chat-round-line-linear" size={16} color="var(--neutral-300)" />
                {task.comments}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action menu */}
      <div className={styles.cardActionMenu} onClick={e => e.stopPropagation()}>
        <RowActionMenu task={task} />
      </div>
    </>
  );
}

/* ── Kanban View: Draggable Card ── */
function DraggableKanbanCard({ task, groupKey, onToggle, onTaskClick }) {
  const wasDragging = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: String(task.id),
    data: { type: 'task', task, groupKey },
  });

  useEffect(() => {
    if (isDragging) wasDragging.current = true;
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleClick = useCallback(() => {
    if (wasDragging.current) {
      wasDragging.current = false;
      return;
    }
    onTaskClick?.(task);
  }, [task, onTaskClick]);

  return (
<div
      ref={setNodeRef}
      style={style}
      className={`${styles.kanbanCard} ${isDragging ? styles.kanbanCardDragging : ''}`}
      {...attributes}
      {...listeners}
      onClick={handleClick}
    >
      <KanbanCardContent task={task} />
    </div>
  );
}

/* ── Kanban View: Droppable Column ── */
function DroppableKanbanColumn({ groupKey, label, tasks, onToggle, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${groupKey}`,
    data: { type: 'column', groupKey },
  });

  return (
    <div className={`${styles.kanbanColumn} ${isOver ? styles.kanbanColumnOver : ''}`}>
      <div className={styles.kanbanColumnHeader}>
        <div className={styles.kanbanColumnTitle}>
          <div className={styles.kanbanStatusDot} style={{ background: `var(--status-${groupKey}, var(--neutral-200))` }} />
          <span className={styles.kanbanStatusLabel}>{label}</span>
          <Badge variant="ai-neutral" label={tasks.length.toString()} />
        </div>
        <div className={styles.kanbanColumnActions}>
          <span className={styles.kanbanSort}>Due Date</span>
          <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--neutral-300)" />
          <ActionButton icon="solar:add-circle-linear" size="S" tooltip="Add task" />
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`${styles.kanbanCards} ${isOver ? styles.kanbanCardsOver : ''}`}
        data-group={groupKey}
      >
        {tasks.map(t => (
          <DraggableKanbanCard key={t.id} task={t} groupKey={groupKey} onToggle={onToggle} onTaskClick={onTaskClick} />
        ))}
        {tasks.length === 0 && (
          <div className={styles.kanbanDropHint}>
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Kanban Board with DnD ── */
export function KanbanBoard({ kanbanGroups, onToggle, onTaskMove, onTaskClick }) {
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const allTasks = useMemo(() => {
    const map = {};
    kanbanGroups.forEach(g => g.tasks.forEach(t => { map[String(t.id)] = t; }));
    return map;
  }, [kanbanGroups]);

  const handleDragStart = useCallback((event) => {
    const task = allTasks[event.active.id];
    if (task) setActiveTask(task);
  }, [allTasks]);

  const resolveGroupKey = useCallback((over) => {
    if (!over) return null;
    const overData = over.data?.current;
    if (overData?.type === 'column') return overData.groupKey;
    if (overData?.type === 'task') return overData.groupKey;
    return null;
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || !active) {
      toast.error('Drag failed: missing over or active');
      return;
    }

    const draggedTask = allTasks[active.id];
    if (!draggedTask) {
      toast.error(`Drag failed: no dragged task found for id ${active.id}`);
      return;
    }

    const targetGroupKey = resolveGroupKey(over);
    const sourceGroupKey = active.data?.current?.groupKey;
    
    if (targetGroupKey && targetGroupKey !== sourceGroupKey) {
      toast.info(`Moving from ${sourceGroupKey} to ${targetGroupKey}`);
      onTaskMove(draggedTask.id, targetGroupKey, sourceGroupKey);
    } else {
      toast.error(`Drag ignored: target=${targetGroupKey}, source=${sourceGroupKey}`);
    }
  }, [allTasks, resolveGroupKey, onTaskMove]);

  const customCollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCenter(args);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.kanbanWrap}>
        {kanbanGroups.map(g => (
          <DroppableKanbanColumn
            key={g.status}
            groupKey={g.status}
            label={g.label || (g.status.charAt(0).toUpperCase() + g.status.slice(1))}
            tasks={g.tasks}
            onToggle={onToggle}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeTask && (
          <div className={`${styles.kanbanCard} ${styles.kanbanCardOverlay}`}>
            <KanbanCardContent task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Empty State ── */
export function EmptyState({ title, description, icon }) {
  return (
    <div className={styles.emptyState}>
      <Icon name={icon || 'solar:inbox-linear'} size={48} color="var(--neutral-200)" />
      <span className={styles.emptyTitle}>{title}</span>
      <span className={styles.emptyDescription}>{description}</span>
    </div>
  );
}
