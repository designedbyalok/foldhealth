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
import { carePlanSignShareEnabled } from '../lib/carePlanSignState';
import styles from '../../program-detail/ProgramDetailView/ProgramDetailView.module.css';

function fmtCarePlanDate(isoOrDisplay) {
  if (!isoOrDisplay) return '';
  const short = typeof isoOrDisplay === 'string' && /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(isoOrDisplay);
  if (short) return `${short[1]}/${short[2]}/20${short[3]}`;
  const d = parseLocalDate(isoOrDisplay);
  if (!d) return String(isoOrDisplay);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// Care plan sign-menu — split button. The main half signs directly
// (Sign is the primary action), the chevron opens a menu with the
// alternate path (send to a reviewer). Same split pattern the med-recon
// signer uses so the two step surfaces read consistently.
const CARE_PLAN_SIGN_MENU_ITEMS = [
  { key: 'review', icon: 'solar:checklist-minimalistic-linear', label: 'Send for Review' },
];

/**
 * Care plan header: "Care Plan • Ver. N" (opens version history), who created
 * and signed it, and the plan toolbar (Search, Filter, Bulk select, Preview,
 * Sign / Send for Review, More). Rendered by the program Care Plan step and by
 * the patient-level Care Plan tab, so both read and act identically.
 */
export function CarePlanHeader({ patientId, program }) {
  const [carePlanReviewOpen, setCarePlanReviewOpen] = useState(false);
  const [carePlanMoreMenu, setCarePlanMoreMenu] = useState(null);
  const requestCarePlanShare = useAppStore(s => s.requestCarePlanShare);
  const carePlanShareRequest = useAppStore(s => s.carePlanShareRequest);
  const requestCarePlanPanel = useAppStore(s => s.requestCarePlanPanel);
  const carePlanBulkMode = useAppStore(s => s.carePlanBulkMode);
  const toggleCarePlanBulkMode = useAppStore(s => s.toggleCarePlanBulkMode);
  const carePlanSearchText = useAppStore(s => s.carePlanSearchText);
  const setCarePlanSearchText = useAppStore(s => s.setCarePlanSearchText);
  const carePlanFiltersOpen = useAppStore(s => s.carePlanFiltersOpen);
  const toggleCarePlanFiltersOpen = useAppStore(s => s.toggleCarePlanFiltersOpen);
  const [carePlanSearchOpen, setCarePlanSearchOpen] = useState(false);
  const carePlanKey = patientId && program?.id ? `${patientId}::${program.id}` : null;
  const liveCarePlan = useAppStore(s => (carePlanKey ? s.patientCarePlans[carePlanKey] : null));
  const carePlanVersions = useAppStore(s => (carePlanKey ? s.patientCarePlanVersions[carePlanKey] : null));
  const fetchCarePlanVersions = useAppStore(s => s.fetchCarePlanVersions);
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const signCarePlan = useAppStore(s => s.signCarePlan);
  const requestCarePlanReview = useAppStore(s => s.requestCarePlanReview);
  const carePlanAudit = useAppStore(s => (carePlanKey ? s.patientCarePlanAudit[carePlanKey] : null));
  const showToast = useAppStore(s => s.showToast);

  useEffect(() => {
    if (!patientId || !program?.id) return;
    fetchPatientCarePlan(patientId, program.id);
    if (carePlanVersions === undefined) fetchCarePlanVersions(patientId, program.id);
  }, [patientId, program?.id, fetchPatientCarePlan, fetchCarePlanVersions, carePlanVersions]);

  const carePlanMeta = useMemo(() => {
    const plan = liveCarePlan?.plan;
    // Author and date come from the plan row itself. Plans created before the
    // author was recorded fall back to the earliest version's author, but only
    // when that version was cut the same day the plan was created — a later
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
                size="L"
                tooltip="Filter"
                className={carePlanFiltersOpen ? styles.iconActive : ''}
                onClick={toggleCarePlanFiltersOpen}
              />
              <span className={styles.headerDivider} aria-hidden="true" />
              <BulkSelectToggle active={carePlanBulkMode} onToggle={toggleCarePlanBulkMode} />
              <span className={styles.headerDivider} aria-hidden="true" />
              {/* Templates moved to the plan's chip row, next to the
                  applied templates it manages. */}
              <Button
                variant="secondary"
                size="L"
                leadingIcon="solar:eye-linear"
                aria-pressed={carePlanShareRequest === 'preview'}
                onClick={() => requestCarePlanShare('preview')}
              >
                Preview
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
        </div>
    </>
  );
}
