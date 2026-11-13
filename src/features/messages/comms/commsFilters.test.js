import { describe, expect, it } from 'vitest';
import { EMPTY_COMMS_FILTERS, commsFiltersActive, dateWindow, lastStaffSenders } from './commsFilters';

const now = new Date(2026, 10, 13, 15, 30); // Nov 13, 3:30 PM local
const day = (d) => new Date(2026, 10, d).getTime();

describe('dateWindow', () => {
  it('is open for All', () => {
    expect(dateWindow(EMPTY_COMMS_FILTERS, now)).toBeNull();
  });
  it('covers today, yesterday, the last week and the last month', () => {
    expect(dateWindow({ ...EMPTY_COMMS_FILTERS, date: 'today' }, now)).toEqual({ from: day(13), to: Infinity });
    expect(dateWindow({ ...EMPTY_COMMS_FILTERS, date: 'yesterday' }, now)).toEqual({ from: day(12), to: day(13) });
    expect(dateWindow({ ...EMPTY_COMMS_FILTERS, date: 'week' }, now)).toEqual({ from: day(7), to: Infinity });
    expect(dateWindow({ ...EMPTY_COMMS_FILTERS, date: 'month' }, now)).toEqual({ from: new Date(2026, 9, 15).getTime(), to: Infinity });
  });
  it('takes a Custom Start - End range through the end day', () => {
    expect(dateWindow({ ...EMPTY_COMMS_FILTERS, date: 'custom', range: { start: '2026-11-01', end: '2026-11-05' } }, now)).toEqual({ from: day(1), to: day(6) });
    expect(dateWindow({ ...EMPTY_COMMS_FILTERS, date: 'custom', range: null }, now)).toBeNull();
  });
});

describe('commsFiltersActive', () => {
  it('is off until something is picked', () => {
    expect(commsFiltersActive(EMPTY_COMMS_FILTERS)).toBe(false);
    expect(commsFiltersActive({ ...EMPTY_COMMS_FILTERS, covering: ['Navin Jethwani'] })).toBe(true);
  });
});

describe('lastStaffSenders', () => {
  it('keeps the newest staff sender per conversation, skipping auto-replies', () => {
    const rows = [
      { conversation_id: 'a', sender_name: 'Devanshi Sharma', created_at: '2026-11-13T10:00:00Z', auto_reply: 'true' },
      { conversation_id: 'a', sender_name: 'Navin Jethwani', created_at: '2026-11-12T10:00:00Z', auto_reply: null },
      { conversation_id: 'a', sender_name: 'Megan Miller', created_at: '2026-11-11T10:00:00Z', auto_reply: null },
      { conversation_id: 'b', sender_name: 'Megan Miller', created_at: '2026-11-10T10:00:00Z', auto_reply: null },
    ];
    expect(lastStaffSenders(rows)).toEqual(new Map([['a', 'Navin Jethwani'], ['b', 'Megan Miller']]));
  });
});
