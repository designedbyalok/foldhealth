import { useId, useRef, useState } from 'react';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import inputStyles from '../Input/Input.module.css';
import styles from './NumberUnitInput.module.css';

/**
 * NumberUnitInput — a count and its unit in one field: "[3 | Days ⌄]".
 * The number is typed; the unit opens a small menu. For things like
 * "Repeats every 3 days" or "Remind 2 hours before".
 *
 * @param {object}   props
 * @param {number|string} props.value   – The count ('' while being cleared)
 * @param {function} props.onChange     – (count: number | '') => void
 * @param {string}   props.unit         – Selected unit value
 * @param {{ value: string, label: string }[]} props.units
 * @param {function} props.onUnitChange – (unit) => void
 * @param {string}   [props.label]      – Field label above
 * @param {number}   [props.min=1]
 * @param {string}   [props.errorText]  – Red border and message below
 * @param {string}   [props.className]  – Extra class on the outer field
 */
export function NumberUnitInput({ value, onChange, unit, units = [], onUnitChange, label, min = 1, errorText, className }) {
  const id = useId();
  const unitRef = useRef(null);
  const shellRef = useRef(null);
  // The menu opens under the field with its options' text starting right
  // under the unit's first letter (the menu's own padding is 16px), and runs
  // to the field's right edge.
  const [menuRect, setMenuRect] = useState(null);
  const MENU_INSET = 16;
  const openMenu = () => {
    const shell = shellRef.current?.getBoundingClientRect();
    const unitText = unitRef.current?.getBoundingClientRect();
    if (shell && unitText) {
      const left = unitText.left - MENU_INSET;
      setMenuRect({ top: shell.top, bottom: shell.bottom, left, right: shell.right, width: shell.right - left });
    }
    setOpen(v => !v);
  };
  const [open, setOpen] = useState(false);
  const current = units.find(u => u.value === unit);

  return (
    <div className={[inputStyles.field, className || ''].filter(Boolean).join(' ')}>
      {label && (
        <label className={inputStyles.label} htmlFor={id}>
          <span className={inputStyles.labelText}>{label}</span>
        </label>
      )}
      <div ref={shellRef} className={[inputStyles.shell, styles.shell, errorText ? inputStyles.shellError : ''].filter(Boolean).join(' ')}>
        <input
          id={id}
          type="number"
          min={min}
          inputMode="numeric"
          className={`${inputStyles.inputBorderless} ${styles.count}`}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value === '' ? '' : Number(e.target.value))}
          aria-invalid={errorText ? true : undefined}
        />
        <span className={styles.divider} aria-hidden="true" />
        <button
          ref={unitRef}
          type="button"
          className={styles.unit}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label ? `${label} unit` : 'Unit'}
          onClick={openMenu}
        >
          <span className={styles.unitText}>{current?.label || ''}</span>
          <DownChevronIcon size={14} color="var(--neutral-300)" />
        </button>
      </div>
      {open && (
        <MenuPopover
          anchorRect={menuRect}
          align="left"
          width={menuRect?.width || 160}
          ariaLabel="Units"
          items={units.map(u => ({ key: u.value, label: u.label }))}
          onSelect={(key) => { setOpen(false); onUnitChange?.(key); }}
          onClose={() => setOpen(false)}
        />
      )}
      {errorText && <span className={inputStyles.errorText}>{errorText}</span>}
    </div>
  );
}
