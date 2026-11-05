// Merged platform-user pool: Astrana HCC staff (Support / Coder / Reviewer /
// Reviewer 2) + Account → Users, deduped by id. Astrana wins on conflict
// because it carries the engine role keys the assignment engine uses.
//
// Single source of truth for every "all users on the platform" picker: the
// bulk Change-Assignees dialog and the HCC "Assignee" filter both read from
// here so they always offer the exact same roster.

import { ASTRANA_STAFF, ROLE_LABEL } from './assignment/astranaStaff';
import { FALLBACK_USERS } from '../settings/fallbackUsers';

export const SYSTEM_USERS = (() => {
  const astrana = ASTRANA_STAFF.map(s => ({
    id: s.id,
    name: s.name,
    initials: s.initials,
    rolesLabel: ROLE_LABEL[s.role] || s.role,
    engineRole: s.role, // 'support' | 'coder' | 'reviewer' | 'reviewer2'
    source: 'astrana',
  }));
  const astranaIds = new Set(astrana.map(u => u.id));
  const account = [];
  for (const u of FALLBACK_USERS) {
    if (astranaIds.has(u.id)) continue;
    account.push({
      id: u.id,
      name: u.name,
      initials: u.initials,
      rolesLabel: u.role || '',
      engineRole: null, // Account users aren't pinned to an engine role
      source: 'account',
    });
  }
  return [...astrana, ...account];
})();

// Distinct display names for filter option lists (Astrana first, then Account).
export const SYSTEM_USER_NAMES = [...new Set(SYSTEM_USERS.map(u => u.name))];
