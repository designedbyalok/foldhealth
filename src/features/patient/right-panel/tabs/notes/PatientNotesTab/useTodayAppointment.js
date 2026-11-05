import { useEffect, useMemo } from 'react';
import { resolvePatientStoreId } from '../../../../../../lib/resolvePatientStoreId';
import { useAppStore } from '../../../../../../store/useAppStore';
import { parseDateTime } from '../../../../data/patientStream';

const INACTIVE = /cancel|no.?show/i;

/** The patient's first non-cancelled appointment today, from the stream sources. */
export function useTodayAppointment() {
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const id = useAppStore(s => (selectedPatientId ? String(resolvePatientStoreId(s, selectedPatientId)) : null));
  const appointments = useAppStore(s => (id ? s.patientStreamSources[id]?.appointments : null));
  const fetchSources = useAppStore(s => s.fetchPatientStreamSources);
  useEffect(() => { if (id) fetchSources(id); }, [id, fetchSources]);

  return useMemo(() => {
    const today = new Date().toDateString();
    return (appointments || [])
      .map(a => ({ ...a, at: parseDateTime(a.date, a.time_start) }))
      .filter(a => a.at && a.at.toDateString() === today && !INACTIVE.test(a.status || ''))
      .sort((a, b) => a.at - b.at)[0] || null;
  }, [appointments]);
}
