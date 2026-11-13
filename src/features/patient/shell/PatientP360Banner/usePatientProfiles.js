import { useAppStore } from '../../../../store/useAppStore';
import { FALLBACK_P360 } from '../../data/p360Mock';

/**
 * The patient's profiles (Central Profile plus one per location / health
 * plan) and the one picked in the banner's profile dropdown, shared through
 * the store so both banners and the Care Team section agree.
 */
export function usePatientProfiles(patientId, p) {
  const key = patientId == null ? null : String(patientId);
  const activeId = useAppStore(s => (key && s.activeProfileByPatient[key]) || 'central');
  const setActiveProfile = useAppStore(s => s.setActiveProfile);
  const profiles = p?.insurance_profiles || FALLBACK_P360.insurance_profiles;
  return {
    profiles,
    activeId,
    active: profiles.find(pr => pr.id === activeId) || profiles[0],
    setActive: (id) => key && setActiveProfile(key, id),
  };
}
