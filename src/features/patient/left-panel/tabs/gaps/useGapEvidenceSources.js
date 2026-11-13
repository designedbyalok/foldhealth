import { useEffect } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';

const EMPTY = [];

// Everything gap evidence is read from for one HEDIS member: their signed
// clinical notes, lab results and gap documents. Loads each once.
export function useGapEvidenceSources(member) {
  const memberId = member?.id;
  const notes = useAppStore(s => s.clinicalNotesByMember?.[memberId]) || EMPTY;
  const labResults = useAppStore(s => s.caregapLabResults[memberId]) || EMPTY;
  const documents = useAppStore(s => s.programDocuments) || EMPTY;
  const fetchNotes = useAppStore(s => s.fetchClinicalNotesForMember);
  const fetchLabs = useAppStore(s => s.fetchCaregapLabs);
  const fetchDocuments = useAppStore(s => s.fetchProgramDocuments);
  useEffect(() => { if (memberId) fetchNotes?.(memberId); }, [memberId, fetchNotes]);
  useEffect(() => { fetchLabs?.(); fetchDocuments?.(); }, [fetchLabs, fetchDocuments]);
  return { memberId, notes, labResults, documents };
}
