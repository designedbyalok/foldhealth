import { useState } from 'react';
import { AnchoredPopover } from '../../../../../../../../components/AnchoredPopover/AnchoredPopover';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../../../../components/Button/Button';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { formatElapsed } from './reviewTime';
import styles from './CarePlanReviewDrawer.module.css';

/**
 * Opens from the review timer when it stops: the recorded time, the call
 * note, and Complete Review, which finishes the review (the plan's new last
 * reviewed date, logged to the Activity Log). Resume restarts the clock.
 */
export function CompleteReviewPopover({ anchorRect, elapsedMs, discussedCount, note, onNoteChange, onResume, onComplete, onClose }) {
  const [saving, setSaving] = useState(false);
  return (
    <AnchoredPopover anchorRect={anchorRect} title="Complete review" width={440} maxHeight={520} onClose={onClose}>
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
            <span className={styles.completeValue}>{discussedCount}</span>
            <span className={styles.completeLabel}>{discussedCount === 1 ? 'Item discussed' : 'Items discussed'}</span>
          </div>
        </div>
        <Textarea
          richText
          placeholder="Call note: what was discussed, what's next"
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
