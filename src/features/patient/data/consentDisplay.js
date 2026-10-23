import { CONSENT_CHANNELS, CONSENT_METHODS, CONSENT_PROGRAMS, consentState, requiredConsentScopes } from './consentRules';

// Labels and Badge tones for consent states, shared by the consent popover,
// the Overview Consent card and the Capture Consent drawer.

// Popover rows use the QuickView consent design: a solid check, green when
// given and grey otherwise.
const STATE = {
  given: { label: 'Consent Given', tone: 'success', icon: 'solar:check-circle-bold', color: 'var(--status-success)' },
  declined: { label: 'Consent Declined', tone: 'grey', icon: 'solar:check-circle-bold', color: 'var(--neutral-200)' },
  withdrawn: { label: 'Consent Withdrawn', tone: 'error', icon: 'solar:check-circle-bold', color: 'var(--neutral-200)' },
  expired: { label: 'Consent Expired', tone: 'warning', icon: 'solar:check-circle-bold', color: 'var(--neutral-200)' },
  missing: { label: 'Consent Not Given', tone: 'warning', icon: 'solar:check-circle-bold', color: 'var(--neutral-200)' },
};

export const consentStateLabel = (state) => STATE[state]?.label || STATE.missing.label;
export const consentStateStyle = (state) => STATE[state] || STATE.missing;

const mdy = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

// "09/11/2024 9:30 AM", as the QuickView consent rows show it.
const mdyTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  return `${mdy(value)} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// A date-only 'YYYY-MM-DD' parsed as local time, not UTC midnight.
const mdyDay = (ymd) => (ymd ? mdy(`${ymd}T00:00:00`) : '');

/** "Verbal · 01/10/2026 · Dana Lee", plus the expiry when it has one. */
export function formatConsentMeta(record) {
  if (!record) return '';
  const method = CONSENT_METHODS.find(m => m.value === record.method)?.label;
  const parts = [method, mdy(record.capturedAt), record.capturedBy];
  if (record.expiresOn) parts.push(`expires ${mdyDay(record.expiresOn)}`);
  return parts.filter(Boolean).join(' · ');
}

const CHANNEL_NAME = { call: 'Call', sms: 'SMS', email: 'Email', tcpa: 'TCPA' };
const scopeLabel = (scopeType, scope) => `${scopeType === 'program' ? scope : CHANNEL_NAME[scope] || scope} Consent`;

/**
 * Popover sections: program consents (the ones the patient's open
 * enrollments require first, marked "Required") then channel consents.
 */
export function consentSections(consents, programs, today = new Date()) {
  const required = new Set(requiredConsentScopes(programs));
  const row = (scopeType, scope) => {
    const { state, record } = consentState(consents, scopeType, scope, today);
    const style = consentStateStyle(state);
    const parts = [style.label, record && mdyTime(record.capturedAt), required.has(scope) && state !== 'given' && 'Required'];
    return {
      id: `${scopeType}:${scope}`,
      scopeType,
      scope,
      state,
      label: scopeLabel(scopeType, scope),
      status: parts.filter(Boolean).join(' • '),
      icon: style.icon,
      color: style.color,
    };
  };
  const programRows = CONSENT_PROGRAMS
    .map(p => row('program', p.scope))
    .sort((a, b) => Number(required.has(b.scope)) - Number(required.has(a.scope)));
  return [
    { id: 'program', title: 'Program Consent', items: programRows },
    { id: 'channel', title: 'Communication Consent', items: CONSENT_CHANNELS.map(c => row('channel', c.scope)) },
  ];
}

/** Every record, newest first, for the audit view. */
export function consentHistory(consents) {
  return [...(consents || [])]
    .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)))
    .map(c => ({
      id: c.id,
      label: scopeLabel(c.scopeType, c.scope),
      status: consentStateLabel(c.status),
      meta: [formatConsentMeta(c), c.witness && `witness ${c.witness}`, c.note].filter(Boolean).join(' · '),
    }));
}
