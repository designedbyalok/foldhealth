import { useEffect } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';

/**
 * The patient's p360_profiles row, fetched once. `undefined` while loading,
 * `null` when the patient has none. Unlike the P360 banner this never falls
 * back to the sample profile, so the Overview shows nothing rather than
 * another patient's data.
 */
export function useP360Profile(patientId) {
  const profile = useAppStore(s => s.p360ProfilesById[patientId]);
  const fetchP360Profile = useAppStore(s => s.fetchP360Profile);
  useEffect(() => {
    if (patientId && profile === undefined) fetchP360Profile(patientId);
  }, [patientId, profile, fetchP360Profile]);
  return profile;
}
