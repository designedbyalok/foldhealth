import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../../components/Icon/Icon';
import { CloseIcon } from '../../../../components/Icon/CloseIcon';
import { Button } from '../../../../components/Button/Button';
import {
  getDbSeenTours,
  getLocalSeenTours,
  getUserId,
  markDbTourSeen,
  markLocalTourSeen,
} from '../../../tours/tourStore';
import styles from './SidebarCollapseHint.module.css';

const TOUR_ID = 'patient-profile-sidebar-collapse';
const HOVER_DELAY_MS = 300;

function HintCard({ anchorRef, onDismiss }) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef]);

  if (!pos) return null;

  return (
    <div
      ref={cardRef}
      className={styles.card}
      style={{ top: pos.top, left: pos.left }}
      role="group"
      aria-labelledby="sidebar-collapse-hint-title"
      aria-describedby="sidebar-collapse-hint-desc"
    >
      <span className={styles.caret} aria-hidden="true" />
      <button type="button" className={styles.closeBtn} onClick={onDismiss} aria-label="Dismiss">
        <CloseIcon size={16} color="var(--neutral-300)" />
      </button>
      <div className={styles.hero} aria-hidden="true">
        <div className={styles.heroIcon}>
          <Icon name="solar:sidebar-minimalistic-linear" size={28} color="var(--primary-300)" />
        </div>
      </div>
      <div className={styles.body}>
        <h3 id="sidebar-collapse-hint-title" className={styles.title}>Collapse the side panel</h3>
        <p id="sidebar-collapse-hint-desc" className={styles.desc}>
          You can collapse this section for a clearer view and more working area.
        </p>
        <Button className={styles.cta} onClick={onDismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}

/**
 * One-time (per user) hint for the profile sidebar collapse control.
 * Auto-opens on first visit; reopens on button hover after 300ms.
 */
export function SidebarCollapseHint({ children, enabled = true }) {
  const anchorRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const pinnedRef = useRef(false);
  const [open, setOpen] = useState(false);

  const dismiss = useCallback(async () => {
    setOpen(false);
    pinnedRef.current = false;
    markLocalTourSeen(TOUR_ID);
    const userId = await getUserId();
    if (userId) markDbTourSeen(userId, TOUR_ID);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    (async () => {
      const localSeen = getLocalSeenTours();
      if (localSeen[TOUR_ID]) return;

      const userId = await getUserId();
      if (cancelled) return;
      if (userId) {
        const dbSeen = await getDbSeenTours(userId);
        if (dbSeen[TOUR_ID]) {
          markLocalTourSeen(TOUR_ID);
          return;
        }
      }

      if (!cancelled) {
        pinnedRef.current = true;
        setOpen(true);
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    if (pinnedRef.current) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => setOpen(false), 120);
  };

  const handleMouseEnter = () => {
    if (!enabled) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    clearHoverTimer();
    scheduleClose();
  };

  const handleHintEnter = () => {
    clearHoverTimer();
  };

  useEffect(() => () => clearHoverTimer(), []);

  return (
    <>
      <span
        ref={anchorRef}
        className={styles.anchor}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
      {enabled && open && createPortal(
        <div onMouseEnter={handleHintEnter} onMouseLeave={handleMouseLeave}>
          <HintCard anchorRef={anchorRef} onDismiss={dismiss} />
        </div>,
        document.body,
      )}
    </>
  );
}
