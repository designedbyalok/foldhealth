import { useEffect, useId, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { FoldHealthLogo } from '../../components/FoldHealthLogo/FoldHealthLogo';
import { track } from '../../lib/tracking';
import { LoginHeroPanel } from './LoginHeroPanel';
import { clearFailedSignIns, completeUnlockLink, inspectUnlockLink } from './accountSecurity';
import styles from './LoginPage.module.css';

/**
 * #/unlock-account?token=…, the link an administrator's unlock emails.
 * Shows the User ID, takes a new password and confirmation, then signs the
 * user in. The link works once and expires in 24 hours.
 */
export function UnlockAccountPage({ token, onDone }) {
  const uid = useId();
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    inspectUnlockLink(token).then((r) => {
      if (!live) return;
      setChecking(false);
      if (r.ok) setEmail(r.email || '');
      else setLinkError(r.message);
    });
    return () => { live = false; };
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (password !== confirm) { setError('The passwords don\'t match.'); return; }
    setSaving(true);
    try {
      const r = await completeUnlockLink({ token, password });
      if (!r.ok) {
        if (r.code === 'expired') setLinkError(r.message);
        else setError(r.message);
        return;
      }
      track('auth.unlock_link_completed');
      const who = r.email || email;
      clearFailedSignIns(who);
      // The password is already set; if signing in fails (or the request
      // throws), send them to the sign-in screen with a notice instead.
      let signedIn = false;
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: who, password });
        signedIn = !signInError;
      } catch { /* fall through to the notice */ }
      onDone?.(signedIn ? { enterApp: true } : { notice: 'Your new password is set. Sign in with it.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <LoginHeroPanel />
      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <div className={styles.logo}>
            <FoldHealthLogo size={32} />
            <span className={styles.logoText}>Foldhealth</span>
          </div>
          <div className={styles.welcome}>
            <h1 className={styles.welcomeTitle}>
              <span className={styles.welcomePurple}>Set a </span>
              <span className={styles.welcomeDark}>New Password</span>
            </h1>
            <p className={styles.welcomeSub}>Your administrator unlocked your account. Choose a new password to sign in.</p>
          </div>

          {checking ? (
            <p className={styles.welcomeSub}>Checking your link...</p>
          ) : linkError ? (
            <div className={styles.form}>
              <div className={styles.error}>
                <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
                {linkError}
              </div>
              <Button variant="outline" fullWidth onClick={() => onDone?.({})}>Back to Login</Button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={submit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${uid}-user`}>User ID</label>
                <Input id={`${uid}-user`} type="email" value={email} readOnly autoComplete="username" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${uid}-new`}>New Password</label>
                <div className={styles.passwordWrap}>
                  <Input
                    id={`${uid}-new`}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    <Icon name={showPassword ? 'solar:eye-linear' : 'solar:eye-closed-linear'} size={16} color="var(--neutral-200)" />
                  </button>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${uid}-confirm`}>Confirm New Password</label>
                <Input id={`${uid}-confirm`} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter your new password" autoComplete="new-password" />
              </div>
              {error && (
                <div className={styles.error}>
                  <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
                  {error}
                </div>
              )}
              <Button fullWidth type="submit" loading={saving}>
                Set Password and Sign In
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
