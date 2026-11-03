import { useEffect, useState } from 'react';
import { Button } from '../../../../components/Button/Button';
import { Icon } from '../../../../components/Icon/Icon';
import { formatLockTime, isLocked, reasonLabel } from './accountLock';
import styles from './AccountLockPanel.module.css';

/**
 * The lock context on a user's profile, as one compact card: when, how many
 * attempts, from which apps and who locked it, with the Unlock action. After
 * an unlock it shows who did it, when and why.
 */
// The "activated" card shows once per viewer per unlock: opening the profile
// marks it read, and it's gone the next time. Kept in this browser only.
const seenKey = (lock) => `fold.activationSeen.${lock.user_id}.${lock.unlocked_at}`;
const wasSeen = (key) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };

export function AccountLockPanel({ lock, canUnlock, onUnlock, onResendLink }) {
  const [resending, setResending] = useState(false);
  const activated = !!lock && !isLocked(lock) && !!lock.unlocked_at && !lock.require_reset;
  const key = activated ? seenKey(lock) : null;
  // Read once on open, so the card stays for this visit after being marked.
  const [seenBefore] = useState(() => (key ? wasSeen(key) : false));
  useEffect(() => {
    if (key) { try { localStorage.setItem(key, '1'); } catch { /* storage blocked */ } }
  }, [key]);
  if (!lock) return null;
  const resend = async () => {
    setResending(true);
    try { await onResendLink(); } finally { setResending(false); }
  };
  if (isLocked(lock)) {
    const attempts = lock.failed_count || 5;
    const details = [
      `Since ${formatLockTime(lock.locked_at)}`,
      `${attempts} failed attempt${attempts === 1 ? '' : 's'}`,
      (lock.failed_apps || []).join(', '),
      lock.locked_by === 'system' ? 'Locked by the system' : lock.locked_by && `Locked by ${lock.locked_by}`,
      !canUnlock && 'Only a practice admin can unlock it',
    ].filter(Boolean).join(' · ');
    return (
      <section className={[styles.panel, styles.locked].join(' ')} aria-label="Account locked">
        <div className={styles.head}>
          <Icon name="solar:lock-keyhole-minimalistic-linear" size={16} color="var(--status-error)" />
          <div className={styles.text}>
            <span className={styles.title}>Account locked</span>
            <span className={styles.note}>{details}</span>
          </div>
          {canUnlock && (
            <Button variant="outline" size="sm" leadingIcon="solar:lock-keyhole-unlocked-linear" onClick={onUnlock}>
              Unlock
            </Button>
          )}
        </div>
      </section>
    );
  }
  if (!lock.unlocked_at) return null;
  const by = lock.unlock_reason === 'password_reset' ? 'the user' : (lock.unlocked_by_name || 'an admin');
  const reason = `${reasonLabel(lock.unlock_reason)}${lock.unlock_note ? ` (${lock.unlock_note})` : ''}`;
  // They've set a new password: the account is back in use.
  if (activated) {
    if (seenBefore) return null;
    return (
      <section className={[styles.panel, styles.activated].join(' ')} aria-label="Account activated">
        <div className={styles.head}>
          <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
          <div className={styles.text}>
            <span className={styles.title}>Account activated successfully</span>
            <span className={styles.note}>
              Unlocked by {by}, {formatLockTime(lock.unlocked_at)} · Reason: {reason} · They set a new password
            </span>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={styles.panel} aria-label="Account unlocked">
      <div className={styles.head}>
        <Icon name="solar:lock-keyhole-unlocked-linear" size={16} color="var(--neutral-300)" />
        <div className={styles.text}>
          <span className={styles.title}>Unlocked by {by}, {formatLockTime(lock.unlocked_at)}</span>
          <span className={styles.note}>
            Reason: {reason} · Waiting for them to set a new password from the emailed link
          </span>
        </div>
        {canUnlock && onResendLink && (
          <Button
            variant="outline"
            size="sm"
            leadingIcon="solar:letter-linear"
            leadingIconElement={resending ? <Icon name="solar:restart-linear" size={14} className={styles.spin} /> : undefined}
            onClick={resend} loading={resending}
          >
            Resend Link
          </Button>
        )}
      </div>
    </section>
  );
}
