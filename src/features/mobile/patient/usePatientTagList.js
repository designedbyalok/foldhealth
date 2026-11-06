import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';

/**
 * The patient's practice tags (Settings > Member/Leads > Tags) as the
 * desktop PatientTags reads them: every tag, and the ones on this patient.
 */
export function usePatientTagList(patientId) {
  const key = patientId == null ? null : String(patientId);
  const all = useAppStore(s => s.contactTags);
  const ids = useAppStore(s => (key ? s.patientTags?.[key] : null));
  const fetchContactTags = useAppStore(s => s.fetchContactTags);
  const fetchPatientTags = useAppStore(s => s.fetchPatientTags);
  useEffect(() => { fetchContactTags?.(); }, [fetchContactTags]);
  useEffect(() => { if (key) fetchPatientTags?.(key); }, [key, fetchPatientTags]);
  const tags = useMemo(() => (ids || []).map(id => (all || []).find(t => t.id === id)).filter(Boolean), [all, ids]);
  return { all: all || [], ids: ids || [], tags };
}
