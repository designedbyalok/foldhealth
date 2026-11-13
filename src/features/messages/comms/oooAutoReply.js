// Out of Office auto-reply: when a patient writes to someone who's out of
// office with an auto-reply set, send it once for that record, on the same
// channel, in their name (meta.ooo_auto_reply, shown as the auto-reply card).
// "Someone" is the staff member the patient was last talking to: the last
// person who sent them a message in the thread.

import { activeOooFor } from '../../ooo/oooUtils';
import { addMessage, getConversation, listMessages, subscribeComms } from './commsRepo';
import { sendEmail, sendSms } from './commsSend';

const FROM_ADDRESS = 'noreply@foldhealth.org';
// Only messages that just came in; a reload or backfill never triggers one.
const FRESH_MS = 5 * 60 * 1000;

export const isAutoReply = (m) => !!m?.meta?.ooo_auto_reply;

/**
 * Whether an incoming message gets an auto-reply, and from whom.
 * Returns { record, staff: { id, name }, body } or null.
 */
export function autoReplyPlan({ messages = [], inbound, records = [], now = new Date() }) {
  if (!inbound || inbound.direction !== 'in' || inbound.internal) return null;
  const at = new Date(inbound.created_at).getTime();
  const lastOut = [...messages]
    .filter(m => m.id !== inbound.id && new Date(m.created_at).getTime() <= at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .reverse()
    .find(m => m.direction === 'out' && !m.internal && !isAutoReply(m) && (m.sender_id || m.sender_name));
  if (!lastOut) return null;
  const staff = { id: lastOut.sender_id || null, name: lastOut.sender_name || '' };
  const record = activeOooFor(records, staff, now);
  const body = String(record?.autoReplyMessage || '').trim();
  if (!record || !record.autoReply || !body) return null;
  // Once per conversation for this record.
  if (messages.some(m => isAutoReply(m) && m.meta?.ooo_record_id === record.id)) return null;
  return { record, staff: { id: staff.id, name: record.userName || staff.name }, body };
}

const replySubject = (s) => (/^re:/i.test(String(s || '').trim()) ? s : `Re: ${s || 'Your message'}`);

/** Send the planned auto-reply on the conversation's channel. */
export async function sendAutoReply(conversation, inbound, plan) {
  const meta = { ooo_auto_reply: true, ooo_record_id: plan.record.id };
  const sender = plan.staff;
  if (conversation.channel === 'email') {
    return sendEmail({
      conversation, sender, from: FROM_ADDRESS,
      to: inbound.from_addr || conversation.patient_email,
      subject: replySubject(inbound.subject), body: plan.body, meta,
    });
  }
  if (conversation.channel === 'sms') {
    return sendSms({ conversation, sender, to: inbound.from_addr || conversation.patient_phone, body: plan.body, meta });
  }
  return addMessage({
    conversation_id: conversation.id, kind: 'message', direction: 'out',
    sender_id: sender.id, sender_name: sender.name, body: plan.body, status: 'sent', meta,
  });
}

/**
 * Watch for patients' messages and auto-reply where it's due. `getRecords`
 * returns the current Out of Office records. Returns an unsubscribe.
 */
export function watchOooAutoReplies(getRecords) {
  const busy = new Set();
  return subscribeComms(async (change) => {
    const row = change?.row;
    if (change?.table !== 'patient_messages' || change.type !== 'INSERT' || !row) return;
    if (row.direction !== 'in' || row.internal) return;
    if (Date.now() - new Date(row.created_at).getTime() > FRESH_MS) return;
    if (busy.has(row.conversation_id)) return;
    busy.add(row.conversation_id);
    try {
      const conversation = await getConversation(row.conversation_id);
      if (!conversation || !['chat', 'sms', 'email'].includes(conversation.channel)) return;
      const plan = autoReplyPlan({ messages: await listMessages(row.conversation_id), inbound: row, records: getRecords() });
      if (plan) await sendAutoReply(conversation, row, plan);
    } catch (err) {
      console.warn('OOO auto-reply:', err?.message || err);
    } finally {
      busy.delete(row.conversation_id);
    }
  });
}
