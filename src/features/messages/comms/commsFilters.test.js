import { describe, expect, it } from 'vitest';
import { EMPTY_COMMS_FILTERS, commsFiltersActive, lastStaffSenders } from './commsFilters';

describe('commsFiltersActive', () => {
  it('is off until something is picked', () => {
    expect(commsFiltersActive(EMPTY_COMMS_FILTERS)).toBe(false);
    expect(commsFiltersActive({ ...EMPTY_COMMS_FILTERS, covering: ['Navin Jethwani'] })).toBe(true);
    expect(commsFiltersActive({ ...EMPTY_COMMS_FILTERS, datePreset: 'Today' })).toBe(true);
    expect(commsFiltersActive({ ...EMPTY_COMMS_FILTERS, inbox: 'inbox-sms-main' })).toBe(true);
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
