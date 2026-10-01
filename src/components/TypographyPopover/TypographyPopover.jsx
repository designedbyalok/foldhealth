import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionButton } from '../ActionButton/ActionButton';
import { Badge } from '../Badge/Badge';
import { CloseIcon } from '../Icon/CloseIcon';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { NumberStepper } from '../NumberStepper/NumberStepper';
import styles from './TypographyPopover.module.css';

/**
 * "Typography" popover (Figma Jan–Present 1119:10152): one row per piece of
 * text, each with a font, a weight and a size.
 *
 * @param {object}   props
 * @param {DOMRect}  props.anchorRect – The trigger's box; the popover opens under it, right-aligned
 * @param {Element}  [props.anchorEl] – The trigger, so pressing it again toggles rather than reopens
 * @param {{ key: string, label: string, value: { family: string, weight: string, size: number },
 *           min?: number, max?: number }[]} props.rows
 * @param {{ value: string, label: string }[]} props.families – Each name shows in its own font (once loaded)
 * @param {{ value: string, label: string }[]} props.weights
 * @param {function} props.onChange – (key, nextValue) => void
 * @param {function} props.onClose
 * @param {string}   [props.title='Typography']
 */
export function TypographyPopover({ anchorRect, anchorEl, rows, families, weights, onChange, onClose, title = 'Typography' }) {
  const popRef = useRef(null);
  const [menu, setMenu] = useState(null); // { key, field, el, rect }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !menu) onClose(); };
    const onDown = (e) => { if (!popRef.current?.contains(e.target) && !anchorEl?.contains(e.target)) onClose(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose, menu, anchorEl]);

  if (!anchorRect) return null;
  const style = {
    top: Math.min(anchorRect.bottom + 4, window.innerHeight - 160),
    right: Math.max(8, window.innerWidth - anchorRect.right),
  };
    // Pressing the open field again closes its menu.
  const pick = (row, field) => (e) => {
    const el = e.currentTarget;
    setMenu(m => (m?.key === row.key && m.field === field ? null : { key: row.key, field, el, rect: el.getBoundingClientRect() }));
  };
  // Every option sits in the same grid cell, only the current one visible,
  // so the badge is always as wide as the longest and never jumps.
  const sized = (list, v) => (
    <span className={styles.sizer}>
      {list.map(o => <span key={o.value} className={o.value === v ? undefined : styles.ghost} aria-hidden={o.value === v ? undefined : true}>{o.label}</span>)}
    </span>
  );
  const open = menu && rows.find(r => r.key === menu.key);
  const options = menu?.field === 'family' ? families : weights;

  return createPortal(
    <div ref={popRef} className={styles.popover} style={style} role="dialog" aria-label={title}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <ActionButton size="S" tooltip="Close" tooltipLeft onClick={onClose}>
          <CloseIcon size={16} color="var(--neutral-300)" />
        </ActionButton>
      </div>
      {rows.map(row => (
        <div key={row.key} className={styles.row}>
          <span className={styles.rowLabel}>{row.label}</span>
          <div className={styles.controls}>
            <button type="button" className={styles.badgeBtn} onClick={pick(row, 'family')} aria-haspopup="menu" aria-label={`${row.label} font`}>
              <Badge tone="white" size="M" label={sized(families, row.value.family)} chevron />
            </button>
            <button type="button" className={styles.badgeBtn} onClick={pick(row, 'weight')} aria-haspopup="menu" aria-label={`${row.label} weight`}>
              <Badge tone="white" size="M" label={sized(weights, row.value.weight)} chevron />
            </button>
            <NumberStepper
              value={row.value.size}
              min={row.min}
              max={row.max}
              ariaLabel="Font size"
              onChange={(size) => onChange(row.key, { ...row.value, size })}
            />
          </div>
        </div>
      ))}
      {open && (
        <MenuPopover
          anchorRect={menu.rect}
          anchorRef={{ current: menu.el }}
          align="left"
          width={160}
          ariaLabel={menu.field === 'family' ? 'Font' : 'Weight'}
          items={options.map(o => ({
            key: o.value,
            // A font name previews in that font; the family is data, not a design choice.
            label: menu.field === 'family' ? <span style={{ fontFamily: `'${o.value}', Inter, sans-serif` }}>{o.label}</span> : o.label,
            selected: open.value[menu.field] === o.value,
          }))}
          onSelect={(v) => onChange(open.key, { ...open.value, [menu.field]: v })}
          onClose={() => setMenu(null)}
        />
      )}
    </div>,
    document.body,
  );
}
