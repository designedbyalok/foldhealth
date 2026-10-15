import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { ProgramDetailView } from '../ProgramDetailView/ProgramDetailView.jsx';
import { ProgramDetailSkeleton } from '../shared/ProgramDetailSkeleton/ProgramDetailSkeleton.jsx';
import { programUrlKey } from '../../CareProgramsTab/CareProgramsTab.utils';

/**
 * The open care program on its own, outside the Care Programs list. Used by
 * the floating-shell "Open in right panel" layout, where the program renders
 * as its own card beside the patient card. Resolves the program from the
 * store's URL-backed key, the same way CareProgramsTab does.
 */
export function ProgramPanel() {
  const patientId = useAppStore(s => s.selectedPatientId);
  const programKey = useAppStore(s => s.selectedCareProgramKey);
  const careProgramsByPatient = useAppStore(s => s.careProgramsByPatient);
  const loaded = useAppStore(s => !!s.careProgramsLoadedFor[patientId]);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const openCareProgram = useAppStore(s => s.openCareProgram);
  const closeCareProgram = useAppStore(s => s.closeCareProgram);

  useEffect(() => {
    if (patientId) fetchCareProgramsForPatient(patientId);
  }, [patientId, fetchCareProgramsForPatient]);

  const program = useMemo(
    () => (careProgramsByPatient[patientId] || []).find(p => programUrlKey(p) === programKey) || null,
    [careProgramsByPatient, patientId, programKey],
  );

  // A stale key (deleted program) would otherwise leave this card on a
  // skeleton forever; closing drops back to the inline Care Programs list.
  useEffect(() => {
    if (loaded && programKey && !program) closeCareProgram();
  }, [loaded, programKey, program, closeCareProgram]);

  if (!program) return <ProgramDetailSkeleton />;

  return (
    <ProgramDetailView
      program={program}
      onClose={closeCareProgram}
      onSwitchProgram={(p) => openCareProgram(programUrlKey(p))}
    />
  );
}
