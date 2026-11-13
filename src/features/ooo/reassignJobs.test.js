import { describe, expect, it } from 'vitest';
import { coveredTasks, workToReturn } from './reassignJobs';

const job = (extra) => ({ type: 'ooo', fromUser: 'Libby Ross', windowEnd: '2026-11-30T00:00:00Z', createdAt: '2026-11-01', results: [], ...extra });

describe('coveredTasks', () => {
  it('maps tasks an Out of Office job moved, while the cover runs', () => {
    const now = new Date('2026-11-12T12:00:00Z');
    const out = coveredTasks([
      job({ results: [
        { kind: 'task', taskId: 't1', outcome: 'reassigned', to: 'Ann', toId: 'a1' },
        { kind: 'task', taskId: 't2', outcome: 'failed', to: 'Ann' },
        { kind: 'program', programId: 'p1', outcome: 'reassigned', to: 'Ann' },
      ] }),
      job({ windowEnd: '2026-11-01T00:00:00Z', results: [{ kind: 'task', taskId: 't3', outcome: 'reassigned', to: 'Bob' }] }),
      job({ type: 'permanent', results: [{ kind: 'task', taskId: 't4', outcome: 'reassigned', to: 'Bob' }] }),
    ], now);
    expect([...out.keys()]).toEqual(['t1']);
    expect(out.get('t1')).toEqual({ fromUser: 'Libby Ross', fromUserId: null, to: 'Ann', toId: 'a1' });
  });
});

describe('workToReturn', () => {
  const jobs = [
    job({ oooRecordId: 'ooo-1', results: [
      { kind: 'task', taskId: 't1', outcome: 'reassigned', to: 'Chris Lee' },
      { kind: 'task', taskId: 't2', outcome: 'reassigned', to: 'Chris Lee' },
      { kind: 'task', taskId: 't3', outcome: 'reassigned', to: 'Chris Lee' },
      { kind: 'task', taskId: 't4', outcome: 'failed', to: 'Chris Lee' },
      { kind: 'program', programId: 'p1', outcome: 'reassigned', to: 'Chris Lee' },
      { kind: 'appointment', appointmentId: 'a1', outcome: 'reassigned', to: 'Chris Lee' },
    ] }),
    job({ oooRecordId: 'ooo-2', results: [{ kind: 'task', taskId: 't5', outcome: 'reassigned', to: 'Chris Lee' }] }),
  ];
  const tasks = [
    { id: 't1', assigned_to: 'Chris Lee', status: 'pending', due_date: '11-18-2026' },
    { id: 't2', assigned_to: 'Dana Park', status: 'pending', due_date: '11-18-2026' }, // moved again by hand
    { id: 't3', assigned_to: 'Chris Lee', status: 'completed', due_date: '11-25-2026' },
    { id: 't4', assigned_to: 'Libby Ross', status: 'pending', due_date: '11-18-2026' },
    { id: 't5', assigned_to: 'Chris Lee', status: 'pending', due_date: '11-18-2026' },
  ];

  it('on delete, returns the record\'s tasks and programs still with the covering provider', () => {
    expect(workToReturn(jobs, { recordId: 'ooo-1', tasks })).toEqual({
      taskIds: ['t1'],
      programs: [{ id: 'p1', to: 'Chris Lee' }],
    });
  });

  it('on shortening, returns only tasks due on the removed dates, and no programs', () => {
    const removed = [{ from: new Date(2026, 10, 20).getTime(), to: new Date(2026, 10, 30).getTime() }];
    const more = [...tasks, { id: 't6', assigned_to: 'Chris Lee', status: 'pending', due_date: '11-21-2026' }];
    const withT6 = [job({ oooRecordId: 'ooo-1', results: [
      { kind: 'task', taskId: 't1', outcome: 'reassigned', to: 'Chris Lee' },
      { kind: 'task', taskId: 't6', outcome: 'reassigned', to: 'Chris Lee' },
      { kind: 'program', programId: 'p1', outcome: 'reassigned', to: 'Chris Lee' },
    ] })];
    expect(workToReturn(withT6, { recordId: 'ooo-1', tasks: more, ranges: removed })).toEqual({ taskIds: ['t6'], programs: [] });
  });

  it('returns nothing without a record id', () => {
    expect(workToReturn(jobs, { recordId: null, tasks })).toEqual({ taskIds: [], programs: [] });
  });
});
