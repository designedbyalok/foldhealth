import { describe, expect, it } from 'vitest';
import { accumulatorSummary, money, serviceDate, short, statusOf } from './claimFormat';

describe('claimFormat', () => {
  it('formats money and short limits', () => {
    expect(money(120)).toBe('$120.00');
    expect(short(3000)).toBe('3K');
    expect(short(12500)).toBe('12.5K');
    expect(short(800)).toBe('800');
  });

  it('reads date-only service dates as local dates', () => {
    expect(serviceDate('2025-06-18')).toBe('Jun 18, 2025');
  });

  it('maps statuses, falling back to pending', () => {
    expect(statusOf('in_review').label).toBe('In Review');
    expect(statusOf('weird').label).toBe('Pending');
  });

  it('explains a coverage row', () => {
    const base = { label: 'Individual Deductible', in_limit: 3000, out_limit: 2000 };
    expect(accumulatorSummary({ ...base, in_spent: 0, out_spent: 0 }).text).toMatch(/No deductions yet/);
    const partial = accumulatorSummary({ ...base, in_spent: 1800, out_spent: 400 });
    expect(partial).toMatchObject({ total: 2200, limit: 5000, met: false });
    expect(partial.text).toMatch(/\$1,200 more in-network or \$1,600 more out-of-network/);
    expect(accumulatorSummary({ ...base, in_spent: 3000, out_spent: 0 }).met).toBe(true);
  });
});
