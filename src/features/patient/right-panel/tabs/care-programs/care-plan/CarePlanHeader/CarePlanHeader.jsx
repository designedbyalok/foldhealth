import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { BulkSelectToggle } from '../../../../../../../components/BulkSelect/BulkSelectToggle';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Tooltip } from '../../../../../../../components/Tooltip/Tooltip';
import { Button } from '../../../../../../../components/Button/Button';
import { SelectAssigneeModal } from '../../../../../../../components/SelectAssigneeModal/SelectAssigneeModal';
import { SearchBar } from '../../../../../../../components/SearchBar/SearchBar';
import { SearchIconButton } from '../../../../../../../components/SearchIconButton/SearchIconButton';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { DownChevronIcon } from '../../../../../../../components/Icon/DownChevronIcon';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { parseLocalDate } from '../../../../../../../lib/localDate';
import { carePlanAwaitingSignature, carePlanSignShareEnabled } from '../lib/carePlanSignState';
import { CompleteCarePlanDialog } from '../drawers/CompleteCarePlanDialog/CompleteCarePlanDialog';
import { GuidedReviewDrawer } from '../drawers/GuidedReviewDrawer/GuidedReviewDrawer';
import { useCarePlanDraftState } from '../lib/useCarePlanDraftState';
import { ConfirmDialog } from '../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { useCarePlanPanelMenu } from '../../../../../hooks/useProgramPanelSplitActive';
import { isCarePlanPaused } from '../lib/carePlanPause';
import styles from '../../program-detail/ProgramDetailView/ProgramDetailView.module.css';

function fmtCarePlanDate(isoOrDisplay) {
  if (!isoOrDisplay) return '';
  const short = typeof isoOrDisplay === 'string' && /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(isoOrDisplay);
  if (short) return `${short[1]}/${short[2]}/20${short[3]}`;
  const d = parseLocalDate(isoOrDisplay);
  if (!d) return String(isoOrDisplay);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// Care plan sign-menu: split button. The main half is Complete (the care
// manager completes the plan and sends it to a provider to sign) or, once it
// is awaiting that signature, Sign. The chevron keeps the other paths: sign
// it now without the provider step, or send it to a reviewer. Same split
// pattern the med-recon signer uses so the two step surfaces read alike.
const REVIEW_ITEM = { key: 'review', icon: 'solar:checklist-minimalistic-linear', label: 'Send for Review' };
const SIGN_NOW_ITEM = { key: 'sign', icon: 'solar:pen-2-linear', label: 'Sign Now' };

/**
 * Care plan header: "Care Plan • Ver. N" (opens version history), who created
 * and signed it, and the plan toolbar (Search, Filter, Bulk select, Preview,
 * Sign / Send for Review, More). Rendered by the program Care Plan step and by
 * the patient-level Care Plan tab, so both read and act identically.
 */
export function CarePlanHeader({ patientId, program, inPanel = false }) {
  const [carePlanReviewOpen, setCarePlanReviewOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reviewOpenHere, setReviewOpen] = useState(false);
  const completeCarePlan = useAppStore(s => s.completeCarePlan);
  const [carePlanMoreMenu, setCarePlanMoreMenu] = useState(null);
  const requestCarePlanShare = useAppStore(s => s.requestCarePlanShare);
  const carePlanShareRequest = useAppStore(s => s.carePlanShareRequest);
  const requestCarePlanPanel = useAppStore(s => s.requestCarePlanPanel);
  const carePlanBulkMode = useAppStore(s => s.carePlanBulkMode);
  const toggleCarePlanBulkMode = useAppStore(s => s.toggleCarePlanBulkMode);
  const carePlanLayout = useAppStore(s => s.carePlanLayout);
  const setCarePlanLayout = useAppStore(s => s.setCarePlanLayout);
  const carePlanSearchText = useAppStore(s => s.carePlanSearchText);
  const setCarePlanSearchText = useAppStore(s => s.setCarePlanSearchText);
  const carePlanFiltersOpen = useAppStore(s => s.carePlanFiltersOpen);
  const toggleCarePlanFiltersOpen = useAppStore(s => s.toggleCarePlanFiltersOpen);
  const [carePlanSearchOpen, setCarePlanSearchOpen] = useState(false);
  const carePlanKey = patientId && program?.id ? `${patientId}::${program.id}` : null;
  // Start Review from Look at These First opens the same drawer.
  const reviewAsked = useAppStore(s => !!carePlanKey && s.carePlanReviewOpenFor === carePlanKey);
  const openCarePlanReviewFor = useAppStore(s => s.openCarePlanReviewFor);
  const reviewOpen = reviewOpenHere || reviewAsked;
  const closeReview = () => { setReviewOpen(false); if (reviewAsked) openCarePlanReviewFor(null); };
  // A review left open with something saved on it (an item discussed or a
  // call note) is picked up where it stopped, as the review drawer does.
  const reviewInProgress = useAppStore(s => {
    const open = carePlanKey ? s.carePlanReviews[carePlanKey]?.open : null;
    return !!open && (Object.keys(open.discussed || {}).length > 0 || !!(open.callNote || '').replace(/<[^>]*>/g, '').trim());
  });
  const liveCarePlan = useAppStore(s => (carePlanKey ? s.patientCarePlans[carePlanKey] : null));
  const carePlanVersions = useAppStore(s => (carePlanKey ? s.patientCarePlanVersions[carePlanKey] : null));
  const fetchCarePlanVersions = useAppStore(s => s.fetchCarePlanVersions);
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const signCarePlan = useAppStore(s => s.signCarePlan);
  const requestCarePlanReview = useAppStore(s => s.requestCarePlanReview);
  const carePlanAudit = useAppStore(s => (carePlanKey ? s.patientCarePlanAudit[carePlanKey] : null));
  const showToast = useAppStore(s => s.showToast);
  const discardCarePlanDraft = useAppStore(s => s.discardCarePlanDraft);
  const [discardOpen, setDiscardOpen] = useState(false);
  const carePlanDraft = useCarePlanDraftState(patientId, program?.id);
  const viewedVersion = useAppStore(s => (carePlanKey ? s.viewedCarePlanVersion[carePlanKey] : null));

  useEffect(() => {
    if (!patientId || !program?.id) return;
    fetchPatientCarePlan(patientId, program.id);
    if (carePlanVersions === undefined) fetchCarePlanVersions(patientId, program.id);
  }, [patientId, program?.id, fetchPatientCarePlan, fetchCarePlanVersions, carePlanVersions]);

  const carePlanMeta = useMemo(() => {
    const plan = liveCarePlan?.plan;
    // Author and date come from the plan row itself. Plans created before the
    // author was recorded fall back to the earliest version's author, but only
    // when that version was cut the same day the plan was created, a later
    // signature says who signed, not who authored, and naming the wrong person
    // is worse than naming none.
    const sameDay = (a, b) => {
      if (!a || !b) return false;
      const x = parseLocalDate(a); const y = parseLocalDate(b);
      return !!x && !!y && x.toDateString() === y.toDateString();
    };
    const firstVersion = carePlanVersions?.length ? carePlanVersions[carePlanVersions.length - 1] : null;
    const createdBy = plan?.createdBy
      || (sameDay(firstVersion?.createdAt, plan?.createdDate) ? firstVersion?.createdBy : '')
      || '';
    const createdDate = fmtCarePlanDate(plan?.createdDate || '');
    const versionNumber = carePlanVersions?.[0]?.versionNumber ?? 0;
    const usingMock = !plan;
    const signedBy = plan?.signedBy || null;
    const signedAt = plan?.signedAt || null;
    // Look for a pending "review requested" audit entry: the newest
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
    // A brand-new sign clears any pending review even if the audit row is
    // stale for a moment. A review asked for on changes made after the
    // signature is still pending until those changes are signed.
    if (signedAt && !carePlanDraft.hasUnsignedChanges) { reviewRequestedTo = null; reviewRequestedAt = null; }
    return { createdBy, createdDate, versionNumber, usingMock, signedBy, signedAt, reviewRequestedTo, reviewRequestedAt };
  }, [liveCarePlan, carePlanVersions, carePlanAudit, carePlanDraft.hasUnsignedChanges]);

  // Completed and waiting for the provider; or completed, then edited, so it
  // has to be completed again.
  const plan = liveCarePlan?.plan;
  const awaitingSignature = !viewedVersion && carePlanAwaitingSignature(liveCarePlan);
  const completedThenEdited = !viewedVersion && !awaitingSignature && !!plan?.completedAt
    && !(plan.signedAt && new Date(plan.signedAt) >= new Date(plan.completedAt));

  const signShareEnabled = useMemo(
    () => carePlanSignShareEnabled(liveCarePlan, { usingMock: carePlanMeta.usingMock, draft: carePlanDraft }),
    [liveCarePlan, carePlanMeta.usingMock, carePlanDraft],
  );

  // Floating sidebar only: open this plan in its own panel (or switch to
  // the right-panel layout with it there), or, inside that panel, put it
  // back in the program. Patient-level plans get the layout toggle.
  const rightPanel = useCarePlanPanelMenu({ program, inPanel });
  const rightPanelItems = rightPanel.items;
  // Pause / Resume for a live plan (not while reading an older version).
  const canPause = !!liveCarePlan?.plan?.id && !viewedVersion;
  const planPaused = isCarePlanPaused(liveCarePlan?.plan);
  const carePlanMoreItems = useMemo(() => {
    const items = [
      ...rightPanelItems,
      carePlanLayout === 'linkage'
        ? { key: 'layout', icon: 'solar:list-linear', label: 'Table View' }
        : { key: 'layout', icon: 'solar:link-linear', label: 'Linkage View' },
      { key: 'ai-plan', iconElement: <Icon name="custom:ai" size={16} />, label: 'Recommend Care Plan' },
      ...(canPause ? [planPaused
        ? { key: 'resume', icon: 'solar:play-circle-linear', label: 'Resume Care Plan' }
        : { key: 'pause', icon: 'solar:pause-circle-linear', label: 'Pause Care Plan' }] : []),
      { key: 'template', icon: 'solar:bookmark-linear', label: 'Save as Template' },
      { key: 'note', icon: 'solar:notes-linear', label: 'Add Note' },
      { key: 'history', iconElement: <Icon name="custom:history" size={16} color="var(--neutral-400)" />, label: 'History' },
      // Unsigned changes since the last signed version: discarding asks first.
      ...(carePlanDraft.canDiscard ? [{
        key: 'discard',
        icon: 'solar:restart-linear',
        label: 'Discard Changes',
        danger: true,
        disabled: !!viewedVersion,
      }] : []),
    ];
    return items;
  }, [rightPanelItems, carePlanLayout, canPause, planPaused, carePlanDraft.canDiscard, viewedVersion]);

  const handleCarePlanMoreSelect = (key) => {
    setCarePlanMoreMenu(null);
    if (rightPanel.select(key)) return;
    if (key === 'discard') setDiscardOpen(true);
    else if (key === 'bulk') toggleCarePlanBulkMode();
    else if (key === 'layout') setCarePlanLayout(carePlanLayout === 'linkage' ? 'tables' : 'linkage');
    else if (key === 'preview') requestCarePlanShare('preview');
    else requestCarePlanPanel(key);
  };

  // Care-plan sign menu handlers. All three routes gate on the same
  // signShareEnabled precondition the primary CTA used (plan exists,
  // patient loaded, care plan step is active); the menu button itself
  // stays disabled otherwise so the picker never opens with no plan
  // to act on.
  const signCarePlanDirect = async () => {
    if (!patientId || !program) return;
    const v = await signCarePlan(patientId, program, '');
    if (v) showToast?.('Care plan signed');
  };
  const submitComplete = async ({ signer, agreement, copy }) => {
    setCompleteOpen(false);
    if (!patientId || !program) return;
    const done = await completeCarePlan(patientId, program, { signer, agreement, copy });
    if (done) showToast?.(`Care plan sent to ${signer.name} to sign`);
  };
  const createCarePlanReviewTask = async (user) => {
    if (!patientId || !program) return;
    const created = await requestCarePlanReview(patientId, program, user);
    showToast?.(created
      ? `Care plan sent to ${user.name} for review`
      : 'Could not send the care plan for review');
  };

  return (
    <>
          <div className={styles.assessmentHeader}>
            <div className={styles.assessmentHeaderText}>
              <button
                type="button"
                className={styles.carePlanTitleBtn}
                onClick={() => requestCarePlanPanel('versions')}
                aria-label="Open version history"
              >
                <span className={styles.assessmentTitle}>
                  Care Plan • {viewedVersion
                    ? `Ver. ${viewedVersion.versionNumber} (read only)`
                    : carePlanMeta.signedBy && carePlanMeta.versionNumber ? `Ver. ${carePlanMeta.versionNumber}` : 'Draft'}
                </span>
                <DownChevronIcon size={16} color="var(--neutral-500)" />
              </button>
              {(() => {
                // Meta row under the title. Responsive by container width:
                //   • Narrow: "Created by …" collapses into a compact
                //               [•••] Badge (shared component) that reveals
                //               the full text via the shared Tooltip.
                //   • Wide: the full "Created by …" text renders inline.
                // Status tail (right of the bullet) prefers, in order:
                //   1. "Sent for review to X on <date>", warning, when a
                //      review is pending (unsigned).
                //   2. "N unsigned changes since vN": warning, when the
                //      draft differs from the signed version.
                //   3. "Signed by X on <date>": green.
                //   4. "Not signed": neutral grey.
                // A plan with no recorded author reads "Created on <date>",
                // naming nobody beats naming the wrong clinician.
                const createdText = carePlanMeta.createdBy
                  ? `Created by ${carePlanMeta.createdBy} on ${carePlanMeta.createdDate}`
                  : `Created on ${carePlanMeta.createdDate}`;
                const fmtShort = (iso) => fmtCarePlanDate(iso);
                let statusText = 'Not signed';
                let statusColor = 'var(--neutral-300)';
                let statusWeight = 400;
                if (viewedVersion) {
                  // A past version reads as itself, not the live draft.
                  const verb = viewedVersion.reason === 'restore' ? 'Restored' : viewedVersion.reason === 'signed' ? 'Signed' : 'Saved';
                  statusText = `${verb}${viewedVersion.createdBy ? ` by ${viewedVersion.createdBy}` : ''}${viewedVersion.createdAt ? ` on ${fmtShort(viewedVersion.createdAt)}` : ''}`;
                  statusColor = 'var(--status-success)';
                  statusWeight = 500;
                } else if (awaitingSignature) {
                  const by = plan.completedBy ? ` • Completed by ${plan.completedBy} on ${fmtShort(plan.completedAt)}` : '';
                  statusText = `Awaiting ${plan.awaitingSigner || 'provider'}'s signature${by}`;
                  statusColor = 'var(--status-warning)';
                  statusWeight = 500;
                } else if (completedThenEdited) {
                  statusText = 'Changed after completing, complete it again';
                  statusColor = 'var(--status-warning)';
                  statusWeight = 500;
                } else if (carePlanMeta.reviewRequestedTo) {
                  const on = carePlanMeta.reviewRequestedAt ? ` on ${fmtShort(carePlanMeta.reviewRequestedAt)}` : '';
                  statusText = `Sent for review to ${carePlanMeta.reviewRequestedTo}${on}`;
                  statusColor = 'var(--status-warning)';
                  statusWeight = 500;
                } else if (carePlanMeta.signedBy && carePlanDraft.hasUnsignedChanges) {
                  const n = carePlanDraft.changes.length;
                  const since = carePlanMeta.versionNumber ? ` since v${carePlanMeta.versionNumber}` : '';
                  statusText = n
                    ? `${n} unsigned ${n === 1 ? 'change' : 'changes'}${since}`
                    : `Unsigned changes${since}`;
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
                          size="sm"
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
        <div className={styles.carePlanActionBar}>
              {carePlanSearchOpen || carePlanSearchText ? (
                <SearchBar
                  className={styles.taskSearch}
                  placeholder="Search goals, interventions, barriers"
                  value={carePlanSearchText}
                  onChange={e => setCarePlanSearchText(e.target.value)}
                  onClose={() => { setCarePlanSearchOpen(false); setCarePlanSearchText(''); }}
                />
              ) : (
                <SearchIconButton onClick={() => setCarePlanSearchOpen(true)} />
              )}
              <span className={styles.headerDivider} aria-hidden="true" />
              {/* Same filter glyph and active tint as the worklist toolbar. */}
              <ActionButton
                icon="custom:filter"
                tooltip="Filter"
                className={carePlanFiltersOpen ? styles.iconActive : ''}
                onClick={toggleCarePlanFiltersOpen}
              />
              <span className={styles.headerDivider} aria-hidden="true" />
              <BulkSelectToggle active={carePlanBulkMode} onToggle={toggleCarePlanBulkMode} />
              <span className={styles.headerDivider} aria-hidden="true" />
              {/* Templates moved to the plan's chip row, next to the
                  applied templates it manages. */}
              {/* Start / Resume Review: labelled where there's room, an icon
                  with a tooltip in a narrow plan (container query). */}
              <span className={styles.carePlanReviewFull}>
                <Button
                  variant="outline"
                  leadingIcon="solar:clipboard-check-linear"
                  disabled={!liveCarePlan?.plan?.id || !!viewedVersion}
                  onClick={() => setReviewOpen(true)}
                >
                  {reviewInProgress ? 'Resume Review' : 'Start Review'}
                </Button>
              </span>
              <span className={styles.carePlanReviewIcon}>
                <ActionButton
                  icon="solar:clipboard-check-linear"
                  tooltip={reviewInProgress ? 'Resume Review' : 'Start Review'}
                  aria-label={reviewInProgress ? 'Resume Review' : 'Start Review'}
                  disabled={!liveCarePlan?.plan?.id || !!viewedVersion}
                  onClick={() => setReviewOpen(true)}
                />
              </span>
              {reviewOpen && program && (
                <GuidedReviewDrawer
                  key={carePlanKey}
                  patientId={patientId}
                  program={program}
                  signable={signShareEnabled}
                  awaitingSignature={awaitingSignature}
                  onClose={(result) => { closeReview(); if (result?.sendToSign) setCompleteOpen(true); }}
                />
              )}
              <Button
                variant="outline"
                leadingIcon="solar:eye-linear"
                aria-pressed={carePlanShareRequest === 'preview'}
                onClick={() => requestCarePlanShare('preview')}
              >
                Preview
              </Button>
              <span className={styles.headerDivider} aria-hidden="true" />
              <Button
                leadingIcon={awaitingSignature ? 'solar:pen-2-linear' : 'solar:check-read-linear'}
                disabled={!signShareEnabled || !!viewedVersion}
                onClick={awaitingSignature ? signCarePlanDirect : () => setCompleteOpen(true)}
                menuItems={awaitingSignature ? [REVIEW_ITEM] : [SIGN_NOW_ITEM, REVIEW_ITEM]}
                menuWidth={200}
                menuAriaLabel="Sign care plan options"
                onMenuSelect={(key) => {
                  if (key === 'review') setCarePlanReviewOpen(true);
                  if (key === 'sign') signCarePlanDirect();
                }}
              >
                {awaitingSignature ? 'Sign' : 'Complete'}
              </Button>
              {completeOpen && (
                <CompleteCarePlanDialog
                  patientId={patientId}
                  program={program}
                  onCancel={() => setCompleteOpen(false)}
                  onSubmit={submitComplete}
                />
              )}
              {discardOpen && carePlanDraft.latestVersion && (
                <ConfirmDialog
                  variant="destructive"
                  title={`Discard ${carePlanDraft.changes.length} unsigned ${carePlanDraft.changes.length === 1 ? 'change' : 'changes'}?`}
                  description={`The care plan goes back to version ${carePlanDraft.latestVersion.versionNumber}${carePlanMeta.signedBy ? `, as signed by ${carePlanMeta.signedBy}` : ''}. Notes and readings are kept. Tasks created for interventions added since then are deleted.`}
                  confirmLabel="Discard Changes"
                  onCancel={() => setDiscardOpen(false)}
                  onConfirm={() => { setDiscardOpen(false); discardCarePlanDraft(patientId, program); }}
                />
              )}
              <SelectAssigneeModal
                open={carePlanReviewOpen}
                title="Send care plan for review"
                onClose={() => setCarePlanReviewOpen(false)}
                onConfirm={(user) => { setCarePlanReviewOpen(false); createCarePlanReviewTask(user); }}
              />
              <span className={styles.headerDivider} aria-hidden="true" />
              <ActionButton
                icon="solar:menu-dots-linear"
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
        </div>
    </>
  );
}
