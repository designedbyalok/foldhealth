import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { parseTaskDate, todayStart } from '../../tasks/TasksView.utils';
import { matchTaskAssignee } from '../../home/useMyWorklistPatients';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'done' | 'overdue' | 'today' | 'upcoming' | 'none' (no due date). */
export function taskBucket(task) {
  if (task.status === 'completed') return 'done';
  if (task.status === 'missed') return 'overdue';
  const d = parseTaskDate(task.due_date);
  if (!d) return 'none';
  const diff = Math.round((d - todayStart()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}

/** "Overdue" / "Due Today" / "Due Tomorrow" / "Due 22 Dec" (Figma task card). */
export function dueLabel(task) {
  const bucket = taskBucket(task);
  if (bucket === 'done') return 'Completed';
  if (bucket === 'overdue') return 'Overdue';
  if (bucket === 'today') return 'Due Today';
  if (bucket === 'none') return 'No due date';
  const d = parseTaskDate(task.due_date);
  const diff = Math.round((d - todayStart()) / 86400000);
  return diff === 1 ? 'Due Tomorrow' : `Due ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const BUCKET_ORDER = { overdue: 0, today: 1, upcoming: 2, none: 3, done: 4 };

/** Most urgent bucket first, then by due date. Tasks need `bucket` set. */
export const compareTasks = (a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket]
  || (parseTaskDate(a.due_date) || 0) - (parseTaskDate(b.due_date) || 0);

// The desktop Tasks tabs (TasksView.utils TABS), matched the way
// useTasksView matches them: by id OR display name, since one person can
// have several profile ids and legacy rows carry only a name.
export const TASK_SCOPES = [
  { key: 'assigned', label: 'My Tasks' },
  { key: 'pool', label: 'Task Pool' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'created', label: 'Created by Me' },
];

/** Unclaimed pooled tasks, the desktop "My Task Pool" tab. */
export const isPoolTask = (t) => !!t.pool && !t.assigned_to && !t.assigned_to_id;

function scopeMatcher(scope, meId, meName) {
  if (scope === 'pool') return isPoolTask;
  if (scope === 'created') return t => (!!meId && t.created_by_id === meId) || (!!meName && t.created_by === meName);
  if (scope === 'mentions') {
    const meLower = (meName || '').toLowerCase();
    return t => (!!meId && Array.isArray(t.mention_ids) && t.mention_ids.includes(meId))
      || (!!meLower && Array.isArray(t.mentions) && t.mentions.some(m => (m || '').toLowerCase() === meLower));
  }
  return t => matchTaskAssignee(t, meId, meName);
}

/**
 * Tasks in one of the desktop tabs (default: assigned to me), most urgent
 * first, plus each tab's count.
 */
export function useMyTasks(scope = 'assigned') {
  const tasks = useAppStore(s => s.tasks);
  const loading = useAppStore(s => s.tasksLoading);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const me = useAppStore(s => s.currentUserProfile);
  useEffect(() => { fetchTasks(); fetchTaskProfiles(); }, [fetchTasks, fetchTaskProfiles]);

  const shown = useMemo(() => {
    const match = scopeMatcher(scope, me?.id, me?.name);
    return (tasks || [])
      .filter(match)
      .map(t => ({ ...t, bucket: taskBucket(t) }))
      .sort(compareTasks);
  }, [tasks, me, scope]);

  const counts = useMemo(() => Object.fromEntries(TASK_SCOPES.map(({ key }) => {
    const match = scopeMatcher(key, me?.id, me?.name);
    return [key, (tasks || []).filter(t => match(t) && t.status !== 'completed').length];
  })), [tasks, me]);

  return { tasks: shown, loading, counts };
}
