import styles from './Switch.module.css';

/**
 * Fold Health Switch: single source-of-truth toggle control.
 *
 * Matches Figma Fold-Pixel-1.0 node 1518:142478 exactly.
 *
 * Size S (Web): default:
 *   Track: 32×19px, 4px radius, 1.5px padding
 *   Knob:  16×16px, 3px radius, white
 *   OFF:   var(--neutral-100)   ON: var(--primary-300)
 *   Disabled OFF: var(--neutral-50)  Disabled ON: var(--primary-100)
 *
 * @param {object}   props
 * @param {boolean}  props.checked    – Current on/off state
 * @param {function} props.onChange    – Called with the new value on click
 * @param {boolean}  [props.disabled] – Disable interaction
 * @param {string}   [props.label]    – Optional visible label text (displayed to the right)
 * @param {string}   [props.ariaLabel] – Screen-reader label (if no visible label)
 * @param {string}   [props.className] – Extra class on the wrapper
 * @param {string|number} [props.labelGap=8] – Space between track and label
 */
export function Switch({ checked, onChange, disabled = false, label, ariaLabel, className, labelGap = 8 }) {
  const trackClass = [
    styles.track,
    checked ? styles.trackOn : '',
    disabled ? styles.trackDisabled : '',
    className || '',
  ].filter(Boolean).join(' ');

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: labelGap }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label}
        className={trackClass}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange?.(!checked);
        }}
      >
        <span className={styles.knob} />
      </button>
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}
