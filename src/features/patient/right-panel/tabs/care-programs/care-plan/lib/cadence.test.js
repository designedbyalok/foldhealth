import { describe, it, expect } from 'vitest';
import {
  addInterval, defaultCadence, dischargeDates, formatInterval, nextReviewDue,
  resolveCadence, reviewStatus, withCadenceDefaults,
} from './cadence';

const day = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

describe('cadence defaults', () => {
  it('HICM weekly, CCM monthly, SNP quarterly', () => {
    expect(formatInterval(defaultCadence('HICM'))).toBe('Weekly');
    expect(formatInterval(defaultCadence('CCM'))).toBe('Monthly');
    expect(formatInterval(defaultCadence('SNP'))).toBe('Quarterly');
  });

  it('fills a partial saved row from the defaults', () => {
    const c = withCadenceDefaults('SNP', { every: 2 });
    expect(c.every).toBe(2);
    expect(c.unit).toBe('month');
    expect(c.postDischarge.days).toBe(30);
  });
});

describe('resolveCadence', () => {
  const snp = defaultCadence('SNP');
  const today = day('2026-11-02');

  it('uses the program default with no acuity rule', () => {
    const r = resolveCadence({ config: snp, acuity: 'Low', today });
    expect(r).toMatchObject({ source: 'program', label: 'Quarterly' });
  });

  it('uses the acuity rule, reading Very High as High', () => {
    const r = resolveCadence({ config: snp, acuity: 'Very High', today });
    expect(r).toMatchObject({ source: 'acuity', label: 'Monthly', sourceLabel: 'High acuity' });
  });

  it('a patient override beats the acuity rule', () => {
    const r = resolveCadence({ config: snp, acuity: 'High', override: { every: 2, unit: 'week' }, today });
    expect(r).toMatchObject({ source: 'override', label: 'Every 2 weeks' });
  });

  it('spikes to weekly for 30 days after a discharge, then reverts', () => {
    const discharges = [day('2026-10-20')];
    expect(resolveCadence({ config: snp, discharges, today })).toMatchObject({ source: 'post_discharge', label: 'Weekly' });
    expect(resolveCadence({ config: snp, discharges, today: day('2026-11-19') }).source).toBe('program');
  });

  it('keeps a tighter override during the spike', () => {
    const r = resolveCadence({ config: snp, override: { every: 3, unit: 'day' }, discharges: [day('2026-10-20')], today });
    expect(r.source).toBe('override');
  });

  it('ignores the spike when switched off', () => {
    const config = { ...snp, postDischarge: { ...snp.postDischarge, enabled: false } };
    expect(resolveCadence({ config, discharges: [day('2026-10-20')], today }).source).toBe('program');
  });
});

describe('due dates and overdue', () => {
  it('adds months keeping month end', () => {
    expect(addInterval(day('2026-01-31'), { every: 1, unit: 'month' })).toEqual(day('2026-02-28'));
  });

  it('is due one interval after the last review', () => {
    const cadence = resolveCadence({ config: defaultCadence('CCM'), today: day('2026-11-02') });
    expect(nextReviewDue({ cadence, lastTouch: '2026-10-05' })).toEqual(day('2026-11-05'));
  });

  it('counts the discharge as the touch during a spike', () => {
    const cadence = resolveCadence({ config: defaultCadence('SNP'), discharges: [day('2026-10-20')], today: day('2026-11-02') });
    expect(nextReviewDue({ cadence, lastTouch: '2026-05-01' })).toEqual(day('2026-10-27'));
  });

  it('flags overdue only N days after the due date', () => {
    const due = day('2026-10-27');
    expect(reviewStatus({ due, overdueAfterDays: 7, today: day('2026-10-20') }).state).toBe('upcoming');
    expect(reviewStatus({ due, overdueAfterDays: 7, today: day('2026-11-01') }).state).toBe('due');
    expect(reviewStatus({ due, overdueAfterDays: 7, today: day('2026-11-03') })).toEqual({ state: 'overdue', daysOverdue: 7 });
  });

  it('reads discharges from ADT events', () => {
    const events = [
      { event_type: 'adt', end_date: '2026-10-20', raw_meta: { action: 'discharge' } },
      { event_type: 'adt', effective_date: '2026-10-15', raw_meta: { action: 'admit' } },
      { event_type: 'lab', effective_date: '2026-10-01' },
    ];
    expect(dischargeDates(events)).toEqual([day('2026-10-20')]);
  });
});
