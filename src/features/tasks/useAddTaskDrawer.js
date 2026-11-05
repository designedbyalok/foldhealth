import { useState, useRef, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  STATUS_ORDER, STATUS_LABELS, PRIORITY_OPTIONS, ASSIGNEE_OPTIONS, MEMBER_OPTIONS, TITLE_MAX, todayMMDDYYYY,
} from './TasksView.utils';

export function useAddTaskDrawer({ defaultStatus, initialMember, initialAssignedTo, onTaskCreated, extraFields, dbOmit, initialLinkedGoalIds, includeScheduleFields = false }) {
  const initialStatus = defaultStatus || 'pending';
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState(initialStatus);
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState(initialAssignedTo || '');
  const [member, setMember] = useState(initialMember || '');
  const [pool, setPool] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [subtaskName, setSubtaskName] = useState('');
  const [stagedSubtasks, setStagedSubtasks] = useState([]);
  const editorRef = useRef(null);

  // Schedule fields: mirrored from the intervention drawer so tasks
  // authored from a care plan carry the same creation cadence, offset,
  // duration semantics and optional repeat schedule.
  const [creationTiming, setCreationTiming] = useState('immediate');
  const [creationCount, setCreationCount] = useState('1');
  const [creationTrigger, setCreationTrigger] = useState('Care Plan Signed');
  const [dueOffset, setDueOffset] = useState('7');
  const [dueUnit, setDueUnit] = useState('day');
  const [durationType, setDurationType] = useState('calendar');
  const [repeat, setRepeat] = useState(false);
  const [repeatCount, setRepeatCount] = useState('1');
  const [repeatEvery, setRepeatEvery] = useState('1');
  const [repeatEveryUnit, setRepeatEveryUnit] = useState('Days');
  const [repeatEnds, setRepeatEnds] = useState('8');
  const [repeatEndsUnit, setRepeatEndsUnit] = useState('Days');

  // Linked Goals: plan-goal ids the task is linked to. Same M:N shape
  // the intervention drawer uses.
  const [linkedGoalIds, setLinkedGoalIds] = useState(() => (
    Array.isArray(initialLinkedGoalIds) ? [...initialLinkedGoalIds] : []
  ));
  const linkGoal = (ids) => setLinkedGoalIds(prev => Array.from(new Set([...prev, ...ids])));
  const unlinkGoal = (id) => setLinkedGoalIds(prev => prev.filter(x => x !== id));

  const createTask = useAppStore(s => s.createTask);
  const showToast = useAppStore(s => s.showToast);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const allPatients = useAppStore(s => s.allPatients);
  const taskPools = useAppStore(s => s.taskPools);

  const assigneeOptions = useMemo(() => {
    const list = [];
    const seenNames = new Set();
    if (currentUserProfile && currentUserProfile.name) {
      list.push({ value: currentUserProfile.name, label: `${currentUserProfile.name} (You)` });
      seenNames.add(currentUserProfile.name);
    }
    (taskProfiles || []).forEach(p => {
      if (seenNames.has(p.name)) return;
      list.push({ value: p.name, label: p.name });
      seenNames.add(p.name);
    });
    if (list.length === 0) return ASSIGNEE_OPTIONS.map(n => ({ value: n, label: n }));
    return list;
  }, [taskProfiles, currentUserProfile]);

  const memberOptions = useMemo(() => {
    const names = (allPatients || []).flatMap(p => p.name ? [p.name] : []);
    return names.length > 0 ? names : MEMBER_OPTIONS;
  }, [allPatients]);

  const isDirty =
    name.trim() !== '' ||
    dueDate !== '' ||
    assignedTo !== '' ||
    member !== '' ||
    pool !== '' ||
    description.replace(/<[^>]*>/g, '').trim() !== '' ||
    selectedLabels.length > 0 ||
    priority !== 'medium' ||
    status !== initialStatus ||
    stagedSubtasks.length > 0 ||
    (includeScheduleFields && (
      creationTiming !== 'immediate' ||
      creationTrigger !== 'Care Plan Signed' ||
      dueOffset !== '7' ||
      dueUnit !== 'day' ||
      durationType !== 'calendar' ||
      repeat ||
      linkedGoalIds.length > 0
    ));

  // Creator attribution is mandatory: without a signed-in profile we can't
  // stamp `created_by` truthfully, so block Save.
  const canSave = name.trim() !== '' && isDirty && name.length <= TITLE_MAX && !!currentUserProfile?.name;

  const addStagedSubtask = () => {
    const trimmed = subtaskName.trim();
    if (!trimmed) return;
    setStagedSubtasks(prev => [...prev, { name: trimmed.slice(0, TITLE_MAX), priority: 'none' }]);
    setSubtaskName('');
    setShowAddSubtask(false);
  };
  const removeStagedSubtask = (idx) => setStagedSubtasks(prev => prev.filter((_, i) => i !== idx));
  // Partial update: pass a string to rename, or `{ name, priority }` to
  // patch selectively. Empty name removes the row.
  const updateStagedSubtask = (idx, next) => {
    const patch = typeof next === 'string' ? { name: next } : (next || {});
    setStagedSubtasks(prev => {
      if (!prev[idx]) return prev;
      const copy = [...prev];
      const current = copy[idx];
      const merged = { ...current, ...patch };
      if (typeof merged.name === 'string') merged.name = merged.name.trim().slice(0, TITLE_MAX);
      if (!merged.name) return prev.filter((_, i) => i !== idx);
      copy[idx] = merged;
      return copy;
    });
  };

  const handleSave = async () => {
    if (!canSave) return;
    if (!currentUserProfile?.name) {
      showToast('Cannot create task: no user identified');
      return;
    }
    const me = currentUserProfile.name;
    const meId = currentUserProfile.id || null;
    const pickedAssignee = assignedTo
      ? (taskProfiles || []).find(p => p.name === assignedTo)
      : null;
    const finalAssigneeName = pool ? null : (assignedTo || me);
    const finalAssigneeId = pool
      ? null
      : (pickedAssignee?.id || (assignedTo === me ? meId : null) || meId);
    const task = {
      name: name.trim().slice(0, TITLE_MAX),
      status,
      priority,
      due_date: dueDate || todayMMDDYYYY(),
      assigned_to: finalAssigneeName,
      assigned_to_id: finalAssigneeId,
      member: member || (allPatients?.[0]?.name) || 'Celia Gerhold',
      labels: selectedLabels,
      meta: pool ? `Pool : ${pool}` : '',
      description: description || '',
      pool: pool || null,
      mentions: [],
      attachments: 0,
      comments: 0,
      is_subtask: false,
      parent_task: null,
      parent_task_id: null,
      created_by: me,
      created_by_id: meId,
      // Care-plan-scoped schedule fields: only sent when the drawer was
      // mounted with `showScheduleFields`, so tasks authored from Tasks
      // list keep the pre-existing payload shape.
      ...(includeScheduleFields ? {
        creation_timing: creationTiming,
        creation_count: creationCount,
        creation_trigger: creationTrigger,
        due_offset: dueOffset,
        due_unit: dueUnit,
        duration_type: durationType,
        repeat_enabled: repeat,
        repeat_count: repeatCount,
        repeat_every: repeatEvery,
        repeat_every_unit: repeatEveryUnit,
        repeat_ends: repeatEnds,
        repeat_ends_unit: repeatEndsUnit,
        linked_goal_ids: linkedGoalIds,
      } : {}),
      ...extraFields,
    };
    const result = await createTask(task, dbOmit?.length ? { dbOmit } : {});
    if (result) {
      await Promise.all(stagedSubtasks.map(sub => createTask({
        name: (sub?.name || '').slice(0, TITLE_MAX),
        status: 'pending',
        priority: sub?.priority && sub.priority !== 'none' ? sub.priority : 'medium',
        due_date: task.due_date,
        assigned_to: finalAssigneeName,
        assigned_to_id: finalAssigneeId,
        member: task.member,
        labels: [],
        parent_task: task.name,
        parent_task_id: result.id,
        is_subtask: true,
        attachments: 0,
        comments: 0,
        meta: '',
        description: '',
        pool: null,
        mentions: [],
        created_by: me,
        created_by_id: meId,
        ...extraFields,
      }, dbOmit?.length ? { dbOmit } : {})));
      showToast('Task created');
      onTaskCreated?.(result);
    }
  };

  // Veto the drawer close when there are unsaved changes, the confirm opens
  // over the still-open drawer; "Keep editing" just dismisses the confirm.
  const guardClose = () => {
    if (isDirty) { setShowCloseConfirm(true); return false; }
    return true;
  };

  const toggleLabel = (l) => {
    setSelectedLabels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  };

  return {
    name, setName,
    priority, setPriority,
    status, setStatus,
    dueDate, setDueDate,
    assignedTo, setAssignedTo,
    member, setMember,
    pool, setPool,
    description, setDescription,
    selectedLabels,
    showCloseConfirm, setShowCloseConfirm,
    showAddSubtask, setShowAddSubtask,
    subtaskName, setSubtaskName,
    stagedSubtasks,
    editorRef,
    assigneeOptions,
    memberOptions,
    taskPools,
    currentUserProfile,
    canSave,
    handleSave,
    guardClose,
    toggleLabel,
    addStagedSubtask,
    removeStagedSubtask,
    updateStagedSubtask,
    STATUS_ORDER,
    STATUS_LABELS,
    PRIORITY_OPTIONS,
    TITLE_MAX,
    // Schedule fields (Creation Date / Due Date / Duration Type / Repeat).
    creationTiming, setCreationTiming,
    creationCount, setCreationCount,
    creationTrigger, setCreationTrigger,
    dueOffset, setDueOffset,
    dueUnit, setDueUnit,
    durationType, setDurationType,
    repeat, setRepeat,
    repeatCount, setRepeatCount,
    repeatEvery, setRepeatEvery,
    repeatEveryUnit, setRepeatEveryUnit,
    repeatEnds, setRepeatEnds,
    repeatEndsUnit, setRepeatEndsUnit,
    // Linked Goals (M:N).
    linkedGoalIds,
    linkGoal,
    unlinkGoal,
  };
}
