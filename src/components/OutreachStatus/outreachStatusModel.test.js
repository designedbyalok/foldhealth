import { describe, it, expect } from 'vitest';
import { outreachFromCount, outreachFromDots, outreachFromSummary } from './outreachStatusModel';

describe('outreach status adapters', () => {
  it('reads dots: any reach is success, else failed; none used is no outreach', () => {
    expect(outreachFromDots(['success', 'pending', 'pending'], { date: '05/19/2026' })).toMatchObject({ result: 'success', attempts: 1, date: '05/19/2026' });
    expect(outreachFromDots(['failed', 'failed', 'failed'])).toMatchObject({ result: 'failed', attempts: 3 });
    expect(outreachFromDots(['pending', 'pending', 'pending'])).toMatchObject({ result: null });
    expect(outreachFromDots([], { attended: true })).toMatchObject({ result: 'success', attempts: 1 });
  });

  it('reads a count and sub status', () => {
    expect(outreachFromCount(0, 'New')).toMatchObject({ result: null });
    expect(outreachFromCount(2, 'Engaged', '10/14/2026')).toMatchObject({ result: 'success', attempts: 2 });
    expect(outreachFromCount(6, 'Unable to Reach')).toMatchObject({ result: 'failed', attempts: 3 });
    expect(outreachFromCount(1, 'Attempted')).toMatchObject({ result: 'followup', attempts: 1 });
  });

  it('reads an SNP summary', () => {
    expect(outreachFromSummary(null)).toMatchObject({ result: null });
    expect(outreachFromSummary({ kind: 'letter', status: 'Failed', date: '09/03/2025', dots: ['red', 'grey', 'grey'] }))
      .toMatchObject({ type: 'letter', result: 'failed', attempts: 1 });
  });
});
