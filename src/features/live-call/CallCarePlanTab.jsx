import { EmptyState } from '../../components/EmptyState/EmptyState';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { Spinner } from '../../components/Spinner/Spinner';
import { useAppStore } from '../../store/useAppStore';
import { CarePlanView } from '../patient/right-panel/tabs/care-programs/care-plan';
import { patientLevelProgram, showsProgramCarePlan } from '../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanMode';
import { Badge } from '../../components/Badge/Badge';
import { useLiveCall } from './useLiveCall';
import { itemState } from './liveCallModel';
import { useCallPatient } from './useCallPatient';
import styles from './LiveCallOverlay.module.css';

/** Care Plan tab: the patient's real care plan (goals, barriers, interventions), one program at a time. */
export function CallCarePlanTab({ patient }) {
  const { pid, programs, loaded } = useCallPatient(patient);
  const programLevel = showsProgramCarePlan(useAppStore(s => s.carePlanMode));
  const planProgramId = useLiveCall(s => s.planProgramId);
  const setPlanProgramId = useLiveCall(s => s.setPlanProgramId);
  const session = useLiveCall();
  // Goals and barriers accepted on this call: not on the plan until wrap-up.
  const fromCall = (session.script?.items || []).filter(it => (it.route?.kind === 'goal' || it.route?.kind === 'barrier') && itemState(session, it.id) === 'accepted');
  const pending = fromCall.length > 0 && (
    <section className={styles.fromCall} aria-label="Care plan changes from this call">
      <span className={styles.sectionLabel}>From This Call</span>
      <ul className={styles.fromCallList}>
        {fromCall.map(it => (
          <li key={it.id} className={styles.fromCallRow}>
            <Badge size="sm" tone={it.tone} icon={it.icon} label={it.type} />
            <span className={styles.fromCallTitle}>{session.edits[it.id] || it.title}</span>
            <span className={styles.count}>Adds at wrap-up</span>
          </li>
        ))}
      </ul>
    </section>
  );

  if (!programLevel) {
    return <div className={styles.tabScroll}>{pending}<CarePlanView patientId={pid} program={patientLevelProgram(pid)} /></div>;
  }
  if (!loaded) return <div className={styles.loading}><Spinner size={20} label="Loading care programs" /></div>;
  if (!programs.length) return <EmptyState title="No open care programs" description="Enroll the patient in a program to start a care plan." />;

  const program = programs.find(p => p.id === planProgramId) || programs[0];
  return (
    <div className={styles.tabScroll}>
      {pending}
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
