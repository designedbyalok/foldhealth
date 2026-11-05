import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';
import { DOCUMENTS_DEMO_PATIENT, SAMPLE_PATIENT_DOCUMENTS } from './documentsData';

/**
 * A patient's documents from `program_documents` (any program, or none),
 * matched on the patient's row id or member id. Until the seed runs, the demo
 * patient's sample documents fill in for rows the table doesn't have yet.
 */
export function usePatientDocuments(patient) {
  const fetchProgramDocuments = useAppStore(s => s.fetchProgramDocuments);
  const programDocuments = useAppStore(s => s.programDocuments);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.resolve(fetchProgramDocuments()).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [fetchProgramDocuments]);

  const documents = useMemo(() => {
    const ids = new Set([patient?.id, patient?.memberId].filter(v => v != null).map(String));
    const mine = programDocuments.filter(d => ids.has(String(d.patientId)));
    if (!ids.has(DOCUMENTS_DEMO_PATIENT)) return mine;
    const have = new Set(mine.map(d => d.id));
    return [...mine, ...SAMPLE_PATIENT_DOCUMENTS.filter(d => !have.has(d.id))];
  }, [programDocuments, patient?.id, patient?.memberId]);

  return { documents, loading };
}
