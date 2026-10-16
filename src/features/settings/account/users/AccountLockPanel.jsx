import { Button } from '../../../../components/Button/Button';
import { Icon } from '../../../../components/Icon/Icon';
import { formatLockTime, isLocked, reasonLabel } from './accountLock';
import styles from './AccountLockPanel.module.css';

function Row({ label, value }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value || 'Not recorded'}</span>
    </div>
  );
}

/**
 * The lock context on a user's profile: when, how many attempts, from which
 * apps, last IP and who locked it, with the Unlock action. After an unlock it
 * shows who did it, when and why.
 */
export function AccountLockPanel({ lock, canUnlock, onUnlock }) {
  if (!lock) return null;
  if (isLocked(lock)) {
    return (
      <section className={[styles.panel, styles.locked].join(' ')} aria-label="Account locked">
        <div className={styles.head}>
          <Icon name="solar:lock-keyhole-minimalistic-linear" size={16} color="var(--status-error)" />
          <span className={styles.title}>Account locked</span>
          {canUnlock && (
            <Button variant="secondary" size="S" leadingIcon="solar:lock-keyhole-unlocked-linear" onClick={onUnlock}>
              Unlock
            </Button>
          )}
        </div>
        <div className={styles.grid}>
          <Row label="Locked" value={formatLockTime(lock.locked_at)} />
          <Row label="Failed attempts" value={String(lock.failed_count || 5)} />
          <Row label="From" value={(lock.failed_apps || []).join(', ')} />
          <Row label="Last IP" value={lock.last_ip} />
          <Row label="Locked by" value={lock.locked_by === 'system' ? 'The system' : lock.locked_by} />
        </div>
        {!canUnlock && (
          <p className={styles.note}>The user can reset their password with an emailed code, or an admin can unlock the account.</p>
        )}
      </section>
    );
  }
  if (!lock.unlocked_at) return null;
  const by = lock.unlock_reason === 'password_reset' ? 'the user' : (lock.unlocked_by_name || 'an admin');
  return (
    <section className={styles.panel} aria-label="Account unlocked">
      <div className={styles.head}>
        <Icon name="solar:lock-keyhole-unlocked-linear" size={16} color="var(--neutral-300)" />
        <span className={styles.title}>Unlocked by {by}, {formatLockTime(lock.unlocked_at)}</span>
      </div>
      <p className={styles.note}>
        Reason: {reasonLabel(lock.unlock_reason)}{lock.unlock_note ? ` (${lock.unlock_note})` : ''}
        {lock.require_reset ? '. A new password is required at the next sign-in.' : ''}
      </p>
    </section>
  );
}
