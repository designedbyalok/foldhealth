import { Fragment, useState } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../components/Icon/AddIconMinimalist';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../../components/Button/Button';
import { Link } from '../../../../../../../components/Link/Link';
import { SelectAssigneeModal } from '../../../../../../../components/SelectAssigneeModal/SelectAssigneeModal';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { PenIcon } from '../../../../../../../components/Icon/PenIcon';
import { SearchBar } from '../../../../../../../components/SearchBar/SearchBar';
import { FilterChip } from '../../../../../../../components/FilterChip/FilterChip';
import { todayMMDDYYYY } from '../../../../../../tasks/TasksView.utils';
import { MED_RECON_MOCK } from '../../../../../data/medReconMock';
import { CarePlanHeader } from '../../care-plan/CarePlanHeader/CarePlanHeader';
import { EMPTY_TASK_FILTERS } from './ProgramDetailView.utils';
import styles from './ProgramDetailView.module.css';

// Sign dropdown actions: Figma SNP-Story 3039:621576. "Send for Sign Off"
// carries the right-chevron submenu affordance from the design; its submenu
// isn't specced yet, so selecting it currently has no handler.
const EMPTY_CHECKS = {};

const SIGN_MENU_ITEMS = [
  { key: 'sign-self', iconElement: <PenIcon size={16} color="var(--neutral-400)" />, label: 'Sign (Self)' },
  { key: 'sign-np', iconElement: <PenIcon size={16} color="var(--neutral-400)" />, label: 'Sign (NP)' },
  { key: 'send-sign-off', icon: 'solar:checklist-minimalistic-linear', label: 'Send for Sign Off' },
];

export function ProgramDetailViewContentHeader({
  program,
  carePlanInPanel,
  onSignMedRecon,
  stepFlags,
  assessmentCfg,
  stepName,
  isMandatoryStep,
  assigneePicker,
  taskSearchOpen,
  setTaskSearchOpen,
  taskSearchText,
  setTaskSearchText,
  diagGapsSearchOpen,
  setDiagGapsSearchOpen,
  diagGapsSearchText,
  setDiagGapsSearchText,
  setAddTaskOpen,
  taskFiltersOpen,
  setTaskFiltersOpen,
  taskFilterMeta,
  taskFilters,
  setTaskFilter,
  taskFiltersActive,
  goNextStep,
  nextStep,
  stepStatus,
  stepStatusSource,
  onMarkStep,
}) {
  // Reviewed / Skip save the step's status for this patient enrollment.
  // A step already completed by its records (e.g. a signed care plan)
  // shows as done and isn't toggled by hand.
  const reviewed = stepStatus === 'completed';
  const skipped = stepStatus === 'skipped';
  const lockedByRecords = reviewed && stepStatusSource === 'records';
  const skipLink = !isMandatoryStep && (
    skipped
      ? <Link variant="secondary" onClick={() => onMarkStep?.(null)}>Undo Skip</Link>
      : !reviewed && <Link variant="secondary" onClick={() => onMarkStep?.('skipped')}>Skip</Link>
  );
  const reviewedButton = (size = 'md') => (
    <Button
      variant={reviewed ? 'soft' : 'outline'} tone={reviewed ? 'success' : 'primary'}
      size={size}
      leadingIcon="solar:check-circle-linear"
      disabled={lockedByRecords}
      onClick={() => onMarkStep?.(reviewed ? null : 'completed')}
    >
      Reviewed
    </Button>
  );
  // A divider between each action shown; hidden ones (Skip on a mandatory
  // step, no assignee picker) don't leave two dividers side by side.
  const withDividers = (...actions) => actions.filter(Boolean).flatMap((a, i) => (
    i === 0 ? [<Fragment key={i}>{a}</Fragment>] : [<span key={`d${i}`} className={styles.headerDivider} />, <Fragment key={i}>{a}</Fragment>]
  ));
  const [signOffOpen, setSignOffOpen] = useState(false);
  const patient = useAppStore(s => s.patients.find(p => p.id === s.selectedPatientId));
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const createTask = useAppStore(s => s.createTask);
  const showToast = useAppStore(s => s.showToast);
  const selectedPatientId = useAppStore(s => s.selectedPatientId);

  // "Send for Sign Off" → pick an assignee, then file a task against them.
  const createSignOffTask = async (user) => {
    const memberName = patient?.name || '';
    const me = currentUserProfile?.name || null;
    const created = await createTask({
      name: `Sign off on med recon for ${memberName}`,
      status: 'pending',
      priority: 'medium',
      due_date: todayMMDDYYYY(),
      assigned_to: user.name,
      assigned_to_id: user.id,
      member: memberName,
      labels: [],
      meta: '',
      description: '',
      pool: null,
      mentions: [],
      attachments: 0,
      comments: 0,
      is_subtask: false,
      parent_task: null,
      parent_task_id: null,
      created_by: me,
      created_by_id: currentUserProfile?.id || null,
      program_code: program?.code || null,
      patient_id: selectedPatientId != null ? String(selectedPatientId) : null,
    });
    showToast?.(created
      ? `Sign-off task assigned to ${user.name}`
      : 'Could not create the sign-off task');
  };

  // Signing is gated on the mandatory Medication Checklist, every box has to
  // be ticked before Sign / Send for Sign Off is available.
  const medReconChecks = useAppStore(s => s.medReconChecks[s.selectedPatientId]) || EMPTY_CHECKS;
  const medReconChecklistDone = MED_RECON_MOCK.checklist.every(c => medReconChecks[c.id]);

  const medReconSignedBy = program?.medReconSignedBy || null;
  const medReconSignature = medReconSignedBy
    ? `Signed by ${medReconSignedBy}${program.medReconSignedRole ? ` (${program.medReconSignedRole})` : ''} on ${program.medReconSignedAt}`
    : null;

  // Sign (Self) / Sign (NP) both stamp the current user; the menu choice is
  // what lands in the parenthetical role.
  const signMedRecon = (role) => {
    const name = currentUserProfile?.name;
    if (!name) { showToast?.('Could not sign: no signed-in user'); return; }
    onSignMedRecon?.(name, role);
    showToast?.('Medication reconciliation signed');
  };

  const {
    isBillingStep, isOutreachStep, isPreVisitStep, isCarePlanStep,
    isAppointmentStep, isOpenCareGapsStep, isMedReconStep,
    isProgramTasksStep, isProgramFilesStep, isReferralStep, isLettersStep,
    isDiagnosisGapsStep,
  } = stepFlags;

  if (isBillingStep) return null;

  // Simple steps render a single-line `.contentTitle` span with a compact
  // action row on the right; keeping the row centered avoids the title
  // top-anchoring against the taller action cluster.
  const isCompactHeader = !assessmentCfg && !isMedReconStep && !isReferralStep && !isCarePlanStep;

  return (
    <div className={`${styles.contentHeader} ${isCarePlanStep ? styles.contentHeaderCarePlan : ''} ${isDiagnosisGapsStep ? styles.contentHeaderDiagGaps : ''}`}>
      <div className={`${styles.contentHeaderRow} ${isCarePlanStep ? styles.contentHeaderRowCarePlan : ''} ${isCompactHeader ? styles.contentHeaderRowCompact : ''}`}>
        {assessmentCfg ? (
          <div className={styles.assessmentHeader}>
            <div className={styles.assessmentHeaderText}>
              <span className={styles.assessmentTitle}>{assessmentCfg.title}</span>
              {assessmentCfg.filledBy && (
                <span className={styles.assessmentMeta}>
                  Filled by {assessmentCfg.filledBy} on {assessmentCfg.filledDate} • Reviewed by {assessmentCfg.reviewedBy} on {assessmentCfg.reviewedDate}
                </span>
              )}
            </div>
          </div>
        ) : isMedReconStep ? (
          <div className={styles.assessmentHeader}>
            <div className={styles.assessmentHeaderText}>
              <span className={styles.assessmentTitle}>{program?.code === 'PHARM' ? 'Medication Review' : 'Medication Reconciliation'}</span>
              <span className={medReconSignature ? styles.assessmentMetaSigned : styles.assessmentMeta}>
                {medReconSignature || 'Last Reviewed by Robert Fox on 11/10/24'}
              </span>
            </div>
          </div>
        ) : isReferralStep ? (
          <div className={styles.assessmentHeader}>
            <div className={styles.assessmentHeaderText}>
              <span className={styles.assessmentTitle}>Referral Review</span>
              <span className={styles.assessmentMeta}>Reviewed by Jonathan Bush (NP) on 05/01/25</span>
            </div>
          </div>
        ) : isCarePlanStep && !carePlanInPanel ? (
          <CarePlanHeader patientId={selectedPatientId} program={program} />
        ) : (
          <span className={styles.contentTitle}>
            {isOutreachStep ? 'Outreach'
              : isPreVisitStep ? 'Pre-visit'
              : isAppointmentStep ? 'Follow Up Appointments'
              : isOpenCareGapsStep ? 'Open Care Gaps'
              : isProgramTasksStep ? 'Program Related Tasks'
              : isProgramFilesStep ? 'Document Library'
              : isLettersStep ? 'Program Related Letters'
              : isCarePlanStep ? 'Care Plan'
              : stepName}
          </span>
        )}
        {!isCarePlanStep && (
        <div className={styles.contentActions}>
          {isMedReconStep ? (
            <>
              {withDividers(assigneePicker, skipLink, medReconSignature ? (
                <Button variant="soft" tone="success" leadingIcon="solar:check-circle-linear">Reviewed</Button>
              ) : (
                <Button
                  variant="outline" tone="primary"
                  menuItems={SIGN_MENU_ITEMS}
                  menuWidth={220}
                  menuAriaLabel="Sign options"
                  onMenuSelect={(key) => {
                    // The Medication Checklist is mandatory: the control stays
                    // enabled so the reason is discoverable, and the attempt
                    // surfaces it rather than a dead button.
                    if (!medReconChecklistDone) {
                      showToast?.('Complete Medication Checklist to sign.');
                      return;
                    }
                    if (key === 'send-sign-off') setSignOffOpen(true);
                    else if (key === 'sign-self') signMedRecon('Self');
                    else if (key === 'sign-np') signMedRecon('NP');
                  }}
                >
                  Sign
                </Button>
              ), <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" />)}
              <SelectAssigneeModal
                open={signOffOpen}
                onClose={() => setSignOffOpen(false)}
                onConfirm={(user) => { setSignOffOpen(false); createSignOffTask(user); }}
              />
            </>
          ) : isProgramTasksStep ? (
            <>
              {taskSearchOpen ? (
                <SearchBar className={styles.taskSearch} placeholder="Search tasks" value={taskSearchText}
                  onChange={e => setTaskSearchText(e.target.value)}
                  onClose={() => { setTaskSearchOpen(false); setTaskSearchText(''); }} />
              ) : (
                <ActionButton icon="solar:magnifer-linear" size="sm" tooltip="Search" onClick={() => setTaskSearchOpen(true)} />
              )}
              <span className={styles.headerDivider} />
              <Button variant="soft" leadingIconElement={<AddIconMinimalist size={16} />} onClick={() => setAddTaskOpen(true)}>Add Task</Button>
              <span className={styles.headerDivider} />
              <ActionButton icon="solar:filter-linear" size="sm" tooltip="Filter" active={taskFiltersOpen}
                iconColor={taskFiltersOpen ? 'var(--primary-300)' : undefined}
                onClick={() => setTaskFiltersOpen(v => !v)} />
            </>
          ) : isOutreachStep ? (
            <>
              {assigneePicker}
              <span className={styles.headerDivider} />
              <Button variant="soft" onClick={goNextStep} disabled={!nextStep}>Next</Button>
            </>
          ) : isProgramFilesStep ? (
            <>
              {skipLink}
            </>
          ) : isAppointmentStep ? (
            <>
              {withDividers(assigneePicker, skipLink, <Button variant="soft" onClick={goNextStep} disabled={!nextStep}>Next</Button>)}
            </>
          ) : isDiagnosisGapsStep ? (
            <>
              {diagGapsSearchOpen ? (
                <SearchBar
                  className={styles.diagGapsSearch}
                  placeholder="Search"
                  value={diagGapsSearchText}
                  onChange={e => setDiagGapsSearchText(e.target.value)}
                  onClose={() => { setDiagGapsSearchOpen(false); setDiagGapsSearchText(''); }}
                />
              ) : (
                <ActionButton
                  icon="solar:magnifer-linear"
                  size="sm"
                  tooltip="Search"
                  onClick={() => setDiagGapsSearchOpen(true)}
                />
              )}
              <span className={styles.headerDivider} />
              {withDividers(reviewedButton('md'), <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" />)}
            </>
          ) : (
            <>
              {withDividers(assigneePicker, skipLink, reviewedButton(), <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" />)}
            </>
          )}
        </div>
        )}
      </div>
      {isProgramTasksStep && taskFiltersOpen && (
        <div className={styles.headerFilterBar}>
          {taskFilterMeta.map(f => (
            <FilterChip key={f.key} label={f.label} options={f.options}
              selected={taskFilters[f.key]} onChange={vals => setTaskFilter(f.key, vals)} />
          ))}
          {taskFiltersActive && (
            <button className={styles.headerClearAll} onClick={() => Object.keys(EMPTY_TASK_FILTERS).forEach(k => setTaskFilter(k, []))}>
              <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
              Clear All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
