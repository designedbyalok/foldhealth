import { describe, expect, it } from 'vitest';
import { activityForInstance, gapInstanceNo, tagGapInstance, withStatus } from './gapInstances';

const gaps = [
  { code: 'BCS', status: 'Open' },
  { code: 'BCS', status: 'Closed - Data', supersededAt: '10/20/2026' },
  { code: 'CBP', status: 'Open' },
];

describe('gap instances', () => {
  it('numbers instances oldest first, none for a single instance', () => {
    expect(gapInstanceNo(gaps, gaps[0])).toBe(2);
    expect(gapInstanceNo(gaps, gaps[1])).toBe(1);
    expect(gapInstanceNo(gaps, gaps[2])).toBe(null);
  });
  it('tags an entry with the latest instance of its gap', () => {
    expect(tagGapInstance(gaps, { gapCode: 'BCS' }).instanceNo).toBe(2);
    expect(tagGapInstance(gaps, { gapCode: 'BCS', instanceNo: 1 }).instanceNo).toBe(1);
    expect(tagGapInstance(gaps, { title: 'x' })).toEqual({ title: 'x' });
  });
  it('keeps entries for the instance on screen, plus untagged ones', () => {
    const entries = [
      { id: 1, gapCode: 'BCS', instanceNo: 1 },
      { id: 2, gapCode: 'BCS', instanceNo: 2 },
      { id: 3, gapCode: 'BCS' },
      { id: 4, gapCode: 'CBP' },
      { id: 5 },
    ];
    expect(activityForInstance(entries, 'BCS', 2, 2).map(e => e.id)).toEqual([2, 3, 5]);
    expect(activityForInstance(entries, 'BCS', 1, 2).map(e => e.id)).toEqual([1, 5]);
  });
});

describe('withStatus', () => {
  it('stamps the closed date on close and clears it on reopen', () => {
    const closed = withStatus({ code: 'BCS', status: 'Open' }, 'Completed');
    expect(closed.closedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(withStatus({ ...closed }, 'Closed - Data').closedDate).toBe(closed.closedDate);
    expect(withStatus(closed, 'Open').closedDate).toBeUndefined();
  });
});
