import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { CloseButton } from '../CloseButton/CloseButton';
import styles from './Coachmark.module.css';

const GAP = 10;
const EDGE = 8;
// Clear space kept around the anchor inside the blur.
const SPOT = 4;

/**
 * A first-time hint pointing at a control (FCS-5677 3540:64643): an icon,
 * a line of guidance and a close button, in a card above the anchor with an
 * arrow down to it. Portal-rendered and kept on the anchor as the page
 * scrolls or resizes. Everything but the anchor is blurred behind it, so
 * the eye lands on the control being introduced. Whether it was dismissed
 * is the caller's to remember.
 *
 * @param {{ current: HTMLElement }} props.anchorRef
 * @param {string}   [props.icon]   Solar icon for the tile on the left
 * @param {import('react').ReactNode} [props.illustration]  shown in place of the icon tile
 * @param {number}   [props.width=320]
 * @param {() => void} props.onClose
 */
export function Coachmark({ anchorRef, icon = 'solar:info-circle-linear', width = 320, illustration, onClose, children }) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const card = cardRef.current;
      if (!a || !card) return;
      const w = Math.min(width, window.innerWidth - EDGE * 2);
      const center = a.left + a.width / 2;
      const left = Math.max(EDGE, Math.min(center - w / 2, window.innerWidth - w - EDGE));
      setPos({ left, width: w, bottom: window.innerHeight - a.top + GAP, arrow: center - left, anchor: a });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, width]);

  const a = pos?.anchor;
  return createPortal(
    <>
      {a && (
        <div className={styles.backdrop} aria-hidden="true">
          <span style={{ top: 0, left: 0, right: 0, height: a.top - SPOT }} />
          <span style={{ top: a.bottom + SPOT, left: 0, right: 0, bottom: 0 }} />
          <span style={{ top: a.top - SPOT, height: a.height + SPOT * 2, left: 0, width: a.left - SPOT }} />
          <span style={{ top: a.top - SPOT, height: a.height + SPOT * 2, left: a.right + SPOT, right: 0 }} />
          <i
            className={styles.spot}
            style={{ top: a.top - SPOT, left: a.left - SPOT, width: a.width + SPOT * 2, height: a.height + SPOT * 2 }}
          />
        </div>
      )}
      <div
        ref={cardRef}
        role="dialog"
        className={`${styles.card} ${illustration ? styles.cardLarge : ''}`}
        style={pos ? { left: pos.left, width: pos.width, bottom: pos.bottom } : { visibility: 'hidden' }}
      >
        {illustration
          ? <span className={styles.illustration}>{illustration}</span>
          : <span className={styles.tile}><Icon name={icon} size={20} color="var(--primary-300)" /></span>}
        <div className={`${styles.text} ${illustration ? styles.textLarge : ''}`}>{children}</div>
        <CloseButton size={16} onClick={onClose} label="Dismiss" className={styles.close} />
        {pos && <span className={styles.arrow} style={{ left: pos.arrow }} aria-hidden="true" />}
      </div>
    </>,
    document.body,
  );
}
