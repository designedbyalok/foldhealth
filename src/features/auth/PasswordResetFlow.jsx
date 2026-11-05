import { useId, useState } from 'react';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { track } from '../../lib/tracking';
import { supabase } from '../../lib/supabase';
import styles from './LoginPage.module.css';

/**
 * Forgot password via Supabase: enter your email, Supabase emails a recovery
 * link (supabase/templates/recovery.html points it at
 * {{ .SiteURL }}#/reset-password?token_hash=…&type=recovery), and
 * ResetPasswordPage redeems the token and sets the new password. The screen
 * answers the same whether or not the account exists, so it never reveals
 * which emails are registered.
 */
export function PasswordResetFlow({ initialEmail = '', onBack }) {
  const uid = useId();
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const sendLink = async (e) => {
    e?.preventDefault?.();
    const clean = email.trim();
    if (!clean) { setError('Enter your email.'); return; }
    setLoading(true);
    setError('');
    let err;
    try {
      ({ error: err } = await supabase.auth.resetPasswordForEmail(clean));
    } finally {
      setLoading(false);
    }
    // A missing account is not surfaced (Supabase returns success for it); only
    // real failures, like a rate limit or a lost connection, are.
    if (err) { setError(err.message || "We couldn't send the reset email. Try again in a moment."); return; }
    track('auth.password_reset_link_requested');
    setSent(true);
  };

  return (
    <>
      <div className={styles.welcome}>
        <h1 className={styles.welcomeTitle}>
          <span className={styles.welcomePurple}>Reset </span>
          <span className={styles.welcomeDark}>Password</span>
        </h1>
        <p className={styles.welcomeSub}>
          {sent
            ? 'Check your email for the link to set a new password.'
            : "Enter your email and we'll send you a link to reset your password."}
        </p>
      </div>

      {sent ? (
        <div className={styles.success}>
          <Icon name="solar:letter-linear" size={14} color="var(--status-success)" />
          If {email.trim()} has a Fold Health account, we have emailed a link to reset your password. The link expires in 24 hours.
        </div>
      ) : (
        <form className={styles.form} onSubmit={sendLink}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-email`}>Email</label>
            <Input id={`${uid}-email`} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@fold.health" autoComplete="email" />
          </div>
          {error && <div className={styles.error}><Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />{error}</div>}
          <Button fullWidth type="submit" loading={loading}>
            Send Reset Link
          </Button>
        </form>
      )}

      <div className={styles.toggleAuth}>
        <button type="button" className={styles.toggleLink} onClick={onBack}>
          <Icon name="solar:alt-arrow-left-linear" size={14} color="currentColor" />
          Back to login
        </button>
      </div>
    </>
  );
}
