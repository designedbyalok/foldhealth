import { useRef, useState } from 'react';
import { Badge } from '../Badge/Badge';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import styles from './BadgeSelect.module.css';

/**
 * BadgeSelect: a badge-styled single-choice dropdown for a section header,
 * e.g. "View By: Active ⌄", a synopsis template, or a year. Shows the current
 * value on the badge; the menu highlights it.
 *
 * @param {object}   props
 * @param {string}   [props.label]           – prefix on the badge ("View By"); omit to show the value alone
 * @param {string}   props.value
 * @param {(string|{ value: string, label?: string, disabled?: boolean, tooltip?: string })[]} props.options
 *                                           – an option can be disabled, with a tooltip saying why
 * @param {function} props.onChange          – (value) => void
 * @param {'left'|'right'} [props.align='right'] – which edge of the menu meets the badge
 * @param {string}   [props.tone='neutral']  – Badge tone, e.g. a status colour
 * @param {'xs'|'sm'|'md'|'lg'} [props.size] – Badge size
 * @param {boolean}  [props.disabled]        – greys the badge out (chevron kept); it doesn't open
 */
export function BadgeSelect({ label, value, options, onChange, align = 'right', tone = 'neutral', size, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const text = label ? `${label}: ${value}` : value;

  return (
    <>
      <button
        type="button"
        ref={ref}
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        aria-label={label ? `${label}: ${value}` : `Change ${value}`}
        onClick={() => setOpen(v => !v)}
      >
        <Badge tone={tone} disabled={disabled} size={size} label={text} trailingIcon="solar:alt-arrow-down-linear" />
      </button>
      {open && !disabled && (
        <MenuPopover
          anchorRef={ref}
          align={align}
          width="auto"
          ariaLabel={label || 'Options'}
          items={options.map((o) => {
            const opt = typeof o === 'string' ? { value: o } : o;
            return { key: opt.value, label: opt.label || opt.value, selected: opt.value === value, disabled: opt.disabled, tooltip: opt.tooltip };
          })}
          onSelect={(key) => { onChange(key); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
