import { describe, it, expect } from 'vitest';
import { memberMatchesFilters } from './hedisFilters';

const yearsAgo = (y, extraDays = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  d.setDate(d.getDate() + extraDays);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};
const matches = (member, groups) => memberMatchesFilters(member, { age: groups });

const monthsAgo = (n, extraDays = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(d.getDate() + extraDays);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

describe('Age filter', () => {
  it('month bands for the first two years', () => {
    expect(matches({ dob: monthsAgo(1) }, ['0–2 months'])).toBe(true);
    expect(matches({ dob: monthsAgo(2) }, ['0–2 months'])).toBe(false);
    expect(matches({ dob: monthsAgo(2) }, ['2–6 months'])).toBe(true);
    expect(matches({ dob: monthsAgo(6) }, ['6–18 months'])).toBe(true);
    expect(matches({ dob: monthsAgo(17) }, ['6–18 months'])).toBe(true);
    expect(matches({ dob: monthsAgo(18) }, ['18–24 months'])).toBe(true);
    expect(matches({ dob: monthsAgo(6, 3) }, ['2–6 months'])).toBe(true); // 6-month day not reached yet
    expect(matches({ dob: monthsAgo(23) }, ['Under 2'])).toBe(true);
  });

  it('month text falls into the month bands', () => {
    expect(matches({ age: '5m' }, ['2–6 months'])).toBe(true);
    expect(matches({ age: '1m' }, ['0–2 months'])).toBe(true);
    expect(matches({ age: '1y 7m' }, ['18–24 months'])).toBe(true);
  });

  it('buckets by whole years from DOB', () => {
    expect(matches({ dob: yearsAgo(1) }, ['Under 2'])).toBe(true);
    expect(matches({ dob: yearsAgo(2) }, ['Under 2'])).toBe(false);
    expect(matches({ dob: yearsAgo(2) }, ['2–17'])).toBe(true);
    expect(matches({ dob: yearsAgo(65) }, ['65–74'])).toBe(true);
    expect(matches({ dob: yearsAgo(80) }, ['75+'])).toBe(true);
  });

  it('a birthday later this year has not happened yet', () => {
    expect(matches({ dob: yearsAgo(18, 5) }, ['2–17'])).toBe(true);
  });

  it('falls back to the age text when there is no DOB', () => {
    expect(matches({ age: '22m' }, ['Under 2'])).toBe(true);
    expect(matches({ age: '67y 2m' }, ['65–74'])).toBe(true);
    expect(matches({ age: '63y' }, ['45–64', '65–74'])).toBe(true);
    expect(matches({}, ['75+'])).toBe(false);
  });
});

describe('Source and Instance filters', () => {
  const m = { gaps: [
    { code: 'BCS', status: 'Open', source: 'fold-native' },
    { code: 'CBP', status: 'Completed', supersededAt: '10/31/2026' },
  ] };
  it('matches a member when any gap has the picked source or instance', () => {
    expect(memberMatchesFilters(m, { gapSource: ['Manual'] })).toBe(true);
    expect(memberMatchesFilters({ gaps: [m.gaps[1]] }, { gapSource: ['Manual'] })).toBe(false);
    expect(memberMatchesFilters(m, { gapInstance: ['Previous'] })).toBe(true);
    expect(memberMatchesFilters({ gaps: [m.gaps[0]] }, { gapInstance: ['Previous'] })).toBe(false);
  });
});
