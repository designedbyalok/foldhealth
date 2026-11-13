import { describe, expect, it } from 'vitest';
import { coveredTasks } from './reassignJobs';

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
