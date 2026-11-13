import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { interpreterStatus } from './interpreterOfferModel';

/** The patient's interpreter status from their preferences (loads them once). */
export function useInterpreterStatus(patientId) {
  const prefs = useAppStore(s => (patientId ? s.patientPreferences[patientId] : null));
  const fetchPatientConsents = useAppStore(s => s.fetchPatientConsents);
  useEffect(() => { if (patientId) fetchPatientConsents(patientId); }, [patientId, fetchPatientConsents]);
  return { prefs, status: interpreterStatus(prefs) };
}
