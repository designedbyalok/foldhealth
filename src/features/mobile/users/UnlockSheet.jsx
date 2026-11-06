import { useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Icon } from '../../../components/Icon/Icon';
import { Textarea } from '../../../components/Textarea/Textarea';
import { UNLOCK_REASONS } from '../../settings/account/users/accountLock';
import form from '../patient/patientForm.module.css';
import styles from './users.module.css';

const OTHER = '__other__';

/**
 * Unlock an account (desktop UnlockAccountDialog): a reason, or Other with
 * a note, and confirming the user's identity was checked. Resolves to the
 * same { reason, note, identityConfirmed } the desktop dialog sends.
 */
export function UnlockSheet({ user, onConfirm, onClose }) {
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [identity, setIdentity] = useState(false);
  const [busy, setBusy] = useState(false);
  const code = choice === OTHER ? '' : choice;
  const valid = (!!code || note.trim().length > 0) && identity;
  const options = [...UNLOCK_REASONS, { code: OTHER, label: 'Other (free text only)' }];

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm({ reason: code || 'other', note: note.trim(), identityConfirmed: identity });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={`Unlock ${user.name}?`} onClose={onClose}>
      <p className={styles.sheetText}>
        We&rsquo;ll email them their User ID and a one-time link (valid 24 hours) to set a new password. The reason, your name and the time are recorded on their profile.
      </p>
      <div className={form.choices} role="radiogroup" aria-label="Reason">
        {options.map(o => (
          <button key={o.code} type="button" role="radio" aria-checked={choice === o.code} className={form.choice} onClick={() => setChoice(o.code)}>
            <span className={form.choiceText}><span className={form.choiceLabel}>{o.label}</span></span>
            {choice === o.code && <Icon name="solar:check-circle-linear" size={24} color="var(--primary-300)" />}
          </button>
        ))}
      </div>
      <Textarea
        aria-label={`Additional notes${code ? ' (optional)' : ''}`}
        rows={3}
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="How you checked their identity, or why you're unlocking (required for Other)"
      />
      <label className={styles.checkRow}>
        <Checkbox checked={identity} onCheckedChange={v => setIdentity(v === true)} aria-label="I checked this user's identity" />
        <span>I checked this user&rsquo;s identity</span>
      </label>
      <div className={styles.sheetActions}>
        <Button size="lg" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="lg" onClick={submit} disabled={!valid} loading={busy}>Unlock account</Button>
      </div>
    </BottomSheet>
  );
}
