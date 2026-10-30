import { describe, expect, test } from 'bun:test';
import { groupByProvider, inPeriod, lockedReason, periodRange, sortAppointments, timeRangeLabel } from './appointmentList';
import { minutesToTime, openSlots } from '../openSlots';

describe('periodRange', () => {
  test('week runs Monday to Sunday', () => {
    expect(periodRange('week', '2026-10-29')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(periodRange('week', '2026-11-01')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
  });
  test('day and month', () => {
    expect(periodRange('day', '2026-10-29')).toEqual({ from: '2026-10-29', to: '2026-10-29' });
    expect(periodRange('month-grid', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
  test('inPeriod reads MM-DD-YYYY', () => {
    expect(inPeriod({ date: '10-26-2026' }, { from: '2026-10-26', to: '2026-11-01' })).toBe(true);
    expect(inPeriod({ date: '11-02-2026' }, { from: '2026-10-26', to: '2026-11-01' })).toBe(false);
  });
});

describe('selection and grouping', () => {
  test('checked in and checked out are locked; cancelled is not', () => {
    expect(lockedReason({ status: 'Checked In' })).toBeTruthy();
    expect(lockedReason({ status: 'Checked Out' })).toBeTruthy();
    expect(lockedReason({ status: 'Cancelled' })).toBeNull();
    expect(lockedReason({ status: 'Scheduled' })).toBeNull();
  });
  test('groups by provider id, A–Z, keeping sort order', () => {
    const list = sortAppointments([
      { id: 1, primary_user: 'Zoe', primary_user_id: 'z', date: '10-27-2026', time_start: '9:00 am' },
      { id: 2, primary_user: 'Amy', primary_user_id: 'a', date: '10-28-2026', time_start: '9:00 am' },
      { id: 3, primary_user: 'Amy', primary_user_id: 'a', date: '10-27-2026', time_start: '9:00 am' },
    ]);
    const groups = groupByProvider(list);
    expect(groups.map(g => g.person.name)).toEqual(['Amy', 'Zoe']);
    expect(groups[0].appointments.map(a => a.id)).toEqual([3, 2]);
  });
});

describe('timeRangeLabel', () => {
  test('shares the AM/PM when both ends have it', () => {
    expect(timeRangeLabel({ time_start: '9:00 am', time_end: '9:30 am' })).toBe('9:00–9:30 AM');
    expect(timeRangeLabel({ time_start: '11:30 am', time_end: '12:15 pm' })).toBe('11:30 AM–12:15 PM');
    expect(timeRangeLabel({ time_start: '2:00 pm' })).toBe('2:00 PM');
  });
});

describe('openSlots', () => {
  const person = { id: 'p1', name: 'Pat' };
  const base = { date: '2026-11-02', person, durationMin: 30, segments: [], holidays: [], oooRecords: [], appointments: [], now: 0 };
  const has = (slots, t) => slots.some(s => s.label === t);

  test('practice hours when the provider has no availability', () => {
    const slots = openSlots(base);
    expect(slots[0].label).toBe('6:00 am');
    expect(slots[slots.length - 1].label).toBe('7:30 pm');
  });
  test('skips booked time, but not the appointments being moved', () => {
    const appt = { id: 'x', primary_user: 'Pat', primary_user_id: 'p1', date: '11-02-2026', time_start: '9:00 am', time_end: '10:00 am' };
    expect(has(openSlots({ ...base, appointments: [appt] }), '9:30 am')).toBe(false);
    expect(has(openSlots({ ...base, appointments: [appt], ignoreIds: new Set(['x']) }), '9:30 am')).toBe(true);
  });
  test('skips slots picked on other rows, out of office and the past', () => {
    const nineAm = new Date(2026, 10, 2, 9).getTime();
    expect(has(openSlots({ ...base, taken: [{ start: nineAm, end: nineAm + 30 * 60000 }] }), '9:00 am')).toBe(false);
    const ooo = [{ userId: 'p1', userName: 'Pat', startAt: new Date(2026, 10, 2, 12).toISOString(), endAt: new Date(2026, 10, 2, 14).toISOString() }];
    expect(has(openSlots({ ...base, oooRecords: ooo }), '1:00 pm')).toBe(false);
    expect(has(openSlots({ ...base, now: nineAm }), '9:00 am')).toBe(false);
    expect(has(openSlots({ ...base, now: nineAm }), '9:30 am')).toBe(true);
  });
  test('minutesToTime', () => {
    expect(minutesToTime(0)).toBe('12:00 am');
    expect(minutesToTime(12 * 60 + 30)).toBe('12:30 pm');
  });
});
