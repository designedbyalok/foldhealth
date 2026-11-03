import { useState } from 'react';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Checkbox } from '../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../../components/ShadcnDialog/ShadcnDialog';
import styles from './AccessControl.module.css';

/** "Copy Permissions?": pick the roles that get `from`'s permissions. Laid out like ReasonDialog. */
export function CopyPermissionsDialog({ from, roles, onCancel, onConfirm }) {
  const [picked, setPicked] = useState([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const q = query.trim().toLowerCase();
  const shown = q ? roles.filter(r => r.name.toLowerCase().includes(q)) : roles;

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent hideClose className={styles.copyDialog}>
        <div className={styles.copyBody}>
          <DialogTitle className={styles.copyTitle}>Copy Permissions?</DialogTitle>
          <DialogDescription className={styles.copyDesc}>
            Choose which other roles should have the same permissions as <strong className={styles.strong}>{from?.name}</strong>.
          </DialogDescription>
          <div className={styles.copyField}>
            <Input
              leadingIcon="solar:magnifer-linear"
              placeholder="Search roles"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search roles"
            />
            <div className={styles.copyList}>
              {shown.map(role => (
                <label key={role.id} className={styles.copyRow}>
                  <Checkbox checked={picked.includes(role.id)} onCheckedChange={() => toggle(role.id)} aria-label={role.name} />
                  {role.name}
                </label>
              ))}
              {!shown.length && <span className={styles.copyEmpty}>No roles match &ldquo;{query.trim()}&rdquo;</span>}
            </div>
          </div>
          <div className={styles.copyFooter}>
            <Button variant="outline" fullWidth onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button
              fullWidth
              disabled={!picked.length}
              disabledReason={!picked.length ? 'Pick at least one role' : undefined}
              onClick={async () => { setSaving(true); await onConfirm(picked); }} loading={saving}
            >
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
