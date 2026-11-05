import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../store/useAppStore';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Icon } from '../../../components/Icon/Icon';
import { CheckIcon } from '../../../components/Icon/CheckIcon';
import { CloseIcon } from '../../../components/Icon/CloseIcon';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Badge } from '../../../components/Badge/Badge';
import { IcdCommentIcon } from './IcdCommentIcon';
import { useIcdComments } from './icdComments';
import { Button } from '../../../components/Button/Button';
import { DismissReasonForm } from './DismissReasonForm';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { reviewedByLabel } from '../reviewedBy';
import { DosSourceBadge } from '../HccWorklistRowParts';
import { deriveClaimId } from '../claimId';
import styles from './IcdDosCard.module.css';

/**
 * IcdDosCard: one card per ICD with one action row per DOS (Paper 1WXT /
 * "RA Coder Workflow"; ICD row states from Figma ICD-Import 4696:132231).
 *
 * Head: purple code + description (selecting opens the source-document
 * preview on the left), comment / activity counters. Body: a row per DOS,
 * date, `HCC n (V28)` chip (or `No HCC`), `Claim` link, `Manually Added`
 * chip: with per-DOS states:
 *   • unactioned → [✓ Accept] [✗ Reject] [⋯]
 *   • accepted   → green "✓ Accepted" + undo + ⋯
 *   • rejected   → inline dismiss-reason form → red "✗ Dismissed" +
 *                  "Dismiss Reason" link + undo + ⋯
 *   • missed / deferred → tag + actions (from the ⋯ menu, keys M/D)
 *
 * @param {object} props
 * @param {object} props.icd       gap record + `entries: [{dos, claimed?}]`
 * @param {string} [props.focusKey]      `${code}|${dos}` of the focused row
 * @param {string} [props.openDismissKey] `${code}|${dos}` whose form is open
 * @param {(key:string|null)=>void} [props.onOpenDismiss]
 */
export function IcdDosCard({ icd, currentDos = null, focusKey, onFocusRow, selectedKeys, onToggleSelect, openDismissKey, onOpenDismiss, onActed, reviewLocked = false, lockReason = null }) {
  const openIcdPanel = useAppStore(s => s.openIcdPanel);
  const diagActivityIcd = useAppStore(s => s.diagActivityIcd);
  const clearDiagActivityIcd = useAppStore(s => s.clearDiagActivityIcd);
  const setDiagLeftPanel = useAppStore(s => s.setDiagLeftPanel);
  const dosActions = useAppStore(s => s.hccGapDosActions);
  const dosMeta = useAppStore(s => s.hccGapDosMeta);
  const setDosAction = useAppStore(s => s.setHccGapDosAction);
  const dismissDos = useAppStore(s => s.dismissHccGapDos);
  const showToast = useAppStore(s => s.showToast);
  const deleteHccGap = useAppStore(s => s.deleteHccGap);
  const removeIcdDos = useAppStore(s => s.removeIcdDos);
  const hccUserRole = useAppStore(s => s.hccUserRole);
  const canDelete = hccUserRole !== 'Support';
  const isManualIcd = icd.type === 'Manual';
  const [confirmDeleteIcd, setConfirmDeleteIcd] = useState(false);
  const [confirmRemoveDos, setConfirmRemoveDos] = useState(null); // {code, dos} | null
  // Flash + scroll when this ICD was just added via the New Diagnosis Gap
  // panel: draws the user's attention to where the new code landed in the
  // current list (the border pulses; auto-clears via the store timer).
  const isJustAdded = useAppStore(s => s.hccJustAddedCode) === icd.code;
  const cardRef = useRef(null);
  useEffect(() => {
    if (isJustAdded) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isJustAdded]);

  // This patient's comments on this ICD, plus whether any are unread (red
  // dot on the counter).
  const { count: commentsCount, unread: hasUnreadComments } = useIcdComments(icd.code, icd.cmts ?? 0);
  // History tab renders one row per DOS the ICD is on for this member,
  // so the counter has to match that, otherwise the "7" on the card
  // opens a tab with 3 rows and the reviewer wonders what disappeared.
  // Activity-log scoping was the old source of truth but it counts
  // events (comments, edits, per-DOS status changes), a different unit
  // than the tab's per-DOS rowcount.
  const historyCount = useMemo(() => icd.entries?.length ?? 0, [icd.entries]);

  const hccShort = (icd.hcc || '').split(' - ')[0].trim();
  const hccLabel = hccShort
    ? (/^hcc\s*not\s*linked$/i.test(hccShort) ? hccShort : `${hccShort} (V28)`)
    : 'No HCC';
  // `icd.hcc` looks like "HCC 58 - Major Depressive Disorder", take the
  // right half as the tooltip content on the header chip so hovering the
  // "HCC N (V28)" badge reveals the full category name.
  const hccDesc = (icd.hcc || '').split(' - ').slice(1).join(' - ').trim();
  // Doc-panel selection: drives the source-document toggle below.
  const isSelected = diagActivityIcd === icd.code;
  // The ICD currently being worked on = the one that owns the focused DOS.
  // Its card is highlighted; as focus advances to the next ICD this one stops
  // being active and (once fully acted) tones down.
  const isActive = !!focusKey && focusKey.split('|')[0] === icd.code;
  const allActed = icd.entries.length > 0
    && icd.entries.every(e => !!dosActions[`${icd.code}|${e.dos}`]);
  const isCompleted = allActed && !isActive;
  // Header status pill: surfaces when the ICD was acted on (accepted OR
  // dismissed) on ANOTHER created-date DOS in the SAME calendar year as
  // the drawer's current DOS. HCC codes close per year, so a prior-year
  // acceptance doesn't close this year's review; the same-year filter
  // keeps the badge to a true "already closed for this year" signal.
  // `currentDos` comes from the drawer's `member.dos_list[0].date` via
  // DiagPanelViewCards. Accepted wins over dismissed if both exist,
  // the positive closure is the more useful signal.
  const currentYear = currentDos ? String(currentDos).split('/')[2] : null;
  // Extract calendar year from a MM/DD/YYYY string.
  const yearOf = (dos) => String(dos).split('/')[2];
  const acceptedDos = currentYear ? (icd.entries.find(e => (
    e.dos !== currentDos
    && yearOf(e.dos) === currentYear
    && dosActions[`${icd.code}|${e.dos}`] === 'accepted'
  ))?.dos || null) : null;
  const dismissedDos = (!acceptedDos && currentYear) ? (icd.entries.find(e => (
    e.dos !== currentDos
    && yearOf(e.dos) === currentYear
    && dosActions[`${icd.code}|${e.dos}`] === 'rejected'
  ))?.dos || null) : null;

  // Selecting an ICD expands the drawer and opens the source-document
  // preview on the left, scoped to this code. Clicking again deselects.
  const toggleSelect = () => {
    if (isSelected) {
      clearDiagActivityIcd();
      setDiagLeftPanel(null);
    } else {
      openIcdPanel('documents', icd.code);
    }
  };

  return (
    <div
      ref={cardRef}
      className={[
        styles.card,
        isActive ? styles.cardSelected : '',
        isCompleted ? styles.cardCompleted : '',
        isJustAdded ? styles.cardJustAdded : '',
      ].filter(Boolean).join(' ')}
    >
      <div className={styles.head}>
        <div className={styles.headMain}>
          <div className={styles.titleLine}>
            <button
              type="button"
              className={styles.code}
              onClick={(e) => { e.stopPropagation(); toggleSelect(); }}
            >
              {icd.code}
            </button>
            <span className={styles.desc}>
              {icd.desc}
            </span>
            {(icd.type === 'Suspect' || icd.type === 'Recapture') && (
              <span className={styles.suspectBadge}>
                {icd.type === 'Recapture' ? 'Recaptured' : 'Suspected'}
              </span>
            )}
          </div>
          {reviewedByLabel(icd.by) && (
            <div className={styles.lastLine}>
              Last Reviewed by {reviewedByLabel(icd.by)} • {icd.last}
            </div>
          )}
          <div className={styles.headMeta}>
            <Tooltip label={hccDesc}>
              <Badge size="sm" label={hccLabel} />
            </Tooltip>

            {acceptedDos && (
              <Badge
                tone="success"
                size="sm"
                icon="solar:check-circle-linear"
                label={`Already Accepted on ${acceptedDos}`}
              />
            )}
            {dismissedDos && (
              <Badge
                tone="danger"
                size="sm"
                icon="solar:close-circle-linear"
                label={`Already Dismissed on ${dismissedDos}`}
              />
            )}
          </div>
        </div>
        <div className={styles.counters} onClick={(e) => e.stopPropagation()}>
          <Tooltip label="Comments">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); openIcdPanel('comments', icd.code); }}
            >
              <IcdCommentIcon unread={hasUnreadComments} />
              {commentsCount}
            </Button>
          </Tooltip>
          <span className={styles.counterDivider} />
          <Tooltip label="History">
            <Button
              variant="ghost"
              size="sm"
              leadingIconElement={<Icon name="custom:history" size={14} />}
              onClick={(e) => { e.stopPropagation(); openIcdPanel('history', icd.code); }}
            >
              {historyCount}
            </Button>
          </Tooltip>
          {isManualIcd && (
            <>
              <span className={styles.counterDivider} />
              <Tooltip label={canDelete ? `Delete ${icd.code}` : 'Support role cannot delete ICDs'}>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  aria-label={`Delete ${icd.code}`}
                  disabled={!canDelete}
                  onClick={!canDelete ? undefined : (e) => {
                    e.stopPropagation();
                    setConfirmDeleteIcd(true);
                  }}
                >
                  <Icon name="solar:trash-bin-2-linear" size={14} />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      <div className={styles.rows}>
        {icd.entries.map((entry) => {
          const key = `${icd.code}|${entry.dos}`;
          // Advance focus to the next un-acted DOS, but only when the action
          // actually resolved the row. Missed/Defer toggle off (undo), so read
          // fresh store state rather than assuming the row is now acted.
          const advanceIfActed = () => {
            if (useAppStore.getState().hccGapDosActions[key]) onActed?.(key);
          };
          return (
            <DosActionRow
              key={key}
              rowKey={key}
              entry={entry}
              icd={icd}
              action={dosActions[key] || null}
              meta={dosMeta[key] || null}
              focused={focusKey === key}
              onFocusRow={onFocusRow ? () => onFocusRow(key) : null}
              selected={selectedKeys?.has(key) || false}
              dismissOpen={openDismissKey === key}
              onToggleSelect={onToggleSelect ? () => onToggleSelect(key) : null}
              onAccept={() => { setDosAction(icd.code, entry.dos, 'accepted'); advanceIfActed(); }}
              onOpenDismiss={() => onOpenDismiss?.(key)}
              onCloseDismiss={() => onOpenDismiss?.(null)}
              onConfirmDismiss={(reason, note) => { dismissDos(icd.code, entry.dos, reason, note); onOpenDismiss?.(null); advanceIfActed(); }}
              onUndo={() => setDosAction(icd.code, entry.dos, dosActions[key])}
              onMissed={() => { setDosAction(icd.code, entry.dos, 'missed'); advanceIfActed(); }}
              onDefer={() => { setDosAction(icd.code, entry.dos, 'deferred'); advanceIfActed(); }}
              onRemoveDos={canDelete ? () => setConfirmRemoveDos({ code: icd.code, dos: entry.dos }) : null}
              reviewLocked={reviewLocked}
              lockReason={lockReason}
            />
          );
        })}
      </div>
      {confirmDeleteIcd && (
        <ConfirmDialog variant="destructive"
          title={`Delete ${icd.code}?`}
          description={`This manually-added ICD and all its DOS rows will be removed. This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDeleteIcd(false)}
          onConfirm={() => {
            deleteHccGap(icd.code);
            showToast(`Removed ${icd.code}`);
            setConfirmDeleteIcd(false);
          }}
        />
      )}
      {confirmRemoveDos && (
        <ConfirmDialog variant="destructive"
          title="Remove DOS?"
          description={`${confirmRemoveDos.code} on ${confirmRemoveDos.dos} will be removed. This can't be undone.`}
          confirmLabel="Remove"
          onCancel={() => setConfirmRemoveDos(null)}
          onConfirm={() => {
            removeIcdDos(confirmRemoveDos.code, confirmRemoveDos.dos);
            showToast(`Removed ${confirmRemoveDos.code} on ${confirmRemoveDos.dos}`);
            setConfirmRemoveDos(null);
          }}
        />
      )}
    </div>
  );
}

function DosActionRow({
  rowKey, entry, icd, action, meta, focused, onFocusRow, selected, dismissOpen,
  onToggleSelect, onAccept, onOpenDismiss, onCloseDismiss, onConfirmDismiss,
  onUndo, onMissed, onDefer, onRemoveDos, reviewLocked = false, lockReason = null,
}) {
  const [menuPos, setMenuPos] = useState(null);
  const moreRef = useRef(null);
  // ICD accept/reject is a coding action, Support can't perform it, and QA /
  // Compliance are locked out until Support + Coder have completed (reviewLocked).
  const rowRole = useAppStore(s => s.hccUserRole);
  const canReview = rowRole !== 'Support' && !reviewLocked;
  // Tooltip copy is ordered most-specific first: an explicit lockReason from
  // the parent (e.g. rejection, with rejecting user + date) always wins;
  // otherwise fall back to role gating, then the generic Support-hasn't-
  // reviewed message.
  const disabledReason = lockReason
    || (rowRole === 'Support'
      ? 'Support role cannot code ICDs'
      : (reviewLocked ? "Support team hasn't reviewed the documents yet" : null));
  // Claim-sourced DOS rows open the DiagPanel's built-in Claims tab (left
  // pane): mirrors the behaviour of the old inline "Claim" link so the
  // detail lands in the panel the user is already looking at, not a
  // separate right-side drawer.
  const openHccClaimForDos = useAppStore(s => s.openHccClaimForDos);
  const diagMemberId = useAppStore(s => s.diagPanelMemberId);
  const isManual = entry.manual || icd.type === 'Manual';
  const isAccepted = action === 'accepted';
  const isRejected = action === 'rejected';
  const isMissed = action === 'missed';
  const isDeferred = action === 'deferred';

  useEffect(() => {
    if (!menuPos) return undefined;
    const onDoc = (e) => {
      if (!moreRef.current?.contains(e.target) && !e.target.closest?.('[data-dos-menu]')) setMenuPos(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuPos(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuPos]);

  const openMenu = () => {
    const r = moreRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 8;
    const menuW = 180;
    // ~3-4 items: 2 base (Missed / Defer) + optional divider + Remove DOS.
    const estHeight = isManual && onRemoveDos ? 168 : 96;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const spaceBelow = vh - r.bottom - margin;
    const flipUp = spaceBelow < estHeight && r.top > estHeight + margin;
    const top = flipUp ? Math.max(margin, r.top - estHeight - 4) : r.bottom + 4;
    const left = Math.min(Math.max(margin, r.right - menuW), vw - menuW - margin);
    setMenuPos({ top, left });
  };

  return (
    <>
      <div
        className={[
          styles.row,
          focused ? styles.rowFocused : '',
          isRejected ? styles.rowRejected : '',
          onFocusRow ? styles.rowClickable : '',
        ].filter(Boolean).join(' ')}
        data-rowkey={rowKey}
        role={onFocusRow ? 'button' : undefined}
        tabIndex={onFocusRow ? 0 : undefined}
        // Clicking the row focuses this DOS (keyboard shortcuts A/X/M/D
        // then target it). Row-level action buttons stop propagation so
        // they still fire their own onClick without also refocusing.
        onClick={(e) => { e.stopPropagation(); onFocusRow?.(); }}
        onKeyDown={onFocusRow ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocusRow(); }
        } : undefined}
      >
        {onToggleSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${icd.code} on ${entry.dos}`}
          />
        )}
        {/* DOS date + D/C/M badge: grouped in one inline-flex span so the
            gap between them (6px) stays independent of the row's 8px flex
            gap between the group and the neighbouring row-actions cluster.
            Claim-sourced rows: hover the C badge to see the claim number
            as a clickable link (same tooltip the worklist uses); click
            either the badge or the number to open the Claims tab inside
            this DiagPanel: matches the old inline "Claim" link but
            through the shared source-badge affordance. */}
        <span className={styles.dosDateGroup}>
          <span className={styles.dosDate}>{entry.dos}</span>
          <DosSourceBadge
            entry={{
              date: entry.dos,
              source: isManual ? 'manual' : (entry.claimed ? 'claim' : 'document'),
            }}
            hasDoc
            claimNumber={entry.claimed ? deriveClaimId(diagMemberId, entry.dos) : null}
            onClick={entry.claimed
              ? (e) => { e.stopPropagation(); openHccClaimForDos(entry.dos); }
              : undefined}
          />
        </span>
        {isRejected && (
          <DismissReasonHoverLink
            reason={meta?.reason || ''}
            note={meta?.note || ''}
            onClick={onOpenDismiss}
          />
        )}
        {/* stopPropagation so ICD-action button clicks (Accept / Dismiss /
            More / Undo) don't bubble to the parent card's toggleSelect
            handler: which would force-switch the left panel to Documents
            even when the user has Timeline / Comments / History open. */}
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          {isAccepted ? (
            <>
              <span className={styles.acceptedPill}><CheckIcon size={13} color="currentColor" /> Accepted</span>
              <Tooltip label={canReview ? 'Undo' : (disabledReason || 'Undo')}>
                <button
                  type="button"
                  className={styles.undoBtn}
                  aria-label="Undo accept"
                  disabled={!canReview}
                  onClick={!canReview ? undefined : onUndo}
                >
                  <Icon name="solar:undo-left-round-linear" size={15} />
                </button>
              </Tooltip>
            </>
          ) : isRejected ? (
            <>
              <span className={styles.dismissedPill}><CloseIcon size={12} color="currentColor" /> Dismissed</span>
              <Tooltip label={canReview ? 'Undo' : (disabledReason || 'Undo')}>
                <button
                  type="button"
                  className={styles.undoBtn}
                  aria-label="Undo dismiss"
                  disabled={!canReview}
                  onClick={!canReview ? undefined : onUndo}
                >
                  <Icon name="solar:undo-left-round-linear" size={15} />
                </button>
              </Tooltip>
            </>
          ) : isMissed ? (
            <>
              <Badge size="sm" tone="warning" icon="solar:flag-linear" label="Missed Opportunity" />
              <Tooltip label={canReview ? 'Undo' : (disabledReason || 'Undo')}>
                <button
                  type="button"
                  className={styles.undoBtn}
                  aria-label="Undo missed opportunity"
                  disabled={!canReview}
                  onClick={!canReview ? undefined : onUndo}
                >
                  <Icon name="solar:undo-left-round-linear" size={15} />
                </button>
              </Tooltip>
            </>
          ) : isDeferred ? (
            <>
              <span className={styles.deferredPill}><Icon name="solar:alarm-linear" size={13} color="currentColor" /> Deferred</span>
              <Tooltip label={canReview ? 'Undo' : (disabledReason || 'Undo')}>
                <button
                  type="button"
                  className={styles.undoBtn}
                  aria-label="Undo defer"
                  disabled={!canReview}
                  onClick={!canReview ? undefined : onUndo}
                >
                  <Icon name="solar:undo-left-round-linear" size={15} />
                </button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip label={canReview ? 'Accept (A)' : (disabledReason || 'Accept')}>
                <Button
                  variant="outline" tone="primary"
                  size="sm"
                  iconOnly
                  aria-label="Accept"
                  disabled={!canReview}
                  onClick={canReview ? onAccept : undefined}
                  leadingIconElement={<CheckIcon size={15} color="currentColor" />}
                />
              </Tooltip>
              <Tooltip label={canReview ? 'Dismiss (X)' : (disabledReason || 'Dismiss')}>
                <Button
                  variant="outline"
                  size="sm"
                  iconOnly
                  aria-label="Dismiss"
                  disabled={!canReview}
                  onClick={!canReview ? undefined : (dismissOpen ? onCloseDismiss : onOpenDismiss)}
                  leadingIconElement={<CloseIcon size={13} color="currentColor" />}
                />
              </Tooltip>
            </>
          )}
          <Tooltip label={canReview ? 'More actions' : (disabledReason || 'More actions')}>
            <button
              ref={moreRef}
              type="button"
              className={styles.moreBtn}
              aria-label="More actions"
              disabled={!canReview}
              onClick={!canReview ? undefined : () => (menuPos ? setMenuPos(null) : openMenu())}
            >
              <Icon name="solar:menu-dots-linear" size={15} />
            </button>
          </Tooltip>
        </div>
      </div>

      {dismissOpen && (
        <DismissReasonForm
          initialReason={meta?.reason || ''}
          initialNote={meta?.note || ''}
          onCancel={onCloseDismiss}
          onConfirm={onConfirmDismiss}
        />
      )}

      {menuPos && createPortal(
        <div data-dos-menu className={styles.moreMenu} style={{ top: menuPos.top, left: menuPos.left }}>
          <button type="button" className={styles.moreItem} onClick={() => { onMissed(); setMenuPos(null); }}>
            <Icon name="solar:flag-linear" size={14} color="var(--neutral-400)" />
            {action === 'missed' ? 'Undo missed opportunity' : 'Missed opportunity'}
          </button>
          <button type="button" className={styles.moreItem} onClick={() => { onDefer(); setMenuPos(null); }}>
            <Icon name="solar:alarm-linear" size={14} color="var(--neutral-400)" />
            {action === 'deferred' ? 'Undo defer' : 'Defer'}
          </button>
          {isManual && onRemoveDos && (
            <>
              <div className={styles.moreMenuDivider} />
              <button
                type="button"
                className={[styles.moreItem, styles.moreItemDanger].join(' ')}
                onClick={() => { onRemoveDos(); setMenuPos(null); }}
              >
                <Icon name="solar:trash-bin-2-linear" size={14} color="var(--status-error)" />
                Remove DOS
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * Hover popover for the "Dismiss Reason" link on a dismissed DOS row. Mirrors
 * the ChartDetailDrawer failed-badge tooltip pattern: a portalled card with a
 * "Dismiss Reason:" heading, the reason text, and an optional Note box, so
 * both surfaces read as one system. Click still opens the inline reason form.
 */
function DismissReasonHoverLink({ reason, note, onClick }) {
  const linkRef = useRef(null);
  const openTimer = useRef(null);
  const [rect, setRect] = useState(null);
  const trimmedNote = (note || '').trim();
  const hasContent = !!reason || !!trimmedNote;

  const open = () => {
    if (!hasContent) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      const r = linkRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    }, 120);
  };
  const close = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    setRect(null);
  };
  useEffect(() => () => clearTimeout(openTimer.current), []);

  const W = 260;
  const style = rect
    ? { top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - W - 8), width: W }
    : null;

  return (
    <>
      <button
        ref={linkRef}
        type="button"
        className={styles.dismissReasonLink}
        onClick={onClick}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
      >
        Dismiss Reason
        <Icon name="solar:info-circle-linear" size={12} />
      </button>
      {rect && hasContent && createPortal(
        <div
          role="tooltip"
          className={styles.reasonTooltip}
          style={style}
        >
          {reason && (
            <>
              <div className={styles.reasonTooltipHeading}>Dismiss Reason:</div>
              <div className={styles.reasonTooltipBody}>{reason}</div>
            </>
          )}
          {trimmedNote && (
            <div className={styles.reasonTooltipNote}>Note: {trimmedNote}</div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

