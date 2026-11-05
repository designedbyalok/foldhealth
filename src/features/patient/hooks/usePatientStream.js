import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { resolvePatientStoreId } from '../../../lib/resolvePatientStoreId';
import { buildPatientStream } from '../data/patientStream';

const EMPTY = [];

/**
 * The patient's event and touchpoint stream (data/patientStream.js), newest
 * first, from the store's slices. Loads what's missing once per patient.
 */
export function usePatientStream(patientId) {
  const id = useAppStore(s => (patientId ? String(resolvePatientStoreId(s, patientId)) : null));
  const sources = useAppStore(s => (id ? s.patientStreamSources[id] : null));
  const medications = useAppStore(s => (id ? s.patientMedications[id] : null)) || EMPTY;
  const crm = useAppStore(s => (id ? s.patientCrmActivities[id] : null)) || EMPTY;
  const programActivity = useAppStore(s => (id ? s.patientProgramActivity[id] : null)) || EMPTY;
  const fetchSources = useAppStore(s => s.fetchPatientStreamSources);
  const fetchMeds = useAppStore(s => s.fetchPatientMedications);
  const fetchCrm = useAppStore(s => s.fetchPatientCrmActivities);
  const fetchActivity = useAppStore(s => s.fetchPatientProgramActivity);

  useEffect(() => {
    if (!id) return;
    fetchSources(id);
    fetchMeds(id);
    fetchCrm(id);
    fetchActivity(id);
  }, [id, fetchSources, fetchMeds, fetchCrm, fetchActivity]);

  const events = useMemo(
    () => (sources ? buildPatientStream({ ...sources, medications, crm, programActivity }) : EMPTY),
    [sources, medications, crm, programActivity],
  );
  return { events, loading: !!id && !sources };
}
