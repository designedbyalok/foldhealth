// "Send To" for the patient send drawers (Compose Email, New SMS, Send
// Assessment, Send Content): who the message goes to, their contact, the
// optional protected link, and the checks that gate Send.

export const RECIPIENT_TYPES = ['Patient', 'Care Giver', 'Emergency Contact', 'Decision Maker', 'Alternate Decision Maker'];

// Each verification method and the detail the recipient must have on record.
export const VERIFICATION_METHODS = [
  { value: 'first_name', label: 'First name', detail: 'first name', field: 'name' },
  { value: 'phone', label: 'Phone number', detail: 'phone number', field: 'phone' },
  { value: 'email', label: 'Email', detail: 'email address', field: 'email' },
  { value: 'otp_sms', label: 'SMS OTP', detail: 'phone number', field: 'phone' },
  { value: 'otp_email', label: 'Email OTP', detail: 'email address', field: 'email' },
];

export const INVALID_ATTEMPT_POLICIES = ['Time-based lock', 'Maximum total attempts', 'Time-based lock and maximum total attempts'];
// Which settings a policy uses: the attempt window + lock, the lifetime cap, or both.
export const usesTimeLock = (policy) => policy !== INVALID_ATTEMPT_POLICIES[1];
export const usesMaxTotal = (policy) => policy !== INVALID_ATTEMPT_POLICIES[0];

export const DEFAULT_PROTECTION = {
  on: false,
  methods: ['first_name', 'phone'],
  required: 2,
  policy: INVALID_ATTEMPT_POLICIES[1],
  maxAttempts: 3,
};

// "Verify ID to access links in this mail" (Compose Email from Comms,
// Figma 2900:34239): off by default.
export const DEFAULT_ID_VERIFICATION = {
  on: false,
  methods: ['first_name', 'phone'],
  minimum: 2,
  action: INVALID_ATTEMPT_POLICIES[2],
  attemptsPerWindow: 3,
  windowMinutes: 10,
  lockMinutes: 60,
  maxTotalAttempts: 10,
};

/**
 * Who can't pass Verify ID: each picked person ({ name, email, phone, dob })
 * whose record can't cover the minimum number of the chosen methods, with
 * what's missing. Empty when verification is off or everyone can verify.
 */
export function verifyBlockers(verify, people = []) {
  if (!verify?.on) return [];
  const methods = VERIFICATION_METHODS.filter(m => verify.methods.includes(m.value));
  const need = Math.min(verify.minimum, methods.length);
  return people.flatMap((p) => {
    const missing = methods.filter(m => !has(p[m.field]));
    if (methods.length - missing.length >= need) return [];
    const available = methods.filter(m => !missing.includes(m));
    return [{ name: p.name || 'This recipient', missing: missing.map(m => m.detail), available: available.map(methodWord) }];
  });
}

/** A method as it reads mid-sentence: "first name", "phone number", "SMS OTP". */
const methodWord = (m) => (m.label.includes('OTP') ? m.label : m.label.toLowerCase());

/** "name, date of birth" and "both required" / "all required" / "any 1 of 3 required". */
export function verifySummary(verify) {
  const chosen = VERIFICATION_METHODS.filter(m => verify.methods.includes(m.value));
  const n = chosen.length;
  const min = Math.min(verify.minimum, n);
  const rule = n <= 1 ? '' : min === n ? (n === 2 ? 'both required' : 'all required') : `any ${min} of ${n} required`;
  return { methods: chosen.map(methodWord).join(', '), rule };
}

// Verify ID protects links: each one is swapped for a secure link that opens
// the original after the recipient verifies. A protected SMS also starts
// with this line, which counts toward the SMS limit.
export const SECURE_SMS_TEXT = 'You have a secure message from Fold Health.';
const URL_RE = /https?:\/\/[^\s"'<>]+/g;
const secureToken = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, '').slice(0, 20);
const secureLink = () => `${window.location.origin}/#/secure/${secureToken()}`;

export const hasLink = (text) => new RegExp(URL_RE.source).test(String(text || ''));

/** SMS text as sent with Verify ID on, and the secure → original link map. */
export function protectSms(body) {
  const links = [];
  const text = String(body).replace(URL_RE, (url) => {
    const secure = secureLink();
    links.push({ secure, url });
    return secure;
  });
  return { text: `${SECURE_SMS_TEXT}\n${text}`, links };
}

/** Email HTML with every web link's href swapped for a secure link. */
export function protectHtml(html) {
  const links = [];
  const out = String(html).replace(/href="(https?:\/\/[^"]+)"/g, (_, url) => { const secure = secureLink(); links.push({ secure, url }); return `href="${secure}"`; });
  return { html: out, links };
}

/** Characters Verify ID adds to an SMS before its text. */
export const SECURE_SMS_PREFIX = SECURE_SMS_TEXT.length + 1;

/**
 * Contact methods a drawer needs (Reference Table 3):
 * 'email' | 'phone' | 'both' (Email, SMS.) | 'either' (Email or SMS).
 */
const has = (v) => !!String(v || '').trim();

/**
 * The first failed check as a message (Reference Table 4), or null.
 * `contact` is the resolved recipient ({ name, email, phone, dob }), null when
 * none of that type is recorded.
 */
export function recipientError({ type, contact, need, protection }) {
  const patient = type === 'Patient';
  const who = patient ? 'This patient' : `The ${type} for this patient`;
  const a = (w) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
  if (!contact) return `No ${type} is recorded for this patient. Add ${a(type)} to send.`;
  const email = has(contact.email);
  const phone = has(contact.phone);
  const missing = need === 'email' ? (!email && 'email address')
    : need === 'phone' ? (!phone && 'phone number')
      : need === 'both' ? ((!email && 'email address') || (!phone && 'phone number'))
        : null;
  if (missing) return `${who} does not have ${a(missing)} on record. Add ${a(missing)} to send.`;
  if (need === 'either' && !email && !phone) return `${who} does not have an email address or phone number on record. Add one to send.`;
  if (protection?.on) {
    const gap = VERIFICATION_METHODS.find(m => protection.methods.includes(m.value) && !has(contact[m.field]));
    if (gap) return `${who} does not have ${a(gap.detail)} on record, which is required for the selected verification method. Add it or remove this verification method to send.`;
  }
  return null;
}

/**
 * Stand-in contacts until a patient's are recorded in `patient_contacts`: one
 * person who is both Care Giver and Decision Maker (one row per role, shown as
 * one person), an Emergency Contact with a phone only, and an Alternate
 * Decision Maker without a date of birth, so every check can be seen. Each
 * role has one holder.
 */
export function sampleContactsFor(patientId) {
  return [
    { id: `${patientId}-cg`, patientId, type: 'Care Giver', name: 'Maria Lopez', gender: 'Female', email: 'maria.lopez@example.com', phone: '(415) 555-0142', dob: '1979-04-12' },
    { id: `${patientId}-ec`, patientId, type: 'Emergency Contact', name: 'Daniel Lopez', gender: 'Male', email: '', phone: '(415) 555-0199', dob: '1982-09-03' },
    { id: `${patientId}-dm`, patientId, type: 'Decision Maker', name: 'Maria Lopez', gender: 'Female', email: 'maria.lopez@example.com', phone: '(415) 555-0142', dob: '1979-04-12' },
    { id: `${patientId}-adm`, patientId, type: 'Alternate Decision Maker', name: 'Rosa Alvarez', gender: 'Female', email: 'rosa.alvarez@example.com', phone: '(415) 555-0177', dob: '' },
  ];
}

/**
 * The resolved recipient for a Send To type: the patient themself, or the
 * patient's contact of that type (null when none is recorded).
 */
export function contactFor(type, patient, contacts = []) {
  if (type === 'Patient') return patient ? { name: patient.name, email: patient.email, phone: patient.phone, dob: patient.dob } : null;
  return contacts.find(c => c.type === type) || null;
}

/**
 * The patient banner's second line from what's on record: "F • 61Y • 19306"
 * (gender, age, member ID). Age is the record's own when it has one, else
 * worked out from the date of birth.
 */
export function personMeta({ gender, dob, age, memberId, email } = {}) {
  const d = dob ? new Date(`${String(dob).slice(0, 10)}T00:00:00`) : null;
  const valid = d && !Number.isNaN(d.getTime());
  const years = valid ? Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000)) : null;
  const ageText = age != null && age !== '' ? (/^\d+$/.test(String(age)) ? `${age}Y` : String(age)) : years != null ? `${years}Y` : '';
  const g = String(gender || '').trim();
  const parts = [g ? g[0].toUpperCase() : '', ageText, memberId || ''].filter(Boolean);
  return parts.length ? parts.join(' • ') : (email || '');
}

export const contactToRow = (c) => ({
  id: c.id,
  patient_id: c.patientId,
  type: c.type,
  name: c.name,
  gender: c.gender || null,
  email: c.email || null,
  phone: c.phone || null,
  dob: c.dob || null,
});

export const rowToContact = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  type: r.type,
  name: r.name,
  gender: r.gender || '',
  email: r.email || '',
  phone: r.phone || '',
  dob: r.dob || '',
});

// A message goes to the Decision Maker or the Alternate, never both.
const DECISION_MAKERS = ['Decision Maker', 'Alternate Decision Maker'];

/**
 * Send To always lists both decision maker roles: one with no contact on
 * record is a placeholder row (`missing: true`) so it's clear there's none.
 */
export function withDecisionMakers(contacts = []) {
  const people = groupContacts(contacts);
  const absent = DECISION_MAKERS.filter(t => !people.some(p => rolesOf(p.type).includes(t)));
  return [...people, ...absent.map(type => ({ id: `missing-${type}`, type, name: type, missing: true }))];
}

const ROLE_SEP = ' · ';
/** A person's roles from their (possibly combined) type: "Care Giver · Decision Maker". */
export const rolesOf = (type) => String(type || '').split(ROLE_SEP).filter(Boolean);

/**
 * One entry per person: someone recorded under several roles (Care Giver,
 * Emergency Contact, Decision Maker…) is one row whose `type` lists them all,
 * in the order recorded. A patient has at most one holder per role, so a
 * role already taken by an earlier record is ignored.
 */
export function groupContacts(contacts = []) {
  const key = (c) => [c.name, c.email, c.phone].map(v => String(v || '').trim().toLowerCase()).join('|');
  const byPerson = new Map();
  const taken = new Set();
  for (const c of contacts) {
    if (taken.has(c.type)) continue;
    taken.add(c.type);
    const k = key(c);
    const p = byPerson.get(k);
    if (!p) byPerson.set(k, { ...c, ids: [c.id] });
    else {
      p.ids.push(c.id);
      if (!rolesOf(p.type).includes(c.type)) p.type = `${p.type}${ROLE_SEP}${c.type}`;
    }
  }
  return [...byPerson.values()];
}

/**
 * Apply a Send To change so at most one decision maker stays picked: the one
 * just picked replaces the other. `typeOf(value)` gives a row's type.
 */
export function pickOneDecisionMaker(next, prev, typeOf) {
  // Which decision-maker role a person holds (a person can hold other roles too).
  const dmRole = (v) => DECISION_MAKERS.find(t => rolesOf(typeOf(v)).includes(t));
  const added = next.find(v => !prev.includes(v) && dmRole(v));
  if (!added) return next;
  // Whoever holds the other decision-maker role is unpicked.
  const role = dmRole(added);
  return next.filter(v => v === added || !dmRole(v) || dmRole(v) === role);
}

const hasNonPatient = (picked) => picked.some(v => v !== 'patient');

/**
 * Verify identity follows who's in Send To: on when someone other than the
 * patient joins, off when only the patient is left. Returns the new on/off,
 * or null when that didn't change (so a manual tick or untick stays).
 */
export function verifyForSendTo(next, prev) {
  const now = hasNonPatient(next);
  return now === hasNonPatient(prev) ? null : now;
}

// Send To, the same in every drawer: who it reaches and the placeholder.
// Chips show just the name; the role is in the list and the chip's hover card.
export const SEND_TO_INFO = 'You can select the member and their contacts (caregiver, decision maker etc.) here.';
export const SEND_TO_PLACEHOLDER = 'Select member and their contacts';
export const sendToChipLabel = (name) => name;
