import styles from './Link.module.css';

/**
 * Link: inline primary-colored text link.
 *
 * Use for primary text actions like "Download Template" or "Choose file".
 * Renders a span (so it composes inside sentences and clickable containers);
 * pass `onClick` for standalone actions.
 *
 * Props:
 *  - children   (ReactNode)
 *  - variant    ('primary'|'secondary'|'subtle'): 'secondary' renders the same
 *                link in neutral text, for de-emphasised actions sitting next
 *                to a primary one; 'subtle' is dark grey regular text that
 *                turns purple with a dashed underline on hover (e.g. "View 3 More")
 *  - size       ('xs'|'sm'|'md'|'lg'): 12 / 13 / 14 / 16px text; unset inherits
 *                the surrounding size
 *  - disabled   (boolean): greyed out and inert (no click, not focusable)
 *  - onClick    (function)
 *  - className  (string)
 *  - style      (object): e.g. { fontSize: 'var(--font-sm)' }
 */
export function Link({ children, variant = 'primary', size, disabled = false, onClick, className, style, ...rest }) {
  return (
    <span
      className={[styles.link, variant === 'secondary' ? styles.secondary : '', variant === 'subtle' ? styles.subtle : '', size ? styles[`size-${size}`] : '', disabled ? styles.disabled : '', className].filter(Boolean).join(' ')}
      onClick={disabled ? undefined : onClick}
      style={style}
      {...rest}
      {...(disabled ? { 'aria-disabled': true, tabIndex: -1, onKeyDown: undefined } : {})}
    >
      {children}
    </span>
  );
}
