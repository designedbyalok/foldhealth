import { describe, expect, it } from 'vitest';
import { awaitingReply, waitLabel } from './awaitingReply';

const NOW = new Date('2026-10-23T12:00:00Z').getTime();
const ago = h => new Date(NOW - h * 3600 * 1000).toISOString();

describe('waitLabel', () => {
  it('reads minutes, hours, then days, and warns past a day', () => {
    expect(waitLabel(ago(0.25), NOW)).toEqual({ label: '15m', tone: 'default' });
    expect(waitLabel(ago(5), NOW)).toEqual({ label: '5h', tone: 'default' });
    expect(waitLabel(ago(30), NOW)).toEqual({ label: '1d', tone: 'warning' });
    expect(waitLabel(ago(72), NOW)).toEqual({ label: '3d', tone: 'error' });
  });
});

describe('awaitingReply', () => {
  it('keeps unread, unarchived threads, longest wait first', () => {
    const list = awaitingReply([
      { id: 'a', unread_count: 2, last_message_at: ago(2) },
      { id: 'b', unread_count: 0, last_message_at: ago(50) },
      { id: 'c', unread_count: 1, last_message_at: ago(30) },
      { id: 'd', unread_count: 3, archived: true, last_message_at: ago(80) },
    ]);
    expect(list.map(c => c.id)).toEqual(['c', 'a']);
  });
});
