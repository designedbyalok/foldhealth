// Patient contact preferences (Phase 2A.4): option lists and the contact
// points shown for validation. Pure; the drawer, the Profile tab and
// Outreach share it.

export const CHANNEL_OPTIONS = [
  { value: 'call', label: 'Phone call' },
  { value: 'sms', label: 'Text message' },
  { value: 'email', label: 'Email' },
  { value: 'letter', label: 'Letter' },
];

export const LITERACY_OPTIONS = [
  { value: 'adequate', label: 'Adequate' },
  { value: 'limited', label: 'Limited', hint: 'Use plain language and teach-back.' },
  { value: 'unknown', label: 'Not assessed' },
];

export const CONTACT_STATUS_OPTIONS = [
  { value: 'valid', label: 'Valid' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'unverified', label: 'Unverified' },
];

export const CONTACT_STATUS_TONE = { valid: 'success', invalid: 'error', unverified: 'grey' };

export const optionLabel = (options, value) => options.find(o => o.value === value)?.label || '';

// Outreach log type → consent channel.
export const OUTREACH_CHANNEL = { Call: 'call', SMS: 'sms', Email: 'email' };

const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9@.]/g, '');

/**
 * Saved contact points first, then any phone or email on the profile that
 * hasn't been checked yet, as 'unverified'. Deduped loosely ("(279) 878-3271"
 * and "279-878-3271" are one number).
 */
export function mergeContactPoints(saved, profile) {
  const out = [...(saved || [])];
  const seen = new Set(out.map(p => norm(p.value)));
  const add = (kind, value) => {
    const key = norm(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ kind, value, status: 'unverified' });
  };
  for (const e of profile?.emails || []) add('email', e);
  for (const n of profile?.plan_numbers_primary || []) add('phone', n);
  for (const x of profile?.extra_phones || []) add('phone', typeof x === 'string' ? x : x?.number);
  return out;
}

/** The phone number inside "Dr. Katherine Moss (581 824-1591)", or the text itself. */
export function numberFromRecipient(text) {
  const str = String(text || '');
  // A full number in parentheses (7+ digits), not an area code like "(555)".
  const m = [...str.matchAll(/\(([^)]*)\)/g)].find(x => x[1].replace(/\D/g, '').length >= 7);
  return m ? m[1] : str;
}
