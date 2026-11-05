import { describe, expect, it } from 'vitest';
import { CMP_FILTER_DEFS, cmpFilterOptions, cmpFilterValues, enrollmentMatches } from './cmpFilters';
import { CMP_MEMBERS } from './data/mock';

const mdyIn = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};
const enrollment = (o = {}) => ({
  id: 'e1', memberId: 'M-1', name: 'Ana Ruiz', g: 'F', language: 'es', dob: '06/12/1954', age: '72y',
  subProgram: 'SPD', progSubStatus: 'Engaged', assignee: 'C. Adams', outreach: 2, lastOutreach: '10/14/2026',
  nextActionDue: mdyIn(3), programStartDate: '03/02/2026', programDueDate: '03/02/2027',
  coordinator: 'G. Evans', nurseHealthCoach: null, ri: 'High', lastAdmission: '06/03/2026', caseAcuity: 'High',
  riskTier: '1_High Risk', tags: ['1_High Risk', 'CHF'], task: 2, ...o,
});

describe('CMP filter roster', () => {
  it('gives every filter options or a date picker, and a value on every enrollment', () => {
    const opts = cmpFilterOptions(CMP_MEMBERS);
    for (const def of CMP_FILTER_DEFS) {
      if (def.type === 'date' || def.type === 'dob') continue;
      expect(opts[def.key]?.length, def.key).toBeGreaterThan(0);
    }
  });

  it('every option built from the data matches at least one enrollment', () => {
    const opts = cmpFilterOptions(CMP_MEMBERS);
    for (const def of CMP_FILTER_DEFS.filter(d => !d.opts && !d.type)) {
      for (const o of opts[def.key]) {
        expect(CMP_MEMBERS.some(e => enrollmentMatches(e, { [def.key]: [o] })), `${def.key}: ${o}`).toBe(true);
      }
    }
  });
});

describe('enrollmentMatches', () => {
  it('matches program, care team and clinical picks', () => {
    const e = enrollment();
    expect(enrollmentMatches(e, { subProgram: ['SPD'], coordinator: ['G. Evans'], caseAcuity: ['High'] })).toBe(true);
    expect(enrollmentMatches(e, { nurseHealthCoach: ['Unassigned'] })).toBe(true);
    expect(enrollmentMatches(e, { coordinator: ['C. Adams'] })).toBe(false);
  });

  it('buckets Next Action Due and reads outreach like the Outreach column', () => {
    expect(cmpFilterValues('nextActionDue', enrollment({ nextActionDue: mdyIn(-2) }))).toEqual(['Overdue']);
    expect(cmpFilterValues('nextActionDue', enrollment())).toEqual(['Due in 7 days']);
    expect(cmpFilterValues('nextActionDue', enrollment({ nextActionDue: null }))).toEqual(['No date']);
    expect(cmpFilterValues('outreach', enrollment())).toEqual(['Attended']);
    expect(cmpFilterValues('outreach', enrollment({ outreach: 0 }))).toEqual(['No outreach']);
  });

  it('matches any tag, and date ranges inclusively', () => {
    const e = enrollment();
    expect(enrollmentMatches(e, { tags: ['CHF'] })).toBe(true);
    expect(enrollmentMatches(e, { lastAdmission: ['2026-06-03', '2026-06-03'] })).toBe(true);
    expect(enrollmentMatches(e, { programDueDate: ['2026-01-01', '2026-12-31'] })).toBe(false);
  });

  it('ignores empty and unknown filters', () => {
    expect(enrollmentMatches(enrollment(), { tags: [], nope: ['x'] })).toBe(true);
  });
});
