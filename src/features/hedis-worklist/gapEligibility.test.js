import { describe, expect, it } from 'vitest';
import { ageAtYearEnd, notApplicableReason } from './gapEligibility';

const BCS = { code: 'BCS', sex: 'F', ageMin: 40, ageMax: 74 };
const COL = { code: 'COL', ageMin: 45, ageMax: 75 };

describe('gap eligibility', () => {
  it('reads age at the end of the measure year from DOB', () => {
    expect(ageAtYearEnd({ dob: '06/23/1949' }, 2026)).toBe(77);
  });
  it('hides a measure for the wrong sex or age', () => {
    expect(notApplicableReason(BCS, { gender: 'M', dob: '01/01/1960' }, 2026)).toBe('female patients, ages 40–74');
    expect(notApplicableReason(BCS, { gender: 'F', dob: '01/01/1940' }, 2026)).toBe('female patients, ages 40–74');
    expect(notApplicableReason(COL, { gender: 'M', dob: '01/01/1990' }, 2026)).toBe('ages 45–75');
  });
  it('keeps a measure that applies, or when sex and age are unknown', () => {
    expect(notApplicableReason(BCS, { gender: 'F', dob: '01/01/1960' }, 2026)).toBe(null);
    expect(notApplicableReason(BCS, {}, 2026)).toBe(null);
  });
});
