import { useMemo } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import { MOCK_ROLES } from '../InviteUserDrawer.utils';

/** Role names a user can be given: the built-in ones plus roles made in Access Control. */
export function useRoleOptions() {
  const accessRoles = useAppStore(s => s.accessRoles);
  return useMemo(() => {
    const custom = (accessRoles || []).filter(r => !r.builtIn).map(r => r.name);
    return [...MOCK_ROLES, ...custom.filter(n => !MOCK_ROLES.includes(n))];
  }, [accessRoles]);
}
