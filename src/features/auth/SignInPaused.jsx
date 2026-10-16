import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import styles from './LoginPage.module.css';

/**
 * Shown on the 5th failed sign-in (or when an admin requires a new
 * password). It never says "locked", so it tells an attacker nothing; the
 * account owner gets the detail by email.
 */
export function SignInPaused({ reason = 'paused', onReset, onBack }) {
  const [showContact, setShowContact] = useState(false);
  const resetRequired = reason === 'resetRequired';
  return (
    <>
      <div className={styles.welcome}>
        <h1 className={styles.welcomeTitle}>
          <span className={styles.welcomePurple}>Sign-in </span>
          <span className={styles.welcomeDark}>{resetRequired ? 'Needs a New Password' : 'Paused'}</span>
        </h1>
        <p className={styles.welcomeSub}>
          {resetRequired
            ? 'Your administrator asked you to set a new password before you sign in.'
            : 'For your security, we paused sign-in for this account. We sent the details to the email on file.'}
        </p>
      </div>

      <div className={styles.form}>
        <Button variant="primary" size="L" fullWidth leadingIcon="solar:key-linear" onClick={onReset}>
          Reset Your Password
        </Button>
        {!resetRequired && (
          <Button variant="secondary" size="L" fullWidth leadingIcon="solar:user-speak-linear" onClick={() => setShowContact(v => !v)}>
            Contact Your Administrator
          </Button>
        )}
        {showContact && (
          <div className={styles.unverifiedNotice}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--status-info)" />
            <div className={styles.unverifiedBody}>
              Ask your practice administrator to unlock your account. They can do it from Settings in Fold Health after checking it's you.
            </div>
          </div>
        )}
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
