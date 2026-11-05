import { useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { DownChevronIcon } from '../../components/Icon/DownChevronIcon';
import { Badge } from '../../components/Badge/Badge';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { PriorityIcon } from '../../components/PriorityIcon/PriorityIcon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { MetaLine, ViewMoreButton } from '../../components/ActivityLog/ActivityLog';
import { historyTimelineStyles as htStyles } from '../../components/HistoryTimeline/HistoryTimeline';
import styles from '../../components/ActivityLog/ActivityLog.module.css';
import { statusTone } from '../../components/ActivityLog/activityTones';
import { useAppStore } from '../../store/useAppStore';
import { openSafeUrl } from '../../lib/openSafeUrl';

// The ActivityLog entries that open app records: clinical notes, tasks and
// appointments (a detail card with actions) and referrals. They read the
// store, so they live here and reach ActivityLog through
// ActivityLogRenderers (see ActivityLogRenderersProvider).

/* ── Variant: Clinical note / Task / Appointment (nested detail card) ─ */
export function DetailCardEntryBody({ entry, variant, onOpenTask, onOpenNote }) {
  const [expanded, setExpanded] = useState(true);
  const dc = entry.detailCard;
  const expandable = !!dc;
  const allTasks = useAppStore(s => s.tasks);
  const taskPriority = dc?.priority
    || (dc?.taskId && allTasks?.find(t => t.id === dc.taskId)?.priority)
    || (variant === 'task' ? 'medium' : 'none');

  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title}</span>
        {expandable && (
          <button
            type="button"
            className={`${styles.viewMoreBtn} ${expanded ? styles.viewMoreBtnOpen : ''}`}
            onClick={() => setExpanded(v => !v)}
          >
            <span className={styles.viewNoteDot} aria-hidden="true">•</span>
            View more
            <DownChevronIcon size={11} color="currentColor" className={expanded ? styles.viewMoreChevronOpen : undefined} />
          </button>
        )}
      </div>
      {expanded && dc && (
        <div className={styles.detailCard}>
          {variant === 'task' ? (
            <div className={styles.detailCardRow}>
              <PriorityIcon priority={taskPriority} size={16} />
              <div className={styles.detailCardText}>
                <span className={styles.detailCardTitle}>{dc.title}</span>
                {dc.assignee && (
                  <div className={styles.detailCardSubtitle}>Assignee: {dc.assignee}</div>
                )}
              </div>
              <div className={styles.detailCardTrailing}>
                {dc.status && <Badge tone={statusTone(dc.status)} size="md" label={dc.status} />}
                <span className={styles.detailCardActionsDivider} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.detailCardIconBtn}
                  aria-label="Preview task"
                  onClick={dc.taskId && onOpenTask ? () => onOpenTask(dc.taskId) : undefined}
                  style={dc.taskId && onOpenTask ? undefined : { cursor: 'default' }}
                >
                  <Icon name="solar:eye-linear" size={14} color="var(--neutral-400)" />
                </button>
              </div>
            </div>
          ) : variant === 'appointment' ? (
            // Figma 1230:74055, leading calendar icon + title over a
            // "date, time · provider" subtitle, trailing status badge and
            // an arrow-out icon that later opens the appointment drawer.
            <div className={styles.detailCardRow}>
              <span className={styles.detailCardHandle}>
                <Icon name="solar:calendar-linear" size={16} color="var(--neutral-300)" />
              </span>
              <div className={styles.detailCardText}>
                <div className={styles.detailCardTitleRow}>
                  <span className={styles.detailCardTitle}>{dc.title}</span>
                </div>
                {dc.subtitle && (
                  <div className={styles.detailCardSubtitle}>{dc.subtitle}</div>
                )}
              </div>
              <div className={styles.detailCardTrailing}>
                {dc.status && <Badge tone={statusTone(dc.status)} size="md" label={dc.status} />}
                <button type="button" className={styles.detailCardIconBtn} aria-label="Open">
                  <Icon name="solar:arrow-right-up-linear" size={14} color="var(--neutral-400)" />
                </button>
              </div>
            </div>
          ) : (
            <ClinicalNoteCardActions dc={dc} draftLock={entry._draftLock} onOpenTask={onOpenTask} onOpenNote={onOpenNote} />
          )}
        </div>
      )}
    </>
  );
}

/* Note-variant card body: the shared Clinical Note affordance. Extracted
   so the eye / edit / task-arrow buttons can hook into the store's task
   opener and PDF viewer instead of being visual-only. Exported so the
   HEDIS Clinical Notes tab can render the same card without the
   ActivityLog's timeline rail. */
// Derive the nested review-task's title from the parent note's title so
// old activity entries (persisted before we started stamping the correct
// per-gap name) render consistently with new ones. Falls back to whatever
// the store stamped originally, then to a safe default.
function deriveReviewTaskTitle(dc) {
  if (dc?.title) return `Request for Sign-off - ${dc.title}`;
  return dc?.reviewTask?.title || 'Request for Sign-off - Clinical Note';
}

export function ClinicalNoteCardActions({ dc, draftLock = null, onOpenTask, onOpenNote }) {
  // Prefer the caller-provided `onOpenTask` (drawer wires the upstream
  // openTaskFromActivity signal: that's the fix from 3e0aa74 that stamps
  // pendingOpenTaskId for TasksView). Fall back to openTaskFromNotification
  // for surfaces without a specific handler.
  const openTaskFromNotification = useAppStore(s => s.openTaskFromNotification);
  const allTasks = useAppStore(s => s.tasks);
  // Each activity entry represents an event at a point in time, so the
  // status badge here mirrors the state the event captured (submit →
  // Pending Review, sign → Signed). A separate "Clinical Note Signed"
  // entry logs at sign-time, so both events remain visible in order.
  const noteStatus = dc?.status;
  // The note as it is NOW (clinical_notes), found by the id the entry saved.
  // A Draft entry stays a historical record, but once that note has been
  // submitted or signed its pencil is locked: the draft is no longer the
  // editable version. Entries logged before noteId was stored fall back to
  // the member's note for the same gap.
  const memberNotes = useAppStore(s => (dc?.memberId ? s.clinicalNotesByMember?.[dc.memberId] : undefined));
  const entryCodes = new Set(dc?.gapCodes?.length ? dc.gapCodes : (dc?.gapCode ? [dc.gapCode] : []));
  const liveNote = dc?.noteId
    ? memberNotes?.find(n => n.id === dc.noteId)
    : memberNotes?.find(n => (n.gapCodes || []).some(c => entryCodes.has(c)));
  const liveStatus = liveNote?.status;
  const draftLocked = noteStatus === 'Draft' && (!!draftLock || (!!liveStatus && liveStatus !== 'draft'));
  const lockReason = (draftLock === 'signed' || liveStatus === 'signed')
    ? 'This note has been signed, so this draft can no longer be edited.'
    : 'This note was submitted for review, so this draft can no longer be edited.';
  const reviewTaskStatus = dc?.reviewTask?.status;
  const reviewTaskPriority = dc?.reviewTask?.priority
    || (dc?.reviewTask?.taskId && allTasks?.find(t => t.id === dc.reviewTask.taskId)?.priority)
    || 'medium';
  const openTask = (taskId) => (onOpenTask ? onOpenTask(taskId) : openTaskFromNotification?.(taskId));
  // `onOpenNote` gets the whole detailCard so the drawer can reopen the
  // note in its left workspace (matches "Add Note"): used by the eye
  // affordance so authors can edit their submission before it's signed.
  const openNote = (dcArg) => onOpenNote?.(dcArg);
  const openClinicalNoteDrawer = useAppStore(s => s.openClinicalNoteDrawer);
  const showToast = useAppStore(s => s.showToast);
  // Draft rows key on the pencil, which reopens the note (edit path).
  // Submitted / Signed rows key on the eye, for a Pending Review note we
  // reopen the linked sign-off task so the reviewer lands back in the
  // ClinicalNotePanel with the exact same fields they filled out,
  // matching Figma 511:105429. Signed notes without a review task fall
  // back to the stored PDF dataUrl.
  const handlePrimary = () => {
    // Eye (Preview / edit re-submission) and pencil (Draft edit) both open
    // the note back in its own workspace via onOpenNote. That gives the
    // submitter a chance to amend before the reviewer signs; the reviewer
    // still uses the task-arrow ↗ button to reach the sign-off task.
    if (onOpenNote) {
      onOpenNote(dc);
      return;
    }
    if (dc.status === 'Draft' && openClinicalNoteDrawer && dc.memberId && dc.gapCode) {
      openClinicalNoteDrawer({ memberId: dc.memberId, gapCode: dc.gapCode });
      return;
    }
    if (dc.pdfDataUrl) {
      openSafeUrl(dc.pdfDataUrl);
    } else {
      showToast?.('Reopen note: coming soon');
    }
  };
  const handleOpenTask = () => {
    if (dc.reviewTask?.taskId) openTask(dc.reviewTask.taskId);
    else showToast?.('No linked review task.');
  };
  return (
    <>
      {/* subMeta (pre-title form-type label) and the "Linked Score Groups"
           link are no longer part of the note-card design, dropped at the
           render layer so historical entries with those fields still
           persisted don't show them. */}
      <div className={styles.detailCardRow}>
        <div className={styles.detailCardText}>
          <div className={styles.detailCardTitleRow}>
            <span className={styles.detailCardTitle}>{dc.title}</span>
            {dc.chip && (
              // Wrap in a Tooltip so hover reveals the exact set of gaps
              // the note bundles: prefer human-readable HEDIS measure
              // names (dc.gapNames) e.g. "Colorectal Cancer Screening,
              // Breast Cancer Screening"; fall back to raw codes for
              // older activity entries.
              (dc.gapNames?.length || dc.gapCodes?.length) ? (
                <Tooltip label={(dc.gapNames || dc.gapCodes).join(', ')}>
                  <Badge size="sm" label={dc.chip} />
                </Tooltip>
              ) : (
                <Badge size="sm" label={dc.chip} />
              )
            )}
          </div>
          {dc.subtitle && <div className={styles.detailCardSubtitle}>{dc.subtitle}</div>}
        </div>
        <div className={styles.detailCardTrailing}>
          <span className={styles.detailCardStatusSlot}>
            {noteStatus && <Badge tone={statusTone(noteStatus)} size="md" label={noteStatus} />}
          </span>
          <span className={styles.detailCardActionsSlot}>
            <Tooltip label={draftLocked ? lockReason : null} maxWidth={240}>
              <button
                type="button"
                className={styles.detailCardIconBtn}
                aria-label={noteStatus === 'Draft' ? 'Edit' : 'Preview'}
                onClick={draftLocked ? undefined : handlePrimary}
                disabled={draftLocked}
              >
                <Icon
                  name={noteStatus === 'Draft' ? 'solar:pen-linear' : 'solar:eye-linear'}
                  size={14}
                  color="var(--neutral-300)"
                />
              </button>
            </Tooltip>
            <span className={styles.detailCardActionsDivider} aria-hidden="true" />
            <button type="button" className={styles.detailCardIconBtn} aria-label="More">
              <Icon name="solar:menu-dots-linear" size={14} color="var(--neutral-300)" />
            </button>
          </span>
        </div>
      </div>
      {dc.reviewTask && (
        <div className={styles.detailCardNested}>
          <PriorityIcon priority={reviewTaskPriority} size={16} />
          <div className={styles.detailCardText}>
            <span className={styles.detailCardTitle}>{deriveReviewTaskTitle(dc)}</span>
            {dc.reviewTask.assignee && (
              <div className={styles.detailCardSubtitle}>Assignee: {dc.reviewTask.assignee}</div>
            )}
          </div>
          <div className={styles.detailCardTrailing}>
            {reviewTaskStatus && <Badge tone={statusTone(reviewTaskStatus)} size="md" label={reviewTaskStatus} />}
            <span className={styles.detailCardActionsDivider} aria-hidden="true" />
            <button type="button" className={styles.detailCardIconBtn} aria-label="Preview task" onClick={handleOpenTask}>
              <Icon name="solar:eye-linear" size={14} color="var(--neutral-400)" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Variant: Assignee change (avatar-transition pills) ──────────────── */

/* ── Variant: Referral (Figma New Care Gap Workflow 1327:419983) ─────── */
// Sender (name + role) → recipient (name, Fold Provider badge, specialty •
// channel contact), then "Created on : date • status". The menu reopens a
// still-draft referral, or opens a sent Email referral in Messages > Email.
export function ReferralEntryBody({ entry }) {
  const [expanded, setExpanded] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const setActivePage = useAppStore(s => s.setActivePage);
  const setPendingEmailReferralId = useAppStore(s => s.setPendingEmailReferralId);
  const providers = useAppStore(s => s.referralProviders);
  const dc = entry.detailCard || {};
  // Specialty is read from the directory at render time, so a card logged
  // before a doctor's specialty was set still shows it. Id first; older
  // entries only carry names, and one person can have duplicate profile rows,
  // so prefer the same-name row that has a specialty.
  const lookup = (id, name) => {
    if (id) {
      const byId = providers?.find(p => p.id === id);
      if (byId) return byId;
    }
    if (!name) return null;
    const same = (providers || []).filter(p => (p.name || '').toLowerCase() === name.toLowerCase());
    return same.find(p => p.specialty) || same[0] || null;
  };
  const fromSpecialty = lookup(dc.fromId, dc.fromName)?.specialty || dc.fromRole || '';
  const toSpecialty = lookup(dc.toId, dc.toName)?.specialty || dc.toSpecialty || '';
  const toContact = dc.toContact ?? dc.toSubtitle ?? '';
  const toSubtitle = [toSpecialty && !toContact.includes(toSpecialty) ? toSpecialty : '', toContact].filter(Boolean).join(' • ');
  const created = dc.createdAt ? new Date(dc.createdAt) : null;
  const createdLabel = created && !Number.isNaN(created.getTime())
    ? `${String(created.getMonth() + 1).padStart(2, '0')}/${String(created.getDate()).padStart(2, '0')}/${created.getFullYear()}, ${created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';
  const isDraft = dc.status === 'Draft';
  const menuItems = [
    ...(entry.onOpenReferralDraft ? [{ key: 'continue-draft', icon: 'solar:pen-linear', label: 'Continue Draft' }] : []),
    ...(!isDraft && dc.channel === 'email' && dc.referralId ? [{ key: 'view-email', icon: 'solar:letter-linear', label: 'View Email' }] : []),
    ...(entry.onCompleteReferral ? [{ key: 'complete', icon: 'solar:check-circle-linear', label: 'Mark as Completed' }] : []),
  ];

  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title}</span>
        <ViewMoreButton expanded={expanded} onToggle={() => setExpanded(v => !v)} leadingDot />
      </div>
      {expanded && (
        <div
          className={[styles.detailCard, styles.referralCard, entry.onOpenReferral ? styles.referralCardClickable : ''].filter(Boolean).join(' ')}
          role={entry.onOpenReferral ? 'button' : undefined}
          tabIndex={entry.onOpenReferral ? 0 : undefined}
          onClick={entry.onOpenReferral}
          onKeyDown={entry.onOpenReferral ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entry.onOpenReferral(); } } : undefined}
        >
          <div className={styles.referralMain}>
            <div className={styles.referralParties}>
              <div className={styles.referralParty}>
                <span className={styles.referralName}>{dc.fromName}</span>
                {fromSpecialty && <span className={styles.referralSub}>{fromSpecialty}</span>}
              </div>
              <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-300)" />
              <div className={styles.referralParty}>
                <span className={styles.referralNameRow}>
                  <span className={styles.referralName}>{dc.toName}</span>
                  {dc.toBadge && <Badge tone="primary" size="sm" label={dc.toBadge} className={styles.referralBadge} />}
                </span>
                {toSubtitle && <span className={styles.referralSub}>{toSubtitle}</span>}
              </div>
            </div>
            <div className={styles.referralSub}>
              {createdLabel && `Created on : ${createdLabel}`}
              {createdLabel && dc.status && ' • '}
              {dc.status && <span className={isDraft ? styles.referralStatusDraft : styles.referralStatus}>{dc.status}</span>}
            </div>
          </div>
          {menuItems.length > 0 && (
            <ActionButton
              icon="solar:menu-dots-linear"
              size="sm"
              tooltip="More actions"
              tooltipLeft
              onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget.getBoundingClientRect()); }}
            />
          )}
          {menuAnchor && (
            // Portal clicks still bubble through React; keep them off the card.
            <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
            <MenuPopover
              anchorRect={menuAnchor}
              width={168}
              align="right"
              items={menuItems}
              onClose={() => setMenuAnchor(null)}
              onSelect={(key) => {
                setMenuAnchor(null);
                if (key === 'continue-draft') entry.onOpenReferralDraft?.();
                else if (key === 'complete') entry.onCompleteReferral?.();
                else if (key === 'view-email') {
                  setActivePage?.('messages');
                  setPendingEmailReferralId?.(dc.referralId);
                }
              }}
            />
            </span>
          )}
        </div>
      )}
    </>
  );
}
