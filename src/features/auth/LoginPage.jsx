import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { track } from '../../lib/tracking';
import { LoginHeroPanel } from './LoginHeroPanel';
import { LoginForm } from './LoginForm';
import { LoginOAuthSection } from './LoginOAuthSection';
import styles from './LoginPage.module.css';

const RESEND_COOLDOWN_SECONDS = 30;

// Read at module load: Supabase redirects back from email-confirmation and
// OAuth with `error_description` in the URL (e.g. the approval hook refusing a
// Pending account), and App rewrites the hash to #/login before this page mounts.
const REDIRECT_AUTH_ERROR = (() => {
  const params = new URLSearchParams(window.location.hash.replace(/^#\/?/, '') || window.location.search);
  // GoTrue double-encodes hook errors ("403%3A Your account…"): decode the
  // leftover escapes and drop the status-code prefix.
  const raw = params.get('error_description') || '';
  let text = raw;
  try { text = decodeURIComponent(raw); } catch { /* keep raw */ }
  return text.replace(/^\d{3}:\s*/, '');
})();

export function LoginPage({ onBypass, notice = '' }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(REDIRECT_AUTH_ERROR);
  const [success, setSuccess] = useState(notice);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Please enter email and password'); return; }
    setLoading(true);
    setError('');
    setUnverifiedEmail('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        track('auth.login_failed', { method: 'password', reason: authError.message || 'unknown' });
        const isUnverified = /email not confirmed/i.test(authError.message || '');
        if (isUnverified) {
          setUnverifiedEmail(email.trim());
          setError('');
        } else {
          setError(authError.message === 'Invalid login credentials' ? 'Invalid email or password' : authError.message);
        }
      } else {
        track('auth.login_succeeded', { method: 'password' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e?.preventDefault?.();
    if (!email.trim()) { setError('Please enter your email'); return; }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (authError) {
        track('auth.password_reset_failed', { reason: authError.message || 'unknown' });
        setError(authError.message);
      } else {
        track('auth.password_reset_email_sent');
        setSuccess(`Reset link sent to ${email.trim()}. Check your inbox.`);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const target = (unverifiedEmail || email).trim();
    if (!target) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error: authError } = await supabase.auth.resend({ type: 'signup', email: target });
      if (authError) {
        track('auth.verification_email_failed', { reason: authError.message || 'unknown' });
        setError(authError.message);
      } else {
        track('auth.verification_email_sent');
        setSuccess(`Verification email sent to ${target}. Check your inbox.`);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setLoading(false);
    }
  };

  const enterForgotMode = () => {
    setForgotMode(true);
    setError('');
    setSuccess('');
    setUnverifiedEmail('');
    setCooldown(0);
  };

  const exitForgotMode = () => {
    setForgotMode(false);
    setError('');
    setSuccess('');
    setCooldown(0);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setError('First name and last name are required'); return; }
    if (!email.trim() || !password.trim()) { setError('Please enter email and password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: `${firstName.trim()} ${lastName.trim()}` },
        },
      });
      if (authError) {
        track('auth.signup_failed', { reason: authError.message || 'unknown' });
        setError(authError.message);
      } else {
        track('auth.signup_succeeded');
        setSuccess('Request submitted. Confirm your email, then an administrator will review your request. You can sign in once it is approved.');
        setIsSignUp(false);
        setConfirmPassword('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    setError('');
    track('auth.oauth_initiated', { provider });
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (authError) {
        track('auth.login_failed', { method: provider, reason: authError.message || 'unknown' });
        setError(authError.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSignUp = () => {
    setIsSignUp(v => !v);
    setError('');
    setSuccess('');
    setUnverifiedEmail('');
  };

  const handleSubmit = forgotMode ? handleForgotPassword : isSignUp ? handleSignUp : handleLogin;

  return (
    <div className={styles.page}>
      <LoginHeroPanel />

      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <LoginForm
            isSignUp={isSignUp}
            forgotMode={forgotMode}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            loading={loading}
            error={error}
            success={success}
            unverifiedEmail={unverifiedEmail}
            cooldown={cooldown}
            onSubmit={handleSubmit}
            onEnterForgotMode={enterForgotMode}
            onExitForgotMode={exitForgotMode}
            onResendVerification={handleResendVerification}
            onToggleSignUp={handleToggleSignUp}
          />

          <LoginOAuthSection
            loading={loading}
            onOAuthLogin={handleOAuthLogin}
            onBypass={onBypass}
          />
        </div>
      </div>
    </div>
  );
}
