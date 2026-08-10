import { useEffect, useId, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { track } from '../../lib/tracking';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { FoldHealthLogo } from '../../components/FoldHealthLogo/FoldHealthLogo';
import loginHero from '../../assets/login-hero.png';
import styles from './LoginPage.module.css';

/**
 * ResetPasswordPage — shown when the user arrives via a Supabase
 * password-recovery or invite/confirmation email link.
 *
 * Two arrival modes:
 *
 * 1. Token-hash links (preferred — requires the custom email templates):
 *    the email points at `{{ .SiteURL }}/#/reset-password?token_hash=…&type=…`
 *    so the link is on OUR domain (not *.supabase.co, which corporate
 *    firewalls block) and merely opening it consumes nothing. The one-time
 *    token is redeemed via verifyOtp() only when the user submits the form,
 *    so mail-security scanners that prefetch links can't burn it.
 *
 * 2. Legacy implicit-flow links ({{ .ConfirmationURL }}): Supabase has
 *    already exchanged the token for a session by the time we render;
 *    App.jsx routes here off PASSWORD_RECOVERY / invited metadata.
 *
 * Recovery users are signed out after the update and sent back to login;
 * invited/confirmed users drop straight into the app.
 */

// Read token-hash params from the email link. They ride in the hash-route
// query (#/reset-password?token_hash=…&type=recovery) with a plain-search
// fallback (?token_hash=…). Read once at mount via useState initializer so
// a later hash rewrite by the SPA router can't lose them.
function readTokenFromUrl() {
  const h = window.location.hash || '';
  const qIndex = h.indexOf('?');
  const params = new URLSearchParams(qIndex >= 0 ? h.slice(qIndex + 1) : window.location.search);
  const tokenHash = params.get('token_hash');
  if (!tokenHash) return null;
  return { tokenHash, type: params.get('type') || 'recovery' };
}

export function ResetPasswordPage({ onDone }) {
  const uid = useId();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // null = still checking; true/false once known.
  const [hasSession, setHasSession] = useState(null);
  // Invited-user flow lands here for their first password — treat it as a
  // "Set Password" welcome rather than a recovery, and drop them straight
  // into the app on success instead of sending them back to login.
  const [isInvited, setIsInvited] = useState(false);
  // Token-hash params from the new-style email links. Non-null means the
  // token is redeemed at submit time (verifyOtp) instead of relying on a
  // pre-established session.
  const [tokenParams] = useState(readTokenFromUrl);

  // Detect whether Supabase managed to establish a recovery session from
  // the email link. If not — and there's no token_hash to redeem later —
  // the link is expired or the user navigated here directly; show a
  // dead-end state instead of letting them submit into a failure.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setIsInvited(session?.user?.user_metadata?.invited === 'true');
    });
  }, []);

  // First-time setup (invite / signup confirmation) vs recovery — drives the
  // heading copy before any session exists. Token links carry the answer in
  // `type`; legacy links fall back to the session's invited metadata.
  const setupFlow = tokenParams ? tokenParams.type !== 'recovery' : isInvited;
  // Dead end only when BOTH arrival modes have nothing to work with.
  const linkDead = hasSession === false && !tokenParams;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');

    // On success we deliberately KEEP loading=true while the redirect
    // timeout runs; every failure path (early return or thrown network
    // error) must reset it, hence the flag + finally.
    let redirecting = false;
    try {
      // Token-hash flow: redeem the one-time token NOW, at submit time.
      // Deferring redemption to a human interaction is what makes the links
      // immune to mail-security prefetchers — a GET of the page burns nothing.
      let invited = isInvited;
      if (tokenParams) {
        const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
          type: tokenParams.type,
          token_hash: tokenParams.tokenHash,
        });
        if (otpError) {
          // The token may already be redeemed (e.g. an earlier submit failed
          // after verifyOtp) — if a session exists we can still proceed.
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            track('auth.password_reset_failed', { reason: otpError.message || 'unknown', stage: 'verify' });
            setError('This link has expired or was already used. Ask your admin to resend the invite or request a new reset link from the login page.');
            return;
          }
        }
        if (otpData?.user?.user_metadata?.invited === 'true') invited = true;
      }

      // Update the password and, for invited users, flip the metadata flag
      // in the same call so App.jsx doesn't loop them back here on refresh.
      const updates = invited
        ? { password, data: { invited: 'false' } }
        : { password };
      const { error: authError } = await supabase.auth.updateUser(updates);
      if (authError) {
        track('auth.password_reset_failed', { reason: authError.message || 'unknown', stage: 'update' });
        const friendly = /Auth session missing/i.test(authError.message || '')
          ? 'Your link has expired. Ask your admin to resend the invite or use "Forgot password" from the login page.'
          : authError.message;
        setError(friendly);
        return;
      }
      track(invited ? 'auth.invite_accepted' : 'auth.password_reset_completed');
      redirecting = true;
      if (invited || setupFlow) {
        // Session is already valid — send them into the app.
        setSuccess('Password set. Welcome to Foldhealth!');
        setTimeout(() => { onDone?.({ enterApp: true }); }, 900);
      } else {
        setSuccess('Password updated. Redirecting to login...');
        await supabase.auth.signOut();
        setTimeout(() => { onDone?.(); }, 1200);
      }
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.leftPanel}>
        <div className={styles.heroWrap}>
          <div className={styles.gridBg} />
          <img src={loginHero} alt="Healthcare illustration" className={styles.heroImg} />
        </div>
        <div className={styles.dots}>
          <span className={styles.dotActive} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <div className={styles.logo}>
            <FoldHealthLogo size={32} />
            <span className={styles.logoText}>Foldhealth</span>
          </div>

          <div className={styles.welcome}>
            <h1 className={styles.welcomeTitle}>
              {linkDead ? (
                <>
                  <span className={styles.welcomePurple}>Link </span>
                  <span className={styles.welcomeDark}>Expired</span>
                </>
              ) : setupFlow ? (
                <>
                  <span className={styles.welcomePurple}>Set your </span>
                  <span className={styles.welcomeDark}>Password</span>
                </>
              ) : (
                <>
                  <span className={styles.welcomePurple}>Set a </span>
                  <span className={styles.welcomeDark}>New Password</span>
                </>
              )}
            </h1>
            <p className={styles.welcomeSub}>
              {linkDead
                ? 'This link is no longer valid. Ask your admin to resend the invite or request a new reset link from the login page.'
                : setupFlow
                ? 'Welcome! Choose a password to finish setting up your account.'
                : 'Choose a new password to finish recovering your account.'}
            </p>
          </div>

          {linkDead ? (
            <div className={styles.form}>
              <div className={styles.error}>
                <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
                Reset links expire shortly after they're sent and can only be used once.
              </div>
              <Button variant="primary" size="L" fullWidth onClick={() => onDone?.()}>
                Back to Login
              </Button>
            </div>
          ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${uid}-new-password`}>New Password</label>
              <div className={styles.passwordWrap}>
                <Input
                  id={`${uid}-new-password`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <Icon name={showPassword ? 'solar:eye-linear' : 'solar:eye-closed-linear'} size={16} color="#8A94A8" />
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${uid}-confirm-password`}>Confirm New Password</label>
              <Input
                id={`${uid}-confirm-password`}
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className={styles.error}>
                <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
                {error}
              </div>
            )}
            {success && (
              <div className={styles.success}>
                <Icon name="solar:check-circle-linear" size={14} color="var(--status-success)" />
                {success}
              </div>
            )}

            <Button variant="primary" size="L" fullWidth disabled={loading} type="submit">
              {loading
                ? (setupFlow ? 'Setting password...' : 'Updating password...')
                : (setupFlow ? 'Set Password' : 'Update Password')}
            </Button>
          </form>
          )}

          <div className={styles.toggleAuth}>
            <button
              type="button"
              className={styles.toggleLink}
              onClick={() => onDone?.()}
            >
              <Icon name="solar:alt-arrow-left-linear" size={14} color="currentColor" />
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
