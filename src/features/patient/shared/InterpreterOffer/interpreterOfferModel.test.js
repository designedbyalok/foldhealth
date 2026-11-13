import { describe, expect, it } from 'vitest';
import { interpreterStatus, offerRecord } from './interpreterOfferModel';

describe('interpreterStatus', () => {
  it('is nothing when the patient needs no interpreter', () => {
    expect(interpreterStatus({ needsInterpreter: false, preferredLanguage: 'Spanish' })).toBeNull();
    expect(interpreterStatus(null)).toBeNull();
  });

  it('warns until the offer is recorded', () => {
    expect(interpreterStatus({ needsInterpreter: true, preferredLanguage: 'Spanish', interpreterOffer: null }))
      .toMatchObject({ tone: 'warning', short: 'Spanish · Interpreter not offered' });
  });

  it('names the qualified interpreter or the family member the patient chose', () => {
    expect(interpreterStatus({ needsInterpreter: true, preferredLanguage: 'Spanish', interpreterOffer: { status: 'qualified' } }).tone).toBe('success');
    const declined = interpreterStatus({ needsInterpreter: true, preferredLanguage: 'Spanish', interpreterOffer: { status: 'declined', name: 'Lucia', relationship: 'Daughter' } });
    expect(declined).toMatchObject({ tone: 'neutral', short: "Spanish · Lucia at patient's request" });
    expect(declined.label).toContain('Lucia (daughter)');
  });
});

describe('offerRecord', () => {
  it('keeps the family member only when the patient declined', () => {
    const now = new Date('2026-11-13T10:00:00Z');
    expect(offerRecord({ status: 'qualified', language: 'Spanish', name: 'Lucia', recordedBy: 'Fold Demo', now }))
      .toEqual({ status: 'qualified', language: 'Spanish', recordedBy: 'Fold Demo', recordedAt: '2026-11-13T10:00:00.000Z' });
    expect(offerRecord({ status: 'declined', language: 'Spanish', name: ' Lucia ', relationship: 'Daughter', recordedBy: 'Fold Demo', now }))
      .toMatchObject({ name: 'Lucia', relationship: 'Daughter' });
  });
});
