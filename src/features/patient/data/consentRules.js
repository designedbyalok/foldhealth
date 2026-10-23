import { isProgramClosed } from './programStatus';
import { nextEnrollment } from './programLifecycle';

// Patient consent and contact rules (Phase 2A). Pure: callers pass the
// patient's consent history (patient_consents rows, mapped) and preferences.
// A scope's current state is its newest record; nothing is ever edited in
// place, so a withdrawal is just a newer row.

// Billable programs that need documented patient consent before any time or
// claim is recorded for them. Every other program bills without a check.
export const CONSENT_PROGRAMS = [
  { scope: 'CCM', label: 'Chronic Care Management' },
  { scope: 'APCM', label: 'Advanced Primary Care Management' },
  { scope: 'RPM', label: 'Remote Patient Monitoring' },
  { scope: 'BHI', label: 'Behavioral Health Integration' },
];

// TCPA covers autodialed or prerecorded calls and texts, so it needs a
// written or e-signed record; verbal is not enough.
export const CONSENT_CHANNELS = [
  { scope: 'call', label: 'Phone calls', methods: ['verbal', 'written', 'e_sign'] },
  { scope: 'sms', label: 'Text messages', methods: ['verbal', 'written', 'e_sign'] },
  { scope: 'email', label: 'Email', methods: ['verbal', 'written', 'e_sign'] },
  { scope: 'tcpa', label: 'Autodialed calls and texts (TCPA)', methods: ['written', 'e_sign'] },
];

export const CONSENT_METHODS = [
  { value: 'verbal', label: 'Verbal' },
  { value: 'written', label: 'Written' },
  { value: 'e_sign', label: 'E-signature' },
];

const PROGRAM_SCOPES = new Set(CONSENT_PROGRAMS.map(p => p.scope));
const CHANNEL_SCOPES = new Set(CONSENT_CHANNELS.map(c => c.scope));

export const requiresConsent = (programCode) => PROGRAM_SCOPES.has(programCode);

/** Allowed capture methods for a scope (programs accept any). */
export function methodsFor(scopeType, scope) {
  if (scopeType === 'channel') return CONSENT_CHANNELS.find(c => c.scope === scope)?.methods || [];
  return CONSENT_METHODS.map(m => m.value);
}

/** Problem with a capture before it's saved, or null when it's valid. */
export function validateCapture(c) {
  const known = c?.scopeType === 'program' ? PROGRAM_SCOPES : c?.scopeType === 'channel' ? CHANNEL_SCOPES : null;
  if (!known || !known.has(c.scope)) return 'Unknown consent scope';
  if (!['given', 'declined', 'withdrawn'].includes(c.status)) return 'Unknown consent status';
  if (c.status !== 'given') return null;
  if (!methodsFor(c.scopeType, c.scope).includes(c.method)) return 'This consent needs a written or e-signed record';
  if (c.method === 'verbal' && !c.witness?.trim()) return 'Verbal consent needs a witness';
  if (c.method !== 'verbal' && !c.artifactPath) return 'Attach the signature or signed document';
  return null;
}

const ymd = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** The scope's newest record, or null. */
export function latestConsent(consents, scopeType, scope) {
  let best = null;
  for (const c of consents || []) {
    if (c.scopeType !== scopeType || c.scope !== scope) continue;
    if (!best || String(c.capturedAt) > String(best.capturedAt)) best = c;
  }
  return best;
}

/**
 * Current state of one scope: 'given' | 'declined' | 'withdrawn' |
 * 'expired' | 'missing', with the record it came from.
 */
export function consentState(consents, scopeType, scope, today = new Date()) {
  const record = latestConsent(consents, scopeType, scope);
  if (!record) return { state: 'missing', record: null };
  if (record.status === 'given' && record.expiresOn && record.expiresOn < ymd(today)) return { state: 'expired', record };
  return { state: record.status, record };
}

const BLOCK_REASON = {
  missing: 'No consent on file',
  declined: 'Patient declined consent',
  withdrawn: 'Patient withdrew consent',
  expired: 'Consent expired',
};

/** Whether billable work for `programCode` may be recorded. Hard block. */
export function canBill(consents, programCode, today = new Date()) {
  if (!requiresConsent(programCode)) return { allowed: true, state: 'not_required', reason: null };
  const { state } = consentState(consents, 'program', programCode, today);
  return state === 'given'
    ? { allowed: true, state, reason: null }
    : { allowed: false, state, reason: `${BLOCK_REASON[state]} for ${programCode}` };
}

/** The contact point record for a phone number or email, matched loosely. */
export function contactPoint(preferences, value) {
  const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9@.]/g, '');
  const key = norm(value);
  if (!key) return null;
  return (preferences?.contactPoints || []).find(p => norm(p.value) === key) || null;
}

/**
 * Whether the patient may be contacted on `channel` at `value`. A declined
 * or withdrawn channel blocks it, an invalid contact point blocks it, and
 * texts and autodialed calls (`automated`) also need TCPA consent.
 * A channel with no record allows manual contact (treatment communication).
 */
export function canContact(consents, preferences, channel, { value, automated = false, today = new Date() } = {}) {
  const { state } = consentState(consents, 'channel', channel, today);
  const channelName = CONSENT_CHANNELS.find(c => c.scope === channel)?.label.toLowerCase() || channel;
  if (state === 'declined' || state === 'withdrawn') return { allowed: false, reason: `${BLOCK_REASON[state]} for ${channelName}` };
  const point = value ? contactPoint(preferences, value) : null;
  if (point?.status === 'invalid') return { allowed: false, reason: `${value} is marked invalid` };
  if (channel === 'sms' || automated) {
    const tcpa = consentState(consents, 'channel', 'tcpa', today).state;
    if (tcpa !== 'given') return { allowed: false, reason: `${BLOCK_REASON[tcpa]} for TCPA` };
  }
  return { allowed: true, reason: null };
}

/** Program consents the patient needs now: one per open billable enrollment. */
export function requiredConsentScopes(programs) {
  const codes = new Set();
  for (const p of programs || []) if (requiresConsent(p.code) && !isProgramClosed(p.status)) codes.add(p.code);
  return [...codes];
}

/** "2/3" for the banner: required program consents given vs required. */
export function consentSummary(consents, programs, today = new Date()) {
  const scopes = requiredConsentScopes(programs);
  const byScope = Object.fromEntries(scopes.map(s => [s, consentState(consents, 'program', s, today).state]));
  return { given: scopes.filter(s => byScope[s] === 'given').length, total: scopes.length, byScope };
}

// Minimum clinical criteria per program. CCM needs two or more chronic
// conditions (CMS); RPM needs at least one condition to monitor. Per-client
// tuning arrives with the Phase 3 rules engine.
const MIN_CONDITIONS = { CCM: 2, RPM: 1 };

/**
 * Pre-enrollment check: `eligible` with the reasons it isn't, and whether
 * consent has to be captured before enrolling. `existing` is the patient's
 * enrollments; `conditions` their chronic conditions, or null when unknown.
 * `subProgram` / `triggerable` pass through to nextEnrollment (CMP, SNP).
 */
export function enrollmentCheck(programCode, { existing = [], conditions = [], consents = [], subProgram = null, triggerable = false, today = new Date() } = {}) {
  const reasons = [];
  if (!nextEnrollment(existing, programCode, subProgram, { triggerable }).allowed) reasons.push(`Already enrolled in ${programCode}`);
  // null = conditions unknown (no profile row); don't block on what we can't see.
  const min = MIN_CONDITIONS[programCode] || 0;
  const count = (conditions || []).filter(Boolean).length;
  if (conditions != null && count < min) reasons.push(`${programCode} needs ${min} or more chronic conditions (has ${count})`);
  const needsConsent = requiresConsent(programCode) && consentState(consents, 'program', programCode, today).state !== 'given';
  return { eligible: reasons.length === 0, reasons, needsConsent };
}
