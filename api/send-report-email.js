/**
 * POST /api/send-report-email
 *
 * Sends a report (e.g. the Employer Impact PDF) by email through Resend,
 * with the file attached. Keeps RESEND_API_KEY on the server.
 *
 * Body: { to: string[], cc?: string[], bcc?: string[], subject: string,
 *         text: string, fromName?: string, replyTo?: string,
 *         attachment: { filename: string, contentBase64: string } }
 *
 * The message is plain text (the composer's body plus its signature),
 * sent as escaped HTML with its line breaks kept.
 */
import { Resend } from 'resend';
import { requireUser } from './_lib/requireUser.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Resend accepts up to 40MB per email; the serverless request body is the
// tighter limit, so a clear error beats a silent failure.
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const escapeHtml = (t) => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const list = (v) => (Array.isArray(v) ? v : []).map(s => String(s).trim()).filter(Boolean);

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;

  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });
  if (!resend) {
    return res.status(500).json({ error: { message: 'Email isn\'t set up: RESEND_API_KEY is missing on the server.' } });
  }
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const to = list(b.to);
  const cc = list(b.cc);
  const bcc = list(b.bcc);
  const bad = [...to, ...cc, ...bcc].filter(a => !EMAIL.test(a));
  if (!to.length) return res.status(400).json({ error: { message: 'Add at least one recipient.' } });
  if (bad.length) return res.status(400).json({ error: { message: `Not a valid email address: ${bad.join(', ')}` } });
  if (!String(b.subject || '').trim()) return res.status(400).json({ error: { message: 'Add a subject.' } });
  const file = b.attachment;
  if (!file?.filename || !file?.contentBase64) return res.status(400).json({ error: { message: 'The report attachment is missing.' } });
  if ((file.contentBase64.length * 3) / 4 > MAX_ATTACHMENT_BYTES) {
    return res.status(413).json({ error: { message: 'The report is too large to email (over 4 MB). Try fewer sections, or no cover image.' } });
  }

  const defaultFrom = process.env.RESEND_FROM || 'Fold Health <noreply@designedbyalok.com>';
  const address = defaultFrom.match(/<(.+)>/)?.[1] || defaultFrom;
  const from = b.fromName ? `${String(b.fromName).replace(/[<>"]/g, '')} <${address}>` : defaultFrom;
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.5;color:#3A485F">${escapeHtml(b.text || '').replace(/\n/g, '<br>')}</div>`;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      replyTo: b.replyTo && EMAIL.test(b.replyTo) ? b.replyTo : undefined,
      subject: String(b.subject).trim(),
      html,
      text: String(b.text || ''),
      attachments: [{ filename: String(file.filename), content: file.contentBase64 }],
    });
    if (error) return res.status(502).json({ error: { message: error.message || 'The email service rejected the message.' } });
    return res.status(200).json({ id: data?.id || null });
  } catch (err) {
    return res.status(502).json({ error: { message: err?.message || 'Sending failed.' } });
  }
}
