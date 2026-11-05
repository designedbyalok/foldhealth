import { describe, expect, it } from 'vitest';
import { dataQualityReport, outcomesReport, productivityReport, reportMembers } from './pharmacyReports.js';
import { addDaysMdy, todayMdy } from './pharmacyWorklist.utils.js';

const daysAgo = (n) => addDaysMdy(todayMdy(), -n);
const inDays = (n) => addDaysMdy(todayMdy(), n);
const paid = (n, o = {}) => ({ date: daysAgo(n), daysSupply: 30, claimId: `C${n}`, claimStatus: 'Paid', ...o });
const med = (refills) => ({ id: 'm1', name: 'Metformin', generic: 'metformin', strength: '500', unit: 'MG', status: 'Active', daysSupply: 30, lastFill: refills[0]?.date, refills });
const measure = (code, o = {}) => ({ code, pdc: 85, failDate: inDays(60), nextFillDue: inDays(25), medications: [med([paid(5)])], ...o });
const raw = (id, o = {}) => ({ id, memberId: id, name: `Member ${id}`, healthPlan: 'SCAN Classic', ipa: 'Astrana IPA', callHistory: [], measures: [measure('MAD')], ...o });

describe('productivityReport', () => {
  const members = [
    raw('1', { callHistory: [
      { date: daysAgo(1), by: 'Priya', result: 'success', measures: ['MAD'] },
      { date: daysAgo(2), by: 'Priya', result: 'failed', measures: ['MAD'], locked: true, items: [{ steps: ['a', 'b', 'c'] }, { steps: ['d'] }] },
      { date: daysAgo(40), by: 'Priya', result: 'success', measures: ['MAD'] },
    ] }),
    raw('2', { callHistory: [{ date: daysAgo(3), by: 'Marcus', result: 'failed', measures: ['MAD'] }] }),
  ];

  it('counts outreaches, reach rate, locked actions and steps per coordinator in the period', () => {
    const { rows, totals } = productivityReport(members, 'Last 30 days');
    // A locked verification call reached the pharmacy even when the fill was not picked up.
    expect(rows[0]).toMatchObject({ coordinator: 'Priya', outreaches: 2, reached: 2, locked: 1, steps: 4, members: 1, reachRate: 100 });
    expect(rows[1]).toMatchObject({ coordinator: 'Marcus', outreaches: 1, reachRate: 0 });
    expect(totals).toMatchObject({ outreaches: 3, locked: 1, steps: 4, reachRate: 67 });
  });

  it('narrows to the period', () => {
    expect(productivityReport(members, 'Year to date').totals.outreaches).toBeGreaterThanOrEqual(3);
    expect(productivityReport([raw('3', { callHistory: [{ date: daysAgo(10), by: 'Priya' }] })], 'Last 7 days').rows).toEqual([]);
  });
});

describe('outcomesReport', () => {
  const enriched = reportMembers([
    raw('1', { measures: [measure('MAD'), measure('MAH', { excluded: true })] }),
    raw('2', { ipa: 'Prospect Medical Group', measures: [measure('MAD', { projectedStatus: 'Already adherent' }), measure('MAC', { failDate: daysAgo(1), pdc: 60, medications: [med([])], nextFillDue: daysAgo(20) })] }),
  ]);

  it('counts closed, safe, failed and excluded gaps by measure', () => {
    const { rows, total } = outcomesReport(enriched, 'measure');
    expect(rows.find(r => r.group === 'MAD')).toMatchObject({ gaps: 2, closed: 1, met: 1, closedTotal: 2, closureRate: 100, members: 2 });
    expect(rows.find(r => r.group === 'MAC')).toMatchObject({ failed: 1, closureRate: 0, belowTarget: 1 });
    // Excluded gaps leave the closure rate.
    expect(rows.find(r => r.group === 'MAH')).toMatchObject({ excluded: 1, closureRate: null });
    expect(total).toMatchObject({ gaps: 4, closedTotal: 2, closureRate: 67, members: 2 });
  });

  it('groups by IPA for the provider report', () => {
    expect(outcomesReport(enriched, 'ipa').rows.map(r => [r.group, r.gaps])).toEqual([['Astrana IPA', 2], ['Prospect Medical Group', 2]]);
  });

  it('counts reversals and rework', () => {
    const reversed = reportMembers([raw('3', { measures: [measure('MAD', { nextFillDue: inDays(10), medications: [med([paid(20, { claimId: 'A' }), { date: daysAgo(5), claimId: 'A-R', txnType: 'Reversal', reversesClaimId: 'A' }])] })] })]);
    expect(outcomesReport(reversed).total).toMatchObject({ reversals: 1, rework: 1 });
  });
});

describe('dataQualityReport', () => {
  it('lists non–Part D claims, rows held for review and unmatched claims', () => {
    const enriched = reportMembers([
      raw('1', { measures: [measure('MAD', { medications: [med([paid(5, { coverage: 'Commercial' }), paid(50, { daysSupply: 0 })])] })] }),
      raw('2', { measures: [measure('MAD', { medications: [med([{ date: daysAgo(40), daysSupply: 90, source: 'Entered by hand', manual: true }])] })] }),
    ]);
    const { counts, rows } = dataQualityReport(enriched);
    expect(counts).toEqual({ notMatched: 1, nonPartD: 1, heldForReview: 1 });
    expect(rows.map(r => r.issue)).toEqual(['Non–Part D claim', 'Claim not matched', 'Held for review']);
  });
});

describe('reportMembers', () => {
  it('narrows by health plan, IPA and measure', () => {
    const members = [raw('1'), raw('2', { healthPlan: 'Humana Gold Plus', measures: [measure('MAD'), measure('MAC')] })];
    expect(reportMembers(members, { healthPlans: ['Humana Gold Plus'] }).map(m => m.id)).toEqual(['2']);
    expect(reportMembers(members, { measures: ['MAC'] }).map(m => m.gaps.length)).toEqual([0, 1]);
  });
});
