import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

/**
 * Tooltip — lightweight portaled hover/focus tooltip.
 *
 * Wraps a single trigger element (usually a button) and renders a small
 * dark bubble above it on hover / keyboard focus, with a 120ms open delay
 * and instant close. Escapes overflow via a portal.
 *
 * Props:
 *  - label   (string | ReactNode)  Tooltip content. Empty → renders nothing.
 *  - children (ReactNode)  The trigger element.
 *  - placement ('top' | 'bottom')  Vertical placement. Defaults to 'top'.
 *  - className (string)  Optional class on the inline wrapper span.
 */
export function Tooltip({ label, children, placement = 'top', className }) {
  const triggerRef = useRef(null);
  const openTimer = useRef(null);
  const [rect, setRect] = useState(null);

  const open = () => {
    if (!label) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    }, 120);
  };
  const close = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    setRect(null);
  };
  useEffect(() => () => clearTimeout(openTimer.current), []);

  const style = rect
    ? placement === 'bottom'
      ? { top: rect.bottom + 6, left: rect.left + rect.width / 2 }
      : { top: rect.top - 6,     left: rect.left + rect.width / 2 }
    : null;

  return (
    <span
      ref={triggerRef}
      className={[styles.wrap, className || ''].filter(Boolean).join(' ')}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {children}
      {rect && label && createPortal(
        <span
          role="tooltip"
          className={[styles.bubble, placement === 'bottom' ? styles.bubbleBottom : styles.bubbleTop].join(' ')}
          style={style}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
