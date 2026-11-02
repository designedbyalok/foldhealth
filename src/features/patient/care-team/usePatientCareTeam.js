import { useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';

/**
 * The patient's current care team (patient_care_team). It loads only once
 * `active` (the section is on screen); `loading` is true until it has.
 */
export function usePatientCareTeam(patientId, active = true) {
  const key = patientId == null ? null : String(patientId);
  const team = useAppStore(s => (key ? s.careTeams[key] : null));
  const fetchCareTeam = useAppStore(s => s.fetchCareTeam);
  useEffect(() => { if (key && active && !team) fetchCareTeam(key); }, [key, active, team, fetchCareTeam]);
  return { team: team?.current || [], history: team?.history || [], loading: !!key && active && !team };
}
