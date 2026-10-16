import { useState } from 'react';
import { ReasonDialog } from '../../../../components/ReasonDialog/ReasonDialog';
import { Checkbox } from '../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { UNLOCK_REASONS } from './accountLock';
import styles from './AccountLockPanel.module.css';

const BY_LABEL = Object.fromEntries(UNLOCK_REASONS.map(r => [r.label, r.code]));

/**
 * Unlock asks for a reason and a confirmation that the user's identity was
 * checked. Optionally it requires a new password; a suspected attack always
 * does (the database enforces it).
 */
export function UnlockAccountDialog({ user, onCancel, onConfirm }) {
  const [identityChecked, setIdentityChecked] = useState(false);
  const [requireReset, setRequireReset] = useState(false);
  return (
    <ReasonDialog
      title={`Unlock ${user.name}?`}
      description="They can sign in again right away. The reason, your name and the time are recorded on their profile."
      decision="pass"
      standardReasons={UNLOCK_REASONS.map(r => r.label)}
      confirmLabel="Unlock Account"
      confirmVariant="primary"
      confirmDisabled={!identityChecked}
      notesPlaceholder="How you checked their identity, or why you're unlocking (required for Other)"

      onCancel={onCancel}
      onSubmit={({ code, freeText }) => onConfirm({
        reason: code ? BY_LABEL[code] : 'other',
        note: freeText,
        identityConfirmed: identityChecked,
        requireReset,
      })}
    >
      <label className={styles.check}>
        <Checkbox checked={identityChecked} onCheckedChange={v => setIdentityChecked(v === true)} />
        <span>I checked this user's identity</span>
      </label>
      <label className={styles.check}>
        <Checkbox checked={requireReset} onCheckedChange={v => setRequireReset(v === true)} />
        <span>Require a new password at the next sign-in (always on for a suspected attack)</span>
      </label>
    </ReasonDialog>
  );
}
