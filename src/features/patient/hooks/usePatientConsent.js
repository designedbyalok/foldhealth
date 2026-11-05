import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { consentSummary } from '../data/consentRules';

const EMPTY = [];

/**
 * A patient's consent history (newest first), preferences, their care
 * programs, and the "given / total" summary over the program consents.
 * `loaded` is false until the first fetch returns.
 */
export function usePatientConsent(patientId) {
  const consents = useAppStore(s => s.patientConsents[patientId]);
  const preferences = useAppStore(s => s.patientPreferences[patientId]);
  const programs = useAppStore(s => s.careProgramsByPatient[patientId]);
  const fetchPatientConsents = useAppStore(s => s.fetchPatientConsents);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);

  useEffect(() => {
    if (!patientId) return;
    fetchPatientConsents(patientId);
    fetchCareProgramsForPatient(patientId);
  }, [patientId, fetchPatientConsents, fetchCareProgramsForPatient]);

  const summary = useMemo(() => consentSummary(consents || EMPTY), [consents]);
  return { consents: consents || EMPTY, preferences, programs: programs || EMPTY, summary, loaded: consents !== undefined };
}
