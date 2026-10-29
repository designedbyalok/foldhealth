import { useMemo, useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Icon } from '../Icon/Icon';
import styles from './SearchListPopover.module.css';

const EMPTY_OPTIONS = [];

/**
 * SearchListPopover — an anchored, portaled search + single-select list. Same
 * chrome as the app's other filter popovers (bordered search field on top, a
 * scrollable list of rows) but rows are plain selectable items — no checkboxes.
 *
 * @param {object}   props
 * @param {DOMRect}  props.anchorRect
 * @param {Array}    props.options       – [{ value, label, disabled?, searchText? }]
 * @param {function} props.onSelect      – (value) => void
 * @param {function} props.onClose
 * @param {string}   [props.searchPlaceholder]
 * @param {string}   [props.emptyText]
 * @param {number}   [props.width=260]
 * @param {'left'|'right'} [props.align='left']
 * @param {string}   [props.selected]    – Value to mark as the current pick
 */
export function SearchListPopover({
  anchorRect,
  options = EMPTY_OPTIONS,
  onSelect,
  onClose,
  searchPlaceholder = 'Search…',
  emptyText = 'No results',
  width = 260,
  align = 'left',
  selected,
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => (o.searchText != null ? o.searchText : o.label).toLowerCase().includes(q));
  }, [options, query]);

  if (!anchorRect) return null;

  return (
    <Popover
      anchor={anchorRect}
      onOpenChange={() => onClose?.()}
      placement={align === 'right' ? 'bottom-end' : 'bottom-start'}
      width={width}
      maxHeight={250}
      listNavigation
      role="group"
      aria-label="Search"
      className={styles.popover}
    >
      <div className={styles.searchRow}>
        <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
        <input
          type="text"
          className={styles.searchInput}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>{emptyText}</div>
        ) : (
          filtered.map(o => (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              aria-current={o.value === selected ? 'true' : undefined}
              className={[styles.row, o.disabled ? styles.rowDisabled : '', o.value === selected ? styles.rowSelected : ''].filter(Boolean).join(' ')}
              onClick={() => { if (o.disabled) return; onSelect?.(o.value); onClose?.(); }}
            >
              <span className={styles.label}>{o.label}</span>
            </button>
          ))
        )}
      </div>
    </Popover>
  );
}
