import { CONSENT_CHANNELS, CONSENT_METHODS, CONSENT_OTHER, CONSENT_PROGRAMS, consentState, requiredConsentScopes } from './consentRules';

// Labels and Badge tones for consent states, shared by the consent popover,
// the Overview Consent card and the Capture Consent drawer.

// Popover rows use the Patient Consent design (Figma 1:35178): a solid dot,
// a green check when given, a red cross when declined or withdrawn, and an
// amber "!" when there is no current consent.
const STATE = {
  given: { label: 'Consent Given', tone: 'success', icon: 'solar:check-circle-bold', color: 'var(--status-success)' },
  declined: { label: 'Consent Declined', tone: 'grey', icon: 'solar:close-circle-bold', color: 'var(--status-error)' },
  withdrawn: { label: 'Consent Withdrawn', tone: 'error', icon: 'solar:close-circle-bold', color: 'var(--status-error)' },
  expired: { label: 'Consent Expired', tone: 'warning', icon: 'solar:danger-circle-bold', color: 'var(--status-warning)' },
  missing: { label: 'Consent Not Given', tone: 'warning', icon: 'solar:danger-circle-bold', color: 'var(--status-warning)' },
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

// TCPA is no longer captured; the name stays so older records read right.
const SCOPE_NAME = { call: 'Call', sms: 'SMS', email: 'Email', tcpa: 'TCPA', data_sharing: 'Data Sharing' };
const scopeLabel = (scopeType, scope) => `${scopeType === 'program' ? scope : SCOPE_NAME[scope] || scope} Consent`;

/**
 * Popover sections: program consents (the ones the patient's open
 * enrollments require first, marked "Required"), channel consents, then
 * other consents.
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
    { id: 'other', title: 'Other Consents', items: CONSENT_OTHER.map(c => row('other', c.scope)) },
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

// Consent History drawer (Figma 1:34523): tabs by category, one rail icon each.
export const CONSENT_CATEGORIES = [
  { key: 'program', label: 'Program Consent', icon: 'solar:clipboard-heart-linear' },
  { key: 'channel', label: 'Communication Consent', icon: 'solar:phone-calling-rounded-linear' },
  { key: 'other', label: 'Others', icon: 'solar:database-linear' },
];

const OUTCOME = {
  given: { word: 'Accepted', tone: 'success' },
  declined: { word: 'Declined', tone: 'error' },
  withdrawn: { word: 'Withdrawn', tone: 'error' },
};

/**
 * Consent History entries for the shared ActivityLog, newest first: raw
 * `when` / `actor` for toActivityLogEntries to date, time and month-group,
 * the outcome ("CCM Consent Withdrawn") with its tone, the category for the
 * tabs, and the note as a reason (refusals) or a note (given).
 */
export function consentTimelineEntries(consents) {
  return [...(consents || [])]
    .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)))
    .map((c) => {
      const outcome = OUTCOME[c.status] || OUTCOME.given;
      const category = CONSENT_CATEGORIES.find(k => k.key === c.scopeType) || CONSENT_CATEGORIES[2];
      const note = c.note?.trim();
      const text = `${scopeLabel(c.scopeType, c.scope)} ${outcome.word}`;
      const reason = note ? `${c.status === 'given' ? 'Note' : 'Reason'}: ${note}` : '';
      return {
        id: c.id,
        t: 'consent',
        when: c.capturedAt,
        actor: c.capturedBy || 'System',
        icon: category.icon,
        avatarVariant: 'others',
        group: category.key,
        status: c.status,
        outcome: text,
        tone: outcome.tone,
        reason,
        searchText: [text, c.capturedBy, reason, mdy(c.capturedAt)].filter(Boolean).join(' ').toLowerCase(),
      };
    });
}
