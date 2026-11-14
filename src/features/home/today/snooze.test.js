import { describe, expect, it } from 'vitest';
import { activeSnooze, addDaysIso, applySnoozes, formatSnoozeDate, snoozeKey } from './snooze';

const row = (id, memberId) => ({ id, memberId });

describe('snooze', () => {
  it('adds days across a month end in local time', () => {
    expect(addDaysIso('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysIso('2026-11-14', 30)).toBe('2026-12-14');
  });

  it('counts a snooze only until its date arrives', () => {
    const item = row('nba-2', 'FH-1');
    const snoozes = { [snoozeKey(item)]: { until: '2026-11-16', reason: 'Waiting on provider' } };
    expect(activeSnooze(snoozes, item, '2026-11-15')).toBeTruthy();
    expect(activeSnooze(snoozes, item, '2026-11-16')).toBeNull();
  });

  it('keys by patient so the same scenario on another patient is not snoozed', () => {
    const snoozes = { [snoozeKey(row('nba-2', 'FH-1'))]: { until: '2026-12-01' } };
    expect(activeSnooze(snoozes, row('nba-2', 'FH-2'), '2026-11-14')).toBeNull();
  });

  it('moves snoozed rows to the end, keeping order, and tags them', () => {
    const rows = [row('a', '1'), row('b', '2'), row('c', '3')];
    const snoozes = { [snoozeKey(rows[0])]: { until: '2026-12-01', reason: 'x' } };
    const out = applySnoozes(rows, snoozes, '2026-11-14');
    expect(out.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(out[2].snooze.reason).toBe('x');
    expect(out[0].snooze).toBeUndefined();
  });

  it('formats the date without a UTC shift', () => {
    expect(formatSnoozeDate('2026-11-17')).toBe('Tue, Nov 17');
  });
});
