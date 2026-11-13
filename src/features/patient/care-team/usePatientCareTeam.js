import { useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';

const inLocation = (location) => (m) => (m.location || 'central') === location;

/**
 * The patient's care team at one profile location (patient_care_team):
 * 'central' (the default) or a location profile id. It loads only once
 * `active` (the section is on screen); `loading` is true until it has.
 */
export function usePatientCareTeam(patientId, active = true, location = 'central') {
  const key = patientId == null ? null : String(patientId);
  const team = useAppStore(s => (key ? s.careTeams[key] : null));
  const fetchCareTeam = useAppStore(s => s.fetchCareTeam);
  useEffect(() => { if (key && active && !team) fetchCareTeam(key); }, [key, active, team, fetchCareTeam]);
  return {
    team: (team?.current || []).filter(inLocation(location)),
    history: (team?.history || []).filter(inLocation(location)),
    loading: !!key && active && !team,
  };
}
