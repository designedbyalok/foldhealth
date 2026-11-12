import { describe, expect, it } from 'vitest';
import { dayOf, filterOptions, passes, rowFacts } from './worklistFilters';

const today = new Date(2026, 10, 12);
const row = { name: 'Alice Walker', gender: 'F', kinds: ['patients', 'hcc'] };
const ctx = {
  patients: [{ id: 'p1', name: 'Alice Walker', status: 'scheduled', language: 'en', facility: 'ER – Downtown', dueOn: '11/16/2026', tags: ['Diabetes'] }],
  appointments: [
    { patient_name: 'Alice Walker', date: '11-02-2026', primary_user: 'Ann', location: 'Downtown Clinic', mode: 'At Clinic', appointment_type_name: 'AWV', status: 'Completed' },
    { patient_name: 'Alice Walker', date: '11-20-2026', primary_user: 'Bob', location: 'Valley', mode: 'Virtual', appointment_type_name: 'Follow-up', status: 'Scheduled' },
  ],
  tasks: [{ member: 'Alice Walker', status: 'pending', due_date: '11-14-2026' }],
};

describe('My Worklist filters', () => {
  it('reads each row\'s facts', () => {
    const f = rowFacts(row, ctx, today);
    expect(f.nextAppt).toBe(dayOf('11-20-2026'));
    expect(f.lastAppt).toBe(dayOf('11-02-2026'));
    expect(f.lastProvider).toBe('Ann');
    expect(f.locations).toEqual(['Downtown Clinic', 'Valley', 'ER – Downtown']);
    expect(f.programs).toEqual(['TOC', 'HCC']);
    expect(f.language).toBe('English');
    expect(f.patientStatus).toBe('Scheduled');
  });
  it('filters by values and day ranges', () => {
    const f = rowFacts(row, ctx, today);
    expect(filterOptions([f]).pos).toEqual(['At Clinic', 'Virtual']);
    expect(passes(f, { pos: ['Virtual'] })).toBe(true);
    expect(passes(f, { gender: ['Male'] })).toBe(false);
    expect(passes(f, { nextAppt: ['2026-11-18', '2026-11-25'] })).toBe(true);
    expect(passes(f, { taskDue: ['2026-11-01', '2026-11-10'] })).toBe(false);
  });
});
