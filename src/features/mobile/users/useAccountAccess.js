import { useEffect } from 'react';
import { useCan } from '../../../lib/useCan';
import { settingsPermissionKey } from '../../../lib/accessControl';
import { useAppStore } from '../../../store/useAppStore';

/** Settings > Account on desktop: the Settings nav plus the Account section. */
export function useAccountAccess() {
  const can = useCan();
  return can('nav:settings') && can(settingsPermissionKey('account'));
}

/** Only admins change access; the dev sign-in bypass can try it locally (as desktop). */
export function useCanEditAccess() {
  const isAdmin = useAppStore(s => s.currentUserIsAdmin);
  let bypass = false;
  try { bypass = import.meta.env.DEV && sessionStorage.getItem('__auth_bypass') === 'true'; } catch { /* storage blocked */ }
  return isAdmin || bypass;
}

/** Load roles and people once, as AccessControlTab does. */
export function useAccessData() {
  const fetchAccessRoles = useAppStore(s => s.fetchAccessRoles);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchAccessRoles(); fetchPlatformUsers(); }, [fetchAccessRoles, fetchPlatformUsers]);
}
