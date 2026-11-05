import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { accessScope } from '../data/programAccess';

/** The signed-in user's program access scope (see programAccess.js). */
export function useProgramAccess() {
  const memberships = useAppStore(s => s.programMemberships);
  const profile = useAppStore(s => s.currentUserProfile);
  const loaded = useAppStore(s => s.programAccessLoaded);
  const fetchProgramAccess = useAppStore(s => s.fetchProgramAccess);
  useEffect(() => { fetchProgramAccess(); }, [fetchProgramAccess]);
  const scope = useMemo(() => accessScope(memberships, profile?.id, profile), [memberships, profile]);
  return { ...scope, loaded };
}
