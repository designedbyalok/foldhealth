import { useState } from 'react';
import { AnchoredPopover } from '../../../../../../../../components/AnchoredPopover/AnchoredPopover';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../../../../components/Button/Button';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { formatElapsed } from './reviewTime';
import styles from './CarePlanReviewDrawer.module.css';

const KIND_ICON = {
  goal: 'solar:target-linear',
  intervention: 'solar:checklist-minimalistic-linear',
  barrier: 'solar:danger-triangle-linear',
};

/**
 * Opens in the middle of the screen when the review timer stops: the
 * recorded time, what was discussed, and the call note filled in on the
 * call (still editable). Complete Review finishes the review, the plan's new
 * last reviewed date, logged to the Activity Log. Resume restarts the clock.
 */
export function CompleteReviewPopover({ elapsedMs, discussed, note, onNoteChange, onResume, onComplete, onClose }) {
  const [saving, setSaving] = useState(false);
  return (
    <AnchoredPopover
      centered
      backdrop
      title="Complete review"
      description="Check the call note and what was covered, then complete the review."
      width={520}
      maxHeight={640}
      onClose={onClose}
    >
      <div className={styles.complete}>
        <div className={styles.completeStats}>
          <div className={styles.completeStat}>
            <Icon name="solar:stopwatch-linear" size={16} color="var(--primary-300)" />
            <span className={styles.completeValue}>{formatElapsed(elapsedMs)}</span>
            <span className={styles.completeLabel}>Recorded time</span>
          </div>
          <span className={styles.completeDivider} aria-hidden="true" />
          <div className={styles.completeStat}>
            <Icon name="solar:check-read-linear" size={16} color="var(--status-success)" />
            <span className={styles.completeValue}>{discussed.length}</span>
            <span className={styles.completeLabel}>{discussed.length === 1 ? 'Item discussed' : 'Items discussed'}</span>
          </div>
        </div>
        {discussed.length > 0 && (
          <ul className={styles.completeList}>
            {discussed.map(item => (
              <li key={item.id}>
                <Icon name={KIND_ICON[item.kind]} size={14} color="var(--neutral-300)" />
                <span className={styles.completeItem}>{item.title}</span>
                <span className={styles.completeItemStatus}>{item.status}</span>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          richText
          title="Call note"
          placeholder="What was discussed, what's next"
          value={note}
          onChange={(v) => onNoteChange(typeof v === 'string' ? v : (v?.target?.value ?? ''))}
          rows={3}
        />
        <div className={styles.completeActions}>
          <Button variant="secondary" size="S" leadingIcon="solar:play-linear" onClick={onResume} disabled={saving}>
            Resume
          </Button>
          <Button
            variant="primary"
            size="S"
            leadingIcon="solar:check-circle-linear"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try { await onComplete(); } finally { setSaving(false); }
            }}
          >
            Complete Review
          </Button>
        </div>
      </div>
    </AnchoredPopover>
  );
}
