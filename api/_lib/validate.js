/**
 * Input checks shared by the routes that send mail or texts, so a signed-in
 * caller can't use them as an open relay or inject headers.
 */

/** At most this many recipients (to + cc + bcc) per send. */
export const MAX_RECIPIENTS = 50;

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export const isEmail = (v) => typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());

/** A string or array of addresses as a trimmed array ([] when absent). */
export function addressList(v) {
  if (v == null || v === '') return [];
  const list = Array.isArray(v) ? v : String(v).split(/[\s,;]+/);
  return list.map(a => String(a).trim()).filter(Boolean);
}

/** Text safe inside a mail header (display names, subjects): no CR/LF or angle brackets. */
export const headerText = (v, max = 200) => String(v ?? '').replace(/[\r\n<>"]/g, ' ').trim().slice(0, max);

/** An https URL with nothing that could break out of a `<...>` header value. */
export function isSafeHttpsUrl(v) {
  if (typeof v !== 'string' || /[\r\n<>\s]/.test(v)) return false;
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
}

/** E.164 phone number: + and 8–15 digits. */
export const isE164 = (v) => typeof v === 'string' && /^\+[1-9]\d{7,14}$/.test(v);
