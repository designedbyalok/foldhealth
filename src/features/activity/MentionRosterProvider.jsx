import { useMemo } from 'react';
import { MentionRoster } from '../../components/CommentComposer/MentionRoster';
import { useAppStore } from '../../store/useAppStore';
import { SYSTEM_USERS } from '../hcc/systemUsers';
import { activeOooFor, coveringPeople } from '../ooo/oooUtils';

/**
 * The people every CommentComposer can @-mention by default: platform users
 * (from `profiles`), or the fixture roster until they load, always including
 * the signed-in user so they can mention themselves. Someone out of office
 * carries `out: true` and `coveredBy` (names), so the @ menus show them with
 * an Out of Office badge and suggest who covers them.
 */
export function MentionRosterProvider({ children }) {
  const platformUsers = useAppStore(s => s.platformUsers);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const oooRecords = useAppStore(s => s.oooRecords);
  const people = useMemo(() => {
    // `realProfile` marks entries whose `id` is an actual profiles.id, so
    // createMentionChip knows which ids are safe to persist. SYSTEM_USERS is a
    // fixture roster whose ids are not uuids and must never be stored.
    const base = platformUsers?.length
      ? platformUsers.map(u => ({ ...u, realProfile: true }))
      : SYSTEM_USERS;
    if (!currentUserProfile?.name) return base;
    if (base.some(u => u.id === currentUserProfile.id || u.name === currentUserProfile.name)) return base;
    const initials = currentUserProfile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return [
      { id: currentUserProfile.id, name: currentUserProfile.name, initials, role: currentUserProfile.role, source: 'self', realProfile: true },
      ...base,
    ];
  }, [platformUsers, currentUserProfile]);
  const users = useMemo(() => people.map((u) => {
    const record = activeOooFor(oooRecords, { id: u.id || null, name: u.name });
    return record ? { ...u, out: true, coveredBy: coveringPeople(record.coverage).map(c => c.name) } : u;
  }), [people, oooRecords]);
  const value = useMemo(() => ({ users, load: fetchPlatformUsers }), [users, fetchPlatformUsers]);
  return <MentionRoster.Provider value={value}>{children}</MentionRoster.Provider>;
}
