import { Fragment, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Icon } from '../../../components/Icon/Icon';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { resolvePatientStoreId } from '../../../lib/resolvePatientStoreId';
import { isEmptyDash } from '../../../lib/emptyDash';
import { statusColorFor } from '../../patient/data/programStatus';
import { STEP_STATUS } from '../../patient/right-panel/tabs/care-programs/program-detail/ProgramDetailView/stepStatus';
import { showsPatientCarePlan } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanMode';
import { useMobileNav } from '../MobileNavContext';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { listStamp } from '../mobileFormat';
import { isCarePlanStep, programTone, stepIsDesktopOnly, todayMDY } from './careUtils';
import { isAssessmentStep, useProgramSteps } from './useProgramSteps';
import { AssigneeSheet, CloseProgramSheet, PauseProgramSheet, ProgramStatusSheet } from './ProgramSheets';
import common from '../mobile.module.css';
import styles from './care.module.css';

const EMPTY = [];
const STEP_ICON = {
  completed: { name: 'solar:check-circle-linear', cls: styles.iconDone, label: 'Completed' },
  skipped: { name: 'solar:skip-next-linear', cls: styles.iconSkipped, label: 'Skipped' },
  in_progress: { name: 'solar:clock-circle-linear', cls: styles.iconProgress, label: 'In progress' },
  pending: { name: 'solar:record-circle-linear', cls: styles.iconPending, label: 'Not started' },
};

/**
 * One care program enrollment (mobile port of ProgramDetailView): status,
 * assignee, steps with Reviewed / Skip, and recent activity.
 */
export function ProgramScreen({ patientId, programId }) {
  const { pop, push } = useMobileNav();
  const programs = useAppStore(s => (patientId ? s.careProgramsByPatient[patientId] : null)) || EMPTY;
  const loaded = useAppStore(s => !!(patientId && s.careProgramsLoadedFor[patientId]));
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const program = programs.find(p => String(p.id) === String(programId)) || null;
  useEffect(() => { if (patientId) fetchCareProgramsForPatient?.(patientId); }, [patientId, fetchCareProgramsForPatient]);

  if (!program) {
    return (
      <div className={common.screen}>
        <ProgramHeader title="Program" onBack={pop} />
        <div className={common.body}>
          {loaded ? <MobileEmpty icon="solar:clipboard-remove-linear" title="Program not found" /> : <MobileListSkeleton count={3} />}
        </div>
      </div>
    );
  }
  return <ProgramDetail patientId={patientId} program={program} onBack={pop} push={push} />;
}

function ProgramHeader({ title, onBack, children }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroTop}>
        <button type="button" className={common.iconBtn} aria-label="Back" onClick={onBack}>
          <Icon name="solar:arrow-left-linear" size={24} />
        </button>
      </div>
      <h1 className={styles.heroTitle}>{title}</h1>
      {children}
    </section>
  );
}

function ProgramDetail({ patientId, program, onBack, push }) {
  const carePlanMode = useAppStore(s => s.carePlanMode);
  const updateCareProgram = useAppStore(s => s.updateCareProgram);
  const closeCareProgramInstance = useAppStore(s => s.closeCareProgramInstance);
  const pauseCareProgramInstance = useAppStore(s => s.pauseCareProgramInstance);
  const resumeCareProgramInstance = useAppStore(s => s.resumeCareProgramInstance);
  const setProgramStepStatus = useAppStore(s => s.setProgramStepStatus);
  const logProgramActivity = useAppStore(s => s.logProgramActivity);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const fetchPatientProgramActivity = useAppStore(s => s.fetchPatientProgramActivity);
  const activityKey = useAppStore(s => String(resolvePatientStoreId(s, patientId)));
  const activity = useAppStore(s => s.patientProgramActivity?.[activityKey]) || EMPTY;
  const activityLoading = useAppStore(s => !!s.patientProgramActivityLoading?.[activityKey]);
  const { stepList, flat, progress, done } = useProgramSteps(patientId, program);

  const [sheet, setSheet] = useState(null); // 'status' | 'close' | 'pause' | 'assignee' | { step }
  const [closing, setClosing] = useState(null); // status picked for Close (or null)
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  useEffect(() => { if (patientId) fetchPatientProgramActivity?.(patientId); }, [patientId, fetchPatientProgramActivity]);

  // Keep the stored progress in step with the steps, as the desktop view does,
  // so the program list and badges agree.
  useEffect(() => {
    if (!flat.length || program.progress === progress) return;
    updateCareProgram(patientId, program.id, { progress });
  }, [flat.length, program.progress, progress, patientId, program.id, updateCareProgram]);

  const programActivity = useMemo(
    () => activity.filter(a => a.programCode === program.code).slice(0, 8),
    [activity, program.code],
  );

  // Same rules as desktop changeStatus (CareProgramsTab / useProgramDetailView).
  const pickStatus = async (status) => {
    if (status === program.status) { setSheet(null); return; }
    if (status === 'Completed' || status === 'Discontinued') { setClosing(status); setSheet('close'); return; }
    if (status === 'Paused') { setSheet('pause'); return; }
    setSheet(null);
    try {
      if (program.status === 'Paused') {
        setBusy(true);
        await resumeCareProgramInstance(patientId, program, { status });
      } else {
        const patch = { status, statusColor: statusColorFor(status) };
        if (status === 'Enrolled' && (!program.startDate || isEmptyDash(program.startDate))) patch.startDate = todayMDY();
        updateCareProgram(patientId, program.id, patch);
      }
      toast.success(`${program.code} is now ${status}`);
    } catch {
      toast.error('Could not change the program status.');
    } finally {
      setBusy(false);
    }
  };

  const submitClose = ({ reason, note, status }) => {
    setBusy(true);
    try {
      closeCareProgramInstance(patientId, program.id, { reason, note, status });
      toast.success(`${program.name} closed`);
      setSheet(null);
    } catch {
      toast.error('Could not close the program.');
    } finally {
      setBusy(false);
    }
  };

  const submitPause = async (form) => {
    setBusy(true);
    const ok = await pauseCareProgramInstance(patientId, program, form).catch(() => false);
    setBusy(false);
    if (ok) { toast.success(`${program.name} paused`); setSheet(null); }
    // pauseCareProgramInstance shows its own error toast.
  };

  const assign = (user) => {
    setSheet(null);
    if (user.name === program.assignee) return;
    updateCareProgram(patientId, program.id, { assignee: user.name });
    toast.success(`Assigned to ${user.name}`);
  };

  // Desktop markStep: save the status on the enrollment, then log it.
  const markStep = async (step, status) => {
    setBusy(true);
    try {
      await setProgramStepStatus(program.id, step, status);
      const activityKind = isAssessmentStep(step) ? 'clipboard' : 'status';
      const log = (title, statusLabel, statusType) => logProgramActivity({ patientId, programCode: program.code, title, activityKind, statusLabel, statusType });
      if (status === STEP_STATUS.completed) {
        log(`${step.name} Marked as Reviewed`, 'Reviewed', 'success');
        toast.success(`${step.name} marked as reviewed`);
      } else if (status === STEP_STATUS.skipped) {
        log(`${step.name} Skipped`, 'Skipped', 'neutral');
        toast.success(`${step.name} skipped`);
      } else {
        log(`${step.name} ${step.status === STEP_STATUS.skipped ? 'Skip' : 'Review'} Undone`, 'Not Started', 'neutral');
        toast.success(`${step.name} reopened`);
      }
      setSheet(null);
    } catch {
      toast.error(`Could not update ${step.name}.`);
    } finally {
      setBusy(false);
    }
  };

  const title = program.subProgram ? `${program.name} · ${program.subProgram}` : program.name;
  const stepRow = (step) => {
    const icon = STEP_ICON[step.status] || STEP_ICON.pending;
    return (
      <button key={step.id} type="button" className={styles.step} aria-label={`${step.name}, ${icon.label}`} onClick={() => setSheet({ step })}>
        <span className={icon.cls}><Icon name={icon.name} size={24} color="currentColor" /></span>
        <span className={styles.stepName}>
          {step.name}
          {step.mandatory && <span className={styles.stepNote}> • Required</span>}
        </span>
        <Icon name="solar:alt-arrow-right-linear" size={20} color="var(--neutral-300)" />
      </button>
    );
  };

  return (
    <div className={common.screen}>
      <div className={common.body}>
        <ProgramHeader title={title} onBack={onBack}>
          <div className={styles.heroRow}>
            <span className={styles.code}>{program.code}</span>
            <button type="button" className={styles.chipBtn} aria-label={`Status ${program.status}, change`} onClick={() => setSheet('status')} disabled={busy}>
              <Badge size="md" tone={programTone(program.status)} variant="soft" label={program.status || 'New'} chevron />
            </button>
          </div>
          {program.status === 'Paused' && program.pause?.resumeOn && (
            <p className={styles.meta}>Paused until {program.pause.resumeOn}{program.pause.autoResume ? ' (resumes automatically)' : ''}</p>
          )}
          <button type="button" className={styles.field} onClick={() => setSheet('assignee')} disabled={busy}>
            <span className={styles.fieldLabel}>Assignee</span>
            <span className={styles.fieldValue}>
              {program.assignee && program.assignee !== 'Unassigned' ? program.assignee : 'Unassigned'}
              <Icon name="solar:alt-arrow-down-linear" size={16} />
            </span>
          </button>
          {!showsPatientCarePlan(carePlanMode) && (
            <button type="button" className={styles.field} onClick={() => push('carePlan', { patientId, programId: program.id })}>
              <span className={styles.fieldLabel}>Care Plan</span>
              <span className={styles.fieldValue}>
                View
                <Icon name="solar:alt-arrow-right-linear" size={16} />
              </span>
            </button>
          )}
          <div className={styles.progressRow}>
            <span className={styles.bar} aria-hidden="true"><span className={styles.barFill} style={{ width: `${progress}%` }} /></span>
            <span>{done}/{flat.length} steps</span>
          </div>
          <p className={styles.meta}>
            {[!isEmptyDash(program.startDate) && program.startDate !== '-' ? `Started ${program.startDate}` : null,
              program.endDate && !isEmptyDash(program.endDate) && program.endDate !== '-' ? `Ended ${program.endDate}` : null,
              program.pcp && !isEmptyDash(program.pcp) ? `PCP ${program.pcp}` : null].filter(Boolean).join(' • ')}
          </p>
        </ProgramHeader>

        <div className={styles.body}>
          <section className={styles.group}>
            <h2 className={styles.groupTitle}>Steps</h2>
            {stepList.length === 0 ? <p className={styles.empty}>No steps configured for this program</p> : (
              <div className={styles.steps}>
                {stepList.map(item => (item.type === 'section' ? (
                  <Fragment key={item.id}>
                    <p className={styles.sectionName}>{item.name}</p>
                    {(item.children || []).map(stepRow)}
                  </Fragment>
                ) : stepRow(item)))}
              </div>
            )}
          </section>

          <section className={styles.group}>
            <h2 className={styles.groupTitle}>Recent Activity</h2>
            {activityLoading && !programActivity.length ? <MobileListSkeleton count={2} height={56} /> : programActivity.length === 0 ? (
              <p className={styles.empty}>No activity yet</p>
            ) : (
              <div className={styles.activity}>
                {programActivity.map(a => (
                  <div key={a.id} className={styles.activityRow}>
                    <span className={styles.activityTitle}>{a.title}</span>
                    <span className={styles.meta}>{[a.statusLabel, a.actorName, listStamp(a.occurredAt)].filter(Boolean).join(' • ')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {sheet === 'status' && <ProgramStatusSheet current={program.status} onPick={pickStatus} onClose={() => setSheet(null)} />}
      {sheet === 'close' && (
        <CloseProgramSheet program={program} status={closing} busy={busy} onSubmit={submitClose} onClose={() => setSheet(null)} />
      )}
      {sheet === 'pause' && <PauseProgramSheet busy={busy} onSubmit={submitPause} onClose={() => setSheet(null)} />}
      {sheet === 'assignee' && (
        <AssigneeSheet users={platformUsers} current={program.assignee} onPick={assign} onClose={() => setSheet(null)} />
      )}
      {sheet?.step && (
        <StepSheet
          step={sheet.step}
          busy={busy}
          onMark={(status) => markStep(sheet.step, status)}
          onOpenCarePlan={() => { setSheet(null); push('carePlan', { patientId, programId: program.id }); }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function StepSheet({ step, busy, onMark, onOpenCarePlan, onClose }) {
  const fromRecords = step.source === 'records';
  const manualDone = step.source === 'manual' && (step.status === STEP_STATUS.completed || step.status === STEP_STATUS.skipped);
  const icon = STEP_ICON[step.status] || STEP_ICON.pending;
  return (
    <BottomSheet title={step.name} onClose={onClose}>
      <p className={styles.sheetMeta}>
        {icon.label}
        {fromRecords ? ' from the patient’s records' : ''}
        {step.mandatory ? ' • Required step' : ''}
      </p>
      {isCarePlanStep(step) && (
        <BottomSheetItem icon="solar:clipboard-heart-linear" label="Open Care Plan" onClick={onOpenCarePlan} />
      )}
      {!fromRecords && !manualDone && (
        <>
          <BottomSheetItem icon="solar:check-circle-linear" label="Mark as Reviewed" onClick={() => onMark(STEP_STATUS.completed)} disabled={busy} />
          <BottomSheetItem icon="solar:skip-next-linear" label="Skip Step" onClick={() => onMark(STEP_STATUS.skipped)} disabled={busy} />
        </>
      )}
      {manualDone && (
        <BottomSheetItem
          icon="solar:restart-linear"
          label={step.status === STEP_STATUS.skipped ? 'Undo Skip' : 'Undo Review'}
          onClick={() => onMark(null)}
          disabled={busy}
        />
      )}
      {(stepIsDesktopOnly(step) || isAssessmentStep(step)) && (
        <div className={styles.desktopNote}>
          <Icon name="solar:monitor-linear" size={20} />
          <span>This step&rsquo;s details open on a computer. You can still mark it reviewed or skip it here.</span>
        </div>
      )}
    </BottomSheet>
  );
}
