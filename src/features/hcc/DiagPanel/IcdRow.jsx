import { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { getConfidence, getScoreStyle, getMeatNote, MEAT_NOTE_DATA } from '../data/confidence';
import styles from './IcdRow.module.css';

// Type-badge color spec — Suspect blue, Recapture purple, Manual blue,
// Added-in-EHR amber. Mirrors the prototype's TYPE_BADGE map (line 1401).
const TYPE_BADGE = {
  Suspect:        { className: 'typeSuspect',     label: 'Suspect' },
  Recapture:      { className: 'typeRecapture',   label: 'Recapture' },
  Manual:         { className: 'typeManual',      label: 'Manual' },
  'Added In EHR': { className: 'typeAddedInEhr',  label: 'Added In EHR' },
};

const isAISuggested = (icd) => ['Suspect', 'Recapture'].includes(icd.type || '');

/**
 * IcdRow v2 — vertical card layout for a single ICD inside an HCC group.
 *
 * Three logical bands:
 *   1. Code + description (top row)
 *   2. Last-reviewed meta + badge cluster (HCC, Type, Confidence score)
 *   3. Doc/comment/notes counts + Accept / Dismiss buttons + 3-dot menu
 *
 * Accept and Dismiss are now wired to the store. The confidence-score badge
 * is clickable and opens an inline evidence drill-down beneath the row.
 *
 * Props:
 *  - icd ({ code, desc, hcc, type, status, last, by, docs, cmts, notes, raf, dismissReason })
 */
export function IcdRow({ icd }) {
  const acceptHccGap = useAppStore(s => s.acceptHccGap);
  const dismissHccGap = useAppStore(s => s.dismissHccGap);
  const reopenHccGap = useAppStore(s => s.reopenHccGap);
  const showToast = useAppStore(s => s.showToast);
  const openIcdActivityLog = useAppStore(s => s.openIcdActivityLog);
  const openIcdPanel = useAppStore(s => s.openIcdPanel);
  // This card is "selected" when the left panel's Activity Log is scoped to
  // its code (Figma Selection variant 1:33197 → primary-50 bg, primary-300
  // border). Clicking the code toggles the scope on/off.
  const diagActivityIcd = useAppStore(s => s.diagActivityIcd);
  const clearDiagActivityIcd = useAppStore(s => s.clearDiagActivityIcd);
  const isSelected = diagActivityIcd === icd.code;

  // Unified expansion panel — opens either via the confidence-score badge
  // (panel='confidence', confidence section open) or via Accept on an AI
  // ICD (panel='meat', meat section open). 'none' = no panel rendered.
  const [panel, setPanel] = useState('none'); // 'none' | 'confidence' | 'meat'
  const [confOpen, setConfOpen] = useState(true);
  const [meatOpen, setMeatOpen] = useState(false);
  const [meatText, setMeatText] = useState('');

  const isAccepted = icd.status === 'Accepted';
  const isDismissed = icd.status === 'Dismissed';
  const isClosed = isAccepted || isDismissed;

  const conf = getConfidence(icd.code);
  const scoreStyle = getScoreStyle(conf.score);
  const typeBadge = icd.type ? TYPE_BADGE[icd.type] : null;

  // Note count: the data field plus the prefilled MEAT note (if this code ships
  // with a specific one) so a card that already has a note authored shows ≥1.
  const noteCount = Math.max(icd.notes ?? 0, MEAT_NOTE_DATA[icd.code] ? 1 : 0);

  const handleAccept = (e) => {
    e.stopPropagation();
    // AI-suggested ICDs (Suspect / Recapture) require a MEAT note before
    // they can be committed. Open the unified panel with MEAT expanded and
    // Confidence collapsed; user signs to confirm.
    if (isAISuggested(icd)) {
      setMeatText(getMeatNote(icd.code, icd.desc));
      setPanel('meat');
      setConfOpen(false);
      setMeatOpen(true);
      return;
    }
    acceptHccGap(icd.code);
  };

  const handleConfidenceClick = (e) => {
    e.stopPropagation();
    setPanel(p => p === 'confidence' ? 'none' : 'confidence');
    setConfOpen(true);
    setMeatOpen(false);
  };

  const handleSignAccept = () => {
    setPanel('none');
    acceptHccGap(icd.code);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    if (isDismissed) {
      // The Dismissed button doubles as the undo trigger.
      reopenHccGap(icd.code);
    } else {
      // For Phase 2c we dismiss directly. The reason-picker modal is 2e.
      dismissHccGap(icd.code);
    }
  };

  const handleMore = (e) => {
    e.stopPropagation();
    showToast('ICD actions — coming in Phase 3');
  };

  // Clicking the notes count button opens the unified expansion panel with
  // the MEAT Note section expanded (and Confidence collapsed). Clicking
  // again while MEAT is already open collapses the panel. For closed ICDs
  // (Accepted / Dismissed) the panel can't render, so we keep the toast.
  const handleNotesClick = (e) => {
    e.stopPropagation();
    if (isClosed) {
      showToast('Notes — coming in Phase 3');
      return;
    }
    const meatAlreadyOpen = panel === 'meat' && meatOpen;
    if (meatAlreadyOpen) {
      setPanel('none');
      setMeatOpen(false);
      return;
    }
    if (!meatText) setMeatText(getMeatNote(icd.code, icd.desc));
    setPanel('meat');
    setConfOpen(false);
    setMeatOpen(true);
  };

  return (
    <div
      className={[styles.row, isDismissed ? styles.rowClosed : '', isSelected ? styles.rowSelected : ''].join(' ')}
      data-status={icd.status}
    >
      {/* Title sub-stack — code + description, then Last Reviewed, then the
          badge cluster (HCC / Suspect / Confidence). All three sit inside
          the stack with a tight 4px gap so the badges read as part of the
          title block, not as a separate section. Outer .row gap (12px)
          continues to separate the whole stack from the footer. */}
      <div className={styles.titleStack}>
        <div className={styles.topRow}>
          <span
            className={styles.code}
            onClick={(e) => {
              e.stopPropagation();
              // Toggle: clicking the already-selected code clears the scope.
              if (isSelected) clearDiagActivityIcd();
              else openIcdActivityLog(icd.code);
            }}
            title={isSelected ? `Hide activity for ${icd.code}` : `View activity for ${icd.code}`}
          >
            {icd.code}
          </span>
          <span className={styles.desc}>{icd.desc}</span>
        </div>
        {(icd.by || icd.last) && (
          <div className={styles.lastLine}>
            {icd.by
              ? `Last Reviewed by ${icd.by}${icd.last ? ' · ' + icd.last : ''}`
              : `Last Recorded: ${icd.last}`}
          </div>
        )}
        <div className={styles.badges}>
          {icd.hcc && (
            <span className={styles.hccChip}>{icd.hcc.split(' - ')[0]}</span>
          )}
          {typeBadge && (
            <span className={[styles.typeTag, styles[typeBadge.className]].join(' ')}>
              {typeBadge.label}
            </span>
          )}
          {conf.score > 0 && (
            <button
              type="button"
              className={styles.confidenceBadge}
              style={{ background: scoreStyle.bg }}
              onClick={handleConfidenceClick}
              aria-expanded={panel === 'confidence'}
              title={`Confidence: ${conf.status} (${conf.score})`}
            >
              <Icon name="solar:star-bold" size={9} color="var(--neutral-0)" />
              <span>{conf.score}</span>
            </button>
          )}
          {icd.dismissReason && (
            <span className={styles.overrideChip}>
              <Icon name="solar:refresh-linear" size={9} color="var(--neutral-300)" />
              Overrides
            </span>
          )}
        </div>
      </div>

      {/* Dismiss-reason explanation row — visible when this ICD has been
          dismissed with a reason. Matches the prototype line 1186. */}
      {icd.dismissReason && isDismissed && (
        <div className={styles.dismissExplanation}>
          <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-300)" />
          <em>{icd.dismissReason}</em>
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.counts}>
          <button
            type="button"
            className={styles.countBtn}
            onClick={(e) => { e.stopPropagation(); openIcdPanel('documents', icd.code); }}
            aria-label={`Open documents for ${icd.code}`}
          >
            <Icon name="solar:file-text-linear" size={16} color="var(--neutral-300)" />
            <span>{icd.docs ?? 0}</span>
          </button>
          <span className={styles.countDivider} />
          <button
            type="button"
            className={styles.countBtn}
            onClick={(e) => { e.stopPropagation(); openIcdPanel('comments', icd.code); }}
            aria-label={`Open comments for ${icd.code}`}
          >
            <Icon name="solar:chat-square-linear" size={16} color="var(--neutral-300)" />
            <span>{icd.cmts ?? 0}</span>
          </button>
          <span className={styles.countDivider} />
          <button
            type="button"
            className={[
              styles.countBtn,
              panel === 'meat' && meatOpen ? styles.countBtnActive : '',
            ].filter(Boolean).join(' ')}
            onClick={handleNotesClick}
            aria-expanded={panel === 'meat' && meatOpen}
            aria-label="Open MEAT note"
          >
            <Icon
              name="solar:notes-linear"
              size={16}
              color={panel === 'meat' && meatOpen ? 'var(--primary-300)' : 'var(--neutral-300)'}
            />
            <span>{noteCount}</span>
          </button>
        </div>

        <div className={styles.actions}>
          {isAccepted ? (
            <span className={[styles.actionBtn, styles.acceptedPill].join(' ')}>
              <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
              <span>Accepted</span>
            </span>
          ) : (
            <button
              type="button"
              className={[styles.actionBtn, styles.acceptBtn].join(' ')}
              onClick={handleAccept}
            >
              <Icon name="solar:check-read-linear" size={16} color="var(--primary-300)" />
              <span>Accept</span>
            </button>
          )}

          <button
            type="button"
            className={[
              styles.actionBtn,
              isDismissed ? styles.dismissedBtn : styles.dismissBtn,
            ].join(' ')}
            onClick={handleDismiss}
            title={isDismissed ? 'Click to reopen' : 'Dismiss this gap'}
          >
            <Icon
              name="solar:close-circle-linear"
              size={16}
              color={isDismissed ? 'var(--status-error)' : 'var(--neutral-300)'}
            />
            <span>{isDismissed ? 'Dismissed' : 'Dismiss'}</span>
          </button>

          <ActionButton
            icon="solar:menu-dots-linear"
            size="L"
            tooltip="More actions"
            onClick={handleMore}
          />
        </div>
      </div>

      {/* ── Unified expansion panel (Confidence Score + MEAT Note) ─────────
          Opens when user clicks the confidence-score badge (confidence) or
          clicks Accept on an AI-suggested ICD (meat). Both sections live in
          the same panel; each can be collapsed independently. Mirrors
          prototype lines 1619–1743. */}
      {panel !== 'none' && !isClosed && (
        <div className={styles.expansionPanel}>
          {/* Confidence Score section */}
          <div className={styles.expandSection}>
            <div className={styles.expandHeader}>
              <button
                type="button"
                className={styles.expandHeaderLeft}
                onClick={() => setConfOpen(o => !o)}
              >
                <Icon
                  name={confOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
                  size={12}
                  color="var(--neutral-300)"
                />
                <span className={styles.expandTitle}>Confidence Score</span>
                <span
                  className={styles.scorePill}
                  style={{ background: scoreStyle.bg }}
                >
                  <span className={styles.scoreValue}>{conf.score}/100</span>
                  <span className={styles.scoreLabel}>&bull; {scoreStyle.label}</span>
                </span>
              </button>
              <button
                type="button"
                className={styles.expandClose}
                onClick={() => setPanel('none')}
              >
                <Icon name="solar:close-linear" size={12} color="var(--neutral-300)" />
                <span>Close</span>
              </button>
            </div>
            {confOpen && (
              <div className={styles.evidenceWrap}>
                <div className={styles.evidenceHeader}>
                  <Icon name="solar:bolt-linear" size={14} color="var(--primary-300)" />
                  <span>Clinical Evidence</span>
                </div>
                {conf.evidence.map((ev, i) => (
                  <div key={i} className={styles.evidenceRow}>
                    <span className={styles.evidenceBullet} aria-hidden="true" />
                    <span className={styles.evidenceText}>{ev.text}</span>
                    <button
                      type="button"
                      className={styles.evidenceLink}
                      title="Open source document"
                      aria-label="Open source document"
                    >
                      <Icon name="solar:link-linear" size={12} color="var(--primary-300)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MEAT Note section */}
          <div className={styles.expandSection}>
            <button
              type="button"
              className={styles.expandHeaderLeft}
              onClick={() => {
                setMeatOpen(o => {
                  if (!o && !meatText) setMeatText(getMeatNote(icd.code, icd.desc));
                  return !o;
                });
              }}
            >
              <Icon
                name={meatOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
                size={12}
                color="var(--neutral-400)"
              />
              <span className={styles.expandTitleLg}>MEAT Note</span>
              <span className={styles.readyBadge}>
                <Icon name="solar:star-bold" size={9} color="var(--primary-300)" />
                <span>Ready</span>
              </span>
            </button>
            {meatOpen && (
              <div className={styles.meatBody}>
                <div className={styles.meatInfoBanner}>
                  <Icon name="solar:info-circle-linear" size={12} color="var(--status-info)" />
                  <span>Review this auto-generated MEAT note before accepting.</span>
                </div>
                <textarea
                  className={styles.meatTextarea}
                  value={meatText}
                  onChange={(e) => setMeatText(e.target.value)}
                />
                <div className={styles.meatActions}>
                  <button
                    type="button"
                    className={[styles.meatBtn, styles.meatSignBtn].join(' ')}
                    onClick={handleSignAccept}
                    disabled={!meatText.trim()}
                  >
                    <Icon name="solar:pen-linear" size={12} color="var(--neutral-0)" />
                    <span>Sign &amp; Accept</span>
                  </button>
                  <button
                    type="button"
                    className={styles.meatBtn}
                    onClick={() => showToast('Saved as draft — wiring in a follow-up.')}
                  >
                    <Icon name="solar:notes-linear" size={12} color="var(--neutral-300)" />
                    <span>Save as Draft</span>
                  </button>
                  <button
                    type="button"
                    className={styles.meatBtn}
                    onClick={() => {
                      navigator.clipboard?.writeText?.(meatText);
                      showToast('MEAT note copied to clipboard');
                    }}
                  >
                    <Icon name="solar:copy-linear" size={12} color="var(--neutral-300)" />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
