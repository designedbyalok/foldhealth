import { describe, expect, it } from 'vitest';
import {
  accessScope, canCoSign, canEditProgram, canOverride, canViewProgram, isPracticeAdmin,
  needsCoSign, notificationInScope, patientInScope, validateOverride,
} from './programAccess';

const m = (userId, programCode, accessLevel, extra = {}) => ({ userId, programCode, accessLevel, active: true, ...extra });
const memberships = [
  m('u1', 'CCM', 'member', { careTeamRole: 'Care Manager' }),
  m('u1', 'BHI', 'member', { careTeamRole: 'Care Manager' }),
  m('u1', 'TCM', 'viewer'),
  m('u1', 'RPM', 'supervisor', { active: false }),
  m('u2', 'BHI', 'member', { careTeamRole: 'Physician/PCP' }),
  m('u3', 'CCM', 'supervisor'),
];

describe('isPracticeAdmin', () => {
  it('matches the database predicate', () => {
    expect(isPracticeAdmin({ admin_role: 'Business/Practice Owner' })).toBe(true);
    expect(isPracticeAdmin({ clinical_roles: ['Nurse', 'Admin/Practice Manager'] })).toBe(true);
    expect(isPracticeAdmin({ admin_role: 'Employer', clinical_roles: ['Nurse'] })).toBe(false);
    expect(isPracticeAdmin(null)).toBe(false);
  });
});

describe('accessScope', () => {
  it('keeps unassigned users and admins unscoped', () => {
    expect(accessScope(memberships, 'nobody', {}).scoped).toBe(false);
    expect(accessScope(memberships, 'u1', { admin_role: 'Admin/Practice Manager' })).toMatchObject({ scoped: false, admin: true });
  });

  it('lists active programs only, at their access level', () => {
    const scope = accessScope(memberships, 'u1', {});
    expect(scope).toMatchObject({ scoped: true, levels: { CCM: 'member', BHI: 'member', TCM: 'viewer' } });
    expect(scope.levels.RPM).toBeUndefined();
  });

  it('keeps the higher level when a program appears twice', () => {
    const dup = [m('u4', 'CCM', 'viewer'), m('u4', 'CCM', 'supervisor')];
    expect(accessScope(dup, 'u4', {}).levels.CCM).toBe('supervisor');
  });
});

describe('view, edit and override', () => {
  const u1 = accessScope(memberships, 'u1', {});
  const u3 = accessScope(memberships, 'u3', {});

  it('lets members edit, viewers only view, and outsiders do neither', () => {
    expect([canViewProgram(u1, 'CCM'), canEditProgram(u1, 'CCM')]).toEqual([true, true]);
    expect([canViewProgram(u1, 'TCM'), canEditProgram(u1, 'TCM')]).toEqual([true, false]);
    expect([canViewProgram(u1, 'AWV'), canEditProgram(u1, 'AWV')]).toEqual([false, false]);
  });

  it('lets anyone unscoped do everything', () => {
    const open = accessScope(memberships, 'nobody', {});
    expect([canViewProgram(open, 'AWV'), canEditProgram(open, 'AWV')]).toEqual([true, true]);
  });

  it('allows overrides for supervisors and admins only', () => {
    expect(canOverride(u3, 'CCM')).toBe(true);
    expect(canOverride(u1, 'CCM')).toBe(false);
    expect(canOverride(accessScope([], 'a', { admin_role: 'Business/Practice Owner' }), 'AWV')).toBe(true);
  });
});

describe('scoped lists and notifications', () => {
  const u1 = accessScope(memberships, 'u1', {});

  it('shows a patient enrolled in any of the user\'s programs', () => {
    expect(patientInScope(u1, ['AWV', 'TCM'])).toBe(true);
    expect(patientInScope(u1, ['AWV'])).toBe(false);
    expect(patientInScope(u1, [])).toBe(false);
    expect(patientInScope(accessScope([], 'x', {}), [])).toBe(true);
  });

  it('lets program-less notifications through', () => {
    expect(notificationInScope(u1, null)).toBe(true);
    expect(notificationInScope(u1, 'AWV')).toBe(false);
  });
});

describe('BHI co-sign', () => {
  it('needs a Physician/PCP or BHI supervisor to co-sign a care manager', () => {
    const cm = accessScope(memberships, 'u1', {});
    const pcp = accessScope(memberships, 'u2', {});
    expect(needsCoSign('BHI', cm)).toBe(true);
    expect(canCoSign('BHI', cm)).toBe(false);
    expect(canCoSign('BHI', pcp)).toBe(true);
    expect(needsCoSign('BHI', pcp)).toBe(false);
    expect(needsCoSign('CCM', cm)).toBe(false);
  });
});

describe('validateOverride', () => {
  it('needs a program and a real reason', () => {
    expect(validateOverride({ reason: 'covering', programCode: 'CCM' })).toBe('Give a reason of at least 10 characters');
    expect(validateOverride({ reason: 'Covering for Dana while she is out', programCode: 'CCM' })).toBeNull();
    expect(validateOverride({ reason: 'Covering for Dana while she is out' })).toBe('Pick the program');
  });
});
