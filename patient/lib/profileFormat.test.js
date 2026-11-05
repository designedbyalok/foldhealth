import { describe, expect, it } from 'vitest';
import { ageFrom, firstName, initialsOf, parseDob, sexAndAge, shortName } from './profileFormat';

const TODAY = new Date(2026, 9, 28);

describe('parseDob', () => {
  it('reads MM/DD/YYYY and ISO as local dates', () => {
    expect(parseDob('01/22/1953')).toEqual(new Date(1953, 0, 22));
    expect(parseDob('2016-06-27')).toEqual(new Date(2016, 5, 27));
  });

  it('returns null for anything else', () => {
    expect(parseDob('')).toBeNull();
    expect(parseDob('soon')).toBeNull();
  });
});

describe('ageFrom', () => {
  it('counts whole years, before and after the birthday', () => {
    expect(ageFrom('10/28/2000', TODAY)).toBe(26);
    expect(ageFrom('10/29/2000', TODAY)).toBe(25);
  });

  it('is null without a usable dob', () => {
    expect(ageFrom(null, TODAY)).toBeNull();
  });
});

describe('sexAndAge', () => {
  it('joins what is known', () => {
    expect(sexAndAge({ gender: 'M', dob: '01/22/1953' }, TODAY)).toBe('Male • 73 years');
    expect(sexAndAge({ gender: 'F' }, TODAY)).toBe('Female');
    expect(sexAndAge({ dob: '10/01/2025' }, TODAY)).toBe('1 year');
  });
});

describe('names', () => {
  it('derives first name and initials', () => {
    expect(firstName({ name: 'Andrew Lewis' })).toBe('Andrew');
    expect(initialsOf({ name: 'andrew evans' })).toBe('AE');
    expect(initialsOf({ name: 'Andrew Evans', initials: 'AX' })).toBe('AX');
  });

  it('uses the full name only when first names clash', () => {
    const lewis = { member_id: '1', name: 'Andrew Lewis' };
    const evans = { member_id: '2', name: 'Andrew Evans' };
    const leo = { member_id: '3', name: 'Leo Jones' };
    expect(shortName(lewis, [lewis, evans, leo])).toBe('Andrew Lewis');
    expect(shortName(leo, [lewis, evans, leo])).toBe('Leo');
    expect(shortName(lewis, [lewis])).toBe('Andrew');
  });
});
