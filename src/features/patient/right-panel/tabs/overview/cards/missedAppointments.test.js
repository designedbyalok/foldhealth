import { describe, expect, it } from 'vitest';
import { missedAppointments } from './missedAppointments';

const NOW = new Date(2026, 9, 26, 12).getTime();
const DAY = 24 * 3600 * 1000;
const appt = (id, n, outcome, title = 'Annual Wellness Visit') => ({ id, kind: 'appointment', at: NOW - n * DAY, title, outcome, actor: 'Dr. Aldo Richman' });

describe('missedAppointments', () => {
  it('finds no-shows, cancellations and visits never checked in', () => {
    const r = missedAppointments({
      events: [
        appt('ns', 10, 'No Show', 'Follow-up Visit'),
        appt('cx', 20, 'Cancelled', 'Lab Draw'),
        appt('nc', 30, 'Scheduled'),
        appt('ok', 15, 'Completed', 'Telehealth'),
      ],
      now: NOW,
    });
    expect(r.map(a => [a.id, a.reason])).toEqual([['ns', 'No show'], ['cx', 'Cancelled'], ['nc', 'Never checked in']]);
    expect(r[0].provider).toBe('Dr. Aldo Richman');
  });

  it('waits until the day is over and looks back a year', () => {
    const r = missedAppointments({ events: [appt('today', 0.2, 'Scheduled'), appt('old', 400, 'No Show')], now: NOW });
    expect(r).toEqual([]);
  });

  it('marks a missed visit rebooked when a later one of the same kind exists', () => {
    const r = missedAppointments({
      events: [appt('nc', 30, 'Scheduled'), appt('next', -5, 'Scheduled', 'annual wellness visit '), appt('lab', 20, 'No Show', 'Lab Draw')],
      upcoming: [{ date: '11/20/2026', type: 'Lab Draw' }],
      now: NOW,
    });
    expect(r.find(a => a.id === 'nc').rebookedAt).toBe(NOW + 5 * DAY);
    expect(new Date(r.find(a => a.id === 'lab').rebookedAt).getDate()).toBe(20);
  });
});
