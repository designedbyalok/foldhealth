import { Resend } from 'resend';

/**
 * Security emails (account lockout, password reset). Every one states the
 * time and what happened and says "If this wasn't you, contact your clinic
 * or administrator". None contains a password. The only link is the
 * one-time "set a new password" link an administrator's unlock sends.
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

export async function sendSecurityEmail(to, kind, payload) {
  if (!resend) throw new Error('RESEND_API_KEY is not set');
  const msg = renderSecurityEmail(kind, payload);
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
export async function flushSecurityOutbox(admin, limit = 50) {
  const { data: rows, error } = await admin.rpc('claim_security_emails', { max_rows: limit });
  if (error) throw error;
  let sent = 0;
  let failed = 0;
  for (const row of rows || []) {
    try {
      await sendSecurityEmail(row.to_email, row.kind, row.payload);
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
