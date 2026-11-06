import { useEffect, useRef } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './SwipeActions.module.css';

// Where a released flick would come to rest (Apple's scroll-deceleration projection).
const project = (velocity, rate = 0.998) => (velocity / 1000) * rate / (1 - rate);
const rubberband = (overshoot, dimension, c = 0.55) => (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
const SETTLE = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * A list row the user can swipe, like iOS Mail or Phone (Figma 759:18999 / 759:19019).
 *
 * - `leading`: one action revealed by swiping right; a long or fast swipe runs it.
 * - `trailing`: actions revealed by swiping left; the row stays open until one is
 *   tapped or the row is tapped again.
 * Each action is `{ key, label, icon, onAction, disabled }`.
 *
 * The row follows the finger 1:1, rubber-bands past its ends, and only claims the
 * gesture once it is clearly horizontal, so vertical scrolling is unaffected.
 */
export function SwipeActions({ leading, trailing = [], children, className }) {
  const trackRef = useRef(null);
  const trailRef = useRef(null);
  const drag = useRef(null);
  const offset = useRef(0);
  const swallowClick = useRef(false);
  const enabledTrailing = trailing.filter(Boolean);
  const canLead = !!leading && !leading.disabled;

  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const place = (x, animate) => {
    const el = trackRef.current;
    if (!el) return;
    offset.current = x;
    el.style.transition = animate && !reduced() ? SETTLE : 'none';
    el.style.transform = x ? `translateX(${x}px)` : '';
    el.parentElement.dataset.side = x > 0 ? 'leading' : x < 0 ? 'trailing' : '';
  };
  const close = () => place(0, true);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { x0: e.clientX, y0: e.clientY, base: offset.current, dir: null, samples: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.dir) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      d.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.dir === 'y') { drag.current = null; return; }
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    if (d.samples.length > 5) d.samples.shift();
    const width = trackRef.current?.offsetWidth || 1;
    const trailWidth = trailRef.current?.offsetWidth || 0;
    let x = d.base + dx;
    if (x > 0 && !canLead) x = rubberband(x, width);
    if (x < -trailWidth) x = -trailWidth - rubberband(-trailWidth - x, width);
    place(x, false);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.dir) {
      // A tap on an open row closes it instead of opening the row.
      if (offset.current !== 0) { swallowClick.current = true; close(); }
      return;
    }
    swallowClick.current = true;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const velocity = ((last.x - first.x) / Math.max(1, last.t - first.t)) * 1000;
    const rest = offset.current + project(velocity);
    const width = trackRef.current?.offsetWidth || 1;
    const trailWidth = trailRef.current?.offsetWidth || 0;
    if (canLead && rest > width * 0.4) {
      close();
      leading.onAction?.();
    } else if (enabledTrailing.length && rest < -trailWidth / 2) {
      place(-trailWidth, true);
    } else {
      close();
    }
  };
  // A drag ends with a click on whatever was under the finger; swallow it so the
  // row doesn't also open. Native capture listener: the track isn't a control.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const onClick = (e) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('click', onClick, true);
    return () => el.removeEventListener('click', onClick, true);
  }, []);

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      {leading && (
        <div className={styles.leading} aria-hidden="true">
          <span className={styles.action}>
            <Icon name={leading.icon} size={24} color="currentColor" />
            <span className={styles.leadingLabel}>{leading.label}</span>
          </span>
        </div>
      )}
      {enabledTrailing.length > 0 && (
        <div className={styles.trailing}>
          <div ref={trailRef} className={styles.trailingActions}>
            {enabledTrailing.map(a => (
              <button
                key={a.key}
                type="button"
                className={styles.trailingAction}
                disabled={a.disabled}
                tabIndex={-1}
                onClick={() => { close(); a.onAction?.(); }}
              >
                <Icon name={a.icon} size={24} color="currentColor" />
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; close(); }}
      >
        {children}
      </div>
    </div>
  );
}
