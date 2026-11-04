import { Fragment, forwardRef, useMemo, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Checkbox } from '../Checkbox/Checkbox';
import { Tooltip } from '../Tooltip/Tooltip';
import { ActionButton } from '../ActionButton/ActionButton';
import styles from './Listbox.module.css';

const textOf = (o) => (o.searchText != null ? o.searchText : typeof o.label === 'string' ? o.label : String(o.value));

/**
 * Listbox: the list of options every picker shows (Select's menu, the filter
 * popovers, the user picker). It owns the rows, selection marks, sections,
 * filtering and keyboard; the picker around it owns the trigger, search box,
 * header and footer.
 *
 * Options: `{ value, label, description?, leading?, icon?, disabled?,
 * section?, searchText?, tooltip?, action?: { icon, label, onClick }, style? }`.
 * A `{ type: 'header', label }` item is a section header; so is a change of
 * `section` between neighbouring options.
 *
 * Keyboard: Up / Down / Home / End move between options, Enter or Space
 * picks. At either end the arrow is left to the surrounding Popover, so focus
 * carries on to its search box or footer.
 *
 * @param {object} props
 * @param {Array}   props.options
 * @param {boolean} [props.multiple]
 * @param {*}       [props.value] – picked value, or array of values when `multiple`
 * @param {*}       [props.defaultValue]
 * @param {(value) => void} [props.onValueChange] – single: the value; multiple:
 *   the new array (picks appended in click order)
 * @param {(option) => void} [props.onSelect] – every pick, with the option
 * @param {'none'|'check'|'checkbox'|'radio'} [props.indicator] – how a pick is
 *   marked; defaults to `checkbox` when multiple, else `none` (the row tints
 *   and its label turns primary). `check` tints the row and adds a check.
 * @param {'plain'|'menu'} [props.variant='plain'] – plain: the pick-list rows of
 *   the filter popovers. menu: Select's menu rows (13px text, primary hover,
 *   the pick outlined).
 * @param {'md'|'lg'} [props.size='md'] – lg: roomier rows for an avatar and two lines
 * @param {boolean} [props.dividers] – a hairline above every section after the first
 * @param {string}  [props.query] – filters options by label / searchText / section
 * @param {React.ReactNode|((query) => React.ReactNode)} [props.emptyText='No matches']
 */
export const Listbox = forwardRef(function Listbox({
  options, multiple = false, value, defaultValue, onValueChange, onSelect,
  indicator, variant = 'plain', size = 'md', dividers = false, query = '', emptyText = 'No matches', className, ...rest
}, ref) {
  const mark = indicator ?? (multiple ? 'checkbox' : 'none');
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? (multiple ? [] : null));
  const current = value !== undefined ? value : uncontrolled;
  const picked = useMemo(
    () => new Set(multiple ? (Array.isArray(current) ? current : []) : (current == null ? [] : [current])),
    [multiple, current],
  );

  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter(o => o.type !== 'header' && (o.searchText != null ? o.searchText : `${textOf(o)} ${o.section || ''}`).toLowerCase().includes(q))
    : options;

  const pick = (o) => {
    if (o.disabled) return;
    let next = o.value;
    if (multiple) {
      const arr = Array.isArray(current) ? current : [];
      next = picked.has(o.value) ? arr.filter(v => v !== o.value) : [...arr, o.value];
    }
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
    onSelect?.(o);
  };

  const onKeyDown = (e) => {
    const rows = [...e.currentTarget.querySelectorAll('[role="option"]:not([aria-disabled="true"])')];
    const at = rows.indexOf(document.activeElement);
    if (at === -1) return;
    const step = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[e.key];
    if (step === undefined || step < 0 || step >= rows.length) return; // ends: let the Popover move on
    e.preventDefault();
    rows[step].focus();
  };

  let lastSection;
  let sections = 0;
  const sectionClass = () => [styles.section, dividers && sections++ > 0 ? styles.sectionNext : ''].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      role="listbox"
      aria-multiselectable={multiple || undefined}
      className={[styles.list, variant === 'menu' ? styles.menu : '', size === 'lg' ? styles.lg : '', className].filter(Boolean).join(' ')}
      onKeyDown={onKeyDown}
      {...rest}
    >
      {shown.length === 0 && (
        <div className={styles.empty} role="presentation">{typeof emptyText === 'function' ? emptyText(query) : emptyText}</div>
      )}
      {shown.map((o, i) => {
        if (o.type === 'header') {
          lastSection = undefined;
          return <div key={`h-${i}-${o.value ?? o.label}`} role="presentation" className={sectionClass()}>{o.label}</div>;
        }
        const header = o.section && o.section !== lastSection
          ? <div role="presentation" className={sectionClass()}>{o.section}</div>
          : null;
        lastSection = o.section;
        const on = picked.has(o.value);
        const label = o.description != null
          ? <span className={styles.text}><span className={styles.label}>{o.label}</span><span className={styles.description}>{o.description}</span></span>
          : <span className={styles.label} title={typeof o.label === 'string' ? o.label : undefined}>{o.label}</span>;
        return (
          <Fragment key={o.value}>
            {header}
            <div
              role="option"
              aria-selected={on}
              aria-disabled={o.disabled || undefined}
              tabIndex={o.disabled ? -1 : 0}
              data-value={o.value}
              className={[
                styles.row,
                mark === 'checkbox' ? styles.rowWithCheckbox : '',
                on && variant === 'menu' ? styles.rowMenuPicked : '',
                on && variant !== 'menu' && mark === 'none' ? styles.rowPicked : '',
                on && variant !== 'menu' && mark === 'check' ? styles.rowTinted : '',
                o.disabled ? styles.rowDisabled : '',
              ].filter(Boolean).join(' ')}
              style={o.style}
              onClick={() => pick(o)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                e.preventDefault();
                pick(o);
              }}
            >
              {mark === 'checkbox' && (
                <Checkbox checked={on} tabIndex={-1} aria-hidden="true" className={styles.checkbox} />
              )}
              {mark === 'radio' && (
                <span className={[styles.radio, on ? styles.radioOn : ''].filter(Boolean).join(' ')} aria-hidden="true">
                  {on && <span className={styles.dot} />}
                </span>
              )}
              {o.leading}
              {o.icon && <Icon name={o.icon} size={14} color="var(--neutral-300)" />}
              {o.tooltip ? <Tooltip label={o.tooltip} placement="right" maxWidth={240} raised className={styles.tip}>{label}</Tooltip> : label}
              {mark === 'check' && on && <Icon name="solar:check-circle-linear" size={16} color="var(--primary-300)" />}
              {o.action && (
                <ActionButton
                  size="sm"
                  icon={o.action.icon}
                  tooltip={o.action.label}
                  tooltipLeft
                  className={styles.action}
                  onClick={(e) => { e.stopPropagation(); o.action.onClick(o.value); }}
                />
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
});
