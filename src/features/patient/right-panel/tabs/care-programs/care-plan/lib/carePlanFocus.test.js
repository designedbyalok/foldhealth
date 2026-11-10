import { describe, expect, it } from 'vitest';
import { carePlanFocusItems } from './carePlanFocus';

const goal = (id, status = 'In Progress') => ({ id, title: `Goal ${id}`, status });

describe('carePlanFocusItems', () => {
  it('flags an open goal whose latest reading is unfavorable', () => {
    const items = carePlanFocusItems({
      goals: [goal('g1'), goal('g2'), goal('g3', 'Met')],
      measurements: [
        { goalId: 'g1', value: '7.1', unit: '%', favorable: true, takenAt: '2026-09-01' },
        { goalId: 'g1', value: '9.2', unit: '%', favorable: false, takenAt: '2026-10-01' },
        { goalId: 'g2', value: '9.0', unit: '%', favorable: false, takenAt: '2026-09-01' },
        { goalId: 'g2', value: '6.8', unit: '%', favorable: true, takenAt: '2026-10-01' },
        { goalId: 'g3', value: '9.9', unit: '%', favorable: false, takenAt: '2026-10-01' },
      ],
    });
    expect(items.map(i => i.key)).toEqual(['goal:g1']);
    expect(items[0].text).toBe('Latest reading 9.2 % on 10/01/2026.');
  });

  it('flags an open intervention past its due date, never one without a date', () => {
    const due = { i1: '2020-01-02', i2: '2020-01-02', i4: '2020-03-04', i5: '2999-01-01' };
    const items = carePlanFocusItems({
      interventions: [
        { id: 'i1', title: 'Call pharmacy', status: 'In Progress' },
        { id: 'i2', title: 'Done already', status: 'Met' },
        { id: 'i3', title: 'No date', status: 'Not Started' },
        { id: 'i4', title: 'Task date', status: 'Not Started' },
        { id: 'i5', title: 'Future', status: 'Not Started' },
      ],
      dueOf: i => (due[i.id] ? { iso: due[i.id], formatted: due[i.id].slice(5, 7) + '/' + due[i.id].slice(8) + '/' + due[i.id].slice(0, 4) } : { iso: null }),
    });
    expect(items.map(i => i.key)).toEqual(['intervention:i1', 'intervention:i4']);
    expect(items[1].text).toBe('Due 03/04/2020.');
  });

  it('flags an open barrier when none of its goals has an open intervention', () => {
    const items = carePlanFocusItems({
      interventions: [
        { id: 'i1', goalId: 'g1', status: 'In Progress', config: {} },
        { id: 'i2', goalId: 'g2', status: 'Met', config: {} },
      ],
      barriers: [
        { id: 'b1', title: 'Cost', status: 'Not Started', goalIds: ['g1'] },
        { id: 'b2', title: 'Transport', status: 'Not Started', goalIds: ['g2'] },
        { id: 'b3', title: 'Loose', status: 'Not Started' },
        { id: 'b4', title: 'Closed', status: 'Met', goalIds: ['g2'] },
      ],
    });
    expect(items.map(i => i.key)).toEqual(['barrier:b2', 'barrier:b3']);
    expect(items[1].text).toBe('It is not linked to a goal.');
  });

  it('puts a due review in and orders danger before warning', () => {
    const items = carePlanFocusItems({
      barriers: [{ id: 'b1', title: 'Cost', status: 'Not Started' }],
      goals: [goal('g1')],
      measurements: [{ goalId: 'g1', value: '9', favorable: false }],
      review: { status: { state: 'overdue', daysOverdue: 3 }, lastReview: '2026-09-20' },
    });
    expect(items.map(i => i.key)).toEqual(['review', 'goal:g1', 'barrier:b1']);
    expect(items[0].title).toBe('Care plan review overdue by 3 days');
    expect(carePlanFocusItems({ review: { status: { state: 'upcoming', daysOverdue: 0 } } })).toEqual([]);
  });
});
