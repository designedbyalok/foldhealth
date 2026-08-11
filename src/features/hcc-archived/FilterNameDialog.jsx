import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../../components/ShadcnDialog/ShadcnDialog';
import { Button } from '../../components/Button/Button';
import styles from './FilterNameDialog.module.css';

/**
 * Dialog used for both "Save Filter" (creating a new saved filter from the
 * currently-active hccFilters) and "Rename Filter" (editing an existing saved
 * filter's name). The dialog is presentational — the caller decides what to do
 * with the name in `onSubmit`.
 *
 * Props:
 *  - open       (boolean)
 *  - title      (string)              Dialog heading
 *  - submitLabel(string)               Primary button label
 *  - initialName(string)               Pre-filled value
 *  - onSubmit   (fn(name: string))     Called when user clicks the primary button
 *  - onCancel   (fn)                   Called on overlay click / Cancel / Esc
 */
export function FilterNameDialog({
  open,
  title = 'Save Filter',
  submitLabel = 'Save & Apply',
  initialName = '',
  onSubmit,
  onCancel,
}) {
  const [name, setName] = useState(initialName);

  // Reset draft when the dialog opens
  useEffect(() => { if (open) setName(initialName); }, [open, initialName]);

  const canSubmit = name.trim().length > 0;
  const submit = () => { if (canSubmit) onSubmit?.(name.trim()); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel?.(); }}>
      <DialogContent className={styles.content}>
        <DialogTitle className={styles.title}>{title}</DialogTitle>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Name
            <span className={styles.required} aria-hidden="true" />
          </span>
          <input
            type="text"
            value={name}
            placeholder="Enter Filter Name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) submit();
              if (e.key === 'Escape') onCancel?.();
            }}
            className={styles.input}
            maxLength={60}
          />
        </label>
        <div className={styles.actions}>
          <Button variant="secondary" size="M" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="M" disabled={!canSubmit} onClick={submit}>
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
