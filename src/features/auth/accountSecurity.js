// Account lockout on the sign-in screen. The real count and lock live in the
// database (supabase/account_lockout_migration.sql, Password Verification
// Hook); this file reads its answers and talks to the reset API.

export const MAX_FAILED_ATTEMPTS = 5;

// Codes the Password Verification Hook returns when it refuses a sign-in.
export const AUTH_REFUSAL = {
  paused: 'ACCOUNT_PAUSED',
  resetRequired: 'PASSWORD_RESET_REQUIRED',
};

/** 'paused' | 'resetRequired' | 'invalid' | 'unverified' | 'other' */
export function classifySignInError(message = '') {
  if (message.includes(AUTH_REFUSAL.paused)) return 'paused';
  if (message.includes(AUTH_REFUSAL.resetRequired)) return 'resetRequired';
  if (/invalid login credentials/i.test(message)) return 'invalid';
  if (/email not confirmed/i.test(message)) return 'unverified';
  return 'other';
}

// Consecutive failures in this browser, per email. The pause screen also
// shows at the 5th local failure, so an address with no account pauses the
// same way a real one does and the screen doesn't reveal which exist.
const KEY = 'fold.signinFailures';
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v) => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };
const norm = (email) => String(email || '').trim().toLowerCase();

export function noteFailedSignIn(email) {
  const all = read();
  const n = (all[norm(email)] || 0) + 1;
  all[norm(email)] = n;
  write(all);
  return n;
}
export function clearFailedSignIns(email) {
  const all = read();
  delete all[norm(email)];
  write(all);
}

async function post(path, body) {
  let res;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, message: 'We couldn\'t reach Fold Health. Check your connection and try again.' };
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json?.error?.message || 'Something went wrong. Try again.', code: json?.error?.code };
  return { ok: true, ...json };
}

/** Emails a 6-digit code. Answers the same whether or not the account exists. */
export const requestResetCode = (email) => post('/api/password-reset', { action: 'request', email: String(email || '').trim() });

export const verifyResetCode = ({ email, code, password }) =>
  post('/api/password-reset', { action: 'verify', email: String(email || '').trim(), code, password });

/** Sends any security emails the database queued (lock, unlock, password changed). */
export function flushSecurityEmails() {
  fetch('/api/security-email-dispatch', { method: 'POST' }).catch(() => {});
}
