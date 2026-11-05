import { describe, expect, it } from 'vitest';
import { FILTER_DEF_MAP, MORE_FILTER_ITEMS, PRIMARY_FILTER_KEYS, dynamicFilterOptions, filterValues, memberMatchesFilters } from './pharmacyFilters.js';
import { addDaysMdy, enrichPharmacyMember, todayMdy } from './pharmacyWorklist.utils.js';

const daysAgo = (n) => addDaysMdy(todayMdy(), -n);
const inDays = (n) => addDaysMdy(todayMdy(), n);
const paid = (n, o = {}) => ({ date: daysAgo(n), daysSupply: 30, claimId: `C${n}`, claimStatus: 'Paid', ...o });
const med = (id, generic, refills) => ({ id, name: generic, generic, strength: '10', unit: 'MG', status: 'Active', daysSupply: 30, lastFill: refills[0]?.date, refills });
const measure = (code, o = {}) => ({ code, pdc: 85, failDate: inDays(60), nextFillDue: inDays(20), medications: [med(`${code}-1`, 'metformin', [paid(10)])], ...o });
const member = (o = {}) => enrichPharmacyMember({
  id: '1', memberId: '1', name: 'Ana Ruiz', gender: 'F', age: '72y 3m', healthPlan: 'SCAN Classic', callHistory: [],
  measures: [measure('MAD')], ...o,
});
const matches = (m, filters, ctx) => memberMatchesFilters(m, filters, ctx);

describe('pharmacy filter roster', () => {
  it('gives every filter a definition and a value', () => {
    for (const { k } of MORE_FILTER_ITEMS) {
      expect(FILTER_DEF_MAP[k]?.type, k).toBeTruthy();
      expect(Array.isArray(filterValues(k, member())), k).toBe(true);
    }
  });

  it('keeps the spec top-bar filters primary', () => {
    expect(PRIMARY_FILTER_KEYS).toEqual(['priority', 'gap', 'gapStatus', 'progress', 'daysLeft', 'overdue', 'claimRecon', 'assignee']);
  });
});

describe('memberMatchesFilters', () => {
  it('matches a multi-select on any of the member gaps', () => {
    const m = member({ measures: [measure('MAD'), measure('MAH', { excluded: true })] });
    expect(matches(m, { gapStatus: ['Excluded'] })).toBe(true);
    expect(matches(m, { gapStatus: ['Failed for Year'] })).toBe(false);
  });

  it('matches a range inclusively', () => {
    const m = member();
    expect(matches(m, { pdc: ['80', '85'] })).toBe(true);
    expect(matches(m, { pdc: ['86', '100'] })).toBe(false);
    expect(matches(m, { age: ['70', '75'] })).toBe(true);
  });

  it('matches a date range', () => {
    const m = member();
    expect(matches(m, { nextFillDue: [inDays(10), inDays(30)] })).toBe(true);
    expect(matches(m, { nextFillDue: [inDays(30), inDays(40)] })).toBe(false);
  });

  it('applies every active filter together', () => {
    const m = member();
    expect(matches(m, { sex: ['F'], pdcBelow80: ['Yes'] })).toBe(false);
    expect(matches(m, { sex: ['F'], pdcAtOrBelow90: ['Yes'] })).toBe(true);
  });

  it('flags a drug counted under two gaps', () => {
    const combo = member({ measures: [measure('MAH', { medications: [med('a', 'amlodipine-atorvastatin', [paid(10)])] }), measure('MAC', { medications: [med('b', 'amlodipine-atorvastatin', [paid(10)])] })] });
    expect(matches(combo, { combinationDrug: ['Yes'] })).toBe(true);
    expect(matches(member(), { combinationDrug: ['Yes'] })).toBe(false);
  });

  it('puts the year on a prior-year compliance flag', () => {
    const m = member({ measures: [measure('MAD', { priorYearNonCompliant: true })] });
    expect(filterValues('priorYearResult', m)).toEqual([`${new Date().getFullYear() - 1} · Non-compliant`]);
  });

  it('marks a claim overdue once it waits past the plan feed lag', () => {
    const awaiting = (n) => member({ measures: [measure('MAD', { medications: [med('m', 'metformin', [{ date: daysAgo(n), daysSupply: 30, source: 'Pickup confirmed by call' }])] })] });
    expect(filterValues('overdue', awaiting(3))).not.toContain('Claim overdue');
    expect(filterValues('overdue', awaiting(10))).toContain('Claim overdue');
  });

  it('finds members assigned to the signed-in user', () => {
    const m = member({ assigneeId: 'u1', assigneeName: 'Priya' });
    expect(matches(m, { assignedToMe: ['Yes'] }, { authUserId: 'u1' })).toBe(true);
    expect(matches(m, { assignedToMe: ['Yes'] }, { authUserId: 'u2' })).toBe(false);
  });

  it('keeps unknown or empty filters from hiding anyone', () => {
    expect(matches(member(), { retired: ['x'], pdc: [] })).toBe(true);
  });
});

describe('dynamicFilterOptions', () => {
  it('lists the values on the worklist', () => {
    const opts = dynamicFilterOptions([member(), member({ id: '2', memberId: '2', name: 'Bo Li', healthPlan: 'Humana Gold Plus' })]);
    expect(opts.healthPlan).toEqual(['Humana Gold Plus', 'SCAN Classic']);
    expect(opts.drugClass).toEqual(['Biguanide']);
    expect(opts.member).toEqual(['Ana Ruiz (#1)', 'Bo Li (#2)']);
  });
});
