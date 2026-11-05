import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../../store/useAppStore';

const EMPTY = [];

/** Users who can be assigned, from the people directory. */
export function usePlatformUserOptions() {
  const users = useAppStore(s => s.platformUsers) || EMPTY;
  const fetchUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchUsers?.(); }, [fetchUsers]);
  return useMemo(() => users.map(u => ({ value: u.id, label: u.name, searchText: `${u.name} ${u.email || ''}` })), [users]);
}
