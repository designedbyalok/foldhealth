import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { resolvePatientStoreId } from '../../lib/resolvePatientStoreId';
import { isProgramClosed } from '../patient/data/programStatus';
import { findPatientRecord } from '../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanPrintSettings';

const EMPTY = [];

/**
 * The call's patient as the chart knows them: store id, record and open care
 * programs (loaded if they aren't yet). Keyed by the call's patient, never the
 * chart's selected patient, so the call can't disturb an open chart.
 */
export function useCallPatient(patient) {
  const pid = useAppStore(s => String(resolvePatientStoreId(s, patient.id) || patient.id));
  // Strings, not the record: findPatientRecord builds a new object per read,
  // which as a selector would re-render forever.
  const recordId = useAppStore(s => String(findPatientRecord(s, pid)?.id || pid));
  const memberId = useAppStore(s => String(findPatientRecord(s, pid)?.memberId || patient.memberId || ''));
  const name = useAppStore(s => String(findPatientRecord(s, pid)?.name || patient.name || ''));
  const record = useMemo(() => ({ id: recordId, memberId, name }), [recordId, memberId, name]);
  const programs = useAppStore(s => s.careProgramsByPatient[pid]) || EMPTY;
  const loaded = useAppStore(s => !!s.careProgramsLoadedFor?.[pid]);
  useEffect(() => {
    if (!loaded) useAppStore.getState().fetchCareProgramsForPatient?.(pid);
  }, [pid, loaded]);
  const open = useMemo(() => programs.filter(p => !isProgramClosed(p.status)), [programs]);
  return { pid, record, programs: open, loaded };
}
