import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { TITLE_MAX, todayMMDDYYYY } from '../../tasks/TasksView.utils';
import { useMobileNav } from '../MobileNavContext';
import { Field, FormShell } from './MessageForm';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
];
const isoToTaskDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${m}-${d}-${y}` : '';
};
const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/**
 * Create Task from a message (desktop CommsThread ••• → AddTaskDrawer with
 * initialMember): the member is the message's, the payload is the desktop
 * Add Task one (useAddTaskDrawer), and the toast offers to open the task.
 */
export function MessageTaskScreen({ member }) {
  const { pop, push } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const createTask = useAppStore(s => s.createTask);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState(todayIso);
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTaskProfiles?.(); }, [fetchTaskProfiles]);
  const people = useMemo(() => {
    const list = (taskProfiles?.length ? taskProfiles : platformUsers) || [];
    const seen = new Set();
    return list.filter(p => p?.name && !seen.has(p.name) && seen.add(p.name));
  }, [taskProfiles, platformUsers]);
  const assigneeOptions = people.map(p => ({ value: p.name, label: p.name === me?.name ? `${p.name} (You)` : p.name }));

  const save = async () => {
    if (!name.trim() || saving) return;
    if (!me?.name) { toast.error('Cannot create task: no user identified'); return; }
    const assignedTo = assignee || me.name;
    const picked = people.find(p => p.name === assignedTo);
    setSaving(true);
    let result;
    try {
      result = await createTask({
        name: name.trim().slice(0, TITLE_MAX),
        status: 'pending',
        priority,
        due_date: isoToTaskDate(due) || todayMMDDYYYY(),
        assigned_to: assignedTo,
        assigned_to_id: picked?.id || (assignedTo === me.name ? me.id || null : null),
        member: member || '',
        labels: [],
        meta: '',
        description: description.trim(),
        pool: null,
        mentions: [],
        attachments: 0,
        comments: 0,
        is_subtask: false,
        parent_task: null,
        parent_task_id: null,
        created_by: me.name,
        created_by_id: me.id || null,
      });
    } catch { result = null; }
    setSaving(false);
    if (!result) { toast.error('Could not create the task.'); return; }
    pop();
    toast.success('Task Created Successfully', { action: { label: 'Open', onClick: () => push('taskDetail', { taskId: result.id }) } });
  };

  return (
    <FormShell
      title="Create Task"
      footer={<Button size="lg" fullWidth onClick={save} disabled={!name.trim() || saving} loading={saving}>Add Task</Button>}
    >
      <Input label="Title" required size="lg" placeholder="Enter task title" enterKeyHint="next" value={name} onValueChange={setName} maxLength={TITLE_MAX} />
      <Textarea rows={4} title="Description" placeholder="Add details" value={description} onValueChange={setDescription} />
      <Input label="Due Date" type="date" size="lg" value={due} onValueChange={setDue} />
      <Field label="Priority">
        <SegmentedControl size="lg" fullWidth aria-label="Priority" value={priority} onValueChange={setPriority} items={PRIORITIES} />
      </Field>
      <Select label="Assignee" searchable options={assigneeOptions} value={assignee || me?.name || ''} onValueChange={setAssignee} placeholder="Select assignee" />
      <Input label="Member" size="lg" value={member || ''} readOnly />
    </FormShell>
  );
}
