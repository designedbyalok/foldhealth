import { EmptyState } from '../../components/EmptyState/EmptyState';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { Spinner } from '../../components/Spinner/Spinner';
import { useAppStore } from '../../store/useAppStore';
import { CarePlanView } from '../patient/right-panel/tabs/care-programs/care-plan';
import { patientLevelProgram, showsProgramCarePlan } from '../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanMode';
import { useLiveCall } from './useLiveCall';
import { useCallPatient } from './useCallPatient';
import styles from './LiveCallOverlay.module.css';

/** Care Plan tab: the patient's real care plan (goals, barriers, interventions), one program at a time. */
export function CallCarePlanTab({ patient }) {
  const { pid, programs, loaded } = useCallPatient(patient);
  const programLevel = showsProgramCarePlan(useAppStore(s => s.carePlanMode));
  const planProgramId = useLiveCall(s => s.planProgramId);
  const setPlanProgramId = useLiveCall(s => s.setPlanProgramId);

  if (!programLevel) {
    return <div className={styles.tabScroll}><CarePlanView patientId={pid} program={patientLevelProgram(pid)} /></div>;
  }
  if (!loaded) return <div className={styles.loading}><Spinner size={20} label="Loading care programs" /></div>;
  if (!programs.length) return <EmptyState title="No open care programs" description="Enroll the patient in a program to start a care plan." />;

  const program = programs.find(p => p.id === planProgramId) || programs[0];
  return (
    <div className={styles.tabScroll}>
      {programs.length > 1 && (
        <SegmentedControl
          size="sm"
          items={programs.map(p => ({ key: p.id, label: p.code, tooltip: p.name }))}
          value={program.id}
          onValueChange={setPlanProgramId}
          aria-label="Care program"
        />
      )}
      <CarePlanView key={program.id} patientId={pid} program={program} />
    </div>
  );
}
