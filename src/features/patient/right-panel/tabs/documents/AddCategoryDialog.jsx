import { useState } from 'react';
import { Button } from '../../../../../components/Button/Button';
import { Input } from '../../../../../components/Input/Input';
import { Dialog, DialogContent, DialogTitle } from '../../../../../components/Dialog/Dialog';
import styles from './DocumentsTab.module.css';

/** Add Category: name a new document folder. `taken` holds names already in use. */
export function AddCategoryDialog({ taken = [], onCancel, onAdd }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();
  const duplicate = taken.some(t => t.toLowerCase() === trimmed.toLowerCase());
  const canAdd = !!trimmed && !duplicate && !saving;

  const submit = async () => {
    if (!canAdd) return;
    setSaving(true);
    await onAdd(trimmed);
  };

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent hideClose className={styles.categoryDialog}>
        <div className={styles.categoryDialogBody}>
          <DialogTitle className={styles.categoryDialogTitle}>Add Category</DialogTitle>
          <Input
            label="Name"
            required
            autoFocus
            placeholder="Enter category name"
            maxLength={40}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            errorText={duplicate ? 'A category with this name already exists.' : undefined}
          />
          <div className={styles.categoryDialogFooter}>
            <Button variant="outline" fullWidth onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button fullWidth disabled={!canAdd} onClick={submit}>Add</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
