import { Resend } from 'resend';
import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import { addressList, isEmail, headerText, isSafeHttpsUrl, MAX_RECIPIENTS } from '../_lib/validate.js';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  if (!resend) {
    console.error('[send-test-email] RESEND_API_KEY is not set');
    return res.status(500).json({ error: { message: 'Email sending is not configured.' } });
  }

  if (!bodyWithinLimit(req, res, 512 * 1024)) return;

  const { subject, html, fromName, listUnsubscribe } = req.body || {};
  const to = addressList(req.body?.to);
  const cc = addressList(req.body?.cc);
  const bcc = addressList(req.body?.bcc);
  const replyTo = req.body?.replyTo ? String(req.body.replyTo).trim() : '';
  if (!to.length || !html) {
    return res.status(400).json({ error: { message: 'Missing required fields: to, html' } });
  }
  // Not an open relay: real addresses only, and a cap on how many.
  const all = [...to, ...cc, ...bcc, ...(replyTo ? [replyTo] : [])];
  if (!all.every(isEmail)) {
    return res.status(400).json({ error: { message: 'One of the email addresses is not valid.' } });
  }
  if (to.length + cc.length + bcc.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: { message: `An email can go to at most ${MAX_RECIPIENTS} recipients.` } });
  }
  if (listUnsubscribe && !isSafeHttpsUrl(listUnsubscribe)) {
    return res.status(400).json({ error: { message: 'The unsubscribe link must be an https URL.' } });
  }

  const defaultFrom = process.env.RESEND_FROM || 'Fold Health <noreply@foldhealth.org>';
  // The display name can't carry header characters (no CR/LF or angle brackets).
  const name = headerText(fromName, 80);
  const from = name ? `${name} <${defaultFrom.match(/<(.+)>/)?.[1] || defaultFrom}>` : defaultFrom;

  // One-click list unsubscribe (RFC 8058): improves deliverability and is a
  // Gmail/Yahoo bulk-sender requirement. Only added when the caller supplies a
  // resolved URL.
  const headers = listUnsubscribe
    ? { 'List-Unsubscribe': `<${listUnsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : undefined;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      ...(cc?.length ? { cc } : {}),
      ...(bcc?.length ? { bcc } : {}),
      ...(replyTo ? { replyTo } : {}),
      subject: headerText(subject, 300) || 'Test Email from Fold Health',
      html,
      ...(headers ? { headers } : {}),
    });
    if (error) {
      console.error('[send-test-email] Resend error', error);
      return res.status(error.statusCode || 400).json({ error: { message: error.message || 'The email could not be sent.' } });
    }
    return res.status(200).json({ data });
  } catch (err) {
    console.error('[send-test-email]', err);
    return res.status(500).json({ error: { message: 'The email could not be sent.' } });
  }
}
