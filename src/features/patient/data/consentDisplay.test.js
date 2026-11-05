import { describe, expect, it } from 'vitest';
import { consentHistory, consentSections, consentStateLabel, consentStateStyle, consentTimelineEntries, formatConsentMeta } from './consentDisplay';

describe('consent display', () => {
  it('labels states and treats unknown ones as missing', () => {
    expect(consentStateLabel('withdrawn')).toBe('Consent Withdrawn');
    expect(consentStateLabel(undefined)).toBe('Consent Not Given');
    expect(consentStateStyle('given').tone).toBe('success');
  });

  it('summarizes method, local capture date, capturer and expiry', () => {
    const record = { method: 'e_sign', capturedAt: '2026-01-10T15:00:00', capturedBy: 'Dana Lee', expiresOn: '2027-01-10' };
    expect(formatConsentMeta(record)).toBe('E-signature · 01/10/2026 · Dana Lee · expires 01/10/2027');
    expect(formatConsentMeta({ capturedAt: '2026-03-02T09:00:00' })).toBe('03/02/2026');
    expect(formatConsentMeta(null)).toBe('');
  });
});

describe('consentSections', () => {
  const today = new Date(2026, 9, 23);
  const consents = [
    { id: 'a', scopeType: 'program', scope: 'APCM', status: 'given', method: 'verbal', capturedAt: '2026-02-01T10:00:00', capturedBy: 'Dana Lee' },
    { id: 'b', scopeType: 'channel', scope: 'sms', status: 'declined', capturedAt: '2026-03-01T10:00:00' },
  ];
  const programs = [{ code: 'CCM', status: 'Active' }, { code: 'APCM', status: 'Active' }];

  it('puts required program consents first and flags the missing ones', () => {
    const [program, channel] = consentSections(consents, programs, today);
    expect(program.items.map(i => i.scope)).toEqual(['CCM', 'APCM', 'RPM', 'BHI']);
    expect(program.items[0]).toMatchObject({ state: 'missing', status: 'Consent Not Given • Required' });
    expect(program.items[1]).toMatchObject({ state: 'given', status: 'Consent Given • 02/01/2026 10:00 AM' });
    expect(channel.items.find(i => i.scope === 'sms')).toMatchObject({ label: 'SMS Consent', state: 'declined', status: 'Consent Declined • 03/01/2026 10:00 AM' });
  });

  it('lists every record newest first for the audit log', () => {
    expect(consentHistory(consents).map(h => [h.label, h.status])).toEqual([['SMS Consent', 'Consent Declined'], ['APCM Consent', 'Consent Given']]);
  });
});

describe('consentTimelineEntries', () => {
  it('lists records newest first with outcome, tone, category and reason', () => {
    const entries = consentTimelineEntries([
      { id: 'a', scopeType: 'program', scope: 'CCM', status: 'given', capturedAt: '2026-01-10T09:05:00', capturedBy: 'Dana Lee' },
      { id: 'b', scopeType: 'program', scope: 'CCM', status: 'withdrawn', capturedAt: '2026-01-17T13:15:00', capturedBy: 'Dr. Aldo Richman', note: 'Not interested' },
      { id: 'c', scopeType: 'other', scope: 'data_sharing', status: 'declined', capturedAt: '2025-12-17T13:15:00' },
    ]);
    expect(entries.map(e => e.id)).toEqual(['b', 'a', 'c']);
    expect(entries[0]).toMatchObject({
      t: 'consent', when: '2026-01-17T13:15:00', actor: 'Dr. Aldo Richman',
      outcome: 'CCM Consent Withdrawn', tone: 'error', group: 'program', reason: 'Reason: Not interested',
    });
    expect(entries[0].searchText).toContain('01/17/2026');
    expect(entries[1]).toMatchObject({ outcome: 'CCM Consent Accepted', tone: 'success', reason: '' });
    expect(entries[2]).toMatchObject({ outcome: 'Data Sharing Consent Declined', group: 'other', actor: 'System' });
  });
});
