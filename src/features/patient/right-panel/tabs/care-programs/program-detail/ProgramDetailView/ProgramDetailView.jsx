import { useEffect } from 'react';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { AssigneeChange } from '../../../../../../../components/AssigneeChange/AssigneeChange';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { OutreachTab } from '../../../../../left-panel/tabs/outreach/OutreachTab/OutreachTab.jsx';
import { CcmBillingReview } from '../billing/CcmBillingReview/CcmBillingReview.jsx';
import { SendLetterDrawer } from '../letters/SendLetterDrawer/SendLetterDrawer.jsx';
import { PreVisitStep } from '../steps/PreVisitStep/PreVisitStep.jsx';
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
import { DiagnosisGapsTable } from '../../../../../left-panel/tabs/gaps/DiagnosisGapsTable/DiagnosisGapsTable.jsx';
import { AddLetterDrawer } from '../letters/AddLetterDrawer/AddLetterDrawer.jsx';
import { LetterHistoryDrawer } from '../letters/LetterHistoryDrawer/LetterHistoryDrawer.jsx';
import { LetterPreviewDrawer } from '../letters/LetterPreviewDrawer/LetterPreviewDrawer.jsx';
import { toast } from '../../../../../../../components/Toast/sonnerToast';
import { PROGRAM_STATUS_OPTIONS } from '../../../../../data/programStatus';
import { useProgramDetailView } from './useProgramDetailView';
import { StepItem, SectionHeader, StepPlaceholder } from './ProgramDetailViewParts';
import { ProgramDetailViewHeader } from './ProgramDetailViewHeader';
import { ProgramDetailViewContentHeader } from './ProgramDetailViewContentHeader';
import { ProgramDetailViewLetters } from './ProgramDetailViewLetters';
import { downloadLetters } from './ProgramDetailView.utils';
import { mmddyy } from './ProgramDetailView.utils';
import styles from './ProgramDetailView.module.css';

export function ProgramDetailView({ program, onClose, startAtFirstStep = false, onSwitchProgram }) {
  const v = useProgramDetailView({ program, onSwitchProgram });
  const { stepFlags } = v;
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

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
    if (stepFlags.isOutreachStep) {
      return (
        <div className={styles.outreachWrap}>
          <OutreachTab defaultPrograms={[program.code].filter(Boolean)} scopedProgram={program.code} defaultLogFor="care-program" defaultFormOpen />
        </div>
      );
    }
    if (stepFlags.isPreVisitStep) return <PreVisitStep programCode={program.code} />;
    if (stepFlags.isCarePlanStep) return <CarePlanView patientId={v.patientId} program={program} />;
    if (stepFlags.isAppointmentStep) return <AppointmentStep patientId={v.currentPatient?.id} programCode={program.code} />;
    if (stepFlags.isOpenCareGapsStep) return <OpenCareGaps />;
    if (stepFlags.isMedReconStep) return <MedicationReconciliation />;
    if (stepFlags.isProgramTasksStep) {
      return <ProgramRelatedTasks programCode={program.code} patientId={v.patientId} onAddTask={() => v.setAddTaskOpen(true)} filters={v.taskFilters} search={v.taskSearchText} />;
    }
    if (stepFlags.isProgramFilesStep) return <ProgramRelatedFiles programCode={program.code} patientId={v.patientId} />;
    if (stepFlags.isReferralStep) return <ReferralReview />;
    if (v.assessmentCfg) {
      return v.assessmentCfg.checklist
        ? <PostVisitChecklist />
        : <AssessmentFormView formName={v.assessmentCfg.formName} />;
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
    if (stepFlags.isDiagnosisGapsStep) return <DiagnosisGapsTable memberName={v.currentPatient?.name} />;
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
                  {expanded && step.children.map(child => (
                    <StepItem key={child.id} step={child} isActive={v.activeStep === child.id}
                      onClick={() => v.setActiveStep(child.id)} isChild />
                  ))}
                </div>
              );
            }
            return (
              <StepItem key={step.id} step={step} isActive={v.activeStep === step.id}
                onClick={() => v.setActiveStep(step.id)} />
            );
          })}
        </div>

        <div className={styles.content}>
          <ProgramDetailViewContentHeader
            program={program}
            onSignMedRecon={(name, role) => v.updateCareProgram(v.patientId, program.id, {
              medReconSignedBy: name,
              medReconSignedRole: role,
              medReconSignedAt: mmddyy(),
            })}
            stepFlags={stepFlags}
            assessmentCfg={v.assessmentCfg}
            stepName={v.stepName}
            isMandatoryStep={v.isMandatoryStep}
            assigneePicker={assigneePicker}
            taskSearchOpen={v.taskSearchOpen}
            setTaskSearchOpen={v.setTaskSearchOpen}
            taskSearchText={v.taskSearchText}
            setTaskSearchText={v.setTaskSearchText}
            setAddTaskOpen={v.setAddTaskOpen}
            taskFiltersOpen={v.taskFiltersOpen}
            setTaskFiltersOpen={v.setTaskFiltersOpen}
            taskFilterMeta={v.taskFilterMeta}
            taskFilters={v.taskFilters}
            setTaskFilter={v.setTaskFilter}
            taskFiltersActive={v.taskFiltersActive}
            goNextStep={v.goNextStep}
            nextStep={v.ALL_STEPS[v.ALL_STEPS.findIndex(s => s.id === v.activeStep) + 1]}
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
          onSent={() => { if (v.sendTarget.clearOnSent) v.setSelectedLetters(new Set()); }}
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
          onSelect={(newStatus) => v.changeStatus(newStatus)}
          onClose={() => v.setStatusMenu(null)}
        />
      )}
    </div>
  );
}
