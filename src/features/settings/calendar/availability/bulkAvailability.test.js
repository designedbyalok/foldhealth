import { describe, expect, it } from 'vitest';
import { reviewUser, schedulesText, typeApplicable } from './bulkAvailability';

const today = '2026-11-11'; // a Wednesday
const block = (over = {}) => ({
  location: '7 Hills Department', timezone: 'America/New_York', repeat: 'weekly', interval: 1,
  days: [1, 2, 3, 4, 5], weeks: [], startDate: '2026-11-01', endDate: '2027-01-31',
  slots: [{ appointmentType: 'Flu Shot', start: '08:00', end: '12:00' }], ...over,
});
const user = { id: 'u1', name: 'Ajay Lakshman', clinicalRoles: ['Physician'], locations: ['7 Hills Department', 'Mary Health'] };
const types = [
  { name: 'Flu Shot', applicable_roles: [] },
  { name: 'Nurse Visit', applicable_roles: ['Nurse'] },
];

describe('typeApplicable', () => {
  it('treats types without Applicable For as open to all', () => {
    expect(typeApplicable('Flu Shot', user, types)).toBe(true);
  });
  it('checks roles and provider lists', () => {
    expect(typeApplicable('Nurse Visit', user, types)).toBe(false);
    expect(typeApplicable('Nurse Visit', { ...user, clinicalRoles: ['Nurse'] }, types)).toBe(true);
    expect(typeApplicable('X', user, [{ name: 'X', applicable_users: ['u1'] }])).toBe(true);
  });
});

describe('reviewUser', () => {
  it('adds a user with a schedule today and no overlaps', () => {
    const existing = [block({ id: 'e1', location: 'Mary Health', slots: [{ appointmentType: 'Flu Shot', start: '13:00', end: '17:00' }] })];
    expect(reviewUser(user, [block()], { existing, appointmentTypes: types, today }).outcome).toBe('add');
  });
  it('skips when a location is not assigned', () => {
    const r = reviewUser(user, [block(), block({ location: 'Riverside Clinic' })], { appointmentTypes: types, today });
    expect(r.outcome).toBe('skip');
    expect(r.lines).toEqual(["Riverside Clinic isn't assigned."]);
  });
  it('skips when no active appointment type applies to the role', () => {
    const r = reviewUser(user, [block({ slots: [{ appointmentType: 'Nurse Visit', start: '08:00', end: '09:00' }] })], { appointmentTypes: types, today });
    expect(r.lines).toEqual(['No active appointment type for this role.']);
    const support = { ...user, clinicalRoles: ['Support'] };
    const roleTypes = [{ name: 'Flu Shot', applicable_roles: ['Physician'] }, { name: 'Old', applicable_roles: ['Support'], active: false }];
    expect(reviewUser(support, [block({ slots: [{ appointmentType: 'All appointment types', start: '08:00', end: '09:00' }] })], { appointmentTypes: roleTypes, today }).lines)
      .toEqual(['No active appointment type for this role.']);
  });
  it('gives one line per reason across schedules', () => {
    const support = { ...user, clinicalRoles: ['Support'] };
    const nurse = [{ appointmentType: 'Nurse Visit', start: '08:00', end: '09:00' }];
    const r = reviewUser(support, [block({ location: 'Riverside Clinic', slots: nurse }), block({ location: 'Valley Clinic', slots: nurse })], { appointmentTypes: types, today });
    expect(r.lines).toEqual(["Riverside Clinic and Valley Clinic aren't assigned.", 'No active appointment type for this role.']);
  });
  it('uses the default roles before a type has its own', () => {
    expect(typeApplicable('X', { ...user, clinicalRoles: ['Coder'] }, [{ name: 'X' }])).toBe(false);
    expect(typeApplicable('X', { ...user, clinicalRoles: ['Physician/Doctor'] }, [{ name: 'X' }])).toBe(true);
  });
  it('skips a user who already has every schedule', () => {
    const r = reviewUser(user, [block()], { existing: [block({ id: 'e1' })], appointmentTypes: types, today });
    expect(r.lines).toEqual(['Already has these schedules.']);
  });
  it('skips the import source', () => {
    expect(reviewUser(user, [block()], { sourceName: 'Ajay Lakshman', today }).lines).toEqual(['Already has these schedules.']);
  });
  it('combines overlaps at one location into one line', () => {
    const existing = [block({ id: 'e1' })];
    const r = reviewUser(user, [block(), block({ location: 'Mary Health', days: [2] }), block({ days: [1] })], { existing, appointmentTypes: types, today });
    expect(r.outcome).toBe('warn');
    expect(r.lines[0]).toBe('Schedules 1, 2 and 3 overlap existing schedules at 7 Hills Department. Double booking may occur.');
  });
  it('warns when the user has no schedule today, and when booking starts later', () => {
    const r = reviewUser(user, [block({ startDate: '2026-12-01' })], { appointmentTypes: types, today });
    expect(r.lines).toEqual([
      'Has no schedule today. After saving, this user is booked only from these schedules.',
      "Can't be booked until 12/01/2026, when the first schedule starts.",
    ]);
    expect(reviewUser(user, [block()], { appointmentTypes: types, today, requireUserAvailability: true }).outcome).toBe('add');
  });
});

describe('text', () => {
  it('names schedules', () => {
    expect(schedulesText([3])).toBe('Schedule 3');
    expect(schedulesText([3, 1])).toBe('Schedules 1 and 3');
  });
});
