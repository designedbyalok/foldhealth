import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import styles from './HccUploadProgressRibbon.module.css';

/**
 * HccUploadProgressRibbon: slim purple ribbon that sits at the top of
 * the HCC worklist when one or more documents are extracting in the
 * background (drawer closed). Mirrors Figma 121:82599.
 *
 * States:
 *   - Pending: "✨ {N} of {M} Processing Documents" + [✨ View] [×]
 *   - Complete (all done, not yet acknowledged): green tint with
 *     "✓ {N} Documents Processed & Extracted Successfully" + [Ready to Review] [×]
 *
 * Visibility rules:
 *   - Hidden if there are no batches at all OR if the upload drawer is
 *     currently open (the drawer carries its own progress UI).
 *   - User can dismiss with the × button, local state hides the
 *     ribbon for the remainder of the session.
 */
export function HccUploadProgressRibbon() {
  const batches = useAppStore(s => s.hccSftpBatches) || [];
  const drawerOpen = useAppStore(s => !!s.hccUploadSession);
  const sftpReviewOpen = useAppStore(s => s.hccSftpReviewOpen);
  const openSftpReview = useAppStore(s => s.openHccSftpReview);
  // Remember which batches the user dismissed so the ribbon doesn't
  // reappear every render: but DO reset when a new batch arrives so
  // the next upload always surfaces.
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const seenIdsRef = useRef(new Set());
  useEffect(() => {
    const currentIds = batches.map(b => b.id);
    const fresh = currentIds.filter(id => !seenIdsRef.current.has(id));
    if (fresh.length > 0) {
      // New batches arrived → un-dismiss so the ribbon comes back.
      setDismissedIds(new Set());
      fresh.forEach(id => seenIdsRef.current.add(id));
    }
  }, [batches]);

  const visibleBatches = batches.filter(b => !dismissedIds.has(b.id));
  const dismissAll = () => setDismissedIds(new Set(batches.map(b => b.id)));

  if (drawerOpen || sftpReviewOpen) return null;
  if (visibleBatches.length === 0) return null;

  const pending = visibleBatches.filter(b => b.status === 'pending').length;
  const done = visibleBatches.filter(b => b.status === 'done').length;
  const total = visibleBatches.length;
  const allDone = pending === 0 && done > 0;

  if (allDone) {
    return (
      <div className={[styles.ribbon, styles.ribbonComplete].join(' ')}>
        <Icon name="solar:check-circle-bold" size={16} color="var(--status-success)" />
        <span className={styles.ribbonLabel}>
          <strong>{done}</strong> Document{done === 1 ? '' : 's'} Processed &amp; Extracted Successfully
        </span>
        <span className={styles.ribbonSpacer} />
        <button
          type="button"
          className={styles.ribbonCta}
          onClick={() => openSftpReview?.()}
        >
          <Icon name="custom:ai-mono" size={13} color="#fff" />
          Ready to Review
        </button>
        <CloseButton size={14} onClick={() => dismissAll()} className={styles.ribbonClose} label="Dismiss" />
      </div>
    );
  }

  // Pending state: show running progress.
  return (
    <div className={styles.ribbon}>
      <Icon name="custom:ai" size={14} color="var(--primary-300)" />
      <span className={styles.ribbonLabel}>
        <strong>{done} of {total}</strong>&nbsp; Processing Documents
      </span>
      <span className={styles.ribbonProgressTrack}>
        <span
          className={styles.ribbonProgressFill}
          style={{ transform: `scaleX(${total === 0 ? 0 : done / total})` }}
        />
      </span>
      <button
        type="button"
        className={styles.ribbonView}
        onClick={() => openSftpReview?.()}
      >
        <Icon name="custom:ai" size={12} color="var(--primary-300)" />
        View
      </button>
      <CloseButton size={14} onClick={() => dismissAll()} className={styles.ribbonClose} label="Dismiss" />
    </div>
  );
}
