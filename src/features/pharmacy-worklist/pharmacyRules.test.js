import { describe, expect, it } from 'vitest';
import { escalation, inOutreachQueue } from './pharmacyRules.js';
import { addDaysMdy, enrichPharmacyMember, todayMdy } from './pharmacyWorklist.utils.js';

const daysAgo = (n) => addDaysMdy(todayMdy(), -n);
const inDays = (n) => addDaysMdy(todayMdy(), n);
const paid = (n) => ({ date: daysAgo(n), daysSupply: 30, claimId: `C${n}`, claimStatus: 'Paid' });
const measure = (o = {}) => ({
  code: 'MAD', pdc: 75, failDate: inDays(60), nextFillDue: inDays(5),
  medications: [{ id: 'm1', name: 'Metformin', generic: 'metformin', strength: '500', unit: 'MG', status: 'Active', daysSupply: 30, lastFill: daysAgo(25), refills: [paid(25)], prescriber: { name: 'Dr. Lee', phone: '555-0100' } }],
  ...o,
});
const member = (o = {}) => enrichPharmacyMember({ id: '1', memberId: '1', name: 'Ana', callHistory: [], measures: [measure()], ...o });
const call = (n, o = {}) => ({ date: daysAgo(n), measures: ['MAD'], contact: 'Member', result: 'failed', ...o });

describe('inOutreachQueue', () => {
  it('queues an open gap whose fill or fail date is within 14 days', () => {
    expect(inOutreachQueue(member().gaps[0])).toBe(true);
    const noClaim = (o) => measure({ ...o, medications: [{ ...measure().medications[0], refills: [] }] });
    expect(inOutreachQueue(member({ measures: [noClaim({ nextFillDue: inDays(30) })] }).gaps[0])).toBe(false);
    expect(inOutreachQueue(member({ measures: [noClaim({ nextFillDue: inDays(30), failDate: inDays(10) })] }).gaps[0])).toBe(true);
    // A claim covering this cycle closes the gap: nothing to work.
    expect(inOutreachQueue(member({ measures: [measure({ nextFillDue: inDays(30), failDate: inDays(10) })] }).gaps[0])).toBe(false);
  });
});

describe('escalation', () => {
  it('escalates a borderline PDC after two failed attempts', () => {
    const m = member({ callHistory: [call(1), call(3)] });
    expect(escalation(m.gaps[0], m)).toMatchObject({ attempts: 2, prescriber: { name: 'Dr. Lee' } });
    const one = member({ callHistory: [call(1)] });
    expect(escalation(one.gaps[0], one)).toBeNull();
  });

  it('waits for a third attempt when PDC is comfortable', () => {
    const two = member({ measures: [measure({ pdc: 89 })], callHistory: [call(1), call(3)] });
    expect(escalation(two.gaps[0], two)).toBeNull();
    const three = member({ measures: [measure({ pdc: 89 })], callHistory: [call(1), call(3), call(5)] });
    expect(escalation(three.gaps[0], three)).toMatchObject({ attempts: 3 });
  });

  it('does not count pharmacy calls as attempts to reach the member', () => {
    const m = member({ callHistory: [
      call(1, { contact: 'Pharmacy', kind: 'pharmacy-verification', locked: true }),
      call(2, { contact: 'CVS Pharmacy' }),
      call(3),
    ] });
    expect(escalation(m.gaps[0], m)).toBeNull();
  });

  it('counts only failures since the last success, and stops once the prescriber was called', () => {
    const reached = member({ callHistory: [call(1), call(2, { result: 'success' }), call(3), call(4)] });
    expect(escalation(reached.gaps[0], reached)).toBeNull();
    const escalated = member({ callHistory: [call(1, { contact: 'Prescriber' }), call(2), call(3)] });
    expect(escalation(escalated.gaps[0], escalated)).toBeNull();
  });
});
