import { useState } from 'react';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Button } from '../../../components/Button/Button';
import styles from './DismissReasonForm.module.css';

// Dismiss reasons: Figma ICD-Import states (node 4696:135817). Shared by the
// confirmed-ICD card (IcdDosCard) and the suspect row (HccSuspectGroup) so both
// dismiss flows offer the same reasons and layout.
const DISMISS_REASONS = [
  'Condition Not Present (Unsupported, Resolved or Transient)',
  'Condition Ruled Out',
  'Historical Diagnosis',
  'Coding Error or Misclassification',
  'Other',
];

/**
 * Inline dismiss-reason form: reason radios + a note, Confirm disabled until a
 * reason is chosen.
 *
 * @param {object} props
 * @param {string} [props.initialReason]
 * @param {string} [props.initialNote]
 * @param {() => void} props.onCancel
 * @param {(reason: string, note: string) => void} props.onConfirm
 */
export function DismissReasonForm({ initialReason = '', initialNote = '', onCancel, onConfirm }) {
  const [reason, setReason] = useState(initialReason);
  const [note, setNote] = useState(initialNote);

  return (
    // The form is a sibling of the DOS row (not inside it), so clicks bubble
    // straight to the parent IcdDosCard whose whole-card handler toggles the
    // ICD selection. Contain events here so confirming/cancelling doesn't
    // deselect the ICD or drop the doc viewer back to its no-scope fallback.
    <div
      className={styles.dismissForm}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className={styles.dismissTitle}>Select a reason and add a note to dismiss the diagnosis gap:</div>
      <div className={styles.reasonList}>
        {DISMISS_REASONS.map((r) => (
          <RadioButton
            key={r}
            name="dismiss-reason"
            value={r}
            label={r}
            checked={reason === r}
            onChange={() => setReason(r)}
          />
        ))}
      </div>
      <div className={styles.noteLabel}>Note</div>
      <Textarea rows={3} placeholder="Add a Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className={styles.dismissActions}>
        <Button size="sm" disabled={!reason} onClick={() => onConfirm(reason, note)}>Confirm</Button>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
