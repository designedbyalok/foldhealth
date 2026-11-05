import { describe, expect, it } from 'vitest';
import { dayLabel, groupByDay } from './notificationFormat';

const NOW = new Date(2026, 9, 28, 15, 0);
const at = (d, h = 9) => new Date(2026, 9, d, h).toISOString();

describe('dayLabel', () => {
  it('names today and yesterday, dates otherwise', () => {
    expect(dayLabel(at(28), NOW)).toBe('Today');
    expect(dayLabel(at(27), NOW)).toBe('Yesterday');
    expect(dayLabel(at(20), NOW)).toBe('Tue, Oct 20');
  });
});

describe('groupByDay', () => {
  it('groups newest first', () => {
    const groups = groupByDay([
      { id: 'a', at: at(27, 21) },
      { id: 'b', at: at(28, 9) },
      { id: 'c', at: at(28, 14) },
    ], NOW);
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['c', 'b']);
  });
});
