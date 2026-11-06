import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { blockStatus } from '../../settings/calendar/availability/availabilityUtils';

const sameName = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

/**
 * The signed-in user's availability slots, matched by name like the desktop
 * User Availability drawer (current first, past last), and the user record
 * saveUserAvailability takes.
 */
export function useMyAvailability() {
  const me = useAppStore(s => s.currentUserProfile);
  const stored = useAppStore(s => s.userAvailability);
  const loading = useAppStore(s => s.userAvailabilityLoading || !s.userAvailabilityFetched);
  const fetchUserAvailability = useAppStore(s => s.fetchUserAvailability);
  useEffect(() => { fetchUserAvailability?.(); }, [fetchUserAvailability]);

  const user = useMemo(() => (me ? { id: me.id, name: me.name, email: me.email } : null), [me]);
  const blocks = useMemo(() => (user ? stored
    .filter(b => sameName(b.userName, user.name))
    .sort((a, b) => (blockStatus(a) === 'expired') - (blockStatus(b) === 'expired'))
    .map(b => ({ ...b, days: [...(b.days || [])], weeks: [...(b.weeks || [])], slots: (b.slots || []).map(s => ({ ...s })) })) : []), [stored, user]);
  return { user, blocks, loading };
}
