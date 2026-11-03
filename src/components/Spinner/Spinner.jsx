import styles from './Spinner.module.css';

/**
 * Fold Health Spinner: an indeterminate ring for work in progress. Draws in
 * `currentColor`, so it takes the color of whatever it sits in (a button's
 * label, a muted caption).
 *
 * @param {object} props
 * @param {number} [props.size=16]  Diameter in px.
 * @param {string} [props.label]    Announced to screen readers (role="status").
 *                                  Leave it out when the spinner only decorates
 *                                  something that already says it's busy, such
 *                                  as a button with aria-busy.
 * @param {string} [props.className]
 */
export function Spinner({ size = 16, label, className, ...rest }) {
  const a11y = label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span
      className={[styles.spinner, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      {...a11y}
      {...rest}
    />
  );
}
