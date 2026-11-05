import { describe, expect, it } from 'vitest';
import { bubbleTime, filterConversations, initialsFrom, listTime } from './messageFormat';

const NOW = new Date(2026, 9, 28, 15, 0);

describe('listTime', () => {
  it('shows the time today, then Yesterday, weekday, date', () => {
    expect(listTime(new Date(2026, 9, 28, 9, 5).toISOString(), NOW)).toBe('9:05 AM');
    expect(listTime(new Date(2026, 9, 27, 9, 5).toISOString(), NOW)).toBe('Yesterday');
    expect(listTime(new Date(2026, 9, 24, 9, 5).toISOString(), NOW)).toBe('Sat');
    expect(listTime(new Date(2026, 8, 2, 9, 5).toISOString(), NOW)).toBe('Sep 2');
  });
});

describe('bubbleTime', () => {
  it('prefixes the day', () => {
    expect(bubbleTime(new Date(2026, 9, 28, 21, 28).toISOString(), NOW)).toBe('Today, 9:28 PM');
    expect(bubbleTime(new Date(2026, 9, 27, 21, 28).toISOString(), NOW)).toBe('Yesterday, 9:28 PM');
    expect(bubbleTime(new Date(2026, 9, 2, 21, 28).toISOString(), NOW)).toBe('Oct 2, 9:28 PM');
  });
});

describe('initialsFrom', () => {
  it('skips titles', () => {
    expect(initialsFrom('Dr. Mehta')).toBe('M');
    expect(initialsFrom('Sarah Kim')).toBe('SK');
    expect(initialsFrom('')).toBe('?');
  });
});

describe('filterConversations', () => {
  const list = [
    { id: 1, title: 'Care for Andrew Lewis', member_names: ['Sarah Kim'] },
    { id: 2, title: 'Billing', member_names: ['Aldo Richman'] },
  ];
  it('matches title or member names, case-insensitively', () => {
    expect(filterConversations(list, 'sarah').map((c) => c.id)).toEqual([1]);
    expect(filterConversations(list, 'BILL').map((c) => c.id)).toEqual([2]);
    expect(filterConversations(list, '')).toHaveLength(2);
  });
});
