import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Spinner } from '../../components/Spinner/Spinner';
import { useAppStore } from '../../store/useAppStore';
import { useCareProgramsOverview } from '../patient/right-panel/tabs/care-programs/CareProgramsTab/overview/useCareProgramsOverview';
import { STEP_STATUS } from '../patient/right-panel/tabs/care-programs/program-detail/ProgramDetailView/stepStatus';
import { useLiveCall } from './useLiveCall';
import { useCallPatient } from './useCallPatient';
import styles from './LiveCallOverlay.module.css';

const STATUS = {
  [STEP_STATUS.completed]: { label: 'Completed', tone: 'success' },
  [STEP_STATUS.inProgress]: { label: 'In Progress', tone: 'info' },
  [STEP_STATUS.pending]: { label: 'Pending', tone: 'neutral' },
  [STEP_STATUS.skipped]: { label: 'Skipped', tone: 'neutral' },
};

/** Program Steps tab: every enrolled program's steps, marked Reviewed or Skipped as the call covers them. */
export function CallStepsTab({ patient }) {
  const { pid, programs, loaded } = useCallPatient(patient);
  const { ready, entries } = useCareProgramsOverview(pid, programs);
  const setProgramStepStatus = useAppStore(s => s.setProgramStepStatus);
  const stepsThisCall = useLiveCall(s => s.stepsThisCall);
  const markStep = useLiveCall(s => s.markStep);

  if (!loaded || (programs.length && !ready)) return <div className={styles.loading}><Spinner size={20} label="Loading program steps" /></div>;
  if (!programs.length) return <EmptyState title="No open care programs" description="Program steps show here once the patient is enrolled." />;

  const mark = (program, step, status) => {
    setProgramStepStatus(program.id, step, status);
    markStep(program, step, status);
  };

  return (
    <div className={styles.tabScroll}>
      {entries.map(({ program, steps }) => {
        const done = steps.filter(s => s.status === STEP_STATUS.completed || s.status === STEP_STATUS.skipped).length;
        const left = steps.length - done;
        return (
          <section key={program.id} className={styles.stepGroup}>
            <div className={styles.stepGroupHead}>
              <Badge size="sm" label={program.code} />
              <span className={styles.stepGroupName}>{program.name}</span>
              <span className={styles.spacer} />
              <span className={styles.count}>{done} of {steps.length} complete</span>
              <span className={styles.stepBar} aria-hidden="true"><span style={{ width: `${steps.length ? Math.round((done / steps.length) * 100) : 0}%` }} /></span>
              <Badge size="sm" tone={left ? 'warning' : 'success'} label={left ? `${left} open` : 'All complete'} />
            </div>
            <ul className={styles.stepList}>
              {steps.map(step => {
                const st = STATUS[step.status] || STATUS[STEP_STATUS.pending];
                const onCall = stepsThisCall[`${program.id}:${step.id}`];
                const canAct = step.source !== 'records' && (step.status === STEP_STATUS.pending || step.status === STEP_STATUS.inProgress);
                return (
                  <li key={step.id} className={styles.stepRow}>
                    <span className={styles.stepName}>
                      {step.name}
                      {step.mandatory && <span className={styles.stepReq}>Required</span>}
                      {onCall && <Badge size="sm" tone="primary" label="This Call" />}
                    </span>
                    <Badge size="sm" tone={st.tone} label={st.label} />
                    <span className={styles.stepActions}>
                      {canAct && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => mark(program, step, STEP_STATUS.completed)}>Reviewed</Button>
                          <Button size="sm" variant="ghost" onClick={() => mark(program, step, STEP_STATUS.skipped)}>Skip</Button>
                        </>
                      )}
                      {onCall && step.source === 'manual' && (
                        <Button size="sm" variant="ghost" onClick={() => mark(program, step, null)}>Undo</Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
