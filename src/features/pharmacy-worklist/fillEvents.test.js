import { describe, it, expect } from 'vitest';
import { applyPickup, applyRecentFill, fillsToStayCompliant, projectedFailDate, projectedPdc, recomputeMeasure, setsRecentFill, withManualRecentFill } from './fillEvents';

// Claims 08/01 and 09/01, 30 days each (measure year 2026).
const claims = [{ date: '09/01/2026', daysSupply: 30 }, { date: '08/01/2026', daysSupply: 30 }];
const med = (o = {}) => ({
  id: 'm1', name: 'Metformin', status: 'Active', daysSupply: 30, lastFill: '09/01/2026', nextFill: '10/01/2026',
  refills: claims, ...o,
});
const gap = (o = {}) => ({ code: 'MAD', pdc: 70, failDate: '12/15/2026', nextFillDue: '10/01/2026', medications: [med()], ...o });
const member = (x) => ({ measures: [x] });
const PICKUP = 'Pharmacy · Confirmed medication pickup date';
const APPROVAL = 'Pharmacy · Refill approval received';

describe('Recent Fill outcomes', () => {
  it('fires on a confirmed pickup, with or without the stakeholder prefix; a refill approval sets no fill', () => {
    expect(setsRecentFill(PICKUP)).toBe(true);
    expect(setsRecentFill('Confirmed medication pickup')).toBe(true);
    expect(setsRecentFill(APPROVAL)).toBe(false);
    expect(setsRecentFill('Pharmacy · Pending: Refill approval')).toBe(false);
    expect(setsRecentFill('UTC')).toBe(false);
  });

  it('keeps Last Fill as the claims date and moves Next Fill from the recent fill', () => {
    const [x] = applyRecentFill(member(gap()), ['MAD'], '10/22/2026', APPROVAL);
    expect(x.medications[0]).toMatchObject({ lastFill: '09/01/2026', recentFill: '10/22/2026', nextFill: '11/21/2026' });
    expect(x.medications[0].recentFillSource).toMatchObject({ outcome: APPROVAL, manual: false });
    expect(x.nextFillDue).toBe('11/21/2026');
  });
});

describe('newer-date guard', () => {
  const later = withManualRecentFill(gap(), 'm1', '11/15/2026');

  it('an older pickup, then the recent-fill step, leaves a newer Recent Fill in place', () => {
    // logPharmacyOutreach runs applyPickup, then applyRecentFill, for a pickup outcome.
    const { measures } = applyPickup(member(later), ['MAD'], '10/22/2026', 'Pickup confirmed by call');
    const [x] = applyRecentFill({ measures }, ['MAD'], '10/22/2026', PICKUP);
    expect(x.medications[0].recentFill).toBe('11/15/2026');
    expect(x.medications[0].nextFill).toBe('12/15/2026');
  });

  it('an older refill approval does not overwrite it either', () => {
    const [x] = applyRecentFill(member(later), ['MAD'], '10/22/2026', APPROVAL);
    expect(x.medications[0].recentFill).toBe('11/15/2026');
  });

  it('a hand-entered date may still be earlier', () => {
    const x = withManualRecentFill(later, 'm1', '10/05/2026');
    expect(x.medications[0]).toMatchObject({ recentFill: '10/05/2026', recentFillSource: { manual: true } });
  });
});

describe('projected PDC', () => {
  it('claims only: 60 of 153 days', () => {
    expect(projectedPdc(gap())).toBe(39);
  });

  it('a confirmed fill on the same day as a claim is the same fill, not a second supply', () => {
    const x = withManualRecentFill(gap(), 'm1', '09/01/2026');
    expect(x.pdcProjected).toBe(39);
    expect(x.medications[0].nextFill).toBe('10/01/2026');
  });

  it('every confirmed pickup counts, not just the latest', () => {
    let { measures } = applyPickup(member(gap()), ['MAD'], '09/15/2026', 'Pickup confirmed by call');
    ({ measures } = applyPickup({ measures }, ['MAD'], '10/20/2026', 'Pickup confirmed by call'));
    // Covered: Aug 1–30, Sep 1–30, then the pickups shifted to Oct 1–30 and
    // Oct 31–Nov 29: 120 of 153 days.
    expect(measures[0].pdcProjected).toBe(78);
    expect(measures[0].medications[0].recentFill).toBe('10/20/2026');
  });

  it('a refill approval is kept in the history and counted', () => {
    const [x] = applyRecentFill(member(gap()), ['MAD'], '10/22/2026', APPROVAL);
    expect(x.medications[0].refills[0]).toMatchObject({ date: '10/22/2026', source: APPROVAL });
    expect(x.pdcProjected).toBeGreaterThan(39);
  });

  it('next fill and PDC use the same shifted schedule', () => {
    // Recent fill 09/10 starts when the 09/01 supply runs out (10/01).
    const x = withManualRecentFill(gap(), 'm1', '09/10/2026');
    expect(x.medications[0].nextFill).toBe('10/31/2026');
    expect(x.nextFillDue).toBe('10/31/2026');
  });

  it('drops back to the plan PDC when the confirmed fill is removed', () => {
    const x = withManualRecentFill(withManualRecentFill(gap(), 'm1', '10/22/2026'), 'm1', null);
    expect(x.pdcProjected).toBeNull();
    expect(x.medications[0].nextFill).toBe('10/01/2026');
  });
});

describe('discontinued drugs', () => {
  it('leave Next Fill Due once recomputed, but their dispensed days still count', () => {
    const b = med({ id: 'm2', name: 'Glipizide', lastFill: '10/10/2026', nextFill: '11/09/2026', refills: [{ date: '10/10/2026', daysSupply: 30 }] });
    const x = withManualRecentFill(gap({ medications: [med(), b] }), 'm1', '10/05/2026');
    // m1's 10/05 fill starts after its 09/01 supply ends, so no shift: 11/04.
    expect(x.nextFillDue).toBe('11/04/2026');
    const dc = recomputeMeasure({ ...x, medications: x.medications.map(d => (d.id === 'm1' ? { ...d, status: 'Discontinued' } : d)) });
    expect(dc.nextFillDue).toBe('11/09/2026');
    expect(projectedPdc(dc)).toBeGreaterThanOrEqual(39);
  });
});

describe('claim reversals in PDC', () => {
  const withRefills = (refills) => gap({ medications: [med({ refills })] });

  it('drops a reversed claim, and a claim voided by a negative-value reversal', () => {
    const base = projectedPdc(withRefills([{ date: '08/01/2026', daysSupply: 30, claimId: 'A' }]));
    expect(projectedPdc(withRefills([
      { date: '09/01/2026', daysSupply: 30, claimId: 'B', claimStatus: 'Reversed' },
      { date: '08/01/2026', daysSupply: 30, claimId: 'A' },
    ]))).toBe(base);
    expect(projectedPdc(withRefills([
      { date: '09/03/2026', qty: -30, daysSupply: -30, claimId: 'B-R', reversesClaimId: 'B' },
      { date: '09/01/2026', daysSupply: 30, claimId: 'B' },
      { date: '08/01/2026', daysSupply: 30, claimId: 'A' },
    ]))).toBe(base);
  });

  it('counts a resubmitted claim once, and never a non-Part D claim', () => {
    const once = projectedPdc(withRefills([{ date: '09/01/2026', daysSupply: 30, claimId: 'B' }]));
    expect(projectedPdc(withRefills([
      { date: '09/01/2026', daysSupply: 30, claimId: 'B-2', claimGroup: 'B', claimSeq: 2 },
      { date: '09/01/2026', daysSupply: 30, claimId: 'B', claimSeq: 1 },
    ]))).toBe(once);
    expect(projectedPdc(withRefills([{ date: '09/01/2026', daysSupply: 30, coverage: 'Commercial' }]))).toBeNull();
  });
});

describe('projected fail date and fills remaining', () => {
  it('moves the fail date later and needs fewer fills after a manual fill', () => {
    const x = gap();
    const after = withManualRecentFill(x, 'm1', '10/01/2026');
    const t = (mdy) => Date.parse(`${mdy.slice(6)}-${mdy.slice(0, 2)}-${mdy.slice(3, 5)}`);
    expect(after.failDateProjected).toBe(projectedFailDate(after));
    expect(t(after.failDateProjected) - t(projectedFailDate(x))).toBe(30 * 86_400_000);
    expect(fillsToStayCompliant(after)).toBe(fillsToStayCompliant(x) - 1);
  });

  it('has no fail date once the fills on record reach 80% for the year', () => {
    const fills = Array.from({ length: 12 }, (_, i) => ({ date: `${String(i + 1).padStart(2, '0')}/01/2026`, daysSupply: 31 }));
    const x = gap({ medications: [med({ refills: fills })] });
    expect(projectedFailDate(x)).toBeNull();
    expect(fillsToStayCompliant(x)).toBe(0);
  });
});
