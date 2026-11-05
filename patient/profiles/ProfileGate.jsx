import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ProfileContext } from '../lib/profileContext';
import { ProfilePicker } from './ProfilePicker';
import { NoProfilePage } from './NoProfilePage';

// The choice lasts for this tab's session: a household manager picks who
// they're acting for after each sign-in (frame 701:4769).
const storageKey = (userId) => `patient-profile:${userId}`;
const readChoice = (userId) => {
  try { return sessionStorage.getItem(storageKey(userId)); } catch { return null; }
};
const writeChoice = (userId, memberId) => {
  try {
    if (memberId) sessionStorage.setItem(storageKey(userId), memberId);
    else sessionStorage.removeItem(storageKey(userId));
  } catch { /* storage unavailable: the choice just won't survive a reload */ }
};

export function ProfileGate({ user, children }) {
  const [state, setState] = useState({ loading: true, error: '', profiles: [] });
  const [chosen, setChosen] = useState(() => readChoice(user.id));
  const [attempt, setAttempt] = useState(0);
  // Contact edits made in this session, laid over the loaded profiles.
  const [patches, setPatches] = useState({});

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_profiles').then(({ data, error }) => {
      if (alive) setState({ loading: false, error: error ? 'We could not load your profile. Please try again.' : '', profiles: data || [] });
    });
    return () => { alive = false; };
  }, [attempt]);

  const retry = () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    setAttempt((n) => n + 1);
  };

  const select = useCallback((memberId) => {
    writeChoice(user.id, memberId);
    setChosen(memberId);
  }, [user.id]);

  const updateProfile = useCallback((memberId, patch) => {
    setPatches((all) => ({ ...all, [memberId]: { ...all[memberId], ...patch } }));
  }, []);

  const profiles = useMemo(() => state.profiles.map((p) => ({ ...p, ...patches[p.member_id] })), [state.profiles, patches]);
  const only = profiles.length === 1 ? profiles[0].member_id : null;
  const profile = profiles.find((p) => p.member_id === (chosen || only)) || null;
  const value = useMemo(() => ({ profiles, profile, select, updateProfile }), [profiles, profile, select, updateProfile]);

  if (state.loading) return null;
  if (state.error || profiles.length === 0) return <NoProfilePage error={state.error} onRetry={retry} />;
  if (!profile) return <ProfilePicker profiles={profiles} onSelect={select} />;
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
