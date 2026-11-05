import { describe, it, expect } from 'vitest';
import { yearSpan, monthSpan, dobRangeSummary } from './yearSpan';

describe('monthSpan', () => {
  it('reads a 1st-to-last-day range as months', () => {
    expect(monthSpan(['1958-04-01', '1961-12-31'])).toEqual([[1958, 4], [1961, 12]]);
    expect(monthSpan(['1960-02-01', '1960-02-29'])).toEqual([[1960, 2], [1960, 2]]);
  });
  it('rejects ranges that do not start on the 1st or end on a month end', () => {
    expect(monthSpan(['1958-04-02', '1961-12-31'])).toBeNull();
    expect(monthSpan(['1958-04-01', '1961-12-30'])).toBeNull();
    expect(monthSpan(['1961-02-01', '1961-02-29'])).toBeNull();
  });
});

describe('dobRangeSummary', () => {
  it('labels years, months and custom dates', () => {
    expect(dobRangeSummary(['1950-01-01', '1960-12-31'])).toBe('1950 – 1960');
    expect(yearSpan(['1950-01-01', '1960-12-31'])).toEqual([1950, 1960]);
    expect(dobRangeSummary(['1958-04-01', '1961-12-31'])).toBe('Apr 1958 – Dec 1961');
    expect(dobRangeSummary(['1958-04-01', '1958-04-30'])).toBe('Apr 1958');
    expect(dobRangeSummary(['1957-01-10', '1957-02-20'])).toBe('01/10/1957 – 02/20/1957');
  });
});
