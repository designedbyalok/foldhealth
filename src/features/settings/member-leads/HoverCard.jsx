import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './HoverCard.module.css';

/**
 * HoverCard: small wrapper that shows a portal-rendered popover when the
 * user hovers the trigger. Used for the Care Team configuration tooltips:
 *   • "Capacity Used: X%" → capacity breakdown by team
 *   • "Total Assigned Users: X%" → users assigned to a TIN
 *   • Team Users avatar stack (in the Care Team table) → user list
 *
 * Props:
 *  - children  ReactNode    The trigger element (rendered as-is).
 *  - content   ReactNode    The popover body.
 *  - placement 'top'|'bottom'  Where to anchor relative to the trigger.
 *                              Defaults to 'top'.
 *  - openDelay number       ms before showing (avoids accidental triggers).
 *                           Defaults to 150.
 */
export function HoverCard({ children, content, placement = 'top', openDelay = 150 }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const openT = useRef(null);
  const closeT = useRef(null);

  const cancelClose = () => { if (closeT.current) { clearTimeout(closeT.current); closeT.current = null; } };
  const cancelOpen  = () => { if (openT.current)  { clearTimeout(openT.current);  openT.current  = null; } };

  const onEnter = () => {
    cancelClose();
    if (pos) return;
    openT.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      // Position above by default; flip below if there's no headroom.
      const tentativeTop = placement === 'bottom' ? r.bottom + 8 : r.top - 8;
      setPos({ top: tentativeTop, left: r.left + r.width / 2, placement });
    }, openDelay);
  };
  const onLeave = () => {
    cancelOpen();
    closeT.current = setTimeout(() => setPos(null), 120);
  };

  useEffect(() => () => { cancelOpen(); cancelClose(); }, []);

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className={styles.trigger}
      >
        {children}
      </span>
      {pos && createPortal(
        <div
          className={[styles.card, pos.placement === 'bottom' ? styles.cardBottom : styles.cardTop].join(' ')}
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={cancelClose}
          onMouseLeave={onLeave}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
