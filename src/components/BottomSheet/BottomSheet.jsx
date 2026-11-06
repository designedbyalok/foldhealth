import { useRef } from 'react';
import { useNativeDialog } from '../../hooks/useNativeDialog';
import { Icon } from '../Icon/Icon';
import styles from './BottomSheet.module.css';

/**
 * BottomSheet: a sheet that slides up from the bottom of a phone screen
 * (Figma Provider App "Drawer", e.g. 759:21765). Built on a native <dialog>,
 * so focus stays inside, Escape closes it and the page behind is inert.
 * Tapping the dimmed area closes it too, and so does dragging it down by
 * its grab handle (Apple HIG sheets: the sheet follows the finger 1:1,
 * resists being pulled up, and a flick dismisses it even if it hasn't
 * travelled far, because the release velocity is projected forward).
 *
 * Render it only while open (`{open && <BottomSheet … />}`).
 *
 * @param {object}   props
 * @param {string}   [props.title]   – small caps heading with a close button
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.children
 * @param {string}   [props.className]
 */
export function BottomSheet({ title, onClose, children, className }) {
  const ref = useNativeDialog();
  const sheetRef = useRef(null);
  const drag = useSheetDrag(sheetRef, onClose);
  return (
    // Escape arrives as the dialog's cancel event.
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
      <div ref={sheetRef} className={[styles.sheet, className].filter(Boolean).join(' ')}>
        <div className={styles.dragZone} {...drag}>
          <span className={styles.grabber} aria-hidden="true" />
          {title && (
            <div className={styles.head}>
              <h2 className={styles.title}>{title}</h2>
              <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
                <Icon name="solar:close-circle-linear" size={24} />
              </button>
            </div>
          )}
        </div>
        {children}
      </div>
      {/* Tapping the dimmed area closes. Keyboard users have Escape and the
          close button, so this stays out of the tab order; it comes after
          the sheet so the dialog's first focus lands in the sheet. */}
      <button type="button" className={styles.scrim} aria-label="Close" tabIndex={-1} onClick={onClose} />
    </dialog>
  );
}

/**
 * One tappable row in a BottomSheet: icon, label, optional detail on the
 * right (Figma 759:21765 "Re-assign · Dr. JeDee Potter (You)").
 */
export function BottomSheetItem({ icon, label, detail, tone = 'neutral', onClick, disabled }) {
  return (
    <button
      type="button"
      className={[styles.item, tone === 'danger' ? styles.danger : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={24} color="currentColor" />}
      <span className={styles.itemLabel}>{label}</span>
      {detail && <span className={styles.itemDetail}>{detail}</span>}
    </button>
  );
}

// Where a released flick would come to rest: the exponential-decay
// projection Apple ships with scroll deceleration (Designing Fluid Interfaces).
const project = (velocity, rate = 0.998) => (velocity / 1000) * rate / (1 - rate);
// Pulling past the top resists more the further it goes.
const rubberband = (overshoot, dimension, c = 0.55) => (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
const SETTLE = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';

function useSheetDrag(sheetRef, onClose) {
  const state = useRef(null);
  const place = (y, transition = 'none') => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform = y ? `translateY(${y}px)` : '';
  };
  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button, a, input, textarea, select')) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      state.current = { y0: e.clientY, dy: 0, moved: false, samples: [{ y: e.clientY, t: e.timeStamp }] };
    },
    onPointerMove: (e) => {
      const d = state.current;
      if (!d) return;
      const dy = e.clientY - d.y0;
      // A little travel before committing, so a tap on the handle isn't a drag.
      if (!d.moved && Math.abs(dy) < 10) return;
      d.moved = true;
      d.samples.push({ y: e.clientY, t: e.timeStamp });
      if (d.samples.length > 5) d.samples.shift();
      const height = sheetRef.current?.offsetHeight || 1;
      d.dy = dy >= 0 ? dy : -rubberband(-dy, height);
      place(d.dy);
    },
    onPointerUp: () => {
      const d = state.current;
      state.current = null;
      if (!d?.moved) return;
      const first = d.samples[0];
      const last = d.samples[d.samples.length - 1];
      const dt = Math.max(1, last.t - first.t);
      const velocity = ((last.y - first.y) / dt) * 1000;
      const height = sheetRef.current?.offsetHeight || 1;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (d.dy + project(velocity) > height / 2) {
        if (reduced) { onClose(); return; }
        place(height, SETTLE);
        setTimeout(onClose, 300);
      } else {
        place(0, reduced ? 'none' : SETTLE);
      }
    },
    onPointerCancel: () => { state.current = null; place(0, SETTLE); },
  };
}
