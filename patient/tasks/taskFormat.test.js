import { describe, expect, it } from 'vitest';
import { addDays, dayKey, sentLabel } from './taskFormat';

describe('taskFormat', () => {
  it('keys the local day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('adds days across a month end', () => {
    expect(dayKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });

  it('labels how long ago a form was sent', () => {
    const now = new Date(2026, 9, 28, 9);
    expect(sentLabel(new Date(2026, 9, 28, 1).toISOString(), now)).toBe('Sent today');
    expect(sentLabel(new Date(2026, 9, 27, 22).toISOString(), now)).toBe('Sent yesterday');
    expect(sentLabel(new Date(2026, 9, 25, 12).toISOString(), now)).toBe('Sent 3 days ago');
  });
});
