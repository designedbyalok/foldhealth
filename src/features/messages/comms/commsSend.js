// Sending on the real channels. Each send is saved first as `queued`, then
// marked `sent` or `failed` (with the reason) once the provider answers, so a
// failure stays visible in the thread and can be retried.
//
// Email goes out through Resend (/api/send-test-email). SMS works like Chat
// for now: it's saved in the app and the patient reads and answers it on
// their patient page. With VITE_SMS_GATEWAY=textbee it goes out through the
// textbee Android gateway (/api/comms-sms) instead, which also hands back
// the replies that pollInboundSms() files into threads.

import {
  addMessage, updateMessage, listConversations,
} from './commsRepo';
import { apiFetch } from '../../../lib/apiFetch';

async function postJson(url, body) {
  let res;
  try {
    res = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Network connectivity issues prevented sending.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `The server returned ${res.status}.`);
  }
  return json;
}

const splitAddrs = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).filter(Boolean);

async function deliverEmail(message) {
  const json = await postJson('/api/send-test-email', {
    to: splitAddrs(message.to_addr),
    cc: splitAddrs(message.cc),
    bcc: splitAddrs(message.bcc),
    subject: message.subject,
    html: message.html || `<div style="white-space:pre-wrap">${escapeHtml(message.body)}</div>`,
    fromName: message.sender_name || undefined,
  });
  return json?.data?.id || null;
}

async function deliverSms(message) {
  const json = await postJson('/api/comms-sms', { to: message.to_addr, message: message.body });
  return json?.id || null;
}

async function settle(message, deliver) {
  try {
    const providerId = await deliver(message);
    return await updateMessage(message.id, { status: 'sent', failure_reason: null, ...(providerId ? { provider_id: providerId } : {}) });
  } catch (err) {
    return updateMessage(message.id, { status: 'failed', failure_reason: err.message });
  }
}

export async function sendEmail({ conversation, sender, from, to, cc, bcc, subject, html, body, meta }) {
  const message = await addMessage({
    conversation_id: conversation.id,
    kind: 'email',
    direction: 'out',
    sender_id: sender?.id || null,
    sender_name: sender?.name || '',
    from_addr: from || null,
    to_addr: splitAddrs(to).join(', '),
    cc: splitAddrs(cc).join(', ') || null,
    bcc: splitAddrs(bcc).join(', ') || null,
    subject,
    html,
    body,
    status: 'queued',
    ...(meta ? { meta } : {}),
  });
  return settle(message, deliverEmail);
}

/** `loggedFor`: the member of a shared number this SMS is logged for. */
/** True when SMS really leaves through the gateway (see the note at the top). */
export const SMS_VIA_GATEWAY = import.meta.env.VITE_SMS_GATEWAY === 'textbee';

export async function sendSms({ conversation, sender, to, body, meta, loggedFor }) {
  const message = await addMessage({
    conversation_id: conversation.id,
    kind: 'message',
    direction: 'out',
    sender_id: sender?.id || null,
    sender_name: sender?.name || '',
    to_addr: to,
    body,
    status: SMS_VIA_GATEWAY ? 'queued' : 'sent',
    ...(meta ? { meta } : {}),
    ...(loggedFor ? { logged_for_patient_id: loggedFor.id, logged_for_name: loggedFor.name } : {}),
  });
  return SMS_VIA_GATEWAY ? settle(message, deliverSms) : message;
}

/** Try a failed email or SMS again. */
export async function retrySend(message) {
  if (message.kind !== 'email' && !SMS_VIA_GATEWAY) {
    return updateMessage(message.id, { status: 'sent', failure_reason: null });
  }
  await updateMessage(message.id, { status: 'queued', failure_reason: null });
  return settle(message, message.kind === 'email' ? deliverEmail : deliverSms);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);

/**
 * Pull texts the gateway phone received and file each into its patient's SMS
 * thread (matched on the last ten digits; an unknown number opens a new
 * thread). Already-filed texts are skipped by their provider id.
 * Resolves to { connected } so the caller can stop polling a missing gateway.
 */
export async function pollInboundSms() {
  // Only numbers the app has texted (an SMS thread it started) are asked
  // for, so the gateway phone's personal texts never reach the browser.
  const convs = (await listConversations())
    .filter(c => c.channel === 'sms' && c.patient_id && digits(c.patient_phone).length >= 7);
  if (!convs.length) return { connected: true };
  const from = [...new Set(convs.map(c => digits(c.patient_phone)))].join(',');
  let res;
  try { res = await apiFetch(`/api/comms-sms?from=${from}`); } catch { return { connected: false }; }
  if (!res.ok) return { connected: false };
  const { messages = [] } = await res.json().catch(() => ({}));
  for (const m of messages) {
    // A text from before the app's thread with that number began is not a reply.
    const received = new Date(m.receivedAt || Date.now()).getTime();
    const conv = convs.find(c => digits(c.patient_phone) === digits(m.from) && received >= new Date(c.created_at).getTime());
    if (!conv) continue;
    await addMessage({
      conversation_id: conv.id,
      kind: 'message',
      direction: 'in',
      sender_name: conv.patient_name,
      from_addr: m.from,
      body: m.body,
      status: 'delivered',
      provider_id: m.id,
      created_at: m.receivedAt || new Date().toISOString(),
    });
  }
  return { connected: true };
}
