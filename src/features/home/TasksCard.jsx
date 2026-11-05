import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { PriorityIcon } from '../../components/PriorityIcon/PriorityIcon';
import { useAppStore } from '../../store/useAppStore';
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer';
import { CheckIcon } from '../tasks/TasksViewIcons';
import { parseTaskDate, todayStart } from '../tasks/TasksView.utils';
import { HomeWidgetEmpty } from './HomeWidgetEmpty';
import styles from './HomeView.module.css';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOME_TASK_LIMIT = 5;

function formatTaskDateLabel(dueDate) {
  const d = parseTaskDate(dueDate);
  if (!d) return dueDate || '';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function buildDueLabel(task) {
  if (task.status === 'completed') {
    const by = task.assigned_to || task.created_by;
    return by ? `Completed by ${by}` : 'Completed';
  }
  const d = parseTaskDate(task.due_date);
  if (!d) return 'No due date';
  const diff = Math.round((d - todayStart()) / 86400000);
  if (diff < 0 || task.status === 'missed') return 'Overdue';
  if (diff === 0) return 'Due Today';
  if (diff === 1) return 'Due Tomorrow';
  if (diff <= 7) return `Due in ${diff} Days`;
  return `Due ${formatTaskDateLabel(task.due_date)}`;
}

function dueTone(task) {
  if (task.status === 'completed') return 'done';
  const d = parseTaskDate(task.due_date);
  if (!d) return 'later';
  const diff = Math.round((d - todayStart()) / 86400000);
  if (diff <= 1 || task.status === 'missed') return 'urgent';
  if (diff <= 3) return 'soon';
  return 'later';
}

function matchAssignee(task, meId, meName) {
  return (!!meId && task.assigned_to_id === meId) || (!!meName && task.assigned_to === meName);
}

function sortHomeTasks(a, b) {
  if (a.status === 'completed' && b.status !== 'completed') return 1;
  if (b.status === 'completed' && a.status !== 'completed') return -1;
  const da = parseTaskDate(a.due_date);
  const db = parseTaskDate(b.due_date);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da - db;
}

export function TasksCard({ dragHandleClassName }) {
  const tasks = useAppStore(s => s.tasks);
  const tasksLoading = useAppStore(s => s.tasksLoading);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const updateTask = useAppStore(s => s.updateTask);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    fetchTasks();
    fetchTaskProfiles();
  }, [fetchTasks, fetchTaskProfiles]);

  const homeTasks = useMemo(() => {
    const meId = currentUserProfile?.id;
    const meName = currentUserProfile?.name;
    let pool = tasks.filter(t => matchAssignee(t, meId, meName));
    if (pool.length === 0) pool = tasks.filter(t => t.status !== 'completed');
    return pool.slice().sort(sortHomeTasks).slice(0, HOME_TASK_LIMIT);
  }, [tasks, currentUserProfile]);

  const tasksEmptyCopy = useMemo(() => {
    const meId = currentUserProfile?.id;
    const meName = currentUserProfile?.name;
    const mine = tasks.filter(t => matchAssignee(t, meId, meName));
    const openMine = mine.filter(t => t.status !== 'completed');
    const anyOpen = tasks.some(t => t.status !== 'completed');

    if (tasks.length === 0) {
      return {
        icon: 'solar:checklist-minimalistic-linear',
        title: 'No tasks yet',
        description: 'When tasks are assigned to you, they\'ll show up here with due dates and priorities.',
      };
    }
    if (openMine.length === 0 && mine.length > 0) {
      return {
        icon: 'solar:check-circle-linear',
        title: 'You\'re all caught up',
        description: 'Every task assigned to you is complete. Nice work.',
      };
    }
    if (!anyOpen) {
      return {
        icon: 'solar:check-circle-linear',
        title: 'You\'re all caught up',
        description: 'No open tasks right now: enjoy the calm.',
      };
    }
    return {
      icon: 'solar:checklist-minimalistic-linear',
      title: 'Nothing to show here',
      description: 'Tasks assigned to you will appear on this list.',
    };
  }, [tasks, currentUserProfile]);

  const handleToggle = (e, task) => {
    e.stopPropagation();
    updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
  };

  return (
    <>
      <div className={styles.card}>
        <div className={[styles.cardHeader, dragHandleClassName].filter(Boolean).join(' ')}>
          <div className={styles.cardTitle}>
            <Icon name="solar:checklist-minimalistic-linear" size={14} color="var(--primary-300)" />
            TASKS
            <span className={styles.countChip}>{homeTasks.length}</span>
          </div>
          <div className={styles.cardActions}>
            <ActionButton icon="custom:filter" size="sm" tooltip="Filter" />
          </div>
        </div>
        <div className={styles.cardBody}>
          {tasksLoading ? (
            <div className={styles.tasksLoading}>Loading tasks…</div>
          ) : homeTasks.length === 0 ? (
            <HomeWidgetEmpty
              icon={tasksEmptyCopy.icon}
              title={tasksEmptyCopy.title}
              description={tasksEmptyCopy.description}
            />
          ) : (
            homeTasks.map(task => {
              const completed = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  className={styles.taskRowBtn}
                >
                  <button
                    type="button"
                    aria-pressed={completed}
                    aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
                    className={[styles.taskCheck, completed ? styles.taskCheckDone : ''].filter(Boolean).join(' ')}
                    onClick={(e) => handleToggle(e, task)}
                  >
                    {completed && <CheckIcon size={10} />}
                  </button>
                  <button type="button" className={styles.taskRowMain} onClick={() => setSelectedTask(task)}>
                    <div className={styles.taskBody}>
                      <div className={[styles.taskTitle, completed ? styles.taskTitleDone : ''].filter(Boolean).join(' ')}>
                        {task.name}
                      </div>
                      <div className={styles.taskMeta}>
                        <PriorityIcon priority={task.priority} size={11} />
                        <span>{formatTaskDateLabel(task.due_date)}</span>
                        <span>•</span>
                        <span className={[styles.taskDue, styles[dueTone(task)]].filter(Boolean).join(' ')}>
                          {buildDueLabel(task)}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedTask && (
        <TaskDetailDrawer
          task={tasks.find(t => t.id === selectedTask.id) || selectedTask}
          onClose={() => setSelectedTask(null)}
          onSelectTask={setSelectedTask}
        />
      )}
    </>
  );
}
