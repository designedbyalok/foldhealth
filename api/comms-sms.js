// Real SMS through textbee.dev: an Android phone running the textbee app
// sends and receives texts on its own SIM, so there is no carrier
// registration and no per-message fee (the phone's plan pays).
//
//   POST /api/comms-sms  { to, message }  → { id }
//   GET  /api/comms-sms?from=<10 digits>,… → { messages: [{ id, from, body, receivedAt }] }
//
// GET is polled by Messages > SMS to pull replies into their threads; it
// needs no public webhook, so it works on localhost too. The gateway phone
// also receives its owner's personal texts, so GET returns only messages
// from the numbers the app is waiting on (`from`, last ten digits each);
// with no `from` it returns nothing.
//
// Env: TEXTBEE_API_KEY, TEXTBEE_DEVICE_ID (both from the textbee dashboard).

import { requireUser } from './_lib/requireUser.js';
import { isE164 } from './_lib/validate.js';

// Longest text we'll send (10 SMS segments).
const MAX_SMS_LENGTH = 1600;

// The number as E.164: digits with a leading +, a bare 10-digit number as US.
function toE164(raw) {
  const s = String(raw || '').trim();
  const digits = s.replace(/\D/g, '');
  if (s.startsWith('+')) return `+${digits}`;
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

const BASE = 'https://api.textbee.dev/api/v1/gateway/devices';

function config() {
  const key = process.env.TEXTBEE_API_KEY;
  const device = process.env.TEXTBEE_DEVICE_ID;
  return key && device ? { key, device } : null;
}

const NOT_CONNECTED = 'SMS gateway is not connected. Add TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID to the environment.';

export default async function handler(req, res) {
  // Reads every inbound patient text and sends from our line: staff only.
  if (!(await requireUser(req, res))) return;
  const cfg = config();
  if (!cfg) return res.status(503).json({ error: { message: NOT_CONNECTED } });
  const headers = { 'x-api-key': cfg.key, 'Content-Type': 'application/json' };

  if (req.method === 'POST') {
    const { message } = req.body || {};
    const to = toE164(req.body?.to);
    if (!req.body?.to || !message) return res.status(400).json({ error: { message: 'Missing required fields: to, message' } });
    // One real phone number and a bounded message, so this isn't an open relay.
    if (!isE164(to)) return res.status(400).json({ error: { message: 'That phone number is not valid.' } });
    if (typeof message !== 'string' || message.length > MAX_SMS_LENGTH) {
      return res.status(400).json({ error: { message: `A text can be at most ${MAX_SMS_LENGTH} characters.` } });
    }
    try {
      const r = await fetch(`${BASE}/${cfg.device}/send-sms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ recipients: [to], message }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error('[comms-sms] gateway error', r.status, json);
        return res.status(r.status).json({ error: { message: 'The SMS gateway could not send this text.' } });
      }
      const id = json?.data?.smsBatchId || json?.data?._id || null;
      return res.status(200).json({ id });
    } catch (err) {
      console.error('[comms-sms]', err);
      return res.status(502).json({ error: { message: 'Could not reach the SMS gateway.' } });
    }
  }

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${BASE}/${cfg.device}/get-received-sms`, { headers });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error('[comms-sms] gateway error', r.status, json);
        return res.status(r.status).json({ error: { message: 'The SMS gateway could not be read.' } });
      }
      const wanted = new Set(
        (new URL(req.url, 'http://localhost').searchParams.get('from') || '')
          .split(',').map(d => d.replace(/\D/g, '').slice(-10)).filter(d => d.length >= 7),
      );
      const messages = (json?.data || [])
        .filter(m => wanted.has(String(m.sender || '').replace(/\D/g, '').slice(-10)))
        .map(m => ({
        id: `textbee:${m._id || m.id}`,
        from: m.sender,
        body: m.message,
        receivedAt: m.receivedAt || m.createdAt,
      }));
      return res.status(200).json({ messages });
    } catch (err) {
      console.error('[comms-sms]', err);
      return res.status(502).json({ error: { message: 'Could not reach the SMS gateway.' } });
    }
  }

  return res.status(405).json({ error: { message: 'Method not allowed' } });
}
