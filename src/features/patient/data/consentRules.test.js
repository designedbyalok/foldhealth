import { describe, expect, it } from 'vitest';
import {
  canBill, canContact, consentState, consentSummary, enrollmentCheck, methodsFor, requiredConsentScopes, validateCapture,
} from './consentRules';

const today = new Date(2026, 9, 23);
const rec = (scopeType, scope, status, capturedAt, extra = {}) => ({ id: `${scope}-${capturedAt}`, scopeType, scope, status, capturedAt, method: status === 'given' ? 'verbal' : null, ...extra });

describe('consentState', () => {
  it('reads the newest record for a scope', () => {
    const history = [
      rec('program', 'CCM', 'given', '2026-01-10T10:00:00Z'),
      rec('program', 'CCM', 'withdrawn', '2026-06-01T10:00:00Z'),
      rec('program', 'APCM', 'given', '2026-07-01T10:00:00Z'),
    ];
    expect(consentState(history, 'program', 'CCM', today).state).toBe('withdrawn');
    expect(consentState(history, 'program', 'APCM', today).state).toBe('given');
    expect(consentState(history, 'program', 'RPM', today)).toEqual({ state: 'missing', record: null });
  });

  it('treats a given consent past its expiry as expired, and the expiry day itself as valid', () => {
    const lapsed = [rec('program', 'BHI', 'given', '2025-01-01T00:00:00Z', { expiresOn: '2026-10-22' })];
    const lastDay = [rec('program', 'BHI', 'given', '2025-01-01T00:00:00Z', { expiresOn: '2026-10-23' })];
    expect(consentState(lapsed, 'program', 'BHI', today).state).toBe('expired');
    expect(consentState(lastDay, 'program', 'BHI', today).state).toBe('given');
  });
});

describe('canBill', () => {
  it('hard-blocks consent programs without a current given consent', () => {
    expect(canBill([], 'CCM', today)).toEqual({ allowed: false, state: 'missing', reason: 'No consent on file for CCM' });
    const given = [rec('program', 'CCM', 'given', '2026-02-01T00:00:00Z')];
    expect(canBill(given, 'CCM', today)).toMatchObject({ allowed: true, state: 'given' });
    const declined = [rec('program', 'RPM', 'declined', '2026-02-01T00:00:00Z')];
    expect(canBill(declined, 'RPM', today).reason).toBe('Patient declined consent for RPM');
  });

  it('lets programs that need no consent through', () => {
    expect(canBill([], 'AWV', today)).toMatchObject({ allowed: true, state: 'not_required' });
  });

  it('does not let a channel consent stand in for a program consent', () => {
    expect(canBill([rec('channel', 'call', 'given', '2026-02-01T00:00:00Z')], 'CCM', today).allowed).toBe(false);
  });
});

describe('canContact', () => {
  const prefs = { contactPoints: [{ kind: 'phone', value: '(279) 878-3271', status: 'invalid' }, { kind: 'phone', value: '(279) 878-3272', status: 'valid' }] };

  it('allows manual calls with no channel record but blocks a withdrawn channel', () => {
    expect(canContact([], prefs, 'call', { value: '(279) 878-3272', today }).allowed).toBe(true);
    const withdrawn = [rec('channel', 'call', 'withdrawn', '2026-03-01T00:00:00Z')];
    expect(canContact(withdrawn, prefs, 'call', { today })).toEqual({ allowed: false, reason: 'Patient withdrew consent for phone calls' });
  });

  it('blocks an invalid number regardless of punctuation', () => {
    expect(canContact([], prefs, 'call', { value: '279-878-3271', today })).toEqual({ allowed: false, reason: '279-878-3271 is marked invalid' });
  });

  it('needs TCPA consent for texts and autodialed calls', () => {
    expect(canContact([], prefs, 'sms', { today }).reason).toBe('No consent on file for TCPA');
    expect(canContact([], prefs, 'call', { automated: true, today }).allowed).toBe(false);
    const tcpa = [rec('channel', 'tcpa', 'given', '2026-03-01T00:00:00Z', { method: 'e_sign' })];
    expect(canContact(tcpa, prefs, 'sms', { today }).allowed).toBe(true);
  });
});

describe('validateCapture', () => {
  it('needs a witness for verbal and an artifact for written or e-signed consent', () => {
    expect(validateCapture({ scopeType: 'program', scope: 'CCM', status: 'given', method: 'verbal' })).toBe('Verbal consent needs a witness');
    expect(validateCapture({ scopeType: 'program', scope: 'CCM', status: 'given', method: 'verbal', witness: 'Dana Lee' })).toBeNull();
    expect(validateCapture({ scopeType: 'program', scope: 'CCM', status: 'given', method: 'e_sign' })).toBe('Attach the signature or signed document');
    expect(validateCapture({ scopeType: 'program', scope: 'CCM', status: 'given', method: 'e_sign', artifactPath: 'p1/x.png' })).toBeNull();
  });

  it('rejects verbal TCPA consent and unknown scopes; declines need no method', () => {
    expect(methodsFor('channel', 'tcpa')).toEqual(['written', 'e_sign']);
    expect(validateCapture({ scopeType: 'channel', scope: 'tcpa', status: 'given', method: 'verbal', witness: 'Dana Lee' })).toBe('This consent needs a written or e-signed record');
    expect(validateCapture({ scopeType: 'program', scope: 'AWV', status: 'given', method: 'verbal' })).toBe('Unknown consent scope');
    expect(validateCapture({ scopeType: 'channel', scope: 'sms', status: 'declined' })).toBeNull();
  });
});

describe('consent summary', () => {
  const programs = [
    { code: 'CCM', status: 'Active' },
    { code: 'APCM', status: 'Enrolled' },
    { code: 'RPM', status: 'Completed' },
    { code: 'AWV', status: 'Active' },
  ];

  it('counts only open billable enrollments', () => {
    expect(requiredConsentScopes(programs)).toEqual(['CCM', 'APCM']);
    const history = [rec('program', 'CCM', 'given', '2026-02-01T00:00:00Z')];
    expect(consentSummary(history, programs, today)).toEqual({ given: 1, total: 2, byScope: { CCM: 'given', APCM: 'missing' } });
  });
});

describe('enrollmentCheck', () => {
  it('requires two chronic conditions for CCM and flags missing consent', () => {
    expect(enrollmentCheck('CCM', { conditions: ['Diabetes'], today })).toEqual({
      eligible: false, reasons: ['CCM needs 2 or more chronic conditions (has 1)'], needsConsent: true,
    });
    const consents = [rec('program', 'CCM', 'given', '2026-02-01T00:00:00Z')];
    expect(enrollmentCheck('CCM', { conditions: ['Diabetes', 'Hypertension'], consents, today })).toEqual({ eligible: true, reasons: [], needsConsent: false });
  });

  it('blocks a second open enrollment but allows re-enrolling after one ended', () => {
    const open = [{ code: 'RPM', status: 'Active' }];
    expect(enrollmentCheck('RPM', { existing: open, conditions: ['CHF'], today }).reasons).toEqual(['Already enrolled in RPM']);
    const ended = [{ code: 'RPM', status: 'Discontinued' }];
    expect(enrollmentCheck('RPM', { existing: ended, conditions: ['CHF'], today }).eligible).toBe(true);
  });

  it('lets SNP add a trigger and CMP add another sub-program', () => {
    expect(enrollmentCheck('SNP', { existing: [{ code: 'SNP', status: 'Engaged' }], triggerable: true, today }).eligible).toBe(true);
    expect(enrollmentCheck('CMP', { existing: [{ code: 'CMP', subProgram: 'SPD', status: 'Active' }], subProgram: 'Maternity Program', today }).eligible).toBe(true);
  });

  it('skips the condition minimum when conditions are unknown', () => {
    expect(enrollmentCheck('CCM', { conditions: null, today })).toEqual({ eligible: true, reasons: [], needsConsent: true });
  });

  it('needs no consent or conditions for programs outside the consent list', () => {
    expect(enrollmentCheck('AWV', { today })).toEqual({ eligible: true, reasons: [], needsConsent: false });
  });
});
