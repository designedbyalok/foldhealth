import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

/**
 * Tooltip: lightweight portaled hover/focus tooltip.
 *
 * Wraps a single trigger element (usually a button) and renders a small
 * dark bubble above it on hover / keyboard focus, with a 120ms open delay
 * and instant close. Escapes overflow via a portal.
 *
 * Props:
 *  - label   (string | ReactNode)  Tooltip content. Empty → renders nothing.
 *  - children (ReactNode)  The trigger element.
 *  - placement ('top' | 'bottom' | 'left' | 'right')  Where the bubble sits
 *             relative to the trigger. Defaults to 'top'. Left / right are
 *             the sidebar-style side placements, with the bubble centred
 *             vertically on the trigger; one with no room on its side of
 *             the viewport opens on the other.
 *  - className (string)  Optional class on the inline wrapper span.
 *  - maxWidth (number)  Wrap long content at this pixel width (default is a
 *             single nowrap line: pass this for sentence-length tooltips).
 *  - align   ('center' | 'left' | 'right')  Horizontal anchoring. Defaults to
 *             centring on the trigger; 'right' pins the bubble's right edge to
 *             the trigger's, for triggers near the right edge of a panel where
 *             a centred bubble would be clipped.
 *  - variant ('dark' | 'light' | 'card')  Visual treatment. Defaults to 'dark';
 *             'light' matches ActionButton tooltips (white bubble, border,
 *             shadow); 'card' is light without the border and with room for
 *             a heading and notes (pair with maxWidth).
 *  - raised  (boolean)  A higher lift (`--shadow-tooltip-raised`), for a card
 *             that sits over busy content such as a form.
 *  - followCursor (boolean)  Anchor to the pointer instead of the trigger, and
 *             track it while hovering. For wide triggers (a whole form field)
 *             where a bubble centred on the element lands far from the cursor.
 */
export function Tooltip({ label, children, placement = 'top', className, maxWidth, align = 'center', variant = 'dark', followCursor = false, raised = false }) {
  const triggerRef = useRef(null);
  const openTimer = useRef(null);
  const [rect, setRect] = useState(null);

  // A zero-size rect at the pointer, so the placement maths below applies unchanged.
  const pointRect = (e) => ({ left: e.clientX, right: e.clientX, width: 0, top: e.clientY - 4, bottom: e.clientY + 16 });
  const open = (e) => {
    if (!label) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    const point = followCursor && e?.clientX != null ? pointRect(e) : null;
    openTimer.current = setTimeout(() => {
      const r = point || triggerRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    }, 120);
  };
  const move = (e) => { if (followCursor && rect) setRect(pointRect(e)); };
  const close = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    setRect(null);
  };
  useEffect(() => () => clearTimeout(openTimer.current), []);

  // Following the cursor near a viewport edge, the bubble opens away from
  // that edge (its right edge at the cursor on the right side) so it isn't
  // clipped or squeezed.
  // A side bubble with no room on its side opens on the other one instead
  // (an option in a list that runs to the right edge of a drawer).
  let place = placement;
  if (rect && (placement === 'left' || placement === 'right')) {
    const need = (maxWidth || 200) + 8;
    if (placement === 'right' && rect.right + need > window.innerWidth && rect.left - need >= 0) place = 'left';
    else if (placement === 'left' && rect.left - need < 0 && rect.right + need <= window.innerWidth) place = 'right';
  }
  let side = align;
  if (followCursor && rect) {
    const half = (maxWidth || 200) / 2 + 8;
    if (rect.left + half > window.innerWidth) side = 'right';
    else if (rect.left - half < 0) side = 'left';
  }
  const anchorX = rect
    ? side === 'right' ? rect.right
      : side === 'left' ? rect.left
        : rect.left + rect.width / 2
    : 0;
  const style = rect
    ? place === 'bottom'
      ? { top: rect.bottom + 6, left: anchorX }
      : place === 'left'
        ? { top: rect.top + rect.height / 2, left: rect.left - 6 }
        : place === 'right'
          ? { top: rect.top + rect.height / 2, left: rect.right + 6 }
          : { top: rect.top - 6,     left: anchorX }
    : null;
  // Edge-aligned bubbles: the arrow points at the trigger's centre, not the
  // bubble's (the CSS keeps it inside the bubble).
  if (style && (side === 'left' || side === 'right')) style['--tt-arrow'] = `${Math.round(rect.width / 2)}px`;
  if (style && maxWidth) {
    style.maxWidth = maxWidth;
    // Its own width, not what's left of the viewport past its left edge.
    style.width = 'max-content';
    style.whiteSpace = 'normal';
    style.textAlign = 'left';
  }

  return (
    <span
      ref={triggerRef}
      className={[styles.wrap, className || ''].filter(Boolean).join(' ')}
      onMouseEnter={open}
      onMouseMove={followCursor ? move : undefined}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {children}
      {rect && label && createPortal(
        <span
          role="tooltip"
          className={[
            styles.bubble,
            variant === 'light' || variant === 'card' ? styles.bubbleLight : '',
            variant === 'card' ? styles.bubbleCard : '',
            raised ? styles.bubbleRaised : '',
            place === 'bottom' ? styles.bubbleBottom
              : place === 'left' ? styles.bubbleLeft
                : place === 'right' ? styles.bubbleRight
                  : styles.bubbleTop,
            side === 'right' ? styles.bubbleAlignRight : '',
            side === 'left' ? styles.bubbleAlignLeft : '',
          ].filter(Boolean).join(' ')}
          style={style}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
