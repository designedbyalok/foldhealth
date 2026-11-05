import { useMemo, useState } from 'react';
import { Icon } from '../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { PriorityIcon } from '../../../../../../components/PriorityIcon/PriorityIcon';
import { AssigneeChange } from '../../../../../../components/AssigneeChange/AssigneeChange';
import { useAppStore } from '../../../../../../store/useAppStore';
import { TaskDatePicker, DetailDropdown } from '../../../../../../features/tasks/TasksViewDropdowns';
import { PRIORITY_OPTIONS, getInitials, isOverdue } from '../../../../../../features/tasks/TasksView.utils';
import { PATIENT_TASKS_MOCK } from '../../../../data/patientTasksMock';
import styles from './TasksTab.module.css';
import { parseLocalDate } from '../../../../../../lib/localDate';

const SCOPES = ['My Tasks', "Patient's Task"];

function useAssigneeOptions() {
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  return useMemo(() => {
    const list = [];
    const seen = new Set();
    if (currentUserProfile?.id) {
      list.push({
        id: currentUserProfile.id,
        name: `${currentUserProfile.name} (You)`,
        initials: getInitials(currentUserProfile.name),
        role: currentUserProfile.role,
        _realName: currentUserProfile.name,
      });
      seen.add(currentUserProfile.id);
    }
    (taskProfiles || []).forEach((p) => {
      if (seen.has(p.id)) return;
      list.push({
        id: p.id,
        name: p.name,
        initials: getInitials(p.name),
        role: p.role,
        _realName: p.name,
      });
      seen.add(p.id);
    });
    return list;
  }, [taskProfiles, currentUserProfile]);
}

function fmtDue(iso) {
  if (!iso) return '';
  const d = parseLocalDate(iso);
  if (!d) return iso;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

function MetaCounts({ task }) {
  return (
    <div className={styles.metaRow}>
      {task.subtasks > 0 && (
        <span className={styles.metaItem}><Icon name="solar:checklist-minimalistic-linear" size={14} color="var(--neutral-300)" />{task.subtasks}</span>
      )}
      {task.attachments > 0 && (
        <span className={styles.metaItem}><Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />{task.attachments}</span>
      )}
      {task.comments > 0 && (
        <span className={styles.metaItem}><Icon name="solar:chat-round-linear" size={14} color="var(--neutral-300)" />{task.comments}</span>
      )}
    </div>
  );
}

function StaticTaskRow({ task, done, onToggle, onClick }) {
  const hasMeta = task.subtasks > 0 || task.attachments > 0 || task.comments > 0;
  return (
    <div
      className={`${styles.row} ${onClick ? styles.rowClickable : ''}`}
      onClick={onClick ? () => onClick(task) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(task); } } : undefined}
    >
      <div className={styles.checkCell} onClick={e => e.stopPropagation()}>
        {done ? (
          <button className={styles.checkBtn} onClick={onToggle} aria-label="Mark incomplete">
            <Icon name="solar:check-circle-bold" size={20} color="var(--status-success)" />
          </button>
        ) : (
          <button className={styles.checkEmpty} onClick={onToggle} aria-label="Mark complete" />
        )}
      </div>
      <div className={styles.nameCell}>
        <span className={`${styles.taskTitle} ${done ? styles.taskTitleDone : ''}`}>{task.title}</span>
        {done && <span className={styles.completedOn}>Completed on {task.completedOn}</span>}
        {hasMeta && <MetaCounts task={task} />}
      </div>
      <div className={styles.pCell}><PriorityIcon priority={task.priority} size={16} /></div>
      <div className={styles.assigneeCell}>
        {task.assignee
          ? <AssigneeChange name={task.assignee} initials={task.assigneeInitials} avatarOnly />
          : <span className={styles.muted}>-</span>}
      </div>
      <div className={`${styles.dueCell} ${task.overdue ? styles.dueOverdue : ''}`}>{fmtDue(task.due)}</div>
    </div>
  );
}

function InteractiveTaskRow({ task, storeTask, done, onToggle, onOpenTask, compact }) {
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  const assigneeOptions = useAssigneeOptions();
  const hasMeta = task.subtasks > 0 || task.attachments > 0 || task.comments > 0;
  const overdue = storeTask ? isOverdue(storeTask) : task.overdue;

  if (!storeTask) {
    return (
      <StaticTaskRow
        task={task}
        done={done}
        onToggle={onToggle}
      />
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.checkCell}>
        {done ? (
          <button className={styles.checkBtn} onClick={onToggle} aria-label="Mark incomplete">
            <Icon name="solar:check-circle-bold" size={20} color="var(--status-success)" />
          </button>
        ) : (
          <button className={styles.checkEmpty} onClick={onToggle} aria-label="Mark complete" />
        )}
      </div>
      <div className={styles.nameCell}>
        <button
          type="button"
          className={`${styles.taskTitleBtn} ${done ? styles.taskTitleDone : ''}`}
          onClick={() => onOpenTask?.(storeTask)}
        >
          {task.title}
        </button>
        {done && <span className={styles.completedOn}>Completed on {task.completedOn}</span>}
        {hasMeta && <MetaCounts task={task} />}
      </div>
      <div className={styles.pCell}>
        <DetailDropdown
          value={storeTask.priority}
          options={PRIORITY_OPTIONS}
          searchable={false}
          align="right"
          onSelect={(v) => { updateTask(storeTask.id, { priority: v }); showToast(`Priority set to ${v}`); }}
          renderOption={(opt) => (
            <><PriorityIcon priority={opt} size={16} /> <span style={{ textTransform: 'capitalize' }}>{opt}</span></>
          )}
        >
          <PriorityIcon priority={storeTask.priority} size={16} />
        </DetailDropdown>
      </div>
      <div className={styles.assigneeCell}>
        <AssigneeChange
          name={storeTask.assigned_to || undefined}
          initials={storeTask.assigned_to ? getInitials(storeTask.assigned_to) : undefined}
          unassigned={!storeTask.assigned_to}
          unassignedLabel="Assign"
          size={compact ? 'S' : 'M'}
          showRole={false}
          avatarOnly={compact}
          fillContainer={!compact}
          users={assigneeOptions}
          onSelect={(u) => {
            const realName = u._realName || u.name;
            updateTask(storeTask.id, { assigned_to: realName, assigned_to_id: u.id || null, pool: null });
            showToast(`Assigned to ${realName}`);
          }}
        />
      </div>
      <div className={`${styles.dueCell} ${overdue ? styles.dueOverdue : ''}`}>
        <TaskDatePicker
          compact={compact}
          value={storeTask.due_date}
          overdue={overdue}
          onSelect={(v) => { updateTask(storeTask.id, { due_date: v }); showToast('Due date updated'); }}
        />
      </div>
    </div>
  );
}

function TaskRow(props) {
  if (props.interactive) return <InteractiveTaskRow {...props} />;
  return <StaticTaskRow {...props} onClick={props.onTaskClick ? () => props.onTaskClick(props.task) : undefined} />;
}

function TaskSection({
  title, tasks, done, overdue, onToggle, onTaskClick, interactive, resolveStoreTask, compact,
}) {
  if (!tasks.length) return null;
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title} ({tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'})</div>
      <div className={styles.colHead}>
        <span className={styles.checkCell} />
        <span className={styles.nameCell}>Task Name</span>
        <span className={styles.pCell}>P</span>
        <span className={styles.assigneeCell}>Assignee</span>
        <span className={styles.dueCell}>Due</span>
      </div>
      {tasks.map(t => (
        <TaskRow
          key={t.id}
          interactive={interactive}
          compact={compact}
          task={{ ...t, overdue }}
          storeTask={resolveStoreTask?.(t.id)}
          done={done}
          onToggle={() => onToggle(t.id)}
          onTaskClick={onTaskClick}
          onOpenTask={onTaskClick}
        />
      ))}
    </div>
  );
}

export function TasksTab({
  data = PATIENT_TASKS_MOCK,
  scopes = SCOPES,
  hideToolbar = false,
  interactive = false,
  compact = false,
  className,
  completedIds: completedIdsProp,
  onToggle: onToggleProp,
  onTaskClick,
}) {
  const [scope, setScope] = useState(scopes[0]);
  const [localCompleted, setLocalCompleted] = useState(() => new Set());
  const allTasks = useAppStore(s => s.tasks);
  const updateTask = useAppStore(s => s.updateTask);
  const completedIds = completedIdsProp ?? localCompleted;

  const resolveStoreTask = (id) => allTasks.find(t => String(t.id) === String(id));

  const toggle = (id) => {
    if (onToggleProp) { onToggleProp(id); return; }
    if (interactive) {
      const storeTask = resolveStoreTask(id);
      if (!storeTask) return;
      if (storeTask.status === 'completed') {
        updateTask(id, { status: 'pending', completed_at: null });
      } else {
        updateTask(id, { status: 'completed', completed_at: new Date().toISOString() });
      }
      return;
    }
    setLocalCompleted(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const pending = data.pending.filter(t => !completedIds.has(t.id));
  const overdue = data.overdue.filter(t => !completedIds.has(t.id));
  const locallyCompleted = [...data.pending, ...data.overdue]
    .filter(t => completedIds.has(t.id))
    .map(t => ({ ...t, completedOn: fmtDue(new Date().toISOString()) }));
  const completed = [...(data.completed || []), ...locallyCompleted];
  const empty = !pending.length && !overdue.length && !completed.length;

  const rootClass = [
    hideToolbar ? styles.tabFlush : styles.tab,
    compact ? styles.compact : '',
    className,
  ].filter(Boolean).join(' ');

  const sectionProps = {
    interactive,
    compact,
    resolveStoreTask,
    onToggle: toggle,
    onTaskClick,
  };

  return (
    <div className={rootClass}>
      {!hideToolbar && (
        <div className={styles.toolbar}>
          <div className={styles.scopeTabs}>
            {scopes.map(s => (
              <button
                key={s}
                className={`${styles.scopeTab} ${scope === s ? styles.scopeTabActive : ''}`}
                onClick={() => setScope(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className={styles.toolbarActions}>
            <ActionButton icon="solar:magnifer-linear" size="sm" tooltip="Search" />
            <ActionButton icon="solar:clipboard-add-linear" size="sm" tooltip="Add task" />
            <ActionButton icon="custom:filter" size="sm" tooltip="Filter" />
          </div>
        </div>
      )}

      <TaskSection title="Pending" tasks={pending} done={false} overdue={false} {...sectionProps} />
      <TaskSection title="Overdue" tasks={overdue} done={false} overdue {...sectionProps} />
      <TaskSection title="Completed" tasks={completed} done {...sectionProps} />
      {empty && <div className={styles.empty}>No tasks match your search or filters.</div>}
    </div>
  );
}
