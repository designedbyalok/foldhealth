import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { TITLE_MAX, todayMMDDYYYY } from '../../tasks/TasksView.utils';
import { MobileSubHeader } from '../MobileHeader';
import { useMobileNav } from '../MobileNavContext';
import common from '../mobile.module.css';
import styles from './AddTaskScreen.module.css';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
];

// The date field speaks ISO (YYYY-MM-DD); tasks store MM-DD-YYYY.
const isoToTaskDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${m}-${d}-${y}` : '';
};
const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/**
 * Add a task from the phone. Same payload as the desktop Add Task drawer
 * (useAddTaskDrawer): name, status, priority, due_date (MM-DD-YYYY),
 * assigned_to / assigned_to_id, member, description, created_by.
 * Opened from a profile, the patient is filled in and linked by patient_id.
 */
export function AddTaskScreen({ patientId, patientName }) {
  const { pop } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const platformUsers = useAppStore(s => s.platformUsers);
  const allPatients = useAppStore(s => s.allPatients);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const createTask = useAppStore(s => s.createTask);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState(todayIso);
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');
  const [member, setMember] = useState(patientName || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTaskProfiles?.(); if (!patientName) fetchAllPatients?.(); }, [fetchTaskProfiles, fetchAllPatients, patientName]);

  const people = useMemo(() => {
    const list = (taskProfiles?.length ? taskProfiles : platformUsers) || [];
    const seen = new Set();
    return list.filter(p => p?.name && !seen.has(p.name) && seen.add(p.name));
  }, [taskProfiles, platformUsers]);
  const assigneeOptions = useMemo(() => people.map(p => ({ value: p.name, label: p.name === me?.name ? `${p.name} (You)` : p.name })), [people, me]);
  const memberOptions = useMemo(() => (allPatients || []).map(p => ({ value: p.name, label: p.name })), [allPatients]);

  const canSave = name.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    if (!me?.name) {
      toast.error('Cannot create task: no user identified');
      return;
    }
    const assignedTo = assignee || me.name;
    const picked = people.find(p => p.name === assignedTo);
    const task = {
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
      ...(patientId != null ? { patient_id: String(patientId) } : {}),
    };
    setSaving(true);
    let result;
    try { result = await createTask(task); } catch { result = null; } finally { setSaving(false); }
    if (!result) {
      toast.error('Could not create the task.');
      return;
    }
    toast.success('Task created');
    pop();
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Add Task" />
      <div className={`${common.body} ${styles.body}`}>
        <div className={styles.form}>
          <Input
            label="Title"
            required
            size="lg"
            placeholder="Enter task title"
            value={name}
            onValueChange={setName}
            maxLength={TITLE_MAX}
          />
          <Textarea
            rows={4}
            title="Description"
            placeholder="Add details"
            value={description}
            onValueChange={setDescription}
          />
          <Input label="Due Date" type="date" size="lg" value={due} onValueChange={setDue} />
          <div className={styles.field}>
            <span className={styles.label}>Priority</span>
            <SegmentedControl size="lg" fullWidth aria-label="Priority" value={priority} onValueChange={setPriority} items={PRIORITIES} />
          </div>
          <Select
            label="Assignee"
            searchable
            options={assigneeOptions}
            value={assignee || me?.name || ''}
            onValueChange={setAssignee}
            placeholder="Select assignee"
          />
          {patientName ? (
            <Input label="Member" size="lg" value={patientName} readOnly />
          ) : (
            <Select
              label="Member"
              searchable
              options={memberOptions}
              value={member}
              onValueChange={setMember}
              placeholder="Select member (optional)"
            />
          )}
        </div>
      </div>
      <div className={styles.footer}>
        <Button size="lg" variant="solid" fullWidth onClick={save} disabled={!canSave} loading={saving}>Add Task</Button>
      </div>
    </div>
  );
}
