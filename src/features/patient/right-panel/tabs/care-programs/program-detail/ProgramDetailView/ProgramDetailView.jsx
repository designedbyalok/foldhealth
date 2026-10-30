import { useEffect, useMemo, useState } from 'react';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { AssigneeChange } from '../../../../../../../components/AssigneeChange/AssigneeChange';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { OutreachTab } from '../../../../../left-panel/tabs/outreach/OutreachTab/OutreachTab.jsx';
import { CcmBillingReview } from '../billing/CcmBillingReview/CcmBillingReview.jsx';
import { SendLetterDrawer } from '../letters/SendLetterDrawer/SendLetterDrawer.jsx';
import { PreVisitStep, ProgramSnapshotStep } from '../steps/PreVisitStep/PreVisitStep.jsx';
import { AssessmentFormView } from '../steps/AssessmentFormView/AssessmentFormView.jsx';
import { CarePlanView } from '../../care-plan/CarePlanView/CarePlanView.jsx';
import { AppointmentStep } from '../steps/AppointmentStep/AppointmentStep.jsx';
import { PostVisitChecklist } from '../steps/PostVisitChecklist/PostVisitChecklist.jsx';
import { OpenCareGaps } from '../steps/OpenCareGaps/OpenCareGaps.jsx';
import { MedicationReconciliation } from '../steps/MedicationReconciliation/MedicationReconciliation.jsx';
import { ProgramRelatedTasks } from '../related/ProgramRelatedTasks/ProgramRelatedTasks.jsx';
import { AddTaskDrawer } from '../../../../../../tasks/TasksView';
import { ProgramRelatedFiles } from '../related/ProgramRelatedFiles/ProgramRelatedFiles.jsx';
import { ReferralReview } from '../steps/ReferralReview/ReferralReview.jsx';
import { ProgramDiagnosisGapsTable } from '../DiagnosisGapsStep/ProgramDiagnosisGapsTable.jsx';
import { AddLetterDrawer } from '../letters/AddLetterDrawer/AddLetterDrawer.jsx';
import { LetterHistoryDrawer } from '../letters/LetterHistoryDrawer/LetterHistoryDrawer.jsx';
import { LetterPreviewDrawer } from '../letters/LetterPreviewDrawer/LetterPreviewDrawer.jsx';
import { ConfirmDialog } from '../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { ProgramHistoryDrawer } from '../ProgramHistoryDrawer/ProgramHistoryDrawer.jsx';
import { useProgramHistory } from '../ProgramHistoryDrawer/useProgramHistory';
import { toast } from '../../../../../../../components/Toast/sonnerToast';
import { Collapse } from '../../../../../../../components/Collapse/Collapse';
import { CloseProgramDialog } from '../shared/CloseProgramDialog/CloseProgramDialog.jsx';
import { PauseCarePlanDialog } from '../../care-plan/drawers/PauseCarePlanDialog/PauseCarePlanDialog';
import { PROGRAM_STATUS_OPTIONS } from '../../../../../data/programStatus';
import { PharmacyOutreachStep } from '../../../../../../pharmacy-worklist/program/PharmacyOutreachStep';
import { PharmacyMedicationReview } from '../../../../../../pharmacy-worklist/program/PharmacyMedicationReview';
import { PharmacyVerificationStep } from '../../../../../../pharmacy-worklist/program/PharmacyVerificationStep';
import { PharmacyBarrierStep } from '../../../../../../pharmacy-worklist/program/PharmacyBarrierStep';
import { PharmacyGapClosureStep } from '../../../../../../pharmacy-worklist/program/PharmacyGapClosureStep';
import { PharmacyActivityLogStep } from '../../../../../../pharmacy-worklist/program/PharmacyActivityLog';
import { PharmacySnapshotStep } from '../../../../../../pharmacy-worklist/program/PharmacySnapshotStep';
import { useProgramDetailView } from './useProgramDetailView';
import { hasPendingRecommendation } from '../../care-plan/lib/carePlanRecommendation';
import { StepItem, SectionHeader, StepPlaceholder, CarePlanInPanelNotice } from './ProgramDetailViewParts';
import { useCarePlanPanelOpen } from '../../../../../hooks/useProgramPanelSplitActive';
import { ProgramDetailViewHeader } from './ProgramDetailViewHeader';
import { ProgramDetailViewContentHeader } from './ProgramDetailViewContentHeader';
import { ProgramDetailViewLetters } from './ProgramDetailViewLetters';
import { downloadLetters } from './ProgramDetailView.utils';
import { mmddyy } from './ProgramDetailView.utils';
import { ProgramReportDrawer } from '../report/ProgramReportDrawer';
import styles from './ProgramDetailView.module.css';

export function ProgramDetailView({ program, onClose, startAtFirstStep = false, onSwitchProgram }) {
  const v = useProgramDetailView({ program, onSwitchProgram });
  // A care plan recommendation awaiting approval marks the Care Plan step.
  const recommendationPending = useAppStore(s => hasPendingRecommendation(s.patientCarePlans[`${v.patientId}::${program.id}`]));
  const isRecommended = (step) => recommendationPending && step.name === 'Care Plan';
  const { stepFlags } = v;
  const isPharmacy = program.code === 'PHARM';
  const carePlanInPanel = useCarePlanPanelOpen();
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  const [programHistoryOpen, setProgramHistoryOpen] = useState(false);
  const [closing, setClosing] = useState(null); // { status } while the Close Program dialog is open
  const closeCareProgramInstance = useAppStore(s => s.closeCareProgramInstance);
  const pauseCareProgramInstance = useAppStore(s => s.pauseCareProgramInstance);
  const [pausing, setPausing] = useState(false); // while the Pause dialog is open
  const [reportOpen, setReportOpen] = useState(false);
  const reportProgram = useMemo(
    () => ({ ...program, ...(v.liveProgram || {}), status: v.status, assignee: v.assignee }),
    [program, v.liveProgram, v.status, v.assignee],
  );
  const fetchPatientProgramActivity = useAppStore(s => s.fetchPatientProgramActivity);
  const programHistory = useProgramHistory(program);
  useEffect(() => {
    if (programHistory.patientId) fetchPatientProgramActivity(programHistory.patientId);
  }, [programHistory.patientId, fetchPatientProgramActivity]);

  // End Program, or Completed / Discontinued picked as the status: close the
  // enrollment with a reason.
  const closeProgram = ({ reason, note, status }) => {
    closeCareProgramInstance(v.patientId, program.id, { reason, note, status });
    setClosing(null);
    toast.success(`${program.name} closed`);
  };

  const onMoreAction = (key) => {
    if (key === 'history') setProgramHistoryOpen(true);
    else if (key === 'report') setReportOpen(true);
    else if (key === 'end') setClosing({ status: null });
  };

  const assigneePicker = (
    <AssigneeChange
      avatarOnly
      size="M"
      name={v.isUnassigned ? undefined : v.assignee}
      initials={v.isUnassigned ? '' : v.initialsOf(v.assignee)}
      unassigned={v.isUnassigned}
      showRole={false}
      users={platformUsers}
      pickerTitle="Assign"
      onSelect={user => v.updateCareProgram(v.patientId, program.id, { assignee: user.name })}
    />
  );

  const renderStepBody = () => {
    if (stepFlags.isBillingStep) return <CcmBillingReview program={program} />;
    // Pharmacy program: outreach is logged per measure (MAD / MAH / MAC) and
    // Medication Review lists the medications behind those measures.
    if (isPharmacy && stepFlags.isOutreachStep) {
      return <div className={styles.outreachWrap}><PharmacyOutreachStep program={program} /></div>;
    }
    // The pharmacy steps are also reused in the Pharmacy Gap Details drawer,
    // which pads them itself, so the program view supplies the same padded,
    // scrolling body every other step has.
    const pharmacyStep = isPharmacy && (
      (stepFlags.isMedReconStep && <PharmacyMedicationReview />)
      || (v.stepName === 'Pharmacy Verification' && <PharmacyVerificationStep program={program} />)
      || (v.stepName === 'Snapshot' && <PharmacySnapshotStep />)
      || (v.stepName === 'Barriers & Interventions' && <PharmacyBarrierStep />)
      || (v.stepName === 'Gap Closure / Outcome' && <PharmacyGapClosureStep />)
      || (v.stepName === 'Activity Log' && <PharmacyActivityLogStep />)
    );
    if (pharmacyStep) return <div className={styles.pharmacyStep}>{pharmacyStep}</div>;
    if (stepFlags.isOutreachStep) {
      return (
        <div className={styles.outreachWrap}>
          <OutreachTab defaultPrograms={[program.code].filter(Boolean)} scopedProgram={program.code} defaultLogFor="care-program" defaultFormOpen />
        </div>
      );
    }
    if (stepFlags.isPreVisitStep) return <PreVisitStep programCode={program.code} />;
    if (stepFlags.isSnapshotStep) return <ProgramSnapshotStep programCode={program.code} patientId={v.patientId} programId={program.id} triggerType={program.triggerType} triggerDate={program.triggerDate} />;
    if (stepFlags.isCarePlanStep) {
      return carePlanInPanel ? <CarePlanInPanelNotice /> : <CarePlanView patientId={v.patientId} program={program} />;
    }
    if (stepFlags.isAppointmentStep) return <AppointmentStep patientId={v.currentPatient?.id} programCode={program.code} stepName={v.screenName} />;
    if (stepFlags.isOpenCareGapsStep) return <OpenCareGaps />;
    if (stepFlags.isMedReconStep) return <MedicationReconciliation programCode={program.code} />;
    if (stepFlags.isProgramTasksStep) {
      return <ProgramRelatedTasks programCode={program.code} patientId={v.patientId} onAddTask={() => v.setAddTaskOpen(true)} filters={v.taskFilters} search={v.taskSearchText} />;
    }
    if (stepFlags.isProgramFilesStep) return <ProgramRelatedFiles programCode={program.code} patientId={v.patientId} />;
    if (stepFlags.isReferralStep) return <ReferralReview />;
    if (v.assessmentCfg) {
      return v.assessmentCfg.checklist
        ? <PostVisitChecklist />
        : <AssessmentFormView formId={v.assessmentCfg.formId} formName={v.assessmentCfg.formName} />;
    }
    if (stepFlags.isLettersStep) {
      return (
        <ProgramDetailViewLetters
          letterSearchOpen={v.letterSearchOpen}
          setLetterSearchOpen={v.setLetterSearchOpen}
          letterSearchText={v.letterSearchText}
          setLetterSearchText={v.setLetterSearchText}
          activeLetterTab={v.activeLetterTab}
          setActiveLetterTab={v.setActiveLetterTab}
          setAddLetterOpen={v.setAddLetterOpen}
          letterFiltersOpen={v.letterFiltersOpen}
          setLetterFiltersOpen={v.setLetterFiltersOpen}
          letterFilterMeta={v.letterFilterMeta}
          letterFilters={v.letterFilters}
          setLetterFilter={v.setLetterFilter}
          letterFiltersActive={v.letterFiltersActive}
          clearLetterFilters={v.clearLetterFilters}
          allLettersSelected={v.allLettersSelected}
          someLettersSelected={v.someLettersSelected}
          toggleAllLetters={v.toggleAllLetters}
          shownLetters={v.shownLetters}
          selectedLetters={v.selectedLetters}
          toggleLetter={v.toggleLetter}
          setSendTarget={v.setSendTarget}
          setRowMenu={v.setRowMenu}
          setHistoryOpen={v.setHistoryOpen}
          previewLetter={v.previewLetter}
          isLettersPane={stepFlags.isLettersStep}
          downloadSelectedLetters={v.downloadSelectedLetters}
          letters={v.letters}
          setSelectedLetters={v.setSelectedLetters}
        />
      );
    }
    if (stepFlags.isDiagnosisGapsStep) return <ProgramDiagnosisGapsTable memberName={v.currentPatient?.name} search={v.diagGapsSearchText} />;
    return <StepPlaceholder name={v.stepName} />;
  };

  return (
    <div className={styles.container}>
      <ProgramDetailViewHeader
        program={program}
        programProgress={v.programProgress}
        status={v.status}
        setStatusMenu={v.setStatusMenu}
        assigneePicker={assigneePicker}
        isSnp={v.isSnp}
        prevTrigger={v.prevTrigger}
        nextTrigger={v.nextTrigger}
        triggerNum={v.triggerNum}
        onSwitchProgram={onSwitchProgram}
        detailsExpanded={v.detailsExpanded}
        setDetailsExpanded={v.setDetailsExpanded}
        isCcm={v.isCcm}
        otherPrograms={v.otherPrograms}
        progressFor={v.progressForCode}
        onMoreAction={onMoreAction}
        onClose={onClose}
      />

      <div className={styles.body}>
        <div className={styles.stepList}>
          {v.stepList.map(step => {
            if (step.type === 'section') {
              const expanded = v.expandedSections[step.id] ?? step.expanded;
              return (
                <div key={step.id}>
                  <SectionHeader name={step.name} expanded={expanded} onToggle={() => v.toggleSection(step.id)} />
                  <Collapse open={expanded}>
                    {step.children.map(child => (
                      <StepItem key={child.id} step={child} isActive={v.activeStep === child.id}
                        onClick={() => v.setActiveStep(child.id)} isChild recommended={isRecommended(child)} />
                    ))}
                  </Collapse>
                </div>
              );
            }
            return (
              <StepItem key={step.id} step={step} isActive={v.activeStep === step.id}
                onClick={() => v.setActiveStep(step.id)} recommended={isRecommended(step)} />
            );
          })}
        </div>

        <div className={styles.content}>
          <ProgramDetailViewContentHeader
            program={program}
            carePlanInPanel={carePlanInPanel}
            onSignMedRecon={(name, role) => {
              v.updateCareProgram(v.patientId, program.id, {
                medReconSignedBy: name,
                medReconSignedRole: role,
                medReconSignedAt: mmddyy(),
              });
              v.logActivity('Medication Reconciliation Signed', { activityKind: 'medication', statusLabel: `Signed by ${name}`, statusType: 'success' });
            }}
            stepFlags={stepFlags}
            assessmentCfg={v.assessmentCfg}
            stepName={v.stepName}
            isMandatoryStep={v.isMandatoryStep}
            assigneePicker={assigneePicker}
            taskSearchOpen={v.taskSearchOpen}
            setTaskSearchOpen={v.setTaskSearchOpen}
            taskSearchText={v.taskSearchText}
            setTaskSearchText={v.setTaskSearchText}
            diagGapsSearchOpen={v.diagGapsSearchOpen}
            setDiagGapsSearchOpen={v.setDiagGapsSearchOpen}
            diagGapsSearchText={v.diagGapsSearchText}
            setDiagGapsSearchText={v.setDiagGapsSearchText}
            setAddTaskOpen={v.setAddTaskOpen}
            taskFiltersOpen={v.taskFiltersOpen}
            setTaskFiltersOpen={v.setTaskFiltersOpen}
            taskFilterMeta={v.taskFilterMeta}
            taskFilters={v.taskFilters}
            setTaskFilter={v.setTaskFilter}
            taskFiltersActive={v.taskFiltersActive}
            goNextStep={v.goNextStep}
            nextStep={v.ALL_STEPS[v.ALL_STEPS.findIndex(s => s.id === v.activeStep) + 1]}
            stepStatus={v.activeStepStatus}
            stepStatusSource={v.activeStepSource}
            onMarkStep={v.markStep}
          />
          {renderStepBody()}
        </div>
      </div>

      {v.sendTarget && (
        <SendLetterDrawer
          letterName={v.sendTarget.letterName}
          memberName={v.currentPatient?.name}
          memberId={v.currentPatient?.memberId}
          onClose={() => v.setSendTarget(null)}
          onSent={() => {
            v.logActivity(`Letter Sent: ${v.sendTarget.letterName}`, { activityKind: 'letter', statusLabel: 'Sent', statusType: 'success' });
            if (v.sendTarget.clearOnSent) v.setSelectedLetters(new Set());
          }}
        />
      )}

      {v.rowMenu && (
        <MenuPopover
          anchorRect={v.rowMenu.rect}
          ariaLabel="Letter actions"
          width={168}
          items={[
            { key: 'preview', icon: 'solar:eye-linear', label: 'Preview' },
            { key: 'download', icon: 'solar:download-minimalistic-linear', label: 'Download' },
          ]}
          onSelect={(key) => {
            const letter = v.letters.find(l => l.id === v.rowMenu.id);
            if (!letter) return;
            if (key === 'download') downloadLetters([letter], toast);
            else if (key === 'preview') v.previewLetter(letter);
          }}
          onClose={() => v.setRowMenu(null)}
        />
      )}

      {v.addLetterOpen && (
        <AddLetterDrawer
          letters={v.letters}
          addedIds={v.addedLetterIds}
          onAdd={(letter) => {
            v.setAddedLetterIds(prev => new Set(prev).add(letter.id));
            toast.success(`${letter.fileName} added`);
            v.logActivity(`Letter Added: ${letter.fileName}`, { activityKind: 'letter', statusLabel: 'Added', statusType: 'neutral' });
          }}
          onPreview={v.previewLetter}
          onDownload={(letter) => downloadLetters([letter], toast)}
          onClose={() => v.setAddLetterOpen(false)}
        />
      )}

      {v.historyOpen && (
        <LetterHistoryDrawer letters={v.letters} onOpen={v.previewLetter} onClose={() => v.setHistoryOpen(false)} />
      )}

      {v.previewTarget && (
        <LetterPreviewDrawer letter={v.previewTarget} onClose={() => v.setPreviewTarget(null)} />
      )}

      {v.addTaskOpen && (
        <AddTaskDrawer
          onClose={() => v.setAddTaskOpen(false)}
          initialMember={v.currentPatient?.name}
          extraFields={{ program_code: program.code, patient_id: v.patientId != null ? String(v.patientId) : null }}
          onTaskCreated={(t) => {
            v.setAddTaskOpen(false);
            if (program.code && t) v.addProgramTask(program.code, t);
          }}
        />
      )}

      {v.statusMenu && (
        <MenuPopover
          anchorRect={v.statusMenu.rect}
          align="left"
          width={180}
          ariaLabel="Change status"
          items={PROGRAM_STATUS_OPTIONS.map(s => ({
            key: s,
            label: <span style={{ color: 'var(--neutral-400)' }}>{s}</span>,
          }))}
          onSelect={(newStatus) => {
            if (newStatus === 'Completed' || newStatus === 'Discontinued') setClosing({ status: newStatus });
            else if (newStatus === 'Paused') { if (v.status !== 'Paused') setPausing(true); }
            else v.changeStatus(newStatus);
          }}
          onClose={() => v.setStatusMenu(null)}
        />
      )}
      {programHistoryOpen && (
        <ProgramHistoryDrawer program={program} onClose={() => setProgramHistoryOpen(false)} />
      )}
      {reportOpen && (
        <ProgramReportDrawer
          program={reportProgram}
          stepList={v.stepList}
          stepCtx={v.stepCtx}
          progress={v.programProgress}
          activity={programHistory.entries}
          letters={v.letters}
          onExport={kind => v.logActivity(kind === 'print' ? 'Program Report Printed' : 'Program Report Downloaded', { activityKind: 'document' })}
          onClose={() => setReportOpen(false)}
        />
      )}
      {pausing && (
        <PauseCarePlanDialog
          subject="program"
          onCancel={() => setPausing(false)}
          onSubmit={async (form) => {
            setPausing(false);
            if (await pauseCareProgramInstance(v.patientId, v.liveProgram || program, form)) toast.success(`${program.name} paused`);
          }}
        />
      )}
      {closing && (
        <CloseProgramDialog
          program={program}
          status={closing.status}
          onSubmit={closeProgram}
          onCancel={() => setClosing(null)}
        />
      )}
    </div>
  );
}
