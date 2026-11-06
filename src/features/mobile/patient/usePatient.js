import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';

/** The all_patients row a patient workflow screen was opened for. */
export function usePatient(patientId) {
  const allPatients = useAppStore(s => s.allPatients);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  useEffect(() => { fetchAllPatients?.(); }, [fetchAllPatients]);
  return useMemo(
    () => (allPatients || []).find(p => String(p.id) === String(patientId)) || null,
    [allPatients, patientId],
  );
}
