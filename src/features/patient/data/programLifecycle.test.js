import { describe, expect, it } from 'vitest';
import { instanceLabel, nextEnrollment, plannedEndDate, previousInstances } from './programLifecycle';

const ccm1 = { id: 'a', code: 'CCM', instance: 1, status: 'Completed' };
const ccm2 = { id: 'b', code: 'CCM', instance: 2, status: 'Active' };
const dm = { id: 'c', code: 'DM', instance: 1, status: 'New' };

describe('nextEnrollment', () => {
  it('blocks a second open instance and allows one after the last ended', () => {
    expect(nextEnrollment([ccm1, ccm2], 'CCM')).toMatchObject({ allowed: false, instance: 3 });
    expect(nextEnrollment([ccm1], 'CCM')).toEqual({ allowed: true, instance: 2, reEnrolled: true });
    expect(nextEnrollment([dm], 'CCM')).toEqual({ allowed: true, instance: 1, reEnrolled: false });
  });

  it('lets SNP add a trigger while one is open, and scopes CMP by sub-program', () => {
    const snp = { id: 's', code: 'SNP', status: 'Engaged' };
    expect(nextEnrollment([snp], 'SNP', null, { triggerable: true })).toMatchObject({ allowed: true, instance: 2, reEnrolled: false });
    const spd = { id: 'm', code: 'CMP', subProgram: 'SPD', status: 'Active' };
    expect(nextEnrollment([spd], 'CMP', 'Maternity Program').allowed).toBe(true);
    expect(nextEnrollment([spd], 'CMP', 'SPD').allowed).toBe(false);
  });
});

describe('plannedEndDate', () => {
  it('adds the configured duration, or gives null without one', () => {
    expect(plannedEndDate('07/28/2026', 90)).toBe('10/26/2026');
    expect(plannedEndDate('12/15/2026', 30)).toBe('01/14/2027');
    expect(plannedEndDate('07/28/2026', null)).toBeNull();
    expect(plannedEndDate('-', 90)).toBeNull();
  });
});

describe('instances', () => {
  it('numbers a program only when it has more than one instance', () => {
    expect(instanceLabel(ccm2, [ccm1, ccm2, dm])).toBe('CCM #2');
    expect(instanceLabel(dm, [ccm1, ccm2, dm])).toBe('DM');
  });

  it('lists the earlier instances, newest first', () => {
    const ccm0 = { id: 'z', code: 'CCM', instance: 0, status: 'Closed' };
    expect(previousInstances(ccm2, [ccm0, ccm1, ccm2, dm]).map(p => p.id)).toEqual(['a', 'z']);
  });
});
