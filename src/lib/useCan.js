import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { canAccess } from './accessControl';

/** `can(key)` for the signed-in user, per Settings > Account > Access Control. */
export function useCan() {
  const roles = useAppStore(s => s.currentUserClinicalRoles);
  const accessRoles = useAppStore(s => s.accessRoles);
  const isAdmin = useAppStore(s => s.currentUserIsAdmin);
  return useCallback(
    key => canAccess(key, { roles: roles || [], accessRoles, isAdmin }),
    [roles, accessRoles, isAdmin],
  );
}
