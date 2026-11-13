import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { toast } from '../../components/Toast/sonnerToast';
import {
  TABS, TASK_FILTER_DEFS, STATUS_ORDER, STATUS_LABELS, PRIORITY_ORDER, PRIORITY_LABELS,
  parseTaskDate, todayStart,
} from './TasksView.utils';
import { coveringPeople, oooStatus, recordPerson, sameName, samePerson } from '../ooo/oooUtils';

// Covering for: the picked names ("away:<name>" from a saved single pick).
const AWAY = 'away:';

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
    if (items.length) acc.push({ status, tasks: sortByDueDateDesc(items) });
    return acc;
  }, []);
}

// Within a status group (Pending / Missed / Completed) tasks come off the
// server in creation order, which reads scrambled once a group grows past a
// few rows. Order latest-due first so the most recent work sits at the top;
// tasks with no due date drop to the bottom, and ties keep their relative
// order (stable sort).
function sortByDueDateDesc(items) {
  return [...items].sort((a, b) => {
    const da = parseTaskDate(a.due_date);
    const db = parseTaskDate(b.due_date);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db - da;
  });
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
    tasks: sortByDueDateDesc(sortedTasks.filter(t => t.status === status)),
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
  const oooRecords = useAppStore(s => s.oooRecords);
  // Reassignment jobs: the rows' "Covering for" notes read them.
  const fetchReassignmentJobs = useAppStore(s => s.fetchReassignmentJobs);
  useEffect(() => { fetchReassignmentJobs?.(); }, [fetchReassignmentJobs]);
  // People out (now or soon) whose cover names me: I see to all their work.
  // name (lowercase) → their record, for the Covering tab's group headers.
  const coverRecords = useMemo(() => {
    const me = { id: currentUserProfile?.id || null, name: currentUserProfile?.name || '' };
    return new Map((oooRecords || [])
      .filter(r => oooStatus(r) !== 'Past' && coveringPeople(r.coverage).some(c => samePerson(c, me)))
      .map(r => [recordPerson(r).name.trim().toLowerCase(), r]));
  }, [oooRecords, currentUserProfile]);
  const coverMe = useMemo(() => new Set(coverRecords.keys()), [coverRecords]);
  // Covering tab: open work still assigned to people I'm covering.
  const matchCovering = useCallback(
    (t) => t.status !== 'completed' && coverMe.has(String(t.assigned_to || '').trim().toLowerCase()),
    [coverMe],
  );
  // The tab shows only while I'm covering someone, after Assigned to Me.
  const tabs = useMemo(() => (coverMe.size
    ? TABS.flatMap(t => (t.key === 'assigned' ? [t, { key: 'covering', label: 'Covering' }] : [t]))
    : TABS), [coverMe]);

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
    // Intentionally excluding `allPatients` from deps: it's read inside a
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
   * callback when it changes" carve-out: Zustand delivers the change via
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
  // A task link (#/tasks?taskId=…, e.g. Copy Link or "View Task" in a new
  // tab) opens that task once, the same way.
  useEffect(() => {
    const id = /[?&]taskId=([^&]+)/.exec(window.location.hash)?.[1];
    if (id) useAppStore.setState({ pendingOpenTaskId: decodeURIComponent(id) });
  }, []);
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

  // Match on id OR display name, never id-else-name. `profiles` holds one row
  // per email a person has signed up with, so the same human appears with
  // several ids; a task can carry any of those ids and still be theirs. Legacy
  // rows carry only a name (no id at all). Short-circuiting on `assigned_to_id`
  // hid both cases from "Assigned to Me".
  const matchAssignee = useCallback(
    (t) => (!!meId && t.assigned_to_id === meId) || (!!meName && t.assigned_to === meName),
    [meId, meName],
  );

  // Mentions now carry a picked profile id (`mention_ids`, written by
  // CommentComposer) as well as the display name. Match on either: the id is
  // exact, and the name still covers rows written before ids were captured.
  // The name compare is case-insensitive because the legacy regex path stored
  // whatever the user typed: real rows contain both "fold demo" and
  // "Fold Demo", and the old exact compare silently missed the lowercase one.
  const matchMentioned = useCallback((t) => {
    if (meId && Array.isArray(t.mention_ids) && t.mention_ids.includes(meId)) return true;
    if (!meName || !Array.isArray(t.mentions)) return false;
    const meLower = meName.toLowerCase();
    return t.mentions.some(m => (m || '').toLowerCase() === meLower);
  }, [meId, meName]);

  const matchCreator = useCallback(
    (t) => (!!meId && t.created_by_id === meId) || (!!meName && t.created_by === meName),
    [meId, meName],
  );

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (tasksTab === 'assigned') result = result.filter(matchAssignee);
    else if (tasksTab === 'pool') result = result.filter(t => t.pool && !t.assigned_to && !t.assigned_to_id);
    else if (tasksTab === 'created') result = result.filter(matchCreator);
    else if (tasksTab === 'mentions') result = result.filter(matchMentioned);
    else if (tasksTab === 'covering') result = result.filter(matchCovering);

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
      } else if (key === 'covering') {
        // Whose work I'm covering: their tasks still with them, when their
        // cover names me. (Work reassigned to me is simply mine now.)
        const picked = (Array.isArray(value) ? value : [value]).map(v => String(v).replace(AWAY, ''));
        if (picked.length) {
          result = result.filter(t => picked.some(away => sameName(t.assigned_to, away) && coverMe.has(String(away).trim().toLowerCase())));
        }
      } else if (key === 'member') result = result.filter(t => t.member === value);
      else if (key === 'labels') result = result.filter(t => Array.isArray(t.labels) && t.labels.includes(value));
    });

    return result;
  }, [tasks, tasksTab, tasksFilters, taskProfiles, matchAssignee, matchCreator, matchMentioned, coverMe, matchCovering]);

  const tabCounts = useMemo(() => ({
    all: tasks.length,
    assigned: tasks.filter(matchAssignee).length,
    pool: tasks.filter(t => t.pool && !t.assigned_to && !t.assigned_to_id).length,
    created: tasks.filter(matchCreator).length,
    mentions: tasks.filter(matchMentioned).length,
    covering: tasks.filter(matchCovering).length,
  }), [tasks, matchAssignee, matchCreator, matchMentioned, matchCovering]);

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
    // Whom I'm covering: people out (now or soon) whose cover names me.
    const awayOpts = (oooRecords || [])
      .filter(r => oooStatus(r) !== 'Past' && coveringPeople(r.coverage).some(c => samePerson(c, { id: currentUserProfile?.id || null, name: currentUserProfile?.name || '' })))
      .map(r => recordPerson(r).name)
      .filter((n, i, a) => n && a.indexOf(n) === i)
      .sort((a, b) => a.localeCompare(b));
    // Single pass: swap in the fetched profile options where they apply, and
    // append the Member filter directly after Created By. The previous
    // map().flatMap() also allocated a throwaway array per definition.
    const defs = [];
    for (const fd of TASK_FILTER_DEFS) {
      const usesProfiles = fd.key === 'assigned_to' || fd.key === 'created_by';
      // Covering for only shows while I'm covering someone.
      if (fd.key === 'covering') { if (awayOpts.length) defs.push({ ...fd, options: awayOpts, searchable: awayOpts.length > 6 }); }
      else defs.push(usesProfiles && profileOpts.length
        ? { ...fd, options: profileOpts, searchable: true }
        : fd);
      if (fd.key === 'created_by' && memberOpts.length) {
        defs.push({ key: 'member', label: 'Member', options: memberOpts, primary: true, searchable: true });
      }
    }
    return defs;
  }, [taskProfiles, allPatients, oooRecords, currentUserProfile]);

  const viewBy = tasksFilters.view_by || 'status';
  // Covering tab: one group per person I'm covering ("Navin Jethwani · Out
  // until 11/24/2026"); otherwise the chosen View By.
  const grouped = useMemo(() => {
    if (tasksTab !== 'covering') return buildGroupedTasks(sortedTasks, viewBy);
    const byPerson = new Map();
    sortedTasks.forEach((t) => {
      const k = String(t.assigned_to || '').trim().toLowerCase();
      if (!byPerson.has(k)) byPerson.set(k, { name: t.assigned_to, tasks: [] });
      byPerson.get(k).tasks.push(t);
    });
    const until = (k) => {
      const end = coverRecords.get(k)?.endAt;
      return end ? ` · Out until ${new Date(end).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}` : '';
    };
    return [...byPerson].sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([k, g]) => ({ status: `covering:${k}`, label: `${g.name}${until(k)}`, tasks: g.tasks, noAdd: true }));
  }, [sortedTasks, viewBy, tasksTab, coverRecords]);
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
        // the write. Reveal that to the user, the row will still snap back
        // on the next fetch.
        toast.error(`Move saved locally but failed to sync, try again.`);
      }
    } catch (err) {
      console.error('handleTaskMove error:', err);
      toast.error(`Move Error: ${err.message || 'Unknown error'}`);
    }
  }, [tasks, updateTask, viewBy]);

  return {
    TABS: tabs,
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
