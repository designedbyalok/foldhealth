import { describe, expect, it } from 'vitest';
import { defaultRemindAt, groupReminders, isoToPicker, pickerToIso, reminderWhen, snoozeOneDay } from './reminders';

const NOW = new Date(2026, 9, 26, 12, 0).getTime();
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).toISOString();

describe('groupReminders', () => {
  it('splits into overdue, today, upcoming and done, soonest first', () => {
    const g = groupReminders([
      { id: 'up2', remindAt: at(30, 9) },
      { id: 'od', remindAt: at(25, 9) },
      { id: 'today', remindAt: at(26, 15) },
      { id: 'up1', remindAt: at(27, 9) },
      { id: 'done', remindAt: at(20, 9), doneAt: at(21, 10) },
    ], NOW);
    expect(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map(r => r.id)]))).toEqual({
      overdue: ['od'], today: ['today'], upcoming: ['up1', 'up2'], done: ['done'],
    });
  });

  it('counts a reminder due earlier today as overdue', () => {
    expect(groupReminders([{ id: 'a', remindAt: at(26, 9) }], NOW).overdue).toHaveLength(1);
  });
});

describe('reminderWhen', () => {
  it('reads relative to today', () => {
    expect(reminderWhen(at(26, 15), NOW)).toBe('Today, 3:00 PM');
    expect(reminderWhen(at(27, 9), NOW)).toBe('Tomorrow, 9:00 AM');
    expect(reminderWhen(at(25, 9), NOW)).toBe('Yesterday, 9:00 AM');
    expect(reminderWhen(at(30, 9), NOW)).toBe('Fri, Oct 30, 9:00 AM');
  });
});

describe('picker round trip, defaults and snooze', () => {
  it('converts between picker values and ISO', () => {
    const iso = pickerToIso('10/30/2026, 14:30');
    expect(isoToPicker(iso)).toBe('10/30/2026, 14:30');
    expect(pickerToIso('')).toBeNull();
  });

  it('defaults to tomorrow at 9:00', () => {
    expect(defaultRemindAt(NOW)).toBe(at(27, 9));
  });

  it('snoozes a day from the due time, or from now when already past', () => {
    expect(snoozeOneDay(at(28, 9), NOW)).toBe(at(29, 9));
    expect(snoozeOneDay(at(20, 9), NOW)).toBe(new Date(NOW + 24 * 3600 * 1000).toISOString());
  });
});
