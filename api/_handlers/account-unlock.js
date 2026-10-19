import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { serviceClient, isPracticeAdmin } from '../_lib/serviceClient.js';
import { requireUser } from '../_lib/requireUser.js';
import { emailConfigured, sendSecurityEmail, flushSecurityOutbox } from '../_lib/securityEmails.js';
import { requestContext } from '../_lib/requestContext.js';

/**
 * Administrator unlock with an emailed one-time link (account lockout).
 *
 *   POST { action: 'unlock', userId, reason, note, identityConfirmed }   admin
 *   POST { action: 'resend', userId }                                     admin
 *   POST { action: 'inspect', token }        → { email } for the link page
 *   POST { action: 'complete', token, password }
 *
 * Unlock runs public.admin_unlock_account as the admin (so the reason and
 * their name are recorded), then emails the user their User ID and a link
 * that works once and expires in 24 hours. Until they set a new password
 * there, password sign-in stays refused. Each step is written to the user's
 * audit log.
 */
const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_PASSWORD = 8;
const anonUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const fail = (res, status, message, code) => res.status(status).json({ error: { message, ...(code ? { code } : {}) } });

function appOrigin(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const origin = req.headers?.origin;
  if (origin) return origin.replace(/\/+$/, '');
  const host = req.headers?.host;
  return host ? `https://${host}` : '';
}

// `ctx` is the method, device and location shown in the user's Login Activity.
async function audit(admin, userId, name, action, details, actor, ctx) {
  await admin.from('audit_logs').insert({
    entity_type: 'UserProfile', entity_id: userId, entity_name: name, action,
    user_name: actor || 'System', details: ctx ? JSON.stringify({ text: details, ...ctx }) : details, category: 'Security',
  });
}

async function requireAdmin(req, res, admin) {
  const caller = await requireUser(req, res);
  if (!caller) return null;
  const { data: me } = await admin.from('profiles')
    .select('id, full_name, email, status, admin_role, clinical_roles').eq('id', caller.id).maybeSingle();
  if (!isPracticeAdmin(me)) { fail(res, 403, 'Only practice admins can unlock accounts.'); return null; }
  return me;
}

async function sendLink(req, admin, target, actorName, createdBy) {
  const token = crypto.randomBytes(32).toString('base64url');
  // One live link at a time.
  await admin.from('account_unlock_tokens').update({ used_at: new Date().toISOString() })
    .eq('user_id', target.id).is('used_at', null);
  const { error } = await admin.from('account_unlock_tokens').insert({
    user_id: target.id, token_hash: sha(token),
    expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(), created_by: createdBy,
  });
  if (error) throw error;
  const link = `${appOrigin(req)}/#/unlock-account?token=${token}`;
  await sendSecurityEmail(target.email, 'unlock_link', {
    name: target.full_name || target.email, email: target.email, link, at: new Date().toISOString(),
  });
  await audit(admin, target.id, target.full_name || target.email, 'Unlock link emailed',
    `Emailed the User ID and a one-time link to set a new password to ${target.email} (expires in 24 hours).`, actorName,
    requestContext(req, 'Email'));
}

async function tokenRow(admin, token) {
  if (!token || typeof token !== 'string') return null;
  const { data } = await admin.from('account_unlock_tokens')
    .select('id, user_id, expires_at, used_at').eq('token_hash', sha(token)).maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

async function handleUnlock(req, res, admin) {
  const me = await requireAdmin(req, res, admin);
  if (!me) return;
  const { userId, reason, note, identityConfirmed } = req.body || {};
  const { data: target } = await admin.from('profiles').select('id, email, full_name').eq('id', userId).maybeSingle();
  if (!target?.email) return fail(res, 404, 'This user has no email address on file.');

  // Run the unlock as the admin, so the database records who did it.
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers?.authorization || '')?.[1];
  const asAdmin = createClient(anonUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const args = { target: target.id, reason, note: note || null, identity_confirmed: !!identityConfirmed, require_reset: true };
  let { data: lock, error } = await asAdmin.rpc('admin_unlock_account_ctx', { ...args, ctx: requestContext(req, 'Admin console') });
  // Before account_activity_context_migration.sql runs, unlock without the context.
  if (error && /admin_unlock_account_ctx/.test(error.message || '')) {
    ({ data: lock, error } = await asAdmin.rpc('admin_unlock_account', args));
  }
  if (error) return fail(res, 400, error.message || 'Could not unlock the account.');

  // The account is already unlocked here, so a failed email must not read as
  // a failed unlock: the admin would click Unlock again instead of Resend Link.
  try {
    await sendLink(req, admin, target, me.full_name || me.email, me.id);
  } catch (err) {
    console.error('[account-unlock] link email failed', err?.message || err);
    return res.status(200).json({
      lock, emailSent: false,
      message: `Account unlocked, but the email to ${target.email} could not be sent. Try Resend Link in a moment.`,
    });
  }
  return res.status(200).json({ lock, emailSent: true });
}

async function handleResend(req, res, admin) {
  const me = await requireAdmin(req, res, admin);
  if (!me) return;
  const { data: target } = await admin.from('profiles').select('id, email, full_name').eq('id', req.body?.userId).maybeSingle();
  if (!target?.email) return fail(res, 404, 'This user has no email address on file.');
  const { data: lock } = await admin.from('account_lockouts').select('locked_at, require_reset').eq('user_id', target.id).maybeSingle();
  if (!lock?.require_reset) return fail(res, 400, 'This account isn\'t waiting for a new password.');
  try {
    await sendLink(req, admin, target, me.full_name || me.email, me.id);
  } catch (err) {
    console.error('[account-unlock] link email failed', err?.message || err);
    return fail(res, 502, `The email to ${target.email} could not be sent. Try again in a moment.`);
  }
  return res.status(200).json({ ok: true });
}

async function handleInspect(req, res, admin) {
  const row = await tokenRow(admin, req.body?.token);
  if (!row) return fail(res, 400, 'This link has expired or was already used. Ask your administrator to send a new one.', 'expired');
  const { data: u } = await admin.from('profiles').select('email').eq('id', row.user_id).maybeSingle();
  return res.status(200).json({ email: u?.email || '' });
}

async function handleComplete(req, res, admin) {
  const { token, password } = req.body || {};
  const row = await tokenRow(admin, token);
  if (!row) return fail(res, 400, 'This link has expired or was already used. Ask your administrator to send a new one.', 'expired');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return fail(res, 400, `Use at least ${MIN_PASSWORD} characters for your new password.`, 'password');
  }
  const { data: reused, error: reuseErr } = await admin.rpc('password_matches_recent', { target: row.user_id, candidate: password });
  if (reuseErr) throw reuseErr;
  if (reused) return fail(res, 400, "You've used this password recently. Choose a different one.", 'password');

  // Mark the link used first, so a second click can't reuse it.
  const { data: claimed } = await admin.from('account_unlock_tokens')
    .update({ used_at: new Date().toISOString() }).eq('id', row.id).is('used_at', null).select('id');
  if (!claimed?.length) return fail(res, 400, 'This link was already used.', 'expired');

  const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, { password });
  if (updErr) {
    await admin.from('account_unlock_tokens').update({ used_at: null }).eq('id', row.id);
    return fail(res, 400, updErr.message || 'That password could not be set. Try a different one.', 'password');
  }
  const { data: u } = await admin.from('profiles').select('email, full_name').eq('id', row.user_id).maybeSingle();
  await audit(admin, row.user_id, u?.full_name || u?.email, 'Unlock link used',
    'Set a new password from the administrator\'s unlock link.', u?.full_name || u?.email, requestContext(req, 'Email link'));
  try { await flushSecurityOutbox(admin); } catch (err) { console.warn('[account-unlock] outbox flush failed', err?.message); }
  return res.status(200).json({ email: u?.email || '' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  if (!serviceClient) return fail(res, 500, "Account unlock isn't configured on the server (SUPABASE_SERVICE_ROLE_KEY).");
  if (!emailConfigured) return fail(res, 500, "Account unlock email isn't configured on the server (RESEND_API_KEY).");
  try {
    const action = req.body?.action;
    if (action === 'unlock') return await handleUnlock(req, res, serviceClient);
    if (action === 'resend') return await handleResend(req, res, serviceClient);
    if (action === 'inspect') return await handleInspect(req, res, serviceClient);
    if (action === 'complete') return await handleComplete(req, res, serviceClient);
    return fail(res, 400, 'Unknown action');
  } catch (err) {
    console.error('[account-unlock]', err);
    return fail(res, 500, 'Something went wrong. Try again in a moment.');
  }
}
