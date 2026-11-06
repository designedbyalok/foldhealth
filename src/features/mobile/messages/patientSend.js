// Send Education / Send Assessment delivery, as in desktop PatientSendDrawers
// (deliver / channelsFor are private there, so the same steps live here).
import { toast } from '../../../components/Toast/sonnerToast';
import { findOrCreateConversation } from '../../messages/comms/commsRepo';
import { sendEmail, sendSms } from '../../messages/comms/commsSend';
import { toE164 } from '../../messages/comms/commsUtils';
import { protectHtml, protectSms } from '../../messages/comms/sendTo';

export const FROM_ADDRESS = 'noreply@foldhealth.org';

export const SEND_VIA = [
  { value: 'email', label: 'Email only' },
  { value: 'sms', label: 'SMS only' },
  { value: 'both', label: 'Email and SMS' },
  { value: 'emailOrSms', label: 'Email, or SMS if there is no email' },
];

/** The channels a send goes out on, given what the person has. */
export function channelsFor(via, recipient) {
  const hasEmail = !!recipient.email;
  const hasPhone = !!recipient.phone;
  if (via === 'email') return { email: hasEmail, sms: false };
  if (via === 'sms') return { email: false, sms: hasPhone };
  if (via === 'both') return { email: hasEmail, sms: hasPhone };
  return { email: hasEmail, sms: !hasEmail && hasPhone };
}

/** Send to each picked person on the channels `via` allows; resolves true when anything went out. */
export async function deliver({ recipient, targets, via, me, subject, html, smsBody, meta, verifyId }) {
  const sender = { id: me?.id, name: me?.name || 'Care team' };
  if (verifyId?.on) {
    const email = protectHtml(html);
    const sms = protectSms(smsBody);
    html = email.html;
    smsBody = sms.text;
    meta = { ...meta, verifyId, secureLinks: [...email.links, ...sms.links] };
  }
  const results = [];
  const emails = targets.filter(t => channelsFor(via, t).email).map(t => t.email);
  const phones = targets.filter(t => channelsFor(via, t).sms).map(t => toE164(t.phone));
  if (emails.length) {
    const conv = await findOrCreateConversation('email', recipient, { patient_email: recipient.email || emails[0], subject });
    results.push(['Email', await sendEmail({
      conversation: conv, sender, from: FROM_ADDRESS, to: emails, subject, html,
      body: new DOMParser().parseFromString(html, 'text/html').body?.innerText || '', meta,
    })]);
  }
  if (phones.length) {
    const own = recipient.phone ? toE164(recipient.phone) : phones[0];
    const conv = await findOrCreateConversation('sms', { ...recipient, phone: own }, { patient_phone: own });
    const loggedFor = recipient.id != null ? { id: String(recipient.id), name: recipient.name } : undefined;
    // One at a time, in order: each SMS goes through the gateway's rate limit and lands in the thread in order.
    for (const phone of phones) results.push(['SMS', await sendSms({ conversation: conv, sender, to: phone, body: smsBody, meta, loggedFor })]);
  }
  const failed = results.filter(([, m]) => m?.status === 'failed');
  const channels = [...new Set(results.map(([c]) => c))];
  if (!results.length) toast.error('Nothing sent: no one picked has an email or phone for the chosen channel.');
  else if (failed.length) toast.error(`${failed.map(([c]) => c).join(' and ')} not sent: ${failed[0][1].failure_reason}`);
  else toast.success(`${channels.join(' and ')} Sent Successfully`);
  return results.length > 0;
}
