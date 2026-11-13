import { useCallback } from 'react';
import { AvatarOooLookup } from '../../components/Avatar/AvatarOooLookup';
import { useAppStore } from '../../store/useAppStore';
import { activeOooFor, coveringPeople, samePerson } from './oooUtils';

/**
 * Lets every Avatar given a `userName` show that person's Out of Office
 * badge. When the record names the signed-in user as a covering provider,
 * its hover adds "You're covering" (the record comes back with `note`).
 */
export function AvatarOooProvider({ children }) {
  const records = useAppStore(s => s.oooRecords);
  const me = useAppStore(s => s.currentUserProfile);
  const lookup = useCallback((who) => {
    const record = activeOooFor(records, who);
    if (!record) return null;
    const mine = me && coveringPeople(record.coverage).some(c => samePerson(c, { id: me.id || null, name: me.name || '' }));
    return mine ? { ...record, note: "You're covering" } : record;
  }, [records, me]);
  return <AvatarOooLookup.Provider value={lookup}>{children}</AvatarOooLookup.Provider>;
}
