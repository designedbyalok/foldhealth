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
 * @param {string[]} props.options
 * @param {function} props.onChange          – (value) => void
 * @param {string}   [props.variant='toc-new'] – Badge variant for the trigger
 * @param {'left'|'right'} [props.align='right'] – which edge of the menu meets the badge
 * @param {string}   [props.tone]            – Badge tone (overrides `variant`), e.g. a status colour
 * @param {'XS'|'S'|'M'|'L'} [props.size]    – Badge size
 */
export function BadgeSelect({ label, value, options, onChange, variant = 'toc-new', align = 'right', tone, size }) {
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
        aria-label={label ? `${label}: ${value}` : `Change ${value}`}
        onClick={() => setOpen(v => !v)}
      >
        <Badge variant={tone ? undefined : variant} tone={tone} size={size} label={text} trailingIcon="solar:alt-arrow-down-linear" />
      </button>
      {open && (
        <MenuPopover
          anchorRef={ref}
          align={align}
          width="auto"
          ariaLabel={label || 'Options'}
          items={options.map(o => ({ key: o, label: o, selected: o === value }))}
          onSelect={(key) => { onChange(key); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
