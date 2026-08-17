import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { MORE_FILTER_ITEMS } from './filters';
import styles from './MoreFiltersPopover.module.css';

/**
 * Controls which filter chips are visible in the FilterChipBar. Mirrors the
 * prototype's MoreFiltersPopup — a searchable two-section list of all available
 * filters (Primary / Extended) with checkbox toggles.
 *
 * Props:
 *  - anchorRect (DOMRect)         Rect of the "More Filters" trigger button.
 *  - visibleKeys (string[])       Currently visible chip keys.
 *  - onToggle   (fn(k: string))   Toggle a key in/out of the visible set.
 *  - onClear    (fn)              Hide all chips.
 *  - onClose    (fn)              Dismiss the popover.
 */
export function MoreFiltersPopover({ anchorRect, visibleKeys, onToggle, onClear, onClose }) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const visibleSet = useMemo(() => new Set(visibleKeys), [visibleKeys]);
  const { primary, extended } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (x) => !q || x.label.toLowerCase().includes(q);
    return {
      primary: MORE_FILTER_ITEMS.filter(x => x.primary && match(x)),
      extended: MORE_FILTER_ITEMS.filter(x => !x.primary && match(x)),
    };
  }, [search]);

  if (!anchorRect) return null;

  const W = 280;
  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 440);
  const right = Math.max(8, window.innerWidth - anchorRect.right);

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div
        className={styles.popover}
        style={{ top, right, width: W }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="More filters"
      >
        {/* Search */}
        <div className={styles.searchRow}>
          <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
          <input aria-label="Search filters"
            type="text"
            value={search}
            placeholder="Search more filter"
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* List */}
        <div className={styles.list}>
          {primary.map((it) => (
            <Row key={it.k} item={it} checked={visibleSet.has(it.k)} onToggle={onToggle} />
          ))}
          {primary.length > 0 && extended.length > 0 && <div className={styles.divider} />}
          {extended.map((it) => (
            <Row key={it.k} item={it} checked={visibleSet.has(it.k)} onToggle={onToggle} />
          ))}
          {primary.length === 0 && extended.length === 0 && (
            <div className={styles.empty}>No filters found</div>
          )}
        </div>

        {/* Footer */}
        <button type="button" className={styles.clear} onClick={onClear}>
          Clear Selection
        </button>
      </div>
    </>,
    document.body,
  );
}

function Row({ item, checked, onToggle }) {
  return (
    <button
      type="button"
      className={styles.row}
      onClick={() => onToggle?.(item.k)}
    >
      <span className={[styles.box, checked ? styles.boxChecked : ''].join(' ')}>
        {checked && <Icon name="solar:check-read-linear" size={10} color="var(--neutral-0)" />}
      </span>
      <span className={styles.label}>{item.label}</span>
    </button>
  );
}
