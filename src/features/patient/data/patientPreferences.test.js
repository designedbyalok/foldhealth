import { describe, expect, it } from 'vitest';
import { mergeContactPoints, numberFromRecipient } from './patientPreferences';

describe('mergeContactPoints', () => {
  it('keeps saved statuses and adds unchecked profile contacts as unverified', () => {
    const saved = [{ kind: 'phone', value: '(279) 878-3271', status: 'invalid', checked_at: '2026-10-01' }];
    const profile = {
      emails: ['annette88@fold.health'],
      plan_numbers_primary: ['279-878-3271'],
      extra_phones: [{ number: '(279) 878-9999', hours: 'Mon-Fri' }],
    };
    expect(mergeContactPoints(saved, profile)).toEqual([
      saved[0],
      { kind: 'email', value: 'annette88@fold.health', status: 'unverified' },
      { kind: 'phone', value: '(279) 878-9999', status: 'unverified' },
    ]);
  });

  it('handles a missing profile and empty values', () => {
    expect(mergeContactPoints(null, { emails: ['', null] })).toEqual([]);
  });
});

describe('numberFromRecipient', () => {
  it('pulls the number out of a recipient label', () => {
    expect(numberFromRecipient('Dr. Katherine Moss (581 824-1591)')).toBe('581 824-1591');
    expect(numberFromRecipient('Patient (Caregiver)')).toBe('Patient (Caregiver)');
    expect(numberFromRecipient('(555) 000-0000')).toBe('(555) 000-0000');
  });
});
