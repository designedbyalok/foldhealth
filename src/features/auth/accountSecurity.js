// Account lockout on the sign-in screen. The real count and lock live in the
// database (supabase/account_lockout_migration.sql and
// account_unlock_link_migration.sql); this file reads its answers, reports
// failures, asks an administrator to unlock, and talks to the unlock API.
import { supabase } from '../../lib/supabase';

export const MAX_FAILED_ATTEMPTS = 5;

// Codes returned when a sign-in is refused: by the access-token hook (free
// plan), or the optional Password Verification Hook (paid plan).
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

export const failedSignIns = (email) => read()[norm(email)] || 0;

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
  if (!res.ok) {
    // The API explains failures in its error payload; read it for the message.
    const err = await res.json().catch(() => ({}));
    return { ok: false, message: err?.error?.message || 'Something went wrong. Try again.', code: err?.error?.code };
  }
  return { ok: true, ...(await res.json().catch(() => ({}))) };
}

// Database bookkeeping for the sign-in page, sent through /api/auth-activity
// so each row in the user's Login Activity records the method, device and
// location (read on the server). If that endpoint can't log it (migration not
// run, or no server in this environment) the plain RPC runs instead, so
// nothing goes uncounted. They answer the same whether or not the email has
// an account. The failure report carries the password because the database
// only counts it after checking it really is wrong, so nobody can lock an
// account by reporting failures they didn't make. Then any "account locked"
// email that report queued goes out.
async function logActivity(body, token) {
  try {
    const res = await fetch('/api/auth-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function reportFailedSignIn(email, password) {
  const p_email = String(email || '').trim();
  const logged = await logActivity({ event: 'failed', email: p_email, password: password || '' });
  if (!logged) await supabase.rpc('record_sign_in_failure', { p_email, p_password: password || '' }).then(() => {}, () => {});
  flushSecurityEmails();
}

/** `method` is 'password' or 'google'. */
export async function reportSignInSuccess(method = 'password') {
  supabase.rpc('record_sign_in_success').then(() => {}, () => {});
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (token) await logActivity({ event: 'signed_in', method }, token);
}

// Set just before the Google redirect, so the SIGNED_IN that follows the
// return is logged as a Google sign-in (and a restored session isn't).
const OAUTH_KEY = 'fold.oauthSignIn';
export function noteOAuthSignIn(provider) {
  try { sessionStorage.setItem(OAUTH_KEY, provider); } catch { /* storage blocked */ }
}
export function takeOAuthSignIn() {
  try {
    const provider = sessionStorage.getItem(OAUTH_KEY);
    sessionStorage.removeItem(OAUTH_KEY);
    return provider;
  } catch {
    return null;
  }
}

/** Asks the practice administrators to unlock this account (in-app + email). */
export async function requestAccountUnlock(email) {
  const p_email = String(email || '').trim();
  if (await logActivity({ event: 'unlock_requested', email: p_email })) {
    flushSecurityEmails();
    return { ok: true };
  }
  const { error } = await supabase.rpc('request_account_unlock', { p_email });
  flushSecurityEmails();
  return !error || /function|schema cache|does not exist/i.test(error.message || '')
    ? { ok: true }
    : { ok: false, message: 'We couldn\'t send the request. Try again in a moment.' };
}

/** The administrator's emailed unlock link: who it's for, then set the password. */
export const inspectUnlockLink = (token) => post('/api/account-unlock', { action: 'inspect', token });
export const completeUnlockLink = ({ token, password }) => post('/api/account-unlock', { action: 'complete', token, password });

/** Sends any security emails the database queued (lock, unlock, password changed). */
export function flushSecurityEmails() {
  fetch('/api/security-email-dispatch', { method: 'POST' }).catch(() => {});
}
