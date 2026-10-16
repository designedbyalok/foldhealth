import { useEffect, useId, useState } from 'react';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { track } from '../../lib/tracking';
import { requestResetCode, verifyResetCode } from './accountSecurity';
import styles from './LoginPage.module.css';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Forgot password by emailed code: enter email, receive a 6-digit code,
 * enter it with a new password. Completing it also clears an account lock.
 */
export function PasswordResetFlow({ initialEmail = '', intro, onDone, onBack }) {
  const uid = useId();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const sendCode = async (e) => {
    e?.preventDefault?.();
    if (!email.trim()) { setError('Enter your email.'); return; }
    setLoading(true);
    setError('');
    const r = await requestResetCode(email);
    setLoading(false);
    if (!r.ok) { setError(r.message); return; }
    track('auth.password_reset_code_requested');
    setStep('code');
    setCode('');
    setNotice(`If ${email.trim()} has a Fold Health account, we sent it a 6-digit code. It expires in 15 minutes.`);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError('');
    if (code.replace(/\D/g, '').length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (password !== confirm) { setError('The passwords don\'t match.'); return; }
    setLoading(true);
    const r = await verifyResetCode({ email, code, password });
    setLoading(false);
    if (!r.ok) {
      setError(r.message);
      if (r.code === 'expired') setCode('');
      return;
    }
    track('auth.password_reset_completed');
    onDone?.('Your password was changed. Sign in with your new password.');
  };

  return (
    <>
      <div className={styles.welcome}>
        <h1 className={styles.welcomeTitle}>
          <span className={styles.welcomePurple}>Reset </span>
          <span className={styles.welcomeDark}>Password</span>
        </h1>
        <p className={styles.welcomeSub}>
          {step === 'email'
            ? (intro || 'Enter your email and we\'ll send you a 6-digit code.')
            : 'Enter the code from your email and choose a new password.'}
        </p>
      </div>

      {step === 'email' ? (
        <form className={styles.form} onSubmit={sendCode}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-email`}>Email</label>
            <Input id={`${uid}-email`} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@fold.health" autoComplete="email" />
          </div>
          {error && <div className={styles.error}><Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />{error}</div>}
          <Button variant="primary" size="L" fullWidth type="submit" disabled={loading}>
            {loading ? 'Sending code...' : 'Send Code'}
          </Button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={submitCode}>
          {notice && <div className={styles.success}><Icon name="solar:letter-linear" size={14} color="var(--status-success)" />{notice}</div>}
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor={`${uid}-code`}>6-digit code</label>
              <button type="button" className={styles.forgotLink} onClick={sendCode} disabled={loading || cooldown > 0}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
            <Input
              id={`${uid}-code`}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
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
          {error && <div className={styles.error}><Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />{error}</div>}
          <Button variant="primary" size="L" fullWidth type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Set New Password'}
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
