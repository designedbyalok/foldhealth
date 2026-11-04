import { useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Input } from '../../../../../../components/Input/Input';
import { Select } from '../../../../../../components/Select/Select';
import { Button } from '../../../../../../components/Button/Button';
import styles from './AddTaskDrawer.module.css';

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// MM/DD/YYYY from a native date input's yyyy-mm-dd value.
const fmtDue = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};

/**
 * Lightweight "Add Task" drawer used by a program's Outreach quick-action.
 * Produces a task in the Program Related Tasks list shape and hands it to
 * `onSave`; persistence is the caller's concern (session store today).
 */
export function AddTaskDrawer({ onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [priority, setPriority] = useState('medium');
  const [due, setDue] = useState('');

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: `task-${Date.now()}`,
      title: title.trim(),
      context: context.trim(),
      priority,
      status: 'Pending',
      due: fmtDue(due) || '-',
      overdue: false,
      subtasks: 0,
      attachments: 0,
      comments: 0,
    });
    onClose();
  };

  return (
    <Drawer
      title="Add Task"
      onClose={onClose}
      footer={(
        <div className={styles.footer}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>Add Task</Button>
        </div>
      )}
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Task Title</span>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Follow up on labs" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Description</span>
          <Input value={context} onChange={e => setContext(e.target.value)} placeholder="Optional context" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Priority</span>
          <Select options={PRIORITY_OPTIONS} value={priority} onValueChange={setPriority} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Due Date</span>
          <Input type="date" value={due} onChange={e => setDue(e.target.value)} />
        </label>
      </div>
    </Drawer>
  );
}
