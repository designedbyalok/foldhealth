import { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from '../../../components/ConfirmDialog/AlertDialogPrimitives';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Button } from '../../../components/Button/Button';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import styles from './DiagPanel.module.css';
// Record-level Reject reasons. Multi-select; a comment is ALWAYS required
// (no "optional" branch, unlike Insufficient), reject is terminal and
// downstream reviewers need the specific reason on the audit trail.
const REJECT_RECORD_REASONS = [
  'All documents belong to wrong patient',
  'All documents illegible',
  'All documents missing signature',
  'All documents outside valid date range',
  'Fraudulent or invalid submission',
  'Other',
];

/**
 * Modal shown when a reviewer picks "Rejected" in the DosStatusMenu.
 * Same shape as InsufficientDosDialog on ChartDetailDrawer, white card,
 * multi-select reasons, MANDATORY comment. Confirm applies the reject.
 */
export function RejectRecordDialog({ onCancel, onConfirm }) {
  const [reasons, setReasons] = useState(() => new Set());
  const [note, setNote] = useState('');
  const toggleReason = (r) => setReasons(prev => {
    const next = new Set(prev);
    if (next.has(r)) next.delete(r); else next.add(r);
    return next;
  });
  const canSubmit = reasons.size > 0 && note.trim().length > 0;
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <AlertDialogContent className={`${styles.rejectDialog} !max-w-[420px]`}>
        <div className={styles.rejectDialogHeader}>
          <div className={styles.rejectDialogTitleGroup}>
            <AlertDialogTitle className={styles.rejectDialogTitle}>
              Mark record Rejected
            </AlertDialogTitle>
            <AlertDialogDescription className={styles.rejectDialogSubtitle}>
              Please select a reason. A note is required.
            </AlertDialogDescription>
          </div>
          <CloseButton size={16} onClick={onCancel} className={styles.rejectDialogClose} />
        </div>
        <div className={styles.rejectDialogReasons}>
          {REJECT_RECORD_REASONS.map((r) => {
            const checked = reasons.has(r);
            return (
              <div
                key={r}
                role="checkbox"
                tabIndex={0}
                aria-checked={checked}
                aria-label={r}
                className={styles.rejectReasonOption}
                onClick={() => toggleReason(r)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleReason(r); } }}
              >
                <Checkbox
                  checked={checked}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none"
                />
                <span className={styles.rejectReasonLabel}>{r}</span>
              </div>
            );
          })}
        </div>
        <div className={styles.rejectDialogNoteLabel}>
          Note<span className={styles.rejectDialogRequired} aria-hidden="true"> *</span>
        </div>
        <Textarea
          rows={2}
          placeholder="Add a note explaining the rejection (required)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className={styles.rejectDialogActions}>
          <Button
            variant="soft" tone="danger"
            size="sm"
            disabled={!canSubmit}
            onClick={() => onConfirm({ reasons: REJECT_RECORD_REASONS.filter(r => reasons.has(r)), note: note.trim() })}
          >
            Confirm
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}