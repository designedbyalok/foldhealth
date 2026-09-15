import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  if (!resend) {
    return res.status(500).json({
      error: {
        message:
          'RESEND_API_KEY is not set. Add it to your Vercel project env vars ' +
          '(Production + Preview + Development) and to .env / .env.local for local dev.',
      },
    });
  }

  const { to, subject, html, fromName, listUnsubscribe } = req.body || {};
  if (!to || !html) {
    return res.status(400).json({ error: { message: 'Missing required fields: to, html' } });
  }

  const defaultFrom = process.env.RESEND_FROM || 'Fold Health <noreply@designedbyalok.com>';
  const from = fromName ? `${fromName} <${defaultFrom.match(/<(.+)>/)?.[1] || defaultFrom}>` : defaultFrom;

  // One-click list unsubscribe (RFC 8058) — improves deliverability and is a
  // Gmail/Yahoo bulk-sender requirement. Only added when the caller supplies a
  // resolved URL.
  const headers = listUnsubscribe
    ? { 'List-Unsubscribe': `<${listUnsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : undefined;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: subject || 'Test Email from Fold Health',
      html,
      ...(headers ? { headers } : {}),
    });
    if (error) {
      return res.status(error.statusCode || 400).json({ error });
    }
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({
      error: { message: err?.message || 'Unknown error', name: err?.name },
    });
  }
}
