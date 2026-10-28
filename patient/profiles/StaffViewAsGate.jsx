import { useCallback, useMemo, useState } from 'react';
import { ProfileContext } from '../lib/profileContext';
import { ViewAsPicker } from './ViewAsPicker';

// Provider-portal users see the portal as one patient at a time. The choice
// lasts for this tab's session, like a patient's profile choice.
const storageKey = (userId) => `patient-view-as:${userId}`;
const readChoice = (userId) => {
  try { return JSON.parse(sessionStorage.getItem(storageKey(userId))); } catch { return null; }
};
const writeChoice = (userId, profile) => {
  try {
    if (profile) sessionStorage.setItem(storageKey(userId), JSON.stringify(profile));
    else sessionStorage.removeItem(storageKey(userId));
  } catch { /* storage unavailable: the choice just won't survive a reload */ }
};

export function StaffViewAsGate({ user, children }) {
  const [profile, setProfile] = useState(() => readChoice(user.id));

  const choose = useCallback((next) => {
    writeChoice(user.id, next);
    setProfile(next);
  }, [user.id]);

  const value = useMemo(() => ({
    profiles: profile ? [profile] : [],
    profile,
    select: () => {},
    updateProfile: (memberId, patch) => { if (profile?.member_id === memberId) choose({ ...profile, ...patch }); },
    viewingAs: { switchPatient: () => choose(null) },
  }), [profile, choose]);

  if (!profile) return <ViewAsPicker onSelect={choose} />;
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
