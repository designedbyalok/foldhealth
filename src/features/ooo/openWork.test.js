import { describe, expect, it } from 'vitest';
import { byDepartment, defaultAppointmentPlan, openTasksByCard, patientDepartments, planPeople, taskCountLine, withDepartments } from './openWork';

const away = { id: 'u1', name: 'Libby Ross' };
const task = (id, extra) => ({ id, name: 'Call patient', status: 'pending', assigned_to: 'Libby Ross', assigned_to_id: 'u1', due_date: '11/12/2026', labels: [], ...extra });

describe('openTasksByCard', () => {
  it('sorts open tasks due by the end into cards', () => {
    const out = openTasksByCard([
      task('a', { labels: ['Care Plan Review'] }),
      task('b', { name: 'Med Recon review for Jo' }),
      task('c', { status: 'missed' }),
      task('d', { status: 'completed' }),
      task('e', { due_date: '12/30/2026' }),
      task('f', { assigned_to: 'Someone', assigned_to_id: 'u9' }),
      task('g', { due_date: null }),
      task('h', { due_date: '11-14-2026' }),
    ], away, new Date(2026, 10, 20).toISOString());
    expect(out.carePlan.map(t => t.id)).toEqual(['a']);
    expect(out.medRecon.map(t => t.id)).toEqual(['b']);
    expect(out.tasks.map(t => t.id)).toEqual(['c', 'g', 'h']);
  });
});

describe('plans', () => {
  it('sends each appointment to its location\'s covering provider', () => {
    const coverage = [{ userId: 'c1', userName: 'Ann', location: 'North' }, { userId: 'c2', userName: 'Bob', location: 'South' }];
    expect(defaultAppointmentPlan([{ id: 1, location: 'North' }, { id: 2, location: 'South' }, { id: 3, location: 'West' }], coverage))
      .toEqual({ 1: { action: 'reassign', to: 'Ann', toId: 'c1' }, 2: { action: 'reassign', to: 'Bob', toId: 'c2' } });
  });
  it('uses the one covering provider for a location they were not set for', () => {
    expect(defaultAppointmentPlan([{ id: 1, location: 'West' }], [{ userId: 'c1', userName: 'Ann', location: 'North' }]))
      .toEqual({ 1: { action: 'reassign', to: 'Ann', toId: 'c1' } });
  });
  it('counts who gets what', () => {
    const ann = { action: 'reassign', to: 'Ann', toId: 'c1' };
    const plan = { a: ann, b: ann, c: { action: 'reassign', to: 'Bob', toId: 'c2' } };
    expect(planPeople(plan, ['a', 'b', 'c', 'd'])).toEqual([{ id: 'c1', name: 'Ann', count: 2 }, { id: 'c2', name: 'Bob', count: 1 }]);
    expect(taskCountLine([task('a'), task('b'), task('c', { status: 'missed' })])).toBe('2 Pending • 1 Missed');
  });
});

describe('departments', () => {
  it('takes an item\'s own department, else its patient\'s latest appointment location', () => {
    const deptOf = patientDepartments([
      { patient_id: 'p1', patient_name: 'Jo', location: 'North', date: '11-01-2026', time_start: '9:00 am' },
      { patient_id: 'p1', patient_name: 'Jo', location: 'South', date: '11-05-2026', time_start: '9:00 am' },
      { patient_id: 'p2', patient_name: 'Al', location: 'West', date: '11-02-2026', time_start: '9:00 am' },
    ]);
    const out = withDepartments(
      [{ id: 1, patient_id: 'p1' }, { id: 2, member: 'Al' }, { id: 3, location: 'East', patient_id: 'p1' }, { id: 4, member: 'Zed' }],
      deptOf,
      t => ({ id: t.patient_id, name: t.member }),
    );
    expect(out.map(t => t.location)).toEqual(['South', 'West', 'East', 'No Department']);
    expect(byDepartment(out).map(g => g.name)).toEqual(['East', 'South', 'West', 'No Department']);
  });
});
