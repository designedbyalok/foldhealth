import { useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../../components/Input/Input';
import { Select } from '../../../../../../../../components/Select/Select';
import styles from './CarePlanView.module.css';

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met']
  .map(v => ({ value: v, label: v }));

// Deliberately plain: title, who owns it, how long, and status. This is the
// simplified intervention entry (roadmap #6) — no automation wizard.
export function AddInterventionDrawer({ intervention, onClose, onSave }) {
  const [title, setTitle] = useState(intervention?.title || '');
  const [assignee, setAssignee] = useState(intervention?.assignee?.name || '');
  const [duration, setDuration] = useState(intervention?.duration || '');
  const [status, setStatus] = useState(intervention?.status || 'Not Started');

  const canSave = title.trim().length > 0;
  const initialsOf = (name) => name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const headerRight = (
    <>
      <Button
        variant="primary"
        size="L"
        disabled={!canSave}
        onClick={() => onSave({
          title: title.trim(),
          duration: duration.trim() || null,
          status,
          assignee: { name: assignee.trim() || 'Unassigned', initials: assignee.trim() ? initialsOf(assignee) : '' },
        })}
      >
        Save
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer
      title={intervention ? 'Edit Intervention' : 'Add Intervention'}
      onClose={onClose}
      headerRight={headerRight}
      noCloseDivider
    >
      <div className={styles.drawerBody}>
        <div className={styles.drawerField}>
          <span className={styles.drawerLabel}>Name <span className={styles.required}>*</span></span>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Measure blood pressure everyday" aria-label="Intervention name" />
        </div>
        <div className={styles.drawerField}>
          <span className={styles.drawerLabel}>Assigned To</span>
          <Input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Enter a name" aria-label="Assigned to" />
        </div>
        <div className={styles.drawerField}>
          <span className={styles.drawerLabel}>Duration</span>
          <Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 9D" aria-label="Duration" />
        </div>
        <div className={styles.drawerField}>
          <span className={styles.drawerLabel}>Status</span>
          <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </div>
      </div>
    </Drawer>
  );
}
