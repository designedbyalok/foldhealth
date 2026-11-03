import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { requestAccountUnlock } from './accountSecurity';
import styles from './LoginPage.module.css';

/**
 * Shown on the 5th failed sign-in, and while an unlocked account waits for
 * its new password. Only an administrator can unlock: the user asks from
 * here, the admin checks who they are and unlocks, and the user gets an
 * email with a link to set a new password. The screen never says "locked";
 * the account owner gets the detail by email.
 */
export function SignInPaused({ reason = 'paused', email, onBack }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const waiting = reason === 'resetRequired';

  const ask = async () => {
    setSending(true);
    setError('');
    try {
      const r = await requestAccountUnlock(email);
      if (r.ok) setSent(true);
      else setError(r.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className={styles.welcome}>
        <h1 className={styles.welcomeTitle}>
          <span className={styles.welcomePurple}>Sign-in </span>
          <span className={styles.welcomeDark}>{waiting ? 'Needs a New Password' : 'Paused'}</span>
        </h1>
        <p className={styles.welcomeSub}>
          {waiting
            ? 'Your administrator unlocked your account. Use the link in the email we sent you to set a new password.'
            : 'For your security, we paused sign-in for this account. We sent the details to the email on file.'}
        </p>
      </div>

      <div className={styles.form}>
        {!sent && (
          <Button fullWidth leadingIcon="solar:user-speak-linear" onClick={ask} loading={sending}>
            {waiting ? 'Ask for a New Link' : 'Request Unlock from Administrator'}
          </Button>
        )}
        {error && (
          <div className={styles.error}>
            <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
            {error}
          </div>
        )}
        <div className={[styles.unverifiedNotice, styles.noticeInfo].join(' ')}>
          <Icon name={sent ? 'solar:check-circle-linear' : 'solar:info-circle-linear'} size={14} color="var(--status-info)" />
          <div className={styles.unverifiedBody}>
            {sent
              ? 'We asked your practice administrator to unlock your account. Once they confirm it\'s you, you\'ll get an email with a link to set a new password.'
              : 'Only your practice administrator can unlock your account. They\'ll check it\'s you, then you\'ll get an email with a link to set a new password.'}
          </div>
        </div>
      </div>

      <div className={styles.toggleAuth}>
        <button type="button" className={styles.toggleLink} onClick={onBack}>
          <Icon name="solar:alt-arrow-left-linear" size={14} color="currentColor" />
          Back to login
        </button>
      </div>
    </>
  );
}
