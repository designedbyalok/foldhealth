// Small shared helpers for the Comms channels.

export const CHANNEL_META = {
  all:   { title: 'All Conversations', noun: 'conversation', icon: 'solar:chat-round-call-linear' },
  chat:  { title: 'Chats', noun: 'chat', icon: 'solar:chat-round-linear' },
  sms:   { title: 'SMS', noun: 'SMS', icon: 'solar:chat-square-linear' },
  call:  { title: 'Calls', noun: 'call', icon: 'solar:phone-calling-linear' },
  email: { title: 'Emails', noun: 'email', icon: 'solar:letter-linear' },
};

export const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean)
  .filter(w => /[a-z]/i.test(w[0])).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '#';

/** The `all_patients` row a conversation is about, when it is linked to one. */
export function patientFor(conversation, patients = []) {
  if (!conversation) return null;
  if (conversation.patient_id) {
    const hit = patients.find(p => String(p.id) === String(conversation.patient_id));
    if (hit) return hit;
  }
  return patients.find(p => p.name === conversation.patient_name) || null;
}

/** "Patient • F • 53Y • Dr. Robert Frost (PCP)" style meta, from what we know. */
export function patientMeta(conversation, patient) {
  return patientMetaParts(conversation, patient).join(' • ');
}

/** The pieces of `patientMeta`; the gender letter, when known, is second. */
export function patientMetaParts(conversation, patient) {
  const parts = ['Patient'];
  if (patient?.gender) parts.push(String(patient.gender)[0].toUpperCase());
  if (patient?.age) parts.push(`${patient.age}Y`);
  if (patient?.pcp) parts.push(`${patient.pcp} (PCP)`);
  if (parts.length === 1) {
    const contact = conversation?.patient_phone || conversation?.patient_email;
    if (contact) parts.push(contact);
  }
  return parts;
}

/** Visuals for a call by how it ended. */
export function callLook(message) {
  const outcome = message?.meta?.outcome;
  const inbound = message?.direction === 'in';
  if (outcome === 'completed') {
    return { tone: 'success', icon: inbound ? 'solar:incoming-call-rounded-linear' : 'solar:outgoing-call-rounded-linear', label: inbound ? 'Incoming Call' : 'Outgoing Call' };
  }
  if (outcome === 'missed') return { tone: 'error', icon: 'solar:end-call-rounded-linear', label: inbound ? 'Missed Call' : 'No Answer' };
  if (outcome === 'declined') return { tone: 'error', icon: 'solar:end-call-rounded-linear', label: 'Call Declined' };
  if (outcome === 'failed') return { tone: 'error', icon: 'solar:end-call-rounded-linear', label: 'Call Failed' };
  if (outcome === 'phone') return { tone: 'neutral', icon: 'solar:phone-calling-linear', label: 'Called from phone' };
  return { tone: 'neutral', icon: 'solar:phone-linear', label: 'Call Cancelled' };
}

export function fullStamp(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} • ${time}`;
}

export function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export const patientLink = (token) => `${window.location.origin}${window.location.pathname}#/p/${token}`;

/**
 * Open a URL in a new browser tab. A real link with target="_blank" always
 * gets a tab; window.open with a features string can open a popup window or
 * land in the same tab instead.
 */
export function openInNewTab(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** For display: +1 (584) 555-0142 */
export function formatPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw || '';
}

/**
 * A number in E.164 (+<country><number>). A number typed with its own "+"
 * keeps it; otherwise the country code is put in front (a leading trunk 0,
 * as in UK or Indian national format, is dropped). With the default US code,
 * an 11-digit number starting with 1 already carries it.
 */
export function toE164(raw, countryCode = '1') {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (String(raw).trim().startsWith('+')) return `+${d}`;
  if (countryCode === '1' && d.length === 11 && d[0] === '1') return `+${d}`;
  return `+${countryCode}${d.replace(/^0+/, '')}`;
}

/** Country dialling codes for number entry (flag, ISO code, dial code). */
export const DIAL_COUNTRIES = [
  { iso: 'US', flag: '🇺🇸', code: '1', name: 'United States' },
  { iso: 'CA', flag: '🇨🇦', code: '1', name: 'Canada' },
  { iso: 'MX', flag: '🇲🇽', code: '52', name: 'Mexico' },
  { iso: 'GB', flag: '🇬🇧', code: '44', name: 'United Kingdom' },
  { iso: 'IE', flag: '🇮🇪', code: '353', name: 'Ireland' },
  { iso: 'IN', flag: '🇮🇳', code: '91', name: 'India' },
  { iso: 'PH', flag: '🇵🇭', code: '63', name: 'Philippines' },
  { iso: 'AU', flag: '🇦🇺', code: '61', name: 'Australia' },
  { iso: 'NZ', flag: '🇳🇿', code: '64', name: 'New Zealand' },
  { iso: 'DE', flag: '🇩🇪', code: '49', name: 'Germany' },
  { iso: 'FR', flag: '🇫🇷', code: '33', name: 'France' },
  { iso: 'ES', flag: '🇪🇸', code: '34', name: 'Spain' },
  { iso: 'IT', flag: '🇮🇹', code: '39', name: 'Italy' },
  { iso: 'NL', flag: '🇳🇱', code: '31', name: 'Netherlands' },
  { iso: 'BR', flag: '🇧🇷', code: '55', name: 'Brazil' },
  { iso: 'CN', flag: '🇨🇳', code: '86', name: 'China' },
  { iso: 'JP', flag: '🇯🇵', code: '81', name: 'Japan' },
  { iso: 'KR', flag: '🇰🇷', code: '82', name: 'South Korea' },
  { iso: 'SG', flag: '🇸🇬', code: '65', name: 'Singapore' },
  { iso: 'AE', flag: '🇦🇪', code: '971', name: 'United Arab Emirates' },
  { iso: 'SA', flag: '🇸🇦', code: '966', name: 'Saudi Arabia' },
  { iso: 'ZA', flag: '🇿🇦', code: '27', name: 'South Africa' },
  { iso: 'NG', flag: '🇳🇬', code: '234', name: 'Nigeria' },
  { iso: 'PK', flag: '🇵🇰', code: '92', name: 'Pakistan' },
  { iso: 'BD', flag: '🇧🇩', code: '880', name: 'Bangladesh' },
];

/** A dialable local number: 10 digits for +1, at least 6 elsewhere. */
export const isDialable = (raw, countryCode = '1') => {
  const d = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  return countryCode === '1' ? d.length >= 10 : d.length >= 6;
};

/** A Calls conversation whose latest call went unanswered. */
export const isMissedCall = (c) => c.channel === 'call' && /missed|no answer|declined|failed/i.test(c.last_preview || '');
