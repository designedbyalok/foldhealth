import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../store/useAppStore';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Icon } from '../../../components/Icon/Icon';
import { CheckIcon } from '../../../components/Icon/CheckIcon';
import { CloseIcon } from '../../../components/Icon/CloseIcon';
import { Checkbox } from '../../../components/ui/checkbox';
import { DismissReasonForm } from './DismissReasonForm';
import { reviewedByLabel } from '../reviewedBy';
import styles from './IcdDosCard.module.css';

/**
 * IcdDosCard — one card per ICD with one action row per DOS (Paper 1WXT /
 * "RA Coder Workflow"; ICD row states from Figma ICD-Import 4696:132231).
 *
 * Head: purple code + description (selecting opens the source-document
 * preview on the left), comment / activity counters. Body: a row per DOS —
 * date, `HCC n (V28)` chip (or `No HCC`), `Claim` link, `Manually Added`
 * chip — with per-DOS states:
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
export function IcdDosCard({ icd, focusKey, selectedKeys, onToggleSelect, openDismissKey, onOpenDismiss, onActed, reviewLocked = false }) {
  const openIcdPanel = useAppStore(s => s.openIcdPanel);
  const openIcdActivityLog = useAppStore(s => s.openIcdActivityLog);
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
  const isManualIcd = icd.type === 'Manual';
  // Flash + scroll when this ICD was just added via the New Diagnosis Gap
  // panel — draws the user's attention to where the new code landed in the
  // current list (the border pulses; auto-clears via the store timer).
  const isJustAdded = useAppStore(s => s.hccJustAddedCode) === icd.code;
  const cardRef = useRef(null);
  useEffect(() => {
    if (isJustAdded) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isJustAdded]);

  const hccShort = (icd.hcc || '').split(' - ')[0].trim();
  // Doc-panel selection — drives the source-document toggle below.
  const isSelected = diagActivityIcd === icd.code;
  // The ICD currently being worked on = the one that owns the focused DOS.
  // Its card is highlighted; as focus advances to the next ICD this one stops
  // being active and (once fully acted) tones down.
  const isActive = !!focusKey && focusKey.split('|')[0] === icd.code;
  const allActed = icd.entries.length > 0
    && icd.entries.every(e => !!dosActions[`${icd.code}|${e.dos}`]);
  const isCompleted = allActed && !isActive;

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
      role="button"
      tabIndex={0}
      className={[
        styles.card,
        isActive ? styles.cardSelected : '',
        isCompleted ? styles.cardCompleted : '',
        isJustAdded ? styles.cardJustAdded : '',
      ].filter(Boolean).join(' ')}
      // Whole-card click opens the source document for this ICD. Inner
      // interactive elements (DOS action buttons, checkboxes, counters, ⋯
      // menus, dismiss form) stop propagation so they don't also fire this.
      onClick={toggleSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelect(); } }}
      title={isSelected ? 'Deselect' : `Open source document for ${icd.code}`}
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
        </div>
        <div className={styles.counters} onClick={(e) => e.stopPropagation()}>
          <Tooltip label="Comments">
            <button type="button" className={styles.counter} onClick={(e) => { e.stopPropagation(); openIcdPanel('comments', icd.code); }}>
              <Icon name="solar:chat-round-line-linear" size={14} />
              {icd.cmts ?? 0}
            </button>
          </Tooltip>
          <span className={styles.counterDivider} />
          <Tooltip label="Activity">
            <button type="button" className={styles.counter} onClick={(e) => { e.stopPropagation(); openIcdActivityLog(icd.code); }}>
              <Icon name="custom:history" size={14} />
              {(icd.docs ?? 0) + (icd.notes ?? 0)}
            </button>
          </Tooltip>
          {isManualIcd && (
            <>
              <span className={styles.counterDivider} />
              <button
                type="button"
                className={styles.deleteBtn}
                title={`Delete ${icd.code}`}
                aria-label={`Delete ${icd.code}`}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteHccGap(icd.code);
                  showToast(`Removed ${icd.code}`);
                }}
              >
                <Icon name="solar:trash-bin-2-linear" size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.rows}>
        {icd.entries.map((entry) => {
          const key = `${icd.code}|${entry.dos}`;
          // Advance focus to the next un-acted DOS — but only when the action
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
              hccShort={hccShort}
              action={dosActions[key] || null}
              meta={dosMeta[key] || null}
              focused={focusKey === key}
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
              onRemoveDos={() => {
                removeIcdDos(icd.code, entry.dos);
                showToast(`Removed ${icd.code} on ${entry.dos}`);
              }}
              reviewLocked={reviewLocked}
            />
          );
        })}
      </div>
    </div>
  );
}

function DosActionRow({
  rowKey, entry, icd, hccShort, action, meta, focused, selected, dismissOpen,
  onToggleSelect, onAccept, onOpenDismiss, onCloseDismiss, onConfirmDismiss,
  onUndo, onMissed, onDefer, onRemoveDos, reviewLocked = false,
}) {
  const [menuPos, setMenuPos] = useState(null);
  const moreRef = useRef(null);
  // ICD accept/reject is a coding action — Support can't perform it, and QA /
  // Compliance are locked out until Support + Coder have completed (reviewLocked).
  const canReview = useAppStore(s => s.hccUserRole) !== 'Support' && !reviewLocked;
  const openHccClaimForDos = useAppStore(s => s.openHccClaimForDos);
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
    if (r) setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - 180) });
  };

  return (
    <>
      <div
        className={[styles.row, focused ? styles.rowFocused : '', isRejected ? styles.rowRejected : ''].filter(Boolean).join(' ')}
        data-rowkey={rowKey}
        // Row-level actions (Accept/Reject/Missed/Defer + checkbox) live inside
        // a clickable ICD card — stop propagation so acting on a DOS doesn't
        // toggle the whole card's document-preview selection.
        onClick={(e) => e.stopPropagation()}
      >
        {onToggleSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${icd.code} on ${entry.dos}`}
          />
        )}
        <span className={styles.dosDate}>{entry.dos}</span>
        <span className={styles.hccChip}>{hccShort ? `${hccShort} (V28)` : 'No HCC'}</span>
        {entry.claimed && (
          <button
            type="button"
            className={styles.claimLink}
            onClick={(e) => { e.stopPropagation(); openHccClaimForDos(entry.dos); }}
            title={`Open claim for DOS ${entry.dos}`}
          >
            Claim
          </button>
        )}
        {isManual && <span className={styles.manualChip}>Manually Added</span>}
        {isRejected && (
          <button type="button" className={styles.dismissReasonLink} onClick={onOpenDismiss} title={meta?.reason || 'View dismiss reason'}>
            Dismiss Reason
            <Icon name="solar:info-circle-linear" size={12} />
          </button>
        )}
        <div className={styles.rowActions}>
          {isAccepted ? (
            <>
              <span className={styles.acceptedPill}><CheckIcon size={13} color="currentColor" /> Accepted</span>
              <button type="button" className={styles.undoBtn} title="Undo" aria-label="Undo accept" onClick={onUndo}>
                <Icon name="solar:undo-left-round-linear" size={15} />
              </button>
            </>
          ) : isRejected ? (
            <>
              <span className={styles.dismissedPill}><CloseIcon size={12} color="currentColor" /> Dismissed</span>
              <button type="button" className={styles.undoBtn} title="Undo" aria-label="Undo dismiss" onClick={onUndo}>
                <Icon name="solar:undo-left-round-linear" size={15} />
              </button>
            </>
          ) : isMissed ? (
            <>
              <span className={styles.warnPill}><Icon name="solar:flag-linear" size={13} color="currentColor" /> Missed opportunity</span>
              <button type="button" className={styles.undoBtn} title="Undo" aria-label="Undo missed opportunity" onClick={onUndo}>
                <Icon name="solar:undo-left-round-linear" size={15} />
              </button>
            </>
          ) : isDeferred ? (
            <>
              <span className={styles.warnPill}><Icon name="solar:alarm-linear" size={13} color="currentColor" /> Deferred</span>
              <button type="button" className={styles.undoBtn} title="Undo" aria-label="Undo defer" onClick={onUndo}>
                <Icon name="solar:undo-left-round-linear" size={15} />
              </button>
            </>
          ) : (
            <>
              <Tooltip label={canReview ? 'Accept (A)' : 'Accept'}>
                <button
                  type="button"
                  className={[styles.acceptBtn, canReview ? '' : styles.disabledAction].filter(Boolean).join(' ')}
                  aria-label="Accept"
                  disabled={!canReview}
                  onClick={canReview ? onAccept : undefined}
                >
                  <CheckIcon size={15} color="currentColor" />
                </button>
              </Tooltip>
              <Tooltip label={canReview ? 'Dismiss (X)' : 'Dismiss'}>
                <button
                  type="button"
                  className={[styles.rejectBtn, dismissOpen ? styles.rejectBtnActive : '', canReview ? '' : styles.disabledAction].filter(Boolean).join(' ')}
                  aria-label="Dismiss"
                  disabled={!canReview}
                  onClick={!canReview ? undefined : (dismissOpen ? onCloseDismiss : onOpenDismiss)}
                >
                  <CloseIcon size={13} color="currentColor" />
                </button>
              </Tooltip>
            </>
          )}
          <button ref={moreRef} type="button" className={styles.moreBtn} aria-label="More actions" onClick={() => (menuPos ? setMenuPos(null) : openMenu())}>
            <Icon name="solar:menu-dots-linear" size={15} />
          </button>
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

