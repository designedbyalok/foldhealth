import { Resend } from 'resend';
import { serviceClient } from './serviceClient.js';

/**
 * Security emails (account lockout, password reset). Every one states the
 * time and what happened and says "If this wasn't you, contact your clinic
 * or administrator". None contains a password. The only link is the
 * one-time "set a new password" link an administrator's unlock sends.
 *
 * The account emails below (TEMPLATE_KINDS) are designed in the email
 * builder (src/features/email-builder/accountEmailTemplates.js): the
 * campaigns row with that `system_key` supplies the subject and the HTML,
 * and its tokens are filled here. Without one, the built-in email is sent.
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM || 'Fold Health <noreply@foldhealth.org>';
const TZ = process.env.SECURITY_EMAIL_TZ || 'America/Los_Angeles';

export const emailConfigured = !!resend;

function when(at) {
  const d = at ? new Date(at) : new Date();
  return d.toLocaleString('en-US', {
    timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(heading, paragraphs) {
  const body = paragraphs.map(p => `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#3A485F">${p}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F6F7F8;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #D0D6E1;border-radius:8px"><tr><td style="padding:24px">
<h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#16181D">${esc(heading)}</h1>
${body}
<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6F7A90">If this wasn't you, contact your clinic or administrator.</p>
</td></tr></table></body></html>`;
}

const TEMPLATE_KINDS = new Set(['unlock_link', 'password_changed', 'account_activated', 'signup_approved']);

/**
 * The app's address for "Sign in" links: APP_URL, else (in production) the
 * project's production domain from Vercel. Only outside production does it
 * fall back to the request's own origin: that header is caller-controlled, so
 * in production it would let anyone point emailed sign-in links at their site.
 */
export function appOrigin(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (prod) return `https://${prod.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
    console.error('[appOrigin] APP_URL is not set in production');
    return '';
  }
  const origin = req?.headers?.origin;
  if (origin) return origin.replace(/\/+$/, '');
  const host = req?.headers?.host;
  return host ? `https://${host}` : '';
}

// The Account tokens (plus the name ones) an account email template uses.
function tokenValues(payload, origin) {
  const name = payload.name || '';
  return {
    full_name: name || 'there',
    first_name: (name.includes('@') ? '' : name.split(/\s+/)[0]) || 'there',
    email: payload.email || '',
    user_id: payload.email || '',
    set_password_link: payload.link || '',
    sign_in_link: origin ? `${origin}/#/login` : '',
    event_time: when(payload.at),
    current_year: String(new Date().getFullYear()),
    clinic_name: 'Fold Health',
  };
}

const fill = (html, values) => html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
  (m, key) => (Object.hasOwn(values, key.toLowerCase()) ? esc(values[key.toLowerCase()]) : m));

/** A template row ({ subject_line, email_html }) filled for one send. */
export function fillTemplate(row, kind, payload, origin) {
  const values = tokenValues(payload, origin);
  const subject = (row.subject_line || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key) => values[key.toLowerCase()] ?? m);
  return { subject: subject || renderSecurityEmail(kind, payload)?.subject, html: fill(row.email_html, values) };
}

/**
 * The email builder's template for `kind`, filled for this send, or null
 * (no template, no stored HTML, migration not run) so the caller falls back.
 */
async function templateEmail(kind, payload, origin) {
  if (!serviceClient || !TEMPLATE_KINDS.has(kind)) return null;
  try {
    const { data, error } = await serviceClient.from('campaigns')
      .select('subject_line, email_html').eq('system_key', kind).maybeSingle();
    if (error || !data?.email_html) return null;
    return fillTemplate(data, kind, payload, origin);
  } catch (err) {
    console.warn('[securityEmails] template lookup failed, using the built-in email', kind, err?.message);
    return null;
  }
}

/** Subject + HTML for one outbox row (or the reset code). */
export function renderSecurityEmail(kind, payload = {}) {
  const name = esc(payload.name || 'there');
  const at = esc(when(payload.at));
  switch (kind) {
    case 'reset_code':
      return {
        subject: 'Your Fold Health password reset code',
        html: layout('Your password reset code', [
          `Hi ${name}, someone asked to reset the password for your Fold Health account at ${at}.`,
          `Your code is <strong style="font-size:20px;letter-spacing:4px;color:#16181D">${esc(payload.code)}</strong>`,
          'Enter it on the sign-in screen to set a new password. The code works once and expires in 15 minutes.',
        ]),
      };
    case 'account_locked':
      return {
        subject: 'Your Fold Health account is locked',
        html: layout('Your account is locked', [
          `Hi ${name}, at ${at} we locked your Fold Health account after ${esc(payload.attempts || 5)} failed sign-in attempts in a row.`,
          'It stays locked until an administrator unlocks it. Waiting does not unlock it.',
          'To get back in, ask your practice administrator to unlock your account (you can send the request from the sign-in screen). You will then get an email with a link to set a new password.',
        ]),
      };
    case 'account_unlocked':
      return {
        subject: 'Your Fold Health account was unlocked',
        html: layout('Your account was unlocked', [
          payload.via === 'password_reset'
            ? `Hi ${name}, your Fold Health account was unlocked at ${at} when your password was reset.`
            : `Hi ${name}, an administrator unlocked your Fold Health account at ${at}.`,
          ...(payload.require_reset
            ? ['You need to set a new password before you can sign in. Choose <strong>Forgot password</strong> on the sign-in screen.']
            : []),
        ]),
      };
    case 'password_changed':
      return {
        subject: 'Your Fold Health password was changed',
        html: layout('Your password was changed', [
          `Hi ${name}, the password for your Fold Health account was changed at ${at}.`,
          'You have been signed out everywhere. Sign in again with your new password.',
        ]),
      };
    case 'patient_invite':
      return {
        subject: 'Your Fold Health patient portal',
        html: layout('Welcome to your Fold Health patient portal', [
          `Hi ${name}, your care team set up the Fold Health patient portal for you${payload.relationship === 'self' ? '' : ` to help with ${esc(payload.patientName)}'s care`}.`,
          'In the portal you can book visits and see what is coming up next.',
          `Your sign-in email: <strong>${esc(payload.email)}</strong>`,
          'Choose a password with this link to get started. It works once and expires in 24 hours.',
          `<a href="${esc(payload.link)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#8C5AE2;color:#FFFFFF;text-decoration:none;font-weight:500">Set your password</a>`,
        ]),
      };
    case 'unlock_link':
      return {
        subject: 'Your Fold Health account was unlocked',
        html: layout('Set a new password to sign in', [
          `Hi ${name}, your administrator unlocked your Fold Health account at ${at}.`,
          `Your User ID: <strong>${esc(payload.email)}</strong>`,
          'Your old password no longer works. Set a new one with this link. It works once and expires in 24 hours.',
          `<a href="${esc(payload.link)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#8C5AE2;color:#FFFFFF;text-decoration:none;font-weight:500">Set a new password</a>`,
        ]),
      };
    case 'account_activated':
      return {
        subject: 'Your Fold Health account is active again',
        html: layout('Account activated successfully', [
          `Hi ${name}, you set a new password at ${at}, and your Fold Health account is active again.`,
          `Sign in with your User ID (${esc(payload.email)}) and your new password.`,
        ]),
      };
    case 'signup_approved':
      return {
        subject: 'Your Fold Health access was approved',
        html: layout('Your access was approved', [
          `Hi ${name}, your request to join Fold Health was approved at ${at}.`,
          `Sign in with your User ID (${esc(payload.email)}) and the password you chose when you signed up.`,
        ]),
      };
    case 'unlock_requested':
      return {
        subject: 'A user asked to unlock their account',
        html: layout('Unlock requested', [
          `${esc(payload.name)} (${esc(payload.email)}) asked to unlock their Fold Health account at ${at}.`,
          'Check their identity first, then unlock it in Fold Health under Settings, Account, Users. They will get an email with a link to set a new password.',
        ]),
      };
    case 'staff_account_locked':
      return {
        subject: 'A staff account is locked',
        html: layout('A staff account is locked', [
          `${esc(payload.name)} (${esc(payload.email)}) was locked at ${at} after ${esc(payload.attempts || 5)} failed sign-in attempts in a row.`,
          'Only an administrator can unlock it. After checking their identity, unlock it in Fold Health under Settings, Account, Users. They will get an email with a link to set a new password.',
        ]),
      };
    default:
      return null;
  }
}

/** `origin` is the app's address, for the template's {{sign_in_link}}. */
export async function sendSecurityEmail(to, kind, payload, { origin = appOrigin() } = {}) {
  if (!resend) throw new Error('RESEND_API_KEY is not set');
  const msg = (await templateEmail(kind, payload || {}, origin)) || renderSecurityEmail(kind, payload);
  if (!msg) throw new Error(`Unknown security email: ${kind}`);
  const { error } = await resend.emails.send({ from: FROM, to, subject: msg.subject, html: msg.html });
  if (error) throw new Error(error.message || 'Email failed');
}

/**
 * Send queued security emails (oldest first). Returns { sent, failed }.
 * Several flushes can run at once (database kick, sign-in page, reset API);
 * claim_security_emails hands each row to only one of them, so nobody gets
 * the same email twice.
 */
export async function flushSecurityOutbox(admin, limit = 50, { origin } = {}) {
  const { data: rows, error } = await admin.rpc('claim_security_emails', { max_rows: limit });
  if (error) throw error;
  let sent = 0;
  let failed = 0;
  for (const row of rows || []) {
    try {
      await sendSecurityEmail(row.to_email, row.kind, row.payload, origin ? { origin } : undefined);
      await admin.from('security_email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: row.attempts + 1 }).eq('id', row.id);
      sent += 1;
    } catch (err) {
      const attempts = row.attempts + 1;
      await admin.from('security_email_outbox')
        .update({ attempts, sent_at: null, last_error: String(err?.message || err).slice(0, 500), status: attempts >= 5 ? 'failed' : 'pending' })
        .eq('id', row.id);
      failed += 1;
    }
  }
  return { sent, failed };
}
