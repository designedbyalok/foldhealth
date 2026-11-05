import { describe, expect, it } from 'vitest';
import { recordDate } from './recordFormat';

describe('recordDate', () => {
  it('formats US and ISO dates without shifting the day', () => {
    expect(recordDate('9/21/2026')).toBe('Sep 21, 2026');
    expect(recordDate('06/27/2020')).toBe('Jun 27, 2020');
    expect(recordDate('2026-10-07')).toBe('Oct 7, 2026');
  });

  it('keeps a bare year or anything else as given', () => {
    expect(recordDate('2019')).toBe('2019');
    expect(recordDate('childhood')).toBe('childhood');
    expect(recordDate(null)).toBe('');
  });
});
