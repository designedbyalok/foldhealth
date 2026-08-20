import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { toast } from '../../components/Toast/sonnerToast';
import {
  TABS, TASK_FILTER_DEFS, STATUS_ORDER, STATUS_LABELS, PRIORITY_ORDER, PRIORITY_LABELS,
  parseTaskDate, todayStart,
} from './TasksView.utils';

function buildGroupedTasks(sortedTasks, viewBy) {
  if (viewBy === 'priority') {
    return PRIORITY_ORDER.reduce((acc, p) => {
      const items = sortedTasks.filter(t => (t.priority || 'none') === p);
      if (items.length) acc.push({ status: p, label: PRIORITY_LABELS[p], tasks: items });
      return acc;
    }, []);
  }
  if (viewBy === 'due_date') {
    const today = todayStart();
    const buckets = { overdue: [], today: [], upcoming: [], no_date: [] };
    sortedTasks.forEach(t => {
      const d = parseTaskDate(t.due_date);
      if (!d) { buckets.no_date.push(t); return; }
      if (d < today) buckets.overdue.push(t);
      else if (d.getTime() === today.getTime()) buckets.today.push(t);
      else buckets.upcoming.push(t);
    });
    const result = [];
    if (buckets.overdue.length) result.push({ status: 'overdue', label: 'Overdue', tasks: buckets.overdue });
    if (buckets.today.length) result.push({ status: 'today', label: 'Today', tasks: buckets.today });
    if (buckets.upcoming.length) result.push({ status: 'upcoming', label: 'Upcoming', tasks: buckets.upcoming });
    return result;
  }
  return STATUS_ORDER.reduce((acc, status) => {
    const items = sortedTasks.filter(t => t.status === status);
    if (items.length) acc.push({ status, tasks: items });
    return acc;
  }, []);
}

function buildKanbanGroups(sortedTasks, viewBy) {
  if (viewBy === 'priority') {
    return PRIORITY_ORDER.map(p => ({
      status: p,
      label: PRIORITY_LABELS[p],
      tasks: sortedTasks.filter(t => (t.priority || 'none') === p),
    }));
  }
  if (viewBy === 'due_date') {
    const today = todayStart();
    const buckets = { overdue: [], today: [], upcoming: [], no_date: [] };
    sortedTasks.forEach(t => {
      const d = parseTaskDate(t.due_date);
      if (!d) { buckets.no_date.push(t); return; }
      if (d < today) buckets.overdue.push(t);
      else if (d.getTime() === today.getTime()) buckets.today.push(t);
      else buckets.upcoming.push(t);
    });
    return [
      { status: 'overdue', label: 'Overdue', tasks: buckets.overdue },
      { status: 'today', label: 'Today', tasks: buckets.today },
      { status: 'upcoming', label: 'Upcoming', tasks: buckets.upcoming },
    ];
  }
  return STATUS_ORDER.map(status => ({
    status,
    label: STATUS_LABELS[status] || (status.charAt(0).toUpperCase() + status.slice(1)),
    tasks: sortedTasks.filter(t => t.status === status),
  }));
}

export function useTasksView() {
  const tasks = useAppStore(s => s.tasks);
  const tasksLoading = useAppStore(s => s.tasksLoading);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const updateTask = useAppStore(s => s.updateTask);
  const tasksTab = useAppStore(s => s.tasksTab);
  const setTasksTab = useAppStore(s => s.setTasksTab);
  const tasksFilters = useAppStore(s => s.tasksFilters);
  const setTasksFilter = useAppStore(s => s.setTasksFilter);
  const clearTasksFilters = useAppStore(s => s.clearTasksFilters);
  const showTasksFilterBar = useAppStore(s => s.showTasksFilterBar);
  const toggleTasksFilterBar = useAppStore(s => s.toggleTasksFilterBar);
  const tasksViewMode = useAppStore(s => s.tasksViewMode);
  const setTasksViewMode = useAppStore(s => s.setTasksViewMode);
  const pendingAddTask = useAppStore(s => s.pendingAddTask);
  const clearPendingAddTask = useAppStore(s => s.clearPendingAddTask);
  const pendingOpenTaskId = useAppStore(s => s.pendingOpenTaskId);
  const clearPendingOpenTaskId = useAppStore(s => s.clearPendingOpenTaskId);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const fetchTaskLabels = useAppStore(s => s.fetchTaskLabels);
  const fetchTaskPools = useAppStore(s => s.fetchTaskPools);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const allPatients = useAppStore(s => s.allPatients);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);

  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [addDrawerStatus, setAddDrawerStatus] = useState('pending');
  const [addDrawerInitialMember, setAddDrawerInitialMember] = useState(null);

  useEffect(() => {
    fetchTasks();
    fetchTaskProfiles();
    fetchTaskLabels();
    fetchTaskPools();
    if (!allPatients || allPatients.length === 0) fetchAllPatients();
    // Intentionally excluding `allPatients` from deps — it's read inside a
    // conditional guard as of-mount state, not a re-run trigger. Including it
    // caused every fetchAllPatients resolution to change the reference and
    // re-fire every task fetch, which flipped `tasksLoading` false→true→false
    // and made the empty state flicker back to the loading skeleton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTasks, fetchTaskProfiles, fetchTaskLabels, fetchTaskPools, fetchAllPatients]);

  /* eslint-disable react-hooks/set-state-in-effect --
   * `pendingAddTask` is a one-shot external signal from the store (another
   * feature sets it, we consume it and clear it). This matches the rule's
   * own "Subscribe for updates from external state, calling setState in a
   * callback when it changes" carve-out — Zustand delivers the change via
   * re-render, and this branch is the callback that reacts.
   */
  useEffect(() => {
    if (!pendingAddTask) return;
    setAddDrawerStatus('pending');
    setAddDrawerInitialMember(pendingAddTask.member || null);
    setShowAddDrawer(true);
    clearPendingAddTask();
  }, [pendingAddTask, clearPendingAddTask]);

  // Clicking a task notification in the bell sets `pendingOpenTaskId` and
  // navigates here. Nothing consumed it before, so the click landed on the
  // Tasks page but never opened the task it was about.
  //
  // Deliberately does NOT clear the signal until the task is found: arriving
  // from another page means this runs before `fetchTasks` has resolved, and
  // clearing on a miss would drop the request on the floor. Leaving it set
  // makes the effect re-run when `tasks` lands.
  useEffect(() => {
    if (pendingOpenTaskId == null) return;
    const match = tasks.find(t => String(t.id) === String(pendingOpenTaskId));
    if (!match) return;
    setSelectedTask(match);
    clearPendingOpenTaskId();
  }, [pendingOpenTaskId, tasks, clearPendingOpenTaskId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const meId = currentUserProfile?.id || null;
  const meName = currentUserProfile?.name || null;

  // Match on id OR display name — never id-else-name. `profiles` holds one row
  // per email a person has signed up with, so the same human appears with
  // several ids; a task can carry any of those ids and still be theirs. Legacy
  // rows carry only a name (no id at all). Short-circuiting on `assigned_to_id`
  // hid both cases from "Assigned to Me".
  const matchAssignee = useCallback(
    (t) => (!!meId && t.assigned_to_id === meId) || (!!meName && t.assigned_to === meName),
    [meId, meName],
  );

  const matchCreator = useCallback(
    (t) => (!!meId && t.created_by_id === meId) || (!!meName && t.created_by === meName),
    [meId, meName],
  );

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (tasksTab === 'assigned') result = result.filter(matchAssignee);
    else if (tasksTab === 'pool') result = result.filter(t => t.pool && !t.assigned_to && !t.assigned_to_id);
    else if (tasksTab === 'created') result = result.filter(matchCreator);
    else if (tasksTab === 'mentions') result = meName ? result.filter(t => Array.isArray(t.mentions) && t.mentions.includes(meName)) : [];

    Object.entries(tasksFilters).forEach(([key, value]) => {
      if (!value) return;
      if (key === 'task_status') result = result.filter(t => t.status === value);
      else if (key === 'priority') result = result.filter(t => t.priority === value);
      else if (key === 'assigned_to') {
        const pickedName = (taskProfiles || []).find(p => p.id === value)?.name;
        result = result.filter(t => t.assigned_to_id === value || (pickedName && t.assigned_to === pickedName));
      } else if (key === 'created_by') {
        const pickedName = (taskProfiles || []).find(p => p.id === value)?.name;
        result = result.filter(t => t.created_by_id === value || (pickedName && t.created_by === pickedName));
      } else if (key === 'member') result = result.filter(t => t.member === value);
      else if (key === 'labels') result = result.filter(t => Array.isArray(t.labels) && t.labels.includes(value));
    });

    return result;
  }, [tasks, tasksTab, tasksFilters, meName, taskProfiles, matchAssignee, matchCreator]);

  const tabCounts = useMemo(() => ({
    all: tasks.length,
    assigned: tasks.filter(matchAssignee).length,
    pool: tasks.filter(t => t.pool && !t.assigned_to && !t.assigned_to_id).length,
    created: tasks.filter(matchCreator).length,
    mentions: meName ? tasks.filter(t => Array.isArray(t.mentions) && t.mentions.includes(meName)).length : 0,
  }), [tasks, meName, matchAssignee, matchCreator]);

  const handleToggle = useCallback((task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTask(task.id, { status: newStatus });
  }, [updateTask]);

  const handleStatusChange = useCallback((taskId, newStatus) => {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    let patch = { status: newStatus };
    let msg = `Task moved to ${STATUS_LABELS[newStatus]}`;
    let variant = 'info';

    if (taskToUpdate?.status === 'missed' && newStatus === 'pending') {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      patch.due_date = `${mm}-${dd}-${d.getFullYear()}`;
      msg = 'Task moved to Pending. Due date extended by 7 days.';
      variant = 'warning';
    } else if (newStatus === 'completed') {
      variant = 'success';
    } else if (newStatus === 'missed') {
      variant = 'error';
    }

    updateTask(taskId, patch);
    toast[variant](msg);
  }, [updateTask, tasks]);

  const sortedTasks = useMemo(() => {
    const sortBy = tasksFilters.sort_by;
    if (!sortBy) return filteredTasks;
    const sorted = [...filteredTasks];
    if (sortBy === 'due_date') {
      sorted.sort((a, b) => {
        const da = parseTaskDate(a.due_date);
        const db = parseTaskDate(b.due_date);
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
    } else if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2, none: 3 };
      sorted.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return sorted;
  }, [filteredTasks, tasksFilters.sort_by]);

  const filterDefs = useMemo(() => {
    const profileOpts = (taskProfiles || []).map(p => ({ value: p.id, label: p.name }));
    const memberOpts = (allPatients || []).map(p => ({ value: p.name, label: p.name }));
    // Single pass: swap in the fetched profile options where they apply, and
    // append the Member filter directly after Created By. The previous
    // map().flatMap() also allocated a throwaway array per definition.
    const defs = [];
    for (const fd of TASK_FILTER_DEFS) {
      const usesProfiles = fd.key === 'assigned_to' || fd.key === 'created_by';
      defs.push(usesProfiles && profileOpts.length
        ? { ...fd, options: profileOpts, searchable: true }
        : fd);
      if (fd.key === 'created_by' && memberOpts.length) {
        defs.push({ key: 'member', label: 'Member', options: memberOpts, primary: true, searchable: true });
      }
    }
    return defs;
  }, [taskProfiles, allPatients]);

  const viewBy = tasksFilters.view_by || 'status';
  const grouped = useMemo(() => buildGroupedTasks(sortedTasks, viewBy), [sortedTasks, viewBy]);
  const kanbanGroups = useMemo(() => buildKanbanGroups(sortedTasks, viewBy), [sortedTasks, viewBy]);
  const hideAssignedTo = !!tasksFilters.assigned_to;

  const handleTaskMove = useCallback(async (taskId, targetGroupKey) => {
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    try {
      let ok = false;
      if (viewBy === 'status') {
        ok = await updateTask(taskId, { status: targetGroupKey });
      } else if (viewBy === 'priority') {
        const priorityVal = targetGroupKey === 'none' ? null : targetGroupKey;
        ok = await updateTask(taskId, { priority: priorityVal });
      } else if (viewBy === 'due_date') {
        let newDate = null;
        if (targetGroupKey === 'today') {
          const d = new Date();
          newDate = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
        } else if (targetGroupKey === 'upcoming') {
          const d = new Date(); d.setDate(d.getDate() + 7);
          newDate = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
        } else if (targetGroupKey === 'overdue') {
          const d = new Date(); d.setDate(d.getDate() - 1);
          newDate = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
        }
        ok = await updateTask(taskId, { due_date: newDate });
      }
      if (ok) {
        toast.success(`Task moved to ${targetGroupKey}`);
      } else {
        // updateTask kept the optimistic local mutation but Supabase rejected
        // the write. Reveal that to the user — the row will still snap back
        // on the next fetch.
        toast.error(`Move saved locally but failed to sync — try again.`);
      }
    } catch (err) {
      console.error('handleTaskMove error:', err);
      toast.error(`Move Error: ${err.message || 'Unknown error'}`);
    }
  }, [tasks, updateTask, viewBy]);

  return {
    TABS,
    tasks,
    tasksLoading,
    tasksTab,
    setTasksTab,
    tasksFilters,
    setTasksFilter,
    clearTasksFilters,
    showTasksFilterBar,
    toggleTasksFilterBar,
    tasksViewMode,
    setTasksViewMode,
    tabCounts,
    filterDefs,
    filteredTasks,
    sortedTasks,
    grouped,
    kanbanGroups,
    hideAssignedTo,
    handleToggle,
    handleStatusChange,
    handleTaskMove,
    selectedTask,
    setSelectedTask,
    showAddDrawer,
    setShowAddDrawer,
    addDrawerStatus,
    setAddDrawerStatus,
    addDrawerInitialMember,
    setAddDrawerInitialMember,
  };
}
