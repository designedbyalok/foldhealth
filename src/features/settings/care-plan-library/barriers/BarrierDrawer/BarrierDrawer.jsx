import { useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { Input } from '../../../../../components/Input/Input';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { CARE_PLAN_TITLE_MAX } from '../../lib/carePlanLimits';
import styles from './BarrierDrawer.module.css';

/**
 * BarrierDrawer — authoring form for a single barrier, shared by the Care Plan
 * Library's "New Barrier" and the care plan's own add / edit barrier action so
 * both surfaces capture the same fields.
 *
 * @param {object} [props.barrier]  Existing barrier; omit to author a new one.
 * @param {string} [props.initialTitle]  Prefill for a new barrier (e.g. what
 *   the user typed into a picker's search).
 * @param {(values: {title: string, description: string}) => void} props.onSave
 */
export function BarrierDrawer({ barrier, initialTitle = '', onClose, onSave }) {
  const [title, setTitle] = useState(barrier?.title || initialTitle);
  const [description, setDescription] = useState(barrier?.description || '');
  const canSave = title.trim().length > 0;

  return (
    <Drawer
      title={barrier ? 'Edit Barrier' : 'Add Barrier'}
      onClose={onClose}
      secondaryAction={<Button variant="secondary" size="L" onClick={onClose}>Cancel</Button>}
      primaryAction={(
        <Button
          variant="primary"
          size="L"
          disabled={!canSave}
          onClick={() => onSave({ title: title.trim(), description: description.trim() })}
        >
          Save
        </Button>
      )}
    >
      <div className={styles.body}>
        <p className={styles.hint}>
          Capture what blocks this patient. It is tracked per plan and appears in the audit history.
        </p>
        <div className={styles.field}>
          <span className={styles.label}>Title <span className={styles.required}>•</span></span>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Transportation, no ride to clinic"
            aria-label="Barrier title"
            maxLength={CARE_PLAN_TITLE_MAX}
            characterLimit={CARE_PLAN_TITLE_MAX}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Description</span>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add details about this barrier"
            rows={3}
          />
        </div>
      </div>
    </Drawer>
  );
}
