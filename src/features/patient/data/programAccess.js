// Program access (Phase 2B): which programs a user works in and what they
// can do there. Pure; callers pass program_memberships rows (mapped) and the
// user's profile. Enforced in the app for now: reads in the database stay
// "signed-in only" (supabase/RLS_POSTURE.md).

export const ACCESS_LEVELS = [
  { value: 'viewer', label: 'Viewer', hint: 'Sees the program, changes nothing.' },
  { value: 'member', label: 'Member', hint: 'Works the program: logs time, edits care plans and steps.' },
  { value: 'supervisor', label: 'Supervisor', hint: 'Member, plus overrides with a reason and co-signs.' },
];

const RANK = { viewer: 1, member: 2, supervisor: 3 };

// Same predicate as is_profile_admin() and the program_memberships write
// policy, so the app and the database agree on who's an admin.
export function isPracticeAdmin(profile) {
  if (!profile) return false;
  const adminRole = profile.admin_role ?? profile.adminRole;
  const clinical = profile.clinical_roles ?? profile.clinicalRoles ?? [];
  return adminRole === 'Admin/Practice Manager'
    || adminRole === 'Business/Practice Owner'
    || (Array.isArray(clinical) && clinical.includes('Admin/Practice Manager'));
}

/**
 * The user's access, by program code. `scoped` is false for admins and for
 * users with no memberships yet (unassigned users keep seeing everything
 * until someone assigns them), so rolling this out changes nothing on day one.
 */
export function accessScope(memberships, userId, profile) {
  const mine = (memberships || []).filter(m => m.userId === userId && m.active !== false);
  const levels = {};
  for (const m of mine) {
    if (!levels[m.programCode] || RANK[m.accessLevel] > RANK[levels[m.programCode]]) levels[m.programCode] = m.accessLevel;
  }
  const admin = isPracticeAdmin(profile);
  return {
    scoped: !admin && mine.length > 0,
    admin,
    levels,
    programs: Object.keys(levels),
    careTeamRoles: Object.fromEntries(mine.map(m => [m.programCode, m.careTeamRole || null])),
  };
}

const atLeast = (scope, code, level) => !scope?.scoped || RANK[scope.levels[code]] >= RANK[level];

export const canViewProgram = (scope, code) => atLeast(scope, code, 'viewer');
export const canEditProgram = (scope, code) => atLeast(scope, code, 'member');

/** Supervisors (and admins) may step outside their scope, with a reason. */
export const canOverride = (scope, code) => !!scope?.admin || scope?.levels?.[code] === 'supervisor';

/**
 * Whether a patient belongs in a scoped list or search: they're in at least
 * one of the user's programs. `programCodes` are the patient's enrollments.
 */
export function patientInScope(scope, programCodes) {
  if (!scope?.scoped) return true;
  return (programCodes || []).some(code => scope.levels[code]);
}

/** Notifications about a program reach only the people who work in it. */
export const notificationInScope = (scope, programCode) => !programCode || canViewProgram(scope, programCode);

// BHI: work by a care manager needs a co-sign from the billing practitioner
// (Physician/PCP) or a BHI supervisor before it bills.
const CO_SIGN_PROGRAMS = new Set(['BHI']);
const SIGNING_ROLES = new Set(['Physician/PCP']);

export function needsCoSign(programCode, authorScope) {
  if (!CO_SIGN_PROGRAMS.has(programCode)) return false;
  return !canCoSign(programCode, authorScope);
}

export function canCoSign(programCode, scope) {
  if (!CO_SIGN_PROGRAMS.has(programCode)) return false;
  if (scope?.admin || scope?.levels?.[programCode] === 'supervisor') return true;
  return SIGNING_ROLES.has(scope?.careTeamRoles?.[programCode]);
}

/** Problem with an override before it's logged, or null. */
export function validateOverride({ reason, programCode } = {}) {
  if (!programCode) return 'Pick the program';
  if (String(reason || '').trim().length < 10) return 'Give a reason of at least 10 characters';
  return null;
}
