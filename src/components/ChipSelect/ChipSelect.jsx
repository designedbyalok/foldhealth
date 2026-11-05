import { Icon } from '../Icon/Icon';
import styles from './ChipSelect.module.css';

/**
 * ChipSelect: a wrapping group of selectable pills for picking from a short
 * fixed list inline (no popover), e.g. barriers / interventions on a form.
 *
 * Props:
 *  - options   string[]
 *  - value     string[] (multi) | string | null (single)
 *  - onChange  (next) => void: string[] in multi mode, string | null in single
 *  - single    boolean: one pick at a time; clicking the picked chip clears it
 *  - tone      'primary' | 'error' | 'success', selected color
 *  - ariaLabel string: names the group for assistive tech
 */
export function ChipSelect({ options, value, onChange, single = false, tone = 'primary', ariaLabel }) {
  const picked = single ? (value ? [value] : []) : (value || []);
  const toggle = (opt) => {
    const on = picked.includes(opt);
    if (single) onChange(on ? null : opt);
    else onChange(on ? picked.filter(v => v !== opt) : [...picked, opt]);
  };
  return (
    <div className={styles.group} role="group" aria-label={ariaLabel}>
      {options.map(opt => {
        const on = picked.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            className={`${styles.chip} ${on ? `${styles.on} ${styles[tone]}` : ''}`}
            aria-pressed={on}
            onClick={() => toggle(opt)}
          >
            {on && <Icon name="solar:check-read-linear" size={12} color="currentColor" />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
