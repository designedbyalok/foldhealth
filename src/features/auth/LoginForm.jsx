import { useId } from 'react';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { FoldHealthLogo } from '../../components/FoldHealthLogo/FoldHealthLogo';
import styles from './LoginPage.module.css';

export function LoginForm({
  isSignUp,
  forgotMode,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  loading,
  error,
  success,
  unverifiedEmail,
  cooldown,
  onSubmit,
  onEnterForgotMode,
  onExitForgotMode,
  onResendVerification,
  onToggleSignUp,
}) {
  const uid = useId();
  return (
    <>
      <div className={styles.logo}>
        <FoldHealthLogo size={32} />
        <span className={styles.logoText}>Foldhealth</span>
      </div>

      <div className={styles.welcome}>
        <h1 className={styles.welcomeTitle}>
          {forgotMode ? (
            <>
              <span className={styles.welcomePurple}>Reset </span>
              <span className={styles.welcomeDark}>Password</span>
            </>
          ) : isSignUp ? (
            <>
              <span className={styles.welcomePurple}>Create </span>
              <span className={styles.welcomeDark}>Account</span>
            </>
          ) : (
            <>
              <span className={styles.welcomePurple}>Welcome </span>
              <span className={styles.welcomeDark}>Back!</span>
            </>
          )}
        </h1>
        <p className={styles.welcomeSub}>
          {forgotMode
            ? "Enter your email and we'll send you a reset link."
            : isSignUp
              ? 'Sign up to get started with Fold Portal'
              : 'Sign in to access your Fold Portal'}
        </p>
      </div>

      <form className={styles.form} onSubmit={onSubmit}>
        {isSignUp && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${uid}-first-name`}>First Name <span style={{ color: 'var(--status-error)' }}>*</span></label>
              <Input
                id={`${uid}-first-name`}
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${uid}-last-name`}>Last Name <span style={{ color: 'var(--status-error)' }}>*</span></label>
              <Input
                id={`${uid}-last-name`}
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />
            </div>
          </div>
        )}
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${uid}-email`}>Email</label>
          <Input
            id={`${uid}-email`}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@fold.health"
            autoComplete="email"
          />
        </div>

        {!forgotMode && (
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor={`${uid}-password`}>Password</label>
              {!isSignUp && (
                <button type="button" className={styles.forgotLink} onClick={onEnterForgotMode}>
                  Forgot Password?
                </button>
              )}
            </div>
            <div className={styles.passwordWrap}>
              <Input
                id={`${uid}-password`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isSignUp ? 'Min 6 characters' : 'Enter your password'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
        )}

        {!forgotMode && isSignUp && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-confirm-password`}>Confirm Password</label>
            <Input
              id={`${uid}-confirm-password`}
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />
          </div>
        )}

        {unverifiedEmail && !forgotMode && (
          <div className={styles.unverifiedNotice}>
            <Icon name="solar:letter-linear" size={14} color="var(--status-warning)" />
            <div className={styles.unverifiedBody}>
              <strong>Verify your email to continue.</strong>{' '}
              We sent a verification link to <strong>{unverifiedEmail}</strong>.
              <button
                type="button"
                className={styles.unverifiedAction}
                onClick={onResendVerification}
                disabled={loading || cooldown > 0}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
              </button>
            </div>
          </div>
        )}

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

        <Button
          variant="primary"
          size="L"
          fullWidth
          disabled={loading || (forgotMode && cooldown > 0)}
          type="submit"
        >
          {forgotMode
            ? (loading
                ? 'Sending reset link...'
                : cooldown > 0 ? `Resend in ${cooldown}s` : success ? 'Resend Reset Link' : 'Send Reset Link')
            : loading
              ? (isSignUp ? 'Creating account...' : 'Signing in...')
              : (isSignUp ? 'Create Account' : 'Login')}
        </Button>
      </form>

      {forgotMode ? (
        <div className={styles.toggleAuth}>
          <button
            type="button"
            className={styles.toggleLink}
            onClick={onExitForgotMode}
          >
            <Icon name="solar:alt-arrow-left-linear" size={14} color="currentColor" />
            Back to login
          </button>
        </div>
      ) : (
        <div className={styles.toggleAuth}>
          <span className={styles.toggleText}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            type="button"
            className={styles.toggleLink}
            onClick={onToggleSignUp}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      )}
    </>
  );
}
