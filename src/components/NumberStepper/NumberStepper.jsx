import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './NumberStepper.module.css';

/**
 * A small "− 14 +" control for nudging a number by `step`, kept between
 * `min` and `max` (each end's button disables there). The number can also be
 * typed: Enter or leaving the field applies it (kept within range), Esc undoes.
 *
 * @param {object}   props
 * @param {number}   props.value
 * @param {function} props.onChange  – (next) => void
 * @param {number}   [props.min=-Infinity]
 * @param {number}   [props.max=Infinity]
 * @param {number}   [props.step=1]
 * @param {string}   [props.ariaLabel='Value'] – Names the value for the buttons ("Decrease font size")
 */
export function NumberStepper({ value, onChange, min = -Infinity, max = Infinity, step = 1, ariaLabel = 'Value' }) {
  const set = (n) => onChange(Math.min(max, Math.max(min, n)));
  const [draft, setDraft] = useState(null); // the typed text while editing
  const commit = () => {
    const n = Number(draft);
    if (draft !== null && draft.trim() !== '' && Number.isFinite(n)) set(Math.round(n));
    setDraft(null);
  };
  return (
    <span className={styles.stepper} role="group" aria-label={ariaLabel}>
      <button type="button" className={styles.btn} disabled={value <= min} onClick={() => set(value - step)} aria-label={`Decrease ${ariaLabel.toLowerCase()}`}>
        <Icon name="solar:minus-linear" size={12} />
      </button>
      <input
        className={styles.value}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={draft ?? String(value)}
        size={Math.max(2, String(draft ?? value).length)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') { e.stopPropagation(); setDraft(null); e.currentTarget.blur(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); set(value + step); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); set(value - step); }
        }}
      />
      <button type="button" className={styles.btn} disabled={value >= max} onClick={() => set(value + step)} aria-label={`Increase ${ariaLabel.toLowerCase()}`}>
        <Icon name="solar:add-linear" size={12} />
      </button>
    </span>
  );
}
