import { describe, expect, it } from 'vitest';
import { holidaysAt, holidaysInYear, holidayYears, isPastHoliday, validateHoliday } from './holidayUtils';

const now = new Date(2026, 9, 1, 12, 0);
const h = (id, s, e, locations = ['Mary Health']) => ({ id, name: id, startAt: s.toISOString(), endAt: e.toISOString(), locations });

describe('holidays', () => {
  it('applies to the locations it lists', () => {
    const list = [h('a', new Date(2026, 9, 2), new Date(2026, 9, 3)), h('b', new Date(2026, 9, 2), new Date(2026, 9, 3), ['Rockwell Health'])];
    expect(holidaysAt(list, ['mary health', 'Palm Health Centre']).map(x => x.id)).toEqual(['a']);
    expect(holidaysAt(list, [])).toEqual([]);
  });
  it('knows past ones and the years they touch', () => {
    const past = h('p', new Date(2025, 11, 31), new Date(2026, 0, 1, 12));
    expect(isPastHoliday(past, now)).toBe(true);
    expect(holidayYears([past], now)).toEqual([2026, 2025]);
    expect(holidaysInYear([past], 2025).length).toBe(1);
  });
  it('needs a name, future dates in order, and a location', () => {
    const errs = validateHoliday({ name: ' ', startAt: new Date(2026, 8, 25).toISOString(), endAt: new Date(2026, 8, 26).toISOString(), locations: [] }, { now });
    expect(errs).toEqual({
      name: 'Enter a holiday name.',
      startAt: 'Please select a start date in future.',
      endAt: 'Please select an end date in future.',
      locations: 'Pick at least one location.',
    });
    expect(validateHoliday({ name: 'Diwali', startAt: new Date(2026, 9, 5).toISOString(), endAt: new Date(2026, 9, 4).toISOString(), locations: ['Mary Health'] }, { now }).endAt).toBe('End must be after the start.');
    expect(validateHoliday({ name: 'Diwali', startAt: new Date(2026, 9, 5).toISOString(), endAt: new Date(2026, 9, 6).toISOString(), locations: ['Mary Health'] }, { now })).toEqual({});
  });
});
