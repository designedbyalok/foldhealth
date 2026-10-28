import { useId, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/Input/Input';
import { Button } from '@/components/Button/Button';
import { Icon } from '@/components/Icon/Icon';
import { Checkbox } from '@/components/ShadcnCheckbox/ShadcnCheckbox';
import { FoldHealthLogo } from '@/components/FoldHealthLogo/FoldHealthLogo';
import { OAuthButtons } from '@/components/OAuthButtons/OAuthButtons';
import { parseIdentifier } from '../lib/parseIdentifier';
import { IntroCarousel } from './IntroCarousel';
import styles from './LoginPage.module.css';

// Dev builds on localhost only: real sign-ins with the Dev test accounts, like
// the staff app's Dev Login. import.meta.env.DEV is false in production
// builds, so this list and the credentials are dropped from the bundle.
const DEV_LOGINS = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? [
    { label: 'Dev login: patient', email: import.meta.env.VITE_DEV_PATIENT_LOGIN_EMAIL, password: import.meta.env.VITE_DEV_PATIENT_LOGIN_PASSWORD, vars: 'VITE_DEV_PATIENT_LOGIN_*' },
    { label: 'Dev login: care team', email: import.meta.env.VITE_DEV_LOGIN_EMAIL, password: import.meta.env.VITE_DEV_LOGIN_PASSWORD, vars: 'VITE_DEV_LOGIN_*' },
  ]
  : [];

export function LoginPage({ notice }) {
  const uid = useId();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = parseIdentifier(identifier);
    if (!id) { setError('Enter the email or mobile number on your Fold Health record.'); return; }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ ...id, password });
      if (authError) setError('That email, mobile number or password is not right.');
    } catch {
      setError('We could not sign you in. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Provider-portal users can sign in with the same Google account they use
  // there; patient accounts are email/mobile and password only.
  const handleOAuth = async (provider) => {
    setError('');
    setInfo('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) setError('We could not start that sign-in. Please try again.');
  };

  const handleDevLogin = async ({ email, password, vars }) => {
    if (!email || !password) { setError(`Set ${vars} in .env.development.local to use this.`); return; }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(`Dev login failed: ${authError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    const id = parseIdentifier(identifier);
    if (!id?.email) { setError('Enter your email above, then choose Forgot password.'); return; }
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(id.email, {
      redirectTo: window.location.origin,
    });
    if (resetError) setError(resetError.message);
    else setInfo(`If ${id.email} has a Fold Health account, a reset link is on its way.`);
  };

  const message = error || notice;

  return (
    <main className={styles.page}>
      <IntroCarousel />

      <div className={styles.side}>
        <form className={styles.card} onSubmit={handleSubmit} noValidate>
          <div className={styles.brand}>
            <FoldHealthLogo size={44} color="var(--primary-400)" />
            <span className={styles.brandName}>Foldhealth</span>
          </div>

          {message && (
            <p className={styles.error} role="alert">
              <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
              {message}
            </p>
          )}
          {info && (
            <p className={styles.info} role="status">
              <Icon name="solar:check-circle-linear" size={14} color="var(--status-success)" />
              {info}
            </p>
          )}

          <Input
            aria-label="Email or mobile number"
            leadingIcon="solar:user-linear"
            placeholder="Email / Mobile"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
          />
          <div className={styles.passwordField}>
            <Input
              aria-label="Password"
              type="password"
              leadingIcon="solar:lock-keyhole-linear"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              showPasswordToggle
            />
            <button type="button" className={styles.forgot} onClick={handleForgot}>
              Forgot password?
            </button>
          </div>

          <div className={styles.terms}>
            <Checkbox id={`${uid}-terms`} checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
            <label htmlFor={`${uid}-terms`}>I agree to the terms of use &amp; privacy policy</label>
          </div>

          <Button
            variant="primary"
            size="L"
            fullWidth
            type="submit"
            disabled={loading || !agreed || !identifier.trim() || !password}
          >
            {loading ? 'Signing in…' : 'Login'}
          </Button>

          <OAuthButtons onSelect={handleOAuth} disabled={loading} label="Care team? Continue with" />

          {DEV_LOGINS.length > 0 && (
            <div className={styles.devLogins}>
              {DEV_LOGINS.map((d) => (
                <button key={d.label} type="button" className={styles.devLogin} disabled={loading} onClick={() => handleDevLogin(d)}>
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
