import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../components/Icon/AddIconMinimalist';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { BulkSelectToggle } from '../../../../../../../components/BulkSelect/BulkSelectToggle';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Tooltip } from '../../../../../../../components/Tooltip/Tooltip';
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
import { carePlanSignShareEnabled } from '../../care-plan/lib/carePlanSignState';
import { EMPTY_TASK_FILTERS } from './ProgramDetailView.utils';
import styles from './ProgramDetailView.module.css';

function fmtCarePlanDate(isoOrDisplay) {
  if (!isoOrDisplay) return '';
  const short = typeof isoOrDisplay === 'string' && /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(isoOrDisplay);
  if (short) return `${short[1]}/${short[2]}/20${short[3]}`;
  const d = new Date(isoOrDisplay);
  if (Number.isNaN(d.getTime())) return String(isoOrDisplay);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
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

// Care plan sign-menu — split button. The main half signs directly
// (Sign is the primary action), the chevron opens a menu with the
// two alternate paths (send to a reviewer, save the working copy as
// a draft). Same split pattern the med-recon signer uses so the two
// step surfaces read consistently.
const CARE_PLAN_SIGN_MENU_ITEMS = [
  { key: 'review', icon: 'solar:checklist-minimalistic-linear', label: 'Send for Review' },
  { key: 'draft', icon: 'solar:bookmark-linear', label: 'Save as Draft' },
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
}) {
  const [signOffOpen, setSignOffOpen] = useState(false);
  const [carePlanReviewOpen, setCarePlanReviewOpen] = useState(false);
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
  const signCarePlan = useAppStore(s => s.signCarePlan);
  const requestCarePlanReview = useAppStore(s => s.requestCarePlanReview);
  const carePlanAudit = useAppStore(s => (carePlanKey ? s.patientCarePlanAudit[carePlanKey] : null));

  useEffect(() => {
    if (!stepFlags?.isCarePlanStep || !selectedPatientId || !program?.id) return;
    fetchPatientCarePlan(selectedPatientId, program.id);
    if (carePlanVersions === undefined) fetchCarePlanVersions(selectedPatientId, program.id);
  }, [stepFlags?.isCarePlanStep, selectedPatientId, program?.id, fetchPatientCarePlan, fetchCarePlanVersions, carePlanVersions]);

  const carePlanMeta = useMemo(() => {
    const plan = liveCarePlan?.plan;
    // Author and date come from the plan row itself. Plans created before the
    // author was recorded fall back to the earliest version's author, but only
    // when that version was cut the same day the plan was created — a later
    // signature says who signed, not who authored, and naming the wrong person
    // is worse than naming none.
    const sameDay = (a, b) => {
      if (!a || !b) return false;
      const x = new Date(a); const y = new Date(b);
      return !Number.isNaN(x) && !Number.isNaN(y) && x.toDateString() === y.toDateString();
    };
    const firstVersion = carePlanVersions?.length ? carePlanVersions[carePlanVersions.length - 1] : null;
    const createdBy = plan?.createdBy
      || (sameDay(firstVersion?.createdAt, plan?.createdDate) ? firstVersion?.createdBy : '')
      || '';
    const createdDate = fmtCarePlanDate(plan?.createdDate || '');
    const versionNumber = Math.max(1, carePlanVersions?.[0]?.versionNumber ?? 0);
    const usingMock = !plan;
    const signedBy = plan?.signedBy || null;
    const signedAt = plan?.signedAt || null;
    // Look for a pending "review requested" audit entry — the newest
    // review event that hasn't been overtaken by a `signed` event.
    // The audit slice is newest-first, so the first plan-level entry
    // we find determines the current state (signed → clears review,
    // review_requested → sets pending).
    let reviewRequestedTo = null;
    let reviewRequestedAt = null;
    for (const entry of (carePlanAudit || [])) {
      if (entry.entityType !== 'plan') continue;
      if (entry.action === 'signed') break;
      if (entry.action === 'review_requested') {
        reviewRequestedTo = entry.summary || null;
        reviewRequestedAt = entry.detail || entry.createdAt || null;
        break;
      }
    }
    // A brand-new sign clears any pending review even if the audit row
    // is stale for a moment — signedAt wins.
    if (signedAt) { reviewRequestedTo = null; reviewRequestedAt = null; }
    return { createdBy, createdDate, versionNumber, usingMock, signedBy, signedAt, reviewRequestedTo, reviewRequestedAt };
  }, [liveCarePlan, carePlanVersions, carePlanAudit]);

  const signShareEnabled = useMemo(
    () => carePlanSignShareEnabled(liveCarePlan, { usingMock: carePlanMeta.usingMock }),
    [liveCarePlan, carePlanMeta.usingMock],
  );

  const carePlanMoreItems = useMemo(() => {
    const items = [
      { key: 'template', icon: 'solar:bookmark-linear', label: 'Save as Template' },
      { key: 'note', icon: 'solar:notes-linear', label: 'Add Note' },
      { key: 'history', iconElement: <Icon name="custom:history" size={16} color="var(--neutral-400)" />, label: 'History' },
    ];
    return items;
  }, []);

  const handleCarePlanMoreSelect = (key) => {
    setCarePlanMoreMenu(null);
    if (key === 'bulk') toggleCarePlanBulkMode();
    else if (key === 'preview') requestCarePlanShare('preview');
    else requestCarePlanPanel(key);
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

  // Care-plan sign menu handlers. All three routes gate on the same
  // signShareEnabled precondition the primary CTA used (plan exists,
  // patient loaded, care plan step is active); the menu button itself
  // stays disabled otherwise so the picker never opens with no plan
  // to act on.
  const signCarePlanDirect = async () => {
    if (!selectedPatientId || !program) return;
    const v = await signCarePlan(selectedPatientId, program, '');
    if (v) showToast?.('Care plan signed');
  };
  const createCarePlanReviewTask = async (user) => {
    if (!selectedPatientId || !program) return;
    const created = await requestCarePlanReview(selectedPatientId, program, user);
    showToast?.(created
      ? `Care plan sent to ${user.name} for review`
      : 'Could not send the care plan for review');
  };
  const saveCarePlanAsDraft = () => {
    // Care plans persist edits in-place until signed, so "Save as Draft"
    // is confirmation UX rather than a distinct write path. The button
    // just acknowledges the working copy is safely stored.
    showToast?.('Care plan saved as draft');
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
              {(() => {
                // Meta row under the title. Responsive by container width:
                //   • Narrow  — "Created by …" collapses into a compact
                //               [•••] Badge (shared component) that reveals
                //               the full text via the shared Tooltip.
                //   • Wide    — the full "Created by …" text renders inline.
                // Status tail (right of the bullet) prefers, in order:
                //   1. "Sent for review to X on <date>" — warning, when a
                //      review is pending (unsigned).
                //   2. "Signed by X on <date>" — green.
                //   3. "Draft" — neutral grey.
                // A plan with no recorded author reads "Created on <date>" —
                // naming nobody beats naming the wrong clinician.
                const createdText = carePlanMeta.createdBy
                  ? `Created by ${carePlanMeta.createdBy} on ${carePlanMeta.createdDate}`
                  : `Created on ${carePlanMeta.createdDate}`;
                const fmtShort = (iso) => fmtCarePlanDate(iso);
                let statusText = 'Draft';
                let statusColor = 'var(--neutral-300)';
                let statusWeight = 400;
                if (carePlanMeta.reviewRequestedTo) {
                  const on = carePlanMeta.reviewRequestedAt ? ` on ${fmtShort(carePlanMeta.reviewRequestedAt)}` : '';
                  statusText = `Sent for review to ${carePlanMeta.reviewRequestedTo}${on}`;
                  statusColor = 'var(--status-warning)';
                  statusWeight = 500;
                } else if (carePlanMeta.signedBy) {
                  const on = carePlanMeta.signedAt ? ` on ${fmtShort(carePlanMeta.signedAt)}` : '';
                  statusText = `Signed by ${carePlanMeta.signedBy}${on}`;
                  statusColor = 'var(--status-success)';
                  statusWeight = 500;
                }
                return (
                  <span className={styles.carePlanAttribution}>
                    <span className={styles.carePlanCreatedCollapsed}>
                      <Tooltip label={createdText}>
                        <Badge
                          size="S"
                          tone="grey"
                          icon="solar:menu-dots-linear"
                          className={styles.carePlanCreatedDotsBadge}
                          aria-label={createdText}
                        />
                      </Tooltip>
                    </span>
                    <span className={styles.carePlanCreatedFull}>{createdText}</span>
                    <span className={styles.carePlanAttributionSep} aria-hidden="true">•</span>
                    <span
                      className={styles.carePlanAttributionText}
                      style={{ color: statusColor, fontWeight: statusWeight }}
                    >
                      {statusText}
                    </span>
                  </span>
                );
              })()}
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
        <div className={isCarePlanStep ? styles.carePlanActionBar : styles.contentActions}>
          {isCarePlanStep ? (
            <>
              <BulkSelectToggle size="S" active={carePlanBulkMode} onToggle={toggleCarePlanBulkMode} />
              <span className={styles.headerDivider} aria-hidden="true" />
              <ActionButton icon="solar:download-minimalistic-linear" size="L" tooltip="Download" onClick={() => requestCarePlanShare('preview')} />
              <span className={styles.headerDivider} aria-hidden="true" />
              <Button
                variant="ghost"
                size="L"
                leadingIcon="solar:add-linear"
                onClick={() => requestCarePlanPanel('templates')}
              >
                Template
              </Button>
              <span className={styles.headerDivider} aria-hidden="true" />
              <Button
                variant="primary"
                size="M"
                leadingIcon="solar:pen-2-linear"
                disabled={!signShareEnabled}
                onClick={signCarePlanDirect}
                menuItems={CARE_PLAN_SIGN_MENU_ITEMS}
                menuWidth={200}
                menuAriaLabel="Sign care plan options"
                onMenuSelect={(key) => {
                  if (key === 'review') setCarePlanReviewOpen(true);
                  else if (key === 'draft') saveCarePlanAsDraft();
                }}
              >
                Sign
              </Button>
              <SelectAssigneeModal
                open={carePlanReviewOpen}
                title="Send care plan for review"
                onClose={() => setCarePlanReviewOpen(false)}
                onConfirm={(user) => { setCarePlanReviewOpen(false); createCarePlanReviewTask(user); }}
              />
              <span className={styles.headerDivider} aria-hidden="true" />
              <ActionButton
                icon="solar:menu-dots-linear"
                size="L"
                tooltip="More"
                onClick={(e) => setCarePlanMoreMenu({ rect: e.currentTarget.getBoundingClientRect() })}
              />
              {carePlanMoreMenu && (
                <MenuPopover
                  anchorRect={carePlanMoreMenu.rect}
                  align="right"
                  width={200}
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
                  size="S"
                  tooltip="Search"
                  onClick={() => setDiagGapsSearchOpen(true)}
                />
              )}
              <Button variant="tertiary" size="M" leadingIcon="solar:check-circle-linear">Reviewed</Button>
              <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" />
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
