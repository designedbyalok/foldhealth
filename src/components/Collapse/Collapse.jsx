import { useState } from 'react';
import styles from './Collapse.module.css';

/**
 * Collapse: shows or hides its children with the height easing open and
 * shut (the same grid-row technique CollapsibleSection uses). The content
 * stays mounted; while shut it's inert, so it can't be tabbed into.
 *
 * @param {object}  props
 * @param {boolean} props.open
 * @param {React.ReactNode} props.children
 * @param {string}  [props.className] – On the animated outer box
 */
export function Collapse({ open, children, className }) {
  // The content is clipped while the height animates, then let out once it's
  // fully open, so dropdowns and popovers inside aren't cut off at the edge.
  const [settled, setSettled] = useState(open);
  const onTransitionEnd = (e) => {
    if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows') setSettled(open);
  };
  return (
    <div
      className={[styles.outer, open ? styles.open : '', open && settled ? styles.settled : '', className || ''].filter(Boolean).join(' ')}
      inert={!open}
      onTransitionEnd={onTransitionEnd}
    >
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
