import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { to, subject, html, fromName, listUnsubscribe } = await req.json();

  if (!to || !html) {
    return Response.json({ error: 'Missing required fields: to, html' }, { status: 400 });
  }

  const defaultFrom = process.env.RESEND_FROM || 'Fold Health <noreply@designedbyalok.com>';
  const from = fromName ? `${fromName} <${defaultFrom.match(/<(.+)>/)?.[1] || defaultFrom}>` : defaultFrom;
  const headers = listUnsubscribe
    ? { 'List-Unsubscribe': `<${listUnsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : undefined;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: subject || 'Test Email from Fold Health',
    html,
    ...(headers ? { headers } : {}),
  });

  if (error) {
    return Response.json({ error }, { status: 400 });
  }

  return Response.json({ data });
}

export const config = { path: '/api/send-test-email' };
