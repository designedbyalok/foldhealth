import crypto from 'node:crypto';
import { serviceClient, isPracticeAdmin } from '../_lib/serviceClient.js';
import { requireUser } from '../_lib/requireUser.js';
import { emailConfigured, sendSecurityEmail, flushSecurityOutbox, appOrigin } from '../_lib/securityEmails.js';

/**
 * Password reset by emailed 6-digit code (account lockout, HITRUST).
 *
 *   POST { action: 'request', email }           anyone (sign-in screen)
 *   POST { action: 'request', userId }          practice admin (Bearer token)
 *   POST { action: 'verify', email, code, password }
 *
 * A code works once, expires in 15 minutes and allows 5 tries; at most 3
 * codes per hour per account. The new password can't match the current one
 * or the last five. Setting it fires public.on_auth_password_changed, which
 * clears any lock, ends every session and queues the "Password changed"
 * email. Public requests always answer the same way, so they don't reveal
 * whether an account exists.
 */
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;
const REQUEST_MIN_MS = 1500;
const MAX_CODES_PER_HOUR = 3;
const MIN_PASSWORD = 8;
const PEPPER = process.env.SECURITY_CODE_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const hashCode = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}:${PEPPER}`).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const fail = (res, status, message, code) => res.status(status).json({ error: { message, ...(code ? { code } : {}) } });

async function profileByEmail(admin, email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return null;
  const escaped = clean.replace(/[\\%_]/g, c => `\\${c}`);
  const { data } = await admin.from('profiles')
    .select('id, email, full_name, status').ilike('email', escaped).limit(1).maybeSingle();
  return data || null;
}

// A locked account (or one waiting for its unlock link) comes back only
// through an administrator, so self-service codes aren't issued for it.
async function lockedOrWaiting(admin, userId) {
  const { data } = await admin.from('account_lockouts').select('locked_at, require_reset').eq('user_id', userId).maybeSingle();
  return !!(data?.locked_at || data?.require_reset);
}

// Except for practice admins: they're the ones who unlock everyone else, so
// if every admin were locked out nobody could recover. A locked admin can
// still reset by emailed code, which needs their mailbox.
async function selfResetBlocked(admin, userId) {
  if (!(await lockedOrWaiting(admin, userId))) return false;
  const { data: me } = await admin.from('profiles').select('status, admin_role, clinical_roles').eq('id', userId).maybeSingle();
  return !isPracticeAdmin(me);
}

async function issueCode(admin, profile, requestedBy) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from('password_reset_codes')
    .select('id', { count: 'exact', head: true }).eq('user_id', profile.id).gte('created_at', since);
  if ((count || 0) >= MAX_CODES_PER_HOUR) return 'rate_limited';

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  // One live code at a time: a new one retires the older ones.
  await admin.from('password_reset_codes').update({ used_at: new Date().toISOString() })
    .eq('user_id', profile.id).is('used_at', null);
  const { error } = await admin.from('password_reset_codes').insert({
    user_id: profile.id,
    code_hash: hashCode(profile.id, code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    requested_by: requestedBy || null,
  });
  if (error) throw error;
  await sendSecurityEmail(profile.email, 'reset_code', {
    name: profile.full_name || profile.email, code, at: new Date().toISOString(),
  });
  return 'sent';
}

async function handleRequest(req, res, admin) {
  const { email, userId } = req.body || {};

  // An admin sending a code to a user from Settings → Users.
  if (userId) {
    const caller = await requireUser(req, res);
    if (!caller) return;
    const { data: me } = await admin.from('profiles').select('status, admin_role, clinical_roles').eq('id', caller.id).maybeSingle();
    if (!isPracticeAdmin(me)) return fail(res, 403, 'Only practice admins can send a reset code.');
    const { data: target } = await admin.from('profiles').select('id, email, full_name, status').eq('id', userId).maybeSingle();
    if (!target?.email) return fail(res, 404, 'This user has no email address on file.');
    if (await lockedOrWaiting(admin, target.id)) return fail(res, 400, 'This account is locked. Use Unlock on their profile instead.');
    const result = await issueCode(admin, target, caller.id);
    if (result === 'rate_limited') return fail(res, 429, 'Three codes were already sent in the last hour. Try again later.');
    return res.status(200).json({ ok: true });
  }

  // Same answer, and about the same response time, whether or not the account
  // exists or is rate limited: a real send waits on the database and Resend.
  const started = Date.now();
  const profile = await profileByEmail(admin, email);
  if (profile && !['Pending', 'Rejected'].includes(profile.status) && !(await selfResetBlocked(admin, profile.id))) {
    await issueCode(admin, profile, null);
  }
  const wait = REQUEST_MIN_MS - (Date.now() - started);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  return res.status(200).json({ ok: true });
}

async function handleVerify(req, res, admin) {
  const { email, code, password } = req.body || {};
  const cleanCode = String(code || '').replace(/\D/g, '');
  if (cleanCode.length !== 6) return fail(res, 400, 'Enter the 6-digit code from your email.', 'code');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return fail(res, 400, `Use at least ${MIN_PASSWORD} characters for your new password.`, 'password');
  }

  // One answer for every failure (unknown email, no code, expired, used up,
  // wrong), so the form doesn't reveal which emails have accounts.
  const rejected = () => fail(res, 400, "That code isn't right or has expired. Check it, or request a new code.", 'code');
  const profile = await profileByEmail(admin, email);
  if (!profile || await selfResetBlocked(admin, profile.id)) return rejected();

  const { data: row } = await admin.from('password_reset_codes')
    .select('id, code_hash, expires_at, attempts')
    .eq('user_id', profile.id).is('used_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_TRIES) return rejected();

  // Spend a try before comparing, and only if nobody else spent it first:
  // parallel guesses all read the same `attempts`, so only one of them wins
  // this compare-and-set and the rest are turned away unchecked.
  const { data: spent } = await admin.from('password_reset_codes').update({ attempts: row.attempts + 1 })
    .eq('id', row.id).eq('attempts', row.attempts).is('used_at', null).select('id');
  if (!spent?.length) return rejected();
  if (!sameHash(row.code_hash, hashCode(profile.id, cleanCode))) return rejected();

  // Claim the code before changing the password so it can't be replayed
  // while that runs; hand it back if the password isn't accepted.
  const { data: claimed } = await admin.from('password_reset_codes').update({ used_at: new Date().toISOString() })
    .eq('id', row.id).is('used_at', null).select('id');
  if (!claimed?.length) return rejected();
  const release = () => admin.from('password_reset_codes').update({ used_at: null }).eq('id', row.id);

  const { data: reused, error: reuseErr } = await admin.rpc('password_matches_recent', { target: profile.id, candidate: password });
  if (reuseErr) { await release(); throw reuseErr; }
  if (reused) {
    await release();
    return fail(res, 400, "You've used this password recently. Choose a different one.", 'password');
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (updErr) {
    await release();
    return fail(res, 400, updErr.message || 'That password could not be set. Try a different one.', 'password');
  }

  // The password-change trigger queued the emails; send them now.
  try { await flushSecurityOutbox(admin, 50, { origin: appOrigin(req) }); } catch (err) { console.warn('[password-reset] outbox flush failed', err?.message); }
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  if (!serviceClient) return fail(res, 500, "Password reset isn't configured on the server (SUPABASE_SERVICE_ROLE_KEY).");
  if (!emailConfigured) return fail(res, 500, "Password reset email isn't configured on the server (RESEND_API_KEY).");
  try {
    const action = req.body?.action;
    if (action === 'request') return await handleRequest(req, res, serviceClient);
    if (action === 'verify') return await handleVerify(req, res, serviceClient);
    return fail(res, 400, 'Unknown action');
  } catch (err) {
    console.error('[password-reset]', err);
    return fail(res, 500, 'Something went wrong. Try again in a moment.');
  }
}
