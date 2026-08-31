import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../components/Icon/AddIconMinimalist';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { BulkSelectToggle } from '../../../../../../../components/BulkSelect/BulkSelectToggle';
import { Button } from '../../../../../../../components/Button/Button';
import { Link } from '../../../../../../../components/Link/Link';
import { SelectAssigneeModal } from '../../../../../../../components/SelectAssigneeModal/SelectAssigneeModal';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { PenIcon } from '../../../../../../../components/Icon/PenIcon';
import { SearchBar } from '../../../../../../../components/SearchBar/SearchBar';
import { FilterChip } from '../../../../../../../components/FilterChip/FilterChip';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { DownChevronIcon } from '../../../../../../../components/Icon/DownChevronIcon';
import { todayMMDDYYYY } from '../../../../../../tasks/TasksView.utils';
import { MED_RECON_MOCK } from '../../../../../data/medReconMock';
import { CARE_PLAN_MOCK } from '../../../../../data/carePlanMock';
import { EMPTY_TASK_FILTERS } from './ProgramDetailView.utils';
import styles from './ProgramDetailView.module.css';

function fmtCarePlanDate(isoOrDisplay) {
  if (!isoOrDisplay) return '';
  if (typeof isoOrDisplay === 'string' && /^\d{2}\/\d{2}\/\d{2}$/.test(isoOrDisplay)) return isoOrDisplay;
  const d = new Date(isoOrDisplay);
  if (Number.isNaN(d.getTime())) return String(isoOrDisplay);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

function CarePlanActionDivider() {
  return <span className={styles.carePlanActionDivider} aria-hidden="true" />;
}

// Sign dropdown actions — Figma SNP-Story 3039:621576. "Send for Sign Off"
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
  setAddTaskOpen,
  taskFiltersOpen,
  setTaskFiltersOpen,
  taskFilterMeta,
  taskFilters,
  setTaskFilter,
  taskFiltersActive,
  goNextStep,
  nextStep,
}) {
  const [signOffOpen, setSignOffOpen] = useState(false);
  const [carePlanMoreMenu, setCarePlanMoreMenu] = useState(null);
  const patient = useAppStore(s => s.patients.find(p => p.id === s.selectedPatientId));
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const createTask = useAppStore(s => s.createTask);
  const showToast = useAppStore(s => s.showToast);
  const requestCarePlanShare = useAppStore(s => s.requestCarePlanShare);
  const requestCarePlanPanel = useAppStore(s => s.requestCarePlanPanel);
  const carePlanBulkMode = useAppStore(s => s.carePlanBulkMode);
  const toggleCarePlanBulkMode = useAppStore(s => s.toggleCarePlanBulkMode);
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const carePlanKey = selectedPatientId && program?.id ? `${selectedPatientId}::${program.id}` : null;
  const liveCarePlan = useAppStore(s => (carePlanKey ? s.patientCarePlans[carePlanKey] : null));
  const carePlanVersions = useAppStore(s => (carePlanKey ? s.patientCarePlanVersions[carePlanKey] : null));
  const fetchCarePlanVersions = useAppStore(s => s.fetchCarePlanVersions);
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);

  useEffect(() => {
    if (!stepFlags?.isCarePlanStep || !selectedPatientId || !program?.id) return;
    fetchPatientCarePlan(selectedPatientId, program.id);
    if (carePlanVersions === undefined) fetchCarePlanVersions(selectedPatientId, program.id);
  }, [stepFlags?.isCarePlanStep, selectedPatientId, program?.id, fetchPatientCarePlan, fetchCarePlanVersions, carePlanVersions]);

  const carePlanMeta = useMemo(() => {
    const plan = liveCarePlan?.plan;
    const createdBy = plan?.createdBy || CARE_PLAN_MOCK.createdBy;
    const createdDate = fmtCarePlanDate(plan?.createdDate || CARE_PLAN_MOCK.createdDate);
    const versionNumber = Math.max(1, carePlanVersions?.[0]?.versionNumber ?? 0);
    const usingMock = !plan;
    const signedBy = plan?.signedBy || null;
    return { createdBy, createdDate, versionNumber, usingMock, signedBy };
  }, [liveCarePlan, carePlanVersions]);

  const carePlanMoreItems = useMemo(() => {
    const items = [
      { key: 'versions', icon: 'solar:layers-minimalistic-linear', label: 'Versions' },
      { key: 'history', iconElement: <Icon name="custom:history" size={16} color="var(--neutral-400)" />, label: 'History' },
    ];
    if (!carePlanMeta.usingMock && carePlanMeta.signedBy) {
      items.push({ key: 'note', icon: 'solar:notes-linear', label: 'Add Note' });
    } else if (!carePlanMeta.usingMock) {
      items.push({ key: 'sign', icon: 'solar:pen-2-linear', label: 'Sign' });
    }
    return items;
  }, [carePlanMeta]);

  const handleCarePlanMoreSelect = (key) => {
    setCarePlanMoreMenu(null);
    requestCarePlanPanel(key);
  };

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
    });
    showToast?.(created
      ? `Sign-off task assigned to ${user.name}`
      : 'Could not create the sign-off task');
  };

  // Signing is gated on the mandatory Medication Checklist — every box has to
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
    if (!name) { showToast?.('Could not sign — no signed-in user'); return; }
    onSignMedRecon?.(name, role);
    showToast?.('Medication reconciliation signed');
  };

  const {
    isBillingStep, isOutreachStep, isPreVisitStep, isCarePlanStep,
    isAppointmentStep, isOpenCareGapsStep, isMedReconStep,
    isProgramTasksStep, isProgramFilesStep, isReferralStep, isLettersStep,
  } = stepFlags;

  if (isBillingStep) return null;

  return (
    <div className={styles.contentHeader}>
      <div className={styles.contentHeaderRow}>
        {assessmentCfg ? (
          <div className={styles.assessmentHeader}>
            <div className={styles.assessmentHeaderText}>
              <span className={styles.assessmentTitle}>{assessmentCfg.title}</span>
              <span className={styles.assessmentMeta}>
                Filled by {assessmentCfg.filledBy} on {assessmentCfg.filledDate} • Reviewed by {assessmentCfg.reviewedBy} on {assessmentCfg.reviewedDate}
              </span>
            </div>
          </div>
        ) : isMedReconStep ? (
          <div className={styles.assessmentHeader}>
            <div className={styles.assessmentHeaderText}>
              <span className={styles.assessmentTitle}>Medication Reconciliation</span>
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
        ) : isCarePlanStep ? (
          <div className={styles.assessmentHeader}>
            <div className={styles.assessmentHeaderText}>
              <button
                type="button"
                className={styles.carePlanTitleBtn}
                onClick={() => requestCarePlanPanel('versions')}
                aria-label="Open version history"
              >
                <span className={styles.assessmentTitle}>Care Plan • Ver. {carePlanMeta.versionNumber}</span>
                <DownChevronIcon size={16} color="var(--neutral-500)" />
              </button>
              <span className={styles.assessmentMeta}>
                Created by {carePlanMeta.createdBy} on {carePlanMeta.createdDate}
              </span>
            </div>
          </div>
        ) : (
          <span className={styles.contentTitle}>
            {isOutreachStep ? 'Outreach'
              : isPreVisitStep ? 'Pre-visit'
              : isAppointmentStep ? 'Follow Up Appointments'
              : isOpenCareGapsStep ? 'Open Care Gaps'
              : isProgramTasksStep ? 'Program Related Tasks'
              : isProgramFilesStep ? 'Document Library'
              : isLettersStep ? 'Program Related Letters'
              : stepName}
          </span>
        )}
        <div className={`${styles.contentActions} ${isCarePlanStep ? styles.carePlanActionBar : ''}`}>
          {isCarePlanStep ? (
            <>
              <ActionButton icon="solar:magnifer-linear" size="S" tooltip="Search" onClick={() => requestCarePlanPanel('filter')} />
              <CarePlanActionDivider />
              <ActionButton icon="solar:download-minimalistic-linear" size="S" tooltip="Download" onClick={() => requestCarePlanShare('preview')} />
              <CarePlanActionDivider />
              <ActionButton
                iconElement={<Icon name="custom:history" size={16} color="var(--neutral-400)" />}
                size="S"
                tooltip="History"
                onClick={() => requestCarePlanPanel('history')}
              />
              <CarePlanActionDivider />
              <ActionButton icon="solar:copy-linear" size="S" tooltip="Copy" onClick={() => showToast?.('Copy — coming soon')} />
              <CarePlanActionDivider />
              <BulkSelectToggle size="S" active={carePlanBulkMode} onToggle={toggleCarePlanBulkMode} />
              <CarePlanActionDivider />
              <Button variant="secondary" size="L" leadingIcon="solar:eye-linear" onClick={() => requestCarePlanShare('preview')}>
                Preview
              </Button>
              <Button
                variant="secondary"
                size="L"
                leadingIcon="solar:bookmark-linear"
                disabled={carePlanMeta.usingMock}
                onClick={() => requestCarePlanPanel('template')}
              >
                Save as Template
              </Button>
              <Button variant="alt" size="L" leadingIcon="solar:pen-2-linear" onClick={() => requestCarePlanShare('share')}>
                Sign &amp; Share
              </Button>
              <CarePlanActionDivider />
              <ActionButton
                icon="solar:menu-dots-linear"
                size="S"
                tooltip="More"
                onClick={(e) => setCarePlanMoreMenu({ rect: e.currentTarget.getBoundingClientRect() })}
              />
              {carePlanMoreMenu && (
                <MenuPopover
                  anchorRect={carePlanMoreMenu.rect}
                  align="right"
                  width={180}
                  ariaLabel="Care plan actions"
                  items={carePlanMoreItems}
                  onSelect={handleCarePlanMoreSelect}
                  onClose={() => setCarePlanMoreMenu(null)}
                />
              )}
            </>
          ) : isMedReconStep ? (
            <>
              {assigneePicker}
              <span className={styles.headerDivider} />
              {!isMandatoryStep && <Link variant="secondary">Skip</Link>}
              <span className={styles.headerDivider} />
              {medReconSignature ? (
                <Button variant="tertiary" size="L" leadingIcon="solar:check-circle-linear">Reviewed</Button>
              ) : (
                <Button
                  variant="alt"
                  size="L"
                  menuItems={SIGN_MENU_ITEMS}
                  menuWidth={220}
                  menuAriaLabel="Sign options"
                  onMenuSelect={(key) => {
                    // The Medication Checklist is mandatory — the control stays
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
              )}
              <SelectAssigneeModal
                open={signOffOpen}
                onClose={() => setSignOffOpen(false)}
                onConfirm={(user) => { setSignOffOpen(false); createSignOffTask(user); }}
              />
              <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" />
            </>
          ) : isProgramTasksStep ? (
            <>
              {taskSearchOpen ? (
                <SearchBar className={styles.taskSearch} placeholder="Search tasks" value={taskSearchText}
                  onChange={e => setTaskSearchText(e.target.value)}
                  onClose={() => { setTaskSearchOpen(false); setTaskSearchText(''); }} />
              ) : (
                <ActionButton icon="solar:magnifer-linear" size="S" tooltip="Search" onClick={() => setTaskSearchOpen(true)} />
              )}
              <span className={styles.headerDivider} />
              <Button variant="tertiary" size="L" leadingIconElement={<AddIconMinimalist size={16} />} onClick={() => setAddTaskOpen(true)}>Add Task</Button>
              <span className={styles.headerDivider} />
              <ActionButton icon="solar:filter-linear" size="S" tooltip="Filter" active={taskFiltersOpen}
                iconColor={taskFiltersOpen ? 'var(--primary-300)' : undefined}
                onClick={() => setTaskFiltersOpen(v => !v)} />
            </>
          ) : isOutreachStep ? (
            <>
              {assigneePicker}
              <span className={styles.headerDivider} />
              <Button variant="tertiary" size="L" onClick={goNextStep} disabled={!nextStep}>Next</Button>
            </>
          ) : isProgramFilesStep ? (
            <>
              {!isMandatoryStep && <Link variant="secondary">Skip</Link>}
            </>
          ) : isAppointmentStep ? (
            <>
              {assigneePicker}
              {!isMandatoryStep && <Link variant="secondary">Skip</Link>}
              <Button variant="tertiary" size="L" onClick={goNextStep} disabled={!nextStep}>Next</Button>
            </>
          ) : (
            <>
              {assigneePicker}
              {!isMandatoryStep && <Link variant="secondary">Skip</Link>}
              <Button variant="tertiary" size="L" leadingIcon="solar:check-circle-linear">Reviewed</Button>
              <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" />
            </>
          )}
        </div>
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
