import crypto from 'node:crypto';
import { serviceClient } from './_lib/serviceClient.js';
import { emailConfigured, flushSecurityOutbox } from './_lib/securityEmails.js';

/**
 * Sends queued security emails (public.security_email_outbox): account
 * locked, account unlocked, password changed, staff account locked.
 *
 * Called by the database (pg_net, via public.security_email_kick) with the
 * x-dispatch-secret header, and by the app after a lock, unlock or reset.
 * It only sends what the database already queued, so it needs no sign-in;
 * each call sends at most 50.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });
  if (!serviceClient || !emailConfigured) {
    return res.status(500).json({ error: { message: 'Security email is not configured on the server.' } });
  }
  const secret = process.env.SECURITY_DISPATCH_SECRET;
  const given = req.headers?.['x-dispatch-secret'];
  const fromDatabase = !!(secret && typeof given === 'string' && given.length === secret.length
    && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret)));
  try {
    const result = await flushSecurityOutbox(serviceClient, fromDatabase ? 100 : 50);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[security-email-dispatch]', err);
    return res.status(500).json({ error: { message: 'Could not send security emails.' } });
  }
}
