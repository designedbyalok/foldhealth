import { addMessage, findOrCreateConversation } from '../../messages/comms/commsRepo';
import { formatPhone, toE164 } from '../../messages/comms/commsUtils';

/**
 * How a logged call reads in the mobile call log (Figma 759:18970):
 * label under the name, avatar tone, and whether the name turns red.
 */
export function callRow(message) {
  const outcome = message?.meta?.outcome;
  const inbound = message?.direction === 'in';
  if (outcome === 'missed') {
    return { label: inbound ? 'Missed' : 'No Answer', variant: 'error', icon: 'solar:end-call-rounded-linear', missed: inbound };
  }
  if (outcome === 'declined' || outcome === 'failed') {
    return { label: outcome === 'declined' ? 'Declined' : 'Abandoned', variant: 'error', icon: 'solar:end-call-rounded-linear', missed: false };
  }
  if (inbound) return { label: 'Incoming', variant: 'success', icon: 'solar:incoming-call-rounded-linear', missed: false };
  return { label: 'Outgoing', variant: 'others', icon: 'solar:outgoing-call-rounded-linear', missed: false };
}

/**
 * Call a number on the provider's own phone (tel:) and log it, the same way
 * the desktop Voice Call drawer does. Logging is best effort: the dialer has
 * already opened.
 */
export async function callFromPhone({ number, patient, patients = [], sender }) {
  const e164 = toE164(number);
  if (!e164) return;
  const who = patient || patients.find(p => toE164(p.phone) === e164) || { id: null, name: formatPhone(e164), phone: e164 };
  window.location.href = `tel:${e164}`;
  try {
    const conv = await findOrCreateConversation('call', who, { patient_phone: e164 });
    await addMessage({
      conversation_id: conv.id, kind: 'call', direction: 'out', sender_id: sender?.id || null, sender_name: sender?.name || '',
      body: 'Called from phone', status: 'sent', meta: { outcome: 'phone', via: 'phone', number: e164 },
    });
  } catch { /* logging only */ }
}
