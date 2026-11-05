import styles from './RadioButton.module.css';

/**
 * Fold Health RadioButton: single source-of-truth radio control.
 *
 * Matches the design spec for the Outreach Log radio selectors.
 *
 * Radio circle: 20×20px, border-radius 50%, 1.5px border
 * Inner dot:    8×8px, border-radius 50%
 * OFF: border var(--neutral-300), bg white
 * ON:  bg var(--primary-300), border var(--primary-300), dot white
 * Disabled: opacity 0.5, not-allowed cursor
 *
 * @param {object}   props
 * @param {boolean}  props.checked     – Current selected state
 * @param {function} props.onChange    – Called on click
 * @param {string}   [props.label]    – Optional visible label text
 * @param {string}   [props.ariaLabel] – Screen-reader-only label. Use when
 *                                       the visible label would be too
 *                                       verbose (e.g. score matrices that
 *                                       already show the question / column
 *                                       header). Falls back to `label`.
 * @param {boolean}  [props.disabled] – Disable interaction
 * @param {string}   [props.className] – Extra class on the wrapper
 * @param {string}   [props.name]     – HTML name attribute for form grouping
 * @param {string}   [props.value]    – HTML value attribute
 */
export function RadioButton({ checked, onChange, label, ariaLabel, disabled = false, className, name, value }) {
  const wrapClass = [
    styles.radioOption,
    disabled ? styles.radioOptionDisabled : '',
    className || '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      disabled={disabled}
      className={wrapClass}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange?.();
      }}
    >
      <span className={`${styles.radioCircle} ${checked ? styles.radioCircleChecked : ''}`} />
      {label && (
        <span className={`${styles.radioLabel} ${checked ? styles.radioLabelChecked : ''}`}>
          {label}
        </span>
      )}
    </button>
  );
}
