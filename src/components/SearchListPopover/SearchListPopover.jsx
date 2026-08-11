import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => (o.searchText != null ? o.searchText : o.label).toLowerCase().includes(q));
  }, [options, query]);

  if (!anchorRect) return null;

  // Always sit 4px below the trigger. Alignment: 'left' pins the popover's left
  // edge to the trigger's left; 'right' pins its right edge to the trigger's right.
  const style = { top: anchorRect.bottom + 4, width };
  if (align === 'right') {
    style.right = Math.max(8, window.innerWidth - anchorRect.right);
  } else {
    style.left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - width - 8));
  }

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div className={styles.popover} style={style} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className={styles.searchRow}>
          <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
          <input
            autoFocus
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
                className={[styles.row, o.disabled ? styles.rowDisabled : ''].filter(Boolean).join(' ')}
                onClick={() => { if (o.disabled) return; onSelect?.(o.value); onClose?.(); }}
              >
                <span className={styles.label}>{o.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
