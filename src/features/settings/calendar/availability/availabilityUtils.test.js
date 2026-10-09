import { describe, it, expect } from 'vitest';
import { blockStatus, cadenceText, validateBlock, formatRange, ruleSummary, newBlock, findConflicts, conflictText, isBlankBlock, monthlyPreview, rowToBlock, cadenceSentence, sampleAvailability } from './availabilityUtils';

const base = { location: '6 Hills', timezone: 'Asia/Kolkata', repeat: 'weekly', days: [1, 2, 3, 4], weeks: [], startDate: '2026-10-08', endDate: '2027-04-06', slots: [{ appointmentType: 'All appointment types', start: '09:00', end: '18:00' }], skipHolidays: true };

describe('user availability', () => {
  it('derives status from the dates', () => {
    expect(blockStatus(base, '2026-11-01')).toBe('active');
    expect(blockStatus(base, '2026-10-01')).toBe('upcoming');
    expect(blockStatus(base, '2027-05-01')).toBe('expired');
  });

  it('describes the repeat pattern', () => {
    expect(cadenceText(base)).toBe('Weekly • Mon, Tue, Wed, Thu');
    expect(cadenceText({ ...base, days: [1, 2, 3, 4, 5] })).toBe('Weekly • Weekdays');
    expect(cadenceText({ ...base, repeat: 'monthly', weeks: [1, 3], days: [6] })).toBe('Monthly • 1st, 3rd Sat');
    expect(cadenceText({ ...base, interval: 2, days: [2, 4] })).toBe('Every 2 weeks • Tue, Thu');
    expect(cadenceText({ ...base, repeat: 'daily', interval: 1 })).toBe('Daily');
    expect(cadenceText({ ...base, repeat: 'daily', interval: 3 })).toBe('Every 3 days');
    expect(cadenceText({ ...base, repeat: 'monthly', interval: 2, weeks: [-1, 2], days: [5] })).toBe('Every 2 months • 2nd, Last Fri');
  });

  it('formats a date range as MM/DD/YYYY', () => {
    expect(formatRange('2026-10-08', '2027-04-06')).toBe('10/08/2026 – 04/06/2027');
    expect(formatRange('2026-10-01', '2026-10-31')).toBe('10/01/2026 – 10/31/2026');
  });

  it('flags bad blocks', () => {
    expect(validateBlock(base)).toEqual({});
    expect(validateBlock({ ...base, days: [] }).days).toBeTruthy();
    expect(validateBlock({ ...base, endDate: '2026-01-01' }).endDate).toBeTruthy();
    const overlap = validateBlock({ ...base, slots: [{ appointmentType: 'All appointment types', start: '09:00', end: '12:00' }, { appointmentType: 'All appointment types', start: '11:00', end: '13:00' }] });
    expect(overlap.slotErrors[1]).toMatch(/Overlaps/);
    expect(validateBlock({ ...base, slots: [{ appointmentType: 'All appointment types', start: '12:00', end: '09:00' }] }).slotErrors[0]).toMatch(/after/);
  });

  it('summarises a block in one line', () => {
    expect(ruleSummary(base)).toContain('6 Hills');
    expect(ruleSummary(base)).toContain('skips holidays');
    expect(newBlock().slots).toHaveLength(1);
    expect(newBlock().location).toBe('');
    expect(ruleSummary(newBlock())).toBe('');
    expect(validateBlock({ ...base, slots: [{ appointmentType: '', start: '09:00', end: '10:00' }] }).slotErrors[0]).toMatch(/appointment type/);
  });

  it('finds blocks that double-book the same hours', () => {
    const today = '2026-11-01';
    const other = { ...base, location: 'Mary Health', days: [2, 5], slots: [{ appointmentType: 'All appointment types', start: '08:00', end: '10:00' }] };
    const [mine, theirs] = findConflicts([base, other], today);
    expect(mine).toMatchObject([{ index: 1, days: [2], hours: [{ start: '09:00', end: '10:00' }] }]);
    expect(theirs[0].index).toBe(0);
    expect(conflictText(mine[0])).toBe('Tue • 9 AM – 10 AM');
    // Different hours, different days, or a clash that's already over: none.
    expect(findConflicts([base, { ...other, slots: [{ appointmentType: 'x', start: '18:00', end: '19:00' }] }], today)[0]).toEqual([]);
    expect(findConflicts([base, { ...other, days: [6] }], today)[0]).toEqual([]);
    expect(findConflicts([base, { ...other, startDate: '2026-01-01', endDate: '2026-10-20' }], today)[0]).toEqual([]);
    // Monthly blocks on different weeks never meet.
    const m = { ...base, repeat: 'monthly', weeks: [1] };
    expect(findConflicts([m, { ...m, weeks: [2] }], today)[0]).toEqual([]);
    expect(findConflicts([m, { ...m, weeks: [1, 3] }], today)[0]).toHaveLength(1);
  });

  it('knows an untouched new block', () => {
    expect(isBlankBlock(newBlock())).toBe(true);
    expect(isBlankBlock({ ...newBlock(), location: 'Mary Health' })).toBe(false);
  });

  it('previews the dates a monthly block falls on', () => {
    const m = { ...base, repeat: 'monthly', weeks: [3], days: [1, 2, 3, 4, 5], startDate: '2026-10-01' };
    expect(monthlyPreview(m)).toEqual({ month: 'October 2026', dates: ['2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21'] });
    expect(monthlyPreview({ ...m, weeks: [-1], days: [5] }).dates).toEqual(['2026-10-30']);
    expect(cadenceSentence({ ...m, days: [1, 5] })).toBe('Repeats on the 3rd Monday and Friday of every month.');
    expect(cadenceSentence({ ...m, weeks: [1, -1], days: [5], interval: 2 })).toBe('Repeats on the 1st and last Friday of every 2 months.');
    expect(cadenceSentence({ ...base, repeat: 'weekly', interval: 2, days: [1, 3, 5] })).toBe('Repeats every 2 weeks on Monday, Wednesday and Friday.');
    expect(cadenceSentence({ ...base, repeat: 'daily', interval: 3 })).toBe('Repeats every 3 days.');
  });

  it('reads old every-2-weeks rows as advanced weekly every 2', () => {
    const b = rowToBlock({ id: 'x', repeat: 'biweekly', days: [2], slots: [] });
    expect(b).toMatchObject({ advanced: true, repeat: 'weekly', interval: 2 });
    expect(rowToBlock({ id: 'y', repeat: 'weekly', days: [2], slots: [] }).advanced).toBe(false);
    expect(validateBlock({ ...base, interval: 0 }).interval).toBeTruthy();
    expect(validateBlock({ ...base, repeat: 'daily', days: [] }).days).toBeUndefined();
  });

  it('has well-formed sample blocks', () => {
    for (const b of sampleAvailability(new Date('2026-10-09'))) {
      expect(Array.isArray(b.slots) && b.slots.length > 0).toBe(true);
      expect(b.startDate <= b.endDate).toBe(true);
    }
  });

  it('merges overlapping clash hours', () => {
    const today = '2026-11-01';
    const a = { ...base, days: [1, 3], slots: [{ appointmentType: 'x', start: '08:30', end: '12:30' }, { appointmentType: 'x', start: '13:30', end: '16:00' }, { appointmentType: 'x', start: '17:00', end: '18:00' }] };
    const b = { ...base, days: [1, 2], slots: [{ appointmentType: 'x', start: '09:00', end: '13:00' }, { appointmentType: 'x', start: '14:00', end: '16:00' }], startDate: '2026-12-01', endDate: '2027-01-31' };
    const [mine] = findConflicts([a, b], today);
    expect(mine[0].hours).toEqual([{ start: '09:00', end: '12:30' }, { start: '14:00', end: '16:00' }]);
  });
});
