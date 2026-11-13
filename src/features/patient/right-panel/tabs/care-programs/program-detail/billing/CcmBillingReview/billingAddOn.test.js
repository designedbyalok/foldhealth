import { describe, expect, it } from 'vitest';
import { addOnNote } from './billingAddOn';

describe('addOnNote', () => {
  it('states the 99439 rule, and counts full 20-minute blocks up to two', () => {
    expect(addOnNote('moderate', 5 * 60)).toBe('Each additional 20 minutes adds 99439, up to two a month.');
    expect(addOnNote('moderate', 41 * 60)).toBe('Each additional 20 minutes adds 99439, up to two a month. 99439 × 2 so far this month.');
    expect(addOnNote('moderate', 75 * 60)).toContain('99439 × 2');
  });

  it('uses 99489 in 30-minute blocks for complex CCM', () => {
    expect(addOnNote('high', 31 * 60)).toBe('Each additional 30 minutes adds 99489. 99489 × 1 so far this month.');
  });
});
