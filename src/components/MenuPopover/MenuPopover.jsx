import { useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import styles from './MenuPopover.module.css';

/**
 * MenuPopover — shared action-list popover. Standardises every "click a
 * trigger → see a list of actions" surface in the app (worklist row
 * actions, Upload toolbar, DOS status menu, etc.) so they all look and
 * feel identical.
 *
 * The popover is portal-rendered so it never gets clipped by a parent's
 * overflow. Anchor positioning takes one of two shapes:
 *   anchorRect — a DOMRect (or { top, bottom, left, right }) from the
 *                trigger's getBoundingClientRect(). Cheapest for portals.
 *   anchorRef  — a React ref to the trigger element; the popover reads
 *                its rect on mount. Use when the parent already has a ref.
 *
 * @param {object}   props
 * @param {DOMRect}  [props.anchorRect]
 * @param {object}   [props.anchorRef]
 * @param {Array}    props.items          – [{ key, icon, iconElement, label, trailing, danger, disabled, hint, tall }]
 *                                          `tall` lets a row grow past 32px for a two-line label
 *                                          (e.g. a person row with a meta line).
 *                                          `iconElement` renders a custom node in the icon slot,
 *                                          overriding the Solar `icon` name.
 *                                          Also accepts { section: 'Label' } for an uppercase
 *                                          group header and { divider: true } for a rule line.
 * @param {function} props.onSelect       – (key, item) => void
 * @param {function} props.onClose
 * @param {string}   [props.ariaLabel='Menu']
 * @param {number|'auto'} [props.width=200] – Pixel width of the menu; 'auto' fits the longest label
 * @param {boolean} [props.searchable=false] – Sticky search box at the top for long
 *                                          lists. Filters items by label / hint; a
 *                                          section whose title matches keeps all its items.
 * @param {string}   [props.searchPlaceholder='Search…']
 * @param {'left'|'right'} [props.align='right']
 *                                          'right' = right edge of menu aligns with right edge of anchor;
 *                                          'left'  = left edge aligns with left edge of anchor.
 */
// Keep items whose label / hint matches; a section header survives when
// any of its items do (or when the header itself matches — then the whole
// section shows). Dividers drop out while filtering.
function filterItems(items, q) {
  const out = [];
  let section = null;
  let sectionMatch = false;
  let pending = [];
  const flush = () => {
    if (pending.length) out.push(...(section ? [section] : []), ...pending);
    pending = [];
  };
  for (const it of items) {
    if (it.section) { flush(); section = it; sectionMatch = it.section.toLowerCase().includes(q); continue; }
    if (it.divider) continue;
    if (sectionMatch || `${it.label || ''} ${it.hint || ''}`.toLowerCase().includes(q)) pending.push(it);
  }
  flush();
  return out;
}

export function MenuPopover({
  anchorRect,
  anchorRef,
  items = [],
  onSelect,
  onClose,
  ariaLabel = 'Menu',
  width = 200,
  align = 'right',
  searchable = false,
  searchPlaceholder = 'Search…',
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shownItems = searchable && q ? filterItems(items, q) : items;

  const anchor = anchorRect || anchorRef;
  if (!anchor) return null;

  return (
    <Popover
      anchor={anchor}
      onOpenChange={() => onClose?.()}
      placement={align === 'left' ? 'bottom-start' : 'bottom-end'}
      width={width === 'auto' ? undefined : width}
      role="menu"
      aria-label={ariaLabel}
      className={styles.menu}
      listNavigation
    >
      {searchable && (
        <div className={styles.searchRow}>
          <Icon name="solar:magnifer-linear" size={13} color="var(--neutral-300)" />
          <input
            autoFocus
            type="text"
            className={styles.searchInput}
            placeholder={searchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label={searchPlaceholder}
          />
        </div>
      )}
      {searchable && q && !shownItems.some(it => it.key || it.label) && (
        <div className={styles.empty}>No matches</div>
      )}
      {shownItems.map((item, idx) => {
        if (item.section) {
          return <div key={`section-${item.section}`} className={styles.section}>{item.section}</div>;
        }
        if (item.divider) {
          return <div key={`divider-${idx}`} className={styles.divider} />;
        }
        return (
        <button
          key={item.key || item.label}
          type="button"
          role="menuitem"
          disabled={!!item.disabled}
          title={item.hint}
          className={[
            styles.row,
            item.danger ? styles.danger : '',
            item.disabled ? styles.disabled : '',
            item.selected ? styles.rowSelected : '',
            item.tall ? styles.rowTall : '',
          ].filter(Boolean).join(' ')}
          onClick={() => {
            if (item.disabled) return;
            onSelect?.(item.key || item.label, item);
            onClose?.();
          }}
        >
          {item.iconElement}
          {!item.iconElement && item.icon && (
            <Icon name={item.icon} size={16} color={item.danger ? 'var(--status-error)' : 'var(--neutral-400)'} />
          )}
          <span className={styles.label}>{item.label}</span>
          {item.trailing && (
            <DownChevronIcon size={12} color="var(--neutral-300)" className={styles.submenuChevron} />
          )}
        </button>
        );
      })}
    </Popover>
  );
}
