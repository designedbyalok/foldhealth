import { describe, expect, it } from 'vitest';
import { dayKey, dayParts, groupByDay, timeLabel, visitWhen } from './slotFormat';

const NY = 'America/New_York';

describe('dayKey / timeLabel', () => {
  it('uses the slot timezone, not the viewer', () => {
    // 03:30 UTC on Oct 29 is still Oct 28 in New York.
    expect(dayKey('2026-10-29T03:30:00Z', NY)).toBe('2026-10-28');
    expect(timeLabel('2026-10-29T13:00:00Z', NY)).toBe('9:00 AM');
  });
});

describe('groupByDay', () => {
  it('groups and sorts by local day and time', () => {
    const slots = [
      { starts_at: '2026-10-30T14:00:00Z', timezone: NY, user_id: 'a' },
      { starts_at: '2026-10-29T13:30:00Z', timezone: NY, user_id: 'a' },
      { starts_at: '2026-10-29T13:00:00Z', timezone: NY, user_id: 'b' },
    ];
    const days = groupByDay(slots);
    expect(days.map((d) => d.key)).toEqual(['2026-10-29', '2026-10-30']);
    expect(days[0].slots.map((s) => s.user_id)).toEqual(['b', 'a']);
  });
});

describe('dayParts', () => {
  it('splits a day key for the date strip', () => {
    expect(dayParts('2026-10-29')).toEqual({ weekday: 'Thu', day: '29', month: 'Oct' });
  });
});

describe('visitWhen', () => {
  it('reads the staff calendar text formats', () => {
    expect(visitWhen({ date: '10-29-2026', time_start: '9:00 am', time_end: '9:30 am' }))
      .toEqual({ month: 'Oct', day: '29', weekday: 'Thu', time: '9:00 AM – 9:30 AM' });
  });

  it('keeps the time when the date does not parse', () => {
    expect(visitWhen({ date: 'soon', time_start: '9:00 am' }).time).toBe('9:00 AM');
  });
});
