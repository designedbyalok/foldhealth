import { describe, expect, it } from 'vitest';
import { apptSpan, coveringProviders, findConflict, groupByDepartment, planDetail, reassignWindow, scopeAppointments, tallyPlan, coveringGroups, coverageFor, missingAccess, COVER_ACCESS } from './reassignUtils';

const now = new Date(2026, 9, 1, 12, 0);
const appt = (id, date, time, extra = {}) => ({ id, primary_user: 'Abhay Chaudhary', date, time_start: time, status: 'Scheduled', location: '7 Hills Department', ...extra });

describe('reassignment scope', () => {
  const win = { from: new Date(2026, 9, 1).getTime(), to: new Date(2026, 9, 3).getTime() };
  it('keeps the provider\'s upcoming, uncancelled appointments in the window', () => {
    const list = [
      appt('a', '10-01-2026', '9:00 am'),             // already past (before noon)
      appt('b', '10-01-2026', '2:30 pm'),
      appt('c', '10-02-2026', '9:00 am', { status: 'Cancelled' }),
      appt('d', '10-02-2026', '11:00 am', { primary_user: 'Someone Else' }),
      appt('e', '10-03-2026', '9:00 am'),             // after the window
      appt('f', '10-02-2026', '11:00 am'),
    ];
    expect(scopeAppointments(list, 'abhay chaudhary', win, now).map(a => a.id)).toEqual(['b', 'f']);
  });
  it('works out the window for each type', () => {
    expect(reassignWindow({ type: 'permanent' }, now).to).toBe(Infinity);
    expect(reassignWindow({ type: 'ooo', record: { startAt: '2026-10-02T00:00:00', endAt: '2026-10-03T00:00:00' } }).from).toBe(new Date('2026-10-02T00:00:00').getTime());
    expect(reassignWindow({ type: 'other', startAt: '2026-10-03T00:00:00', endAt: '2026-10-02T00:00:00' })).toBeNull();
  });
  it('groups by department, A–Z', () => {
    const g = groupByDepartment([appt('a', '10-02-2026', '9:00 am', { location: 'Mary Health' }), appt('b', '10-02-2026', '9:00 am'), appt('c', '10-02-2026', '9:00 am', { location: '' })]);
    expect(g.map(d => d.name)).toEqual(['7 Hills Department', 'Mary Health', 'No Department']);
  });
});

describe('covering providers and conflicts', () => {
  const users = [
    { name: 'Abhay Chaudhary', locations: ['7 Hills Department'] },
    { name: 'James Will', locations: ['7 Hills Department', 'Mary Health'] },
    { name: 'Elena Smith', locations: ['7 Hills Department'] },
    { name: 'Emma Johnson', locations: ['Mary Health'] },
  ];
  const window = { from: new Date(2026, 9, 2).getTime(), to: new Date(2026, 9, 5).getTime() };
  it('lists the department\'s people, not the away provider or anyone also out', () => {
    const ooo = [{ userName: 'Elena Smith', startAt: '2026-10-04T00:00:00', endAt: '2026-10-06T00:00:00' }];
    expect(coveringProviders('7 Hills Department', users, { awayUser: 'Abhay Chaudhary', oooRecords: ooo, window }).map(u => u.name)).toEqual(['James Will']);
  });
  it('finds an overlapping appointment on the covering provider\'s calendar', () => {
    const a = appt('a', '10-02-2026', '9:00 am', { time_end: '9:30 am' });
    const theirs = [{ id: 'x', primary_user: 'James Will', date: '10-02-2026', time_start: '9:15 am', time_end: '9:45 am', status: 'Scheduled' }];
    expect(findConflict(a, 'James Will', theirs)?.id).toBe('x');
    expect(findConflict(a, 'Emma Johnson', theirs)).toBeNull();
    expect(apptSpan({ date: '10-02-2026', time_start: '9:00 am' }).end - apptSpan({ date: '10-02-2026', time_start: '9:00 am' }).start).toBe(30 * 60000);
  });
});

describe('plan tally', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('counts reassigning, cancelling and the rest', () => {
    const plan = { a: { action: 'reassign', to: 'James Will' }, b: { action: 'cancel' } };
    expect(tallyPlan(plan, list)).toEqual({ reassigning: 1, cancelling: 1, noAction: 1 });
    expect(planDetail(plan, list)).toBe('1 Reassigned • 1 Cancelled');
    expect(planDetail({ a: { action: 'cancel' }, b: { action: 'cancel' }, c: { action: 'cancel' } }, list)).toBe('All Cancelled');
  });
});

describe('buildJob', () => {
  it('reassigns, cancels, flags clashes and fails missing appointments', async () => {
    const { buildJob } = await import('./reassignJobs');
    const list = [
      { id: 'a', primary_user: 'Abhay', date: '10-02-2026', time_start: '9:00 am', time_end: '9:30 am', location: 'Mary Health' },
      { id: 'b', primary_user: 'Abhay', date: '10-02-2026', time_start: '11:00 am', location: 'Mary Health' },
      { id: 'c', primary_user: 'Abhay', date: '10-02-2026', time_start: '2:30 pm', location: 'Mary Health', ehr_missing: true },
      { id: 'd', primary_user: 'Abhay', date: '10-03-2026', time_start: '9:00 am', location: 'Rockwell Health' },
    ];
    const everyone = [...list, { id: 'x', primary_user: 'James Will', date: '10-02-2026', time_start: '9:00 am', time_end: '9:30 am', status: 'Scheduled' }];
    const plan = { a: { action: 'reassign', to: 'James Will' }, b: { action: 'reassign', to: 'James Will' }, c: { action: 'reassign', to: 'James Will' }, d: { action: 'cancel' } };
    const job = buildJob({ fromUser: 'Abhay', type: 'ooo', window: { from: 0, to: Infinity }, plan, appointments: list, everyone });
    expect([job.reassignedCount, job.cancelledCount, job.conflictingCount, job.failedCount]).toEqual([2, 1, 1, 1]);
    expect(job.results.find(r => r.appointmentId === 'a').conflict.appointmentId).toBe('x');
    expect(job.windowEnd).toBeNull();
  });
});

describe('reassigning between people with the same name', () => {
  it('scopes, covers and clashes by id', () => {
    const away = { id: 'u-1', name: 'John Smith' };
    const other = { id: 'u-2', name: 'John Smith', locations: ['Mary Health'] };
    const window = { from: new Date(2026, 9, 10).getTime(), to: new Date(2026, 9, 11).getTime() };
    const now = new Date(2026, 9, 1);
    const appts = [
      { id: 'x', primary_user: 'John Smith', primary_user_id: 'u-1', date: '10-10-2026', time_start: '9:00 am', time_end: '9:30 am' },
      { id: 'y', primary_user: 'John Smith', primary_user_id: 'u-2', date: '10-10-2026', time_start: '9:00 am', time_end: '9:30 am' },
    ];
    expect(scopeAppointments(appts, away, window, now).map(a => a.id)).toEqual(['x']);
    // The other John Smith can cover: he isn't the one away.
    expect(coveringProviders('Mary Health', [other], { awayUser: away, window }).map(u => u.id)).toEqual(['u-2']);
    // And his own 9:00 appointment is a clash for him, not for the one away.
    expect(findConflict(appts[0], other, appts)?.id).toBe('y');
  });
});

describe('coveringGroups', () => {
  const users = [
    { id: 'a', name: 'Abhay Chaudhary', locations: ['Downtown Clinic'], clinicalRoles: ['Physician'] },
    { id: 'b', name: 'Bella Stone', locations: ['Downtown Clinic'], clinicalRoles: ['Nurse'] },
    { id: 'c', name: 'Abhijit Gupta', locations: ['Downtown Clinic'], clinicalRoles: ['Physician'] },
    { id: 'd', name: 'Dev Rao', locations: ['Riverside Clinic'], clinicalRoles: ['Physician'] },
    { id: 'e', name: 'Navin Jethwani', locations: ['Downtown Clinic'], clinicalRoles: ['Physician'] },
  ];
  const from = new Date(2026, 10, 10).getTime();
  const to = new Date(2026, 10, 12).getTime();
  const oooRecords = [
    { id: 'r1', userId: 'e', userName: 'Navin Jethwani', startAt: new Date(2026, 10, 11).toISOString(), endAt: new Date(2026, 10, 13).toISOString() },
    { id: 'self', userId: 'a', userName: 'Abhay Chaudhary', startAt: new Date(2026, 10, 10).toISOString(), endAt: new Date(2026, 10, 12).toISOString() },
  ];
  const names = list => list.map(x => x.user.name);
  const away = { id: 'a', name: 'Abhay Chaudhary' };

  it('puts people missing access in limited, the rest by shared location then role', () => {
    const g = coveringGroups(away, users, { oooRecords, from, to, recordId: 'self' });
    const limited = users.filter(u => u.id !== 'a' && u.id !== 'e' && missingAccess(u).length).map(u => u.name);
    expect(names(g.limited).sort()).toEqual(limited.sort());
    g.limited.forEach(x => expect(COVER_ACCESS).toContain(x.missing[0]));
    const expected = ['Abhijit Gupta', 'Bella Stone', 'Dev Rao'].filter(n => !limited.includes(n));
    expect(names(g.suggested)).toEqual(expected);
    expect(names(g.unavailable)).toEqual(['Navin Jethwani']);
    expect(g.unavailable[0].out.id).toBe('r1');
  });

  it('marks nobody unavailable without dates', () => {
    const g = coveringGroups(away, users, { oooRecords });
    expect(g.unavailable).toEqual([]);
  });

  it('leads with people at the given location', () => {
    const g = coveringGroups(away, users, { location: 'Riverside Clinic' });
    if (!missingAccess(users[3]).length) expect(names(g.suggested)[0]).toBe('Dev Rao');
  });
});

describe('missingAccess', () => {
  it('is stable and lacks at most two different accesses', () => {
    const sizes = new Set();
    for (let i = 0; i < 200; i++) {
      const u = { id: `user-${i}` };
      const m = missingAccess(u);
      expect(m).toEqual(missingAccess({ ...u }));
      expect(new Set(m).size).toBe(m.length);
      sizes.add(m.length);
    }
    expect([...sizes].sort()).toEqual([0, 1, 2]);
  });
});

describe('coverageFor', () => {
  it('covers each of the away provider\'s locations', () => {
    expect(coverageFor({ id: 'c', name: 'Abhijit Gupta' }, ['Downtown Clinic', 'SEB Office'])).toEqual([
      { userId: 'c', userName: 'Abhijit Gupta', location: 'Downtown Clinic' },
      { userId: 'c', userName: 'Abhijit Gupta', location: 'SEB Office' },
    ]);
    expect(coverageFor({ id: 'c', name: 'Abhijit Gupta' }, [])).toEqual([{ userId: 'c', userName: 'Abhijit Gupta', location: '' }]);
    expect(coverageFor(null, ['SEB Office'])).toEqual([]);
  });
});
