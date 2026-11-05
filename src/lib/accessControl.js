// Role-based access (Settings > Account > Access Control). Each role keeps a
// map of permission key → allowed; a key the map doesn't mention is allowed,
// so a new permission or a role nobody has configured never locks anyone out.
//
// This only hides things in the app. It is not a security boundary: the data
// itself is still guarded by the database's row level security.
import { SETTINGS_MENU_ITEMS } from '../features/settings/settingsNavItems';
import { ROLE_COLORS } from '../features/settings/account/AccountPanel.constants';

export const PLATFORM_NAV_PERMISSIONS = [
  { key: 'nav:home', label: 'Home', page: 'home' },
  { key: 'nav:population', label: 'Population', page: 'population' },
  { key: 'nav:calendar', label: 'Calendar', page: 'calendar' },
  { key: 'nav:tasks', label: 'Tasks', page: 'tasks' },
  { key: 'nav:messages', label: 'Messages', page: 'messages' },
  { key: 'nav:calls', label: 'Calls', page: 'calls' },
  { key: 'nav:leads', label: 'Leads & Contacts', page: 'leads' },
  { key: 'nav:campaign', label: 'Campaigns', page: 'campaign' },
  { key: 'nav:analytics', label: 'Analytics', page: 'analytics' },
  { key: 'nav:settings', label: 'Settings', page: 'settings' },
];

export const PLATFORM_OTHER_PERMISSIONS = [
  { key: 'patient:details', label: 'Patient Details' },
  { key: 'notes:sign', label: 'Sign and Amend EHR Notes' },
];

export const PLATFORM_PERMISSIONS = [...PLATFORM_NAV_PERMISSIONS, ...PLATFORM_OTHER_PERMISSIONS];

export const settingsSectionKey = (item) => item.key || item.label.toLowerCase();

export const SETTINGS_PERMISSIONS = SETTINGS_MENU_ITEMS.map(item => ({
  key: `settings:${settingsSectionKey(item)}`,
  label: item.label,
}));

export const navPermissionKey = (page) => `nav:${page}`;
export const settingsPermissionKey = (section) => `settings:${section}`;

// The roles that ship with the app. Code matches on these names (HCC review
// roles, the Admin/Practice Manager checks), so they can't be renamed or
// deleted from Access Control; only their permissions change.
export const BUILT_IN_ROLES = Object.keys(ROLE_COLORS).filter(r => r !== 'Patient');

export const isAllowedFor = (role, key) => role?.permissions?.[key] !== false;

export const countAllowed = (role, list) => list.filter(p => isAllowedFor(role, p.key)).length;

/**
 * Whether the signed-in user may see `key`. Admins see everything (so nobody
 * can hide Access Control from the people who manage it), a user with no
 * roles sees everything, and otherwise any one of their roles allowing it is
 * enough.
 */
export function canAccess(key, { roles = [], accessRoles = [], isAdmin = false } = {}) {
  if (isAdmin || !roles.length) return true;
  return roles.some((name) => {
    const role = accessRoles.find(r => r.name === name);
    return !role || isAllowedFor(role, key);
  });
}
