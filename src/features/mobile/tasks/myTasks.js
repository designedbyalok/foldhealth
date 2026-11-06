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

/** The signed-in user's tasks, most urgent first. */
export function useMyTasks() {
  const tasks = useAppStore(s => s.tasks);
  const loading = useAppStore(s => s.tasksLoading);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const me = useAppStore(s => s.currentUserProfile);
  useEffect(() => { fetchTasks(); fetchTaskProfiles(); }, [fetchTasks, fetchTaskProfiles]);

  const mine = useMemo(() => (tasks || [])
    .filter(t => matchTaskAssignee(t, me?.id, me?.name))
    .map(t => ({ ...t, bucket: taskBucket(t) }))
    .sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket]
      || (parseTaskDate(a.due_date) || 0) - (parseTaskDate(b.due_date) || 0)), [tasks, me]);

  return { tasks: mine, loading };
}
