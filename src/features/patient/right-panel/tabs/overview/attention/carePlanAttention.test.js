import { describe, expect, it } from 'vitest';
import { carePlanAttention, carePlanByKind } from './carePlanAttention';

const NOW = new Date(2026, 9, 26, 12).getTime();
const DAY = 24 * 3600 * 1000;
const iso = n => new Date(NOW - n * DAY).toISOString();

describe('carePlanAttention', () => {
  it('flags goals that are not met, past target or trending down', () => {
    const goals = [
      { id: 'a', title: 'A', status: 'Not Met', priority: 'low' },
      { id: 'b', title: 'B', status: 'In Progress', targetDate: '2026-10-01', priority: 'medium' },
      { id: 'c', title: 'C', status: 'In Progress', trend: '↓', priority: 'high' },
      { id: 'd', title: 'D', status: 'In Progress', trend: '↑', priority: 'high' },
      { id: 'e', title: 'E', status: 'Met', trend: '↓' },
    ];
    const r = carePlanAttention({ goals, now: NOW });
    expect(r.items.map(i => [i.item.id, i.reason])).toEqual([
      ['b', 'Past target date'],
      ['a', 'Not met'],
      ['c', 'Trending down'],
    ]);
    expect(r).toMatchObject({ attention: 3, open: 4, total: 5 });
  });

  it('flags interventions past due, with low adherence, without an owner or not started', () => {
    const interventions = [
      { id: 'due', title: 'due', status: 'In Progress', config: { dueDateOverride: '2026-10-20' } },
      { id: 'adh', title: 'adh', status: 'In Progress', adherence: 32 },
      { id: 'own', title: 'own', status: 'In Progress', priority: 'high', assignee: { name: 'Unassigned' } },
      { id: 'idle', title: 'Idle', status: 'Not Started', priority: 'high', assignee: { name: 'Ana Ruiz' }, createdAt: iso(20) },
      { id: 'low', title: 'Low', status: 'Not Started', priority: 'low', createdAt: iso(20) },
      { id: 'fresh', title: 'Fresh', status: 'Not Started', priority: 'high', assignee: { name: 'Ana Ruiz' }, createdAt: iso(3) },
      { id: 'done', title: 'done', status: 'Met', config: { dueDateOverride: '2026-10-01' } },
    ];
    const r = carePlanAttention({ interventions, now: NOW });
    expect(Object.fromEntries(r.items.filter(i => i.tone !== 'info').map(i => [i.item.id, i.reason]))).toEqual({
      due: 'Past due', adh: 'Adherence 32%', own: 'No owner', idle: 'Not started',
    });
  });

  it('counts an item planned under several programs once', () => {
    const goals = [{ id: 'a', title: 'Lower A1c', status: 'In Progress' }, { id: 'b', title: 'Lower A1c ', status: 'Not Met' }];
    const r = carePlanAttention({ goals, now: NOW });
    expect(r).toMatchObject({ attention: 1, total: 1 });
    // The copy that needs attention wins over the one that doesn't.
    expect(r.items[0].item.id).toBe('b');
  });

  it('flags barriers on hold and new high-priority ones', () => {
    const barriers = [
      { id: 'hold', title: 'hold', status: 'On Hold' },
      { id: 'new', title: 'new', status: 'Not Started', priority: 'high', createdAt: iso(10) },
      { id: 'old', title: 'old', status: 'Not Started', priority: 'high', createdAt: iso(60) },
    ];
    expect(carePlanAttention({ barriers, now: NOW }).items.map(i => i.item.id)).toEqual(['new', 'hold']);
  });

  it('fills spare slots with recently updated open items, marked as recent', () => {
    const goals = [
      { id: 'flag', title: 'flag', status: 'Not Met' },
      { id: 'recent', title: 'recent', status: 'In Progress', updatedAt: iso(2) },
      { id: 'stale', title: 'stale', status: 'In Progress', updatedAt: iso(40) },
    ];
    const r = carePlanAttention({ goals, now: NOW, limit: 5 });
    expect(r.items.map(i => [i.item.id, i.tone])).toEqual([['flag', 'error'], ['recent', 'info']]);
    expect(r.attention).toBe(1);
  });
});

describe('carePlanByKind', () => {
  const now = new Date('2026-10-26T12:00:00Z').getTime();
  it('splits open items by kind, flagged first, each with a why line', () => {
    const out = carePlanByKind({
      now,
      goals: [
        { id: 'g1', title: 'Steps', status: 'In Progress', priority: 'low' },
        { id: 'g2', title: 'A1c', status: 'Not Met', currentValue: '8.2', targetValue: '7', comparator: '<', category: 'Others', customUnit: '%' },
        { id: 'g3', title: 'Done', status: 'Met' },
      ],
      interventions: [{ id: 'i1', title: 'Call', status: 'Not Started', priority: 'high', assignee: 'Unassigned' }],
      barriers: [],
    });
    expect(out.goal.map(e => e.item.id)).toEqual(['g2', 'g1']);
    expect(out.goal[0].detail).toBe('Not met. Current 8.2 %, target < 7 %.');
    expect(out.goal[1].detail).toBeNull();
    expect(out.intervention[0].detail).toBe('High priority with no one assigned.');
    expect(out.barrier).toEqual([]);
  });
});
