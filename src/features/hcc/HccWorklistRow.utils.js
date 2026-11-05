import { staffById } from './assignment/astranaStaff';

const TERMINAL_STATUSES = new Set(['Completed', 'Skipped', 'Billing Ready', 'Billed']);
const BLOCKING_STATUSES = new Set(['Reject', 'Rejected', 'Insufficient']);
const REJECTED_STATUSES = new Set(['Rejected', 'Reject']);
const BILLED_STATUSES = new Set(['Billed']);
const STAGES_LOW_TO_HIGH = ['support', 'coder', 'reviewer', 'reviewer2'];

export function isRejectedStatus(s) { return REJECTED_STATUSES.has(s); }
export function isBilledStatus(s) { return BILLED_STATUSES.has(s); }

function nameToInitials(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function resolveStaffName(id, platformUsers = []) {
  if (!id) return null;
  const staff = staffById(id);
  if (staff?.name) return { name: staff.name, initials: staff.initials };
  const pu = platformUsers.find(u => u.id === id);
  if (pu?.name) return { name: pu.name, initials: pu.initials || nameToInitials(pu.name) };
  return null;
}

function makeActive(staffId, role, status, platformUsers = []) {
  const resolved = resolveStaffName(staffId, platformUsers);
  return {
    kind: 'active',
    name: resolved?.name || null,
    initials: resolved?.initials || (staffId || '').slice(0, 2),
    role,
    status,
  };
}

function makeActiveLegacy(name, role, status) {
  return {
    kind: 'active',
    name: name || null,
    initials: nameToInitials(name || ''),
    role,
    status,
  };
}

// Billed is a terminal post-billing state, if any role's status carries
// it, the whole DOS is billed and the assignee cell should show that
// instead of "Billing Ready". Callers rely on the returned kind='billed'
// to render the green Billed chip in place of the review chip.
function isDosBilled(dosState, member) {
  if (dosState) {
    for (const role of STAGES_LOW_TO_HIGH) {
      if (BILLED_STATUSES.has(dosState?.[role]?.status)) return true;
    }
    return false;
  }
  return BILLED_STATUSES.has(member?.supS)
    || BILLED_STATUSES.has(member?.cdrS)
    || BILLED_STATUSES.has(member?.r1s)
    || BILLED_STATUSES.has(member?.r2s);
}

export function resolveCurrentAssignee(member, dosState, platformUsers = []) {
  if (isDosBilled(dosState, member)) return { kind: 'billed' };
  if (dosState) {
    for (const role of STAGES_LOW_TO_HIGH) {
      const rs = dosState[role];
      const status = rs?.status;
      const hasReachedStage = !!(status || rs?.assignee);
      if (!hasReachedStage || !status || status === 'Assign') {
        if (rs?.assignee && status && status !== 'Assign') {
          return makeActive(rs.assignee, role, status, platformUsers);
        }
        return { kind: 'unassigned', role };
      }
      if (BLOCKING_STATUSES.has(status)) {
        return makeActive(rs?.assignee, role, status, platformUsers);
      }
      if (!TERMINAL_STATUSES.has(status)) {
        return makeActive(rs?.assignee, role, status, platformUsers);
      }
    }
    return { kind: 'billing' };
  }

  const legacy = [
    { role: 'support',   name: member.sup, status: member.supS },
    { role: 'coder',     name: member.cdr, status: member.cdrS },
    { role: 'reviewer',  name: member.r1,  status: member.r1s },
    { role: 'reviewer2', name: member.r2,  status: member.r2s },
  ];
  for (const r of legacy) {
    if (!r.name && (!r.status || r.status === 'Assign')) {
      return { kind: 'unassigned', role: r.role };
    }
    if (!r.status || r.status === 'Assign') {
      return makeActiveLegacy(r.name, r.role, r.status);
    }
    if (BLOCKING_STATUSES.has(r.status)) {
      return makeActiveLegacy(r.name, r.role, r.status);
    }
    if (!TERMINAL_STATUSES.has(r.status)) {
      return makeActiveLegacy(r.name, r.role, r.status);
    }
  }
  return { kind: 'billing' };
}
