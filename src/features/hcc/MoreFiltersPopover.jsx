import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { MORE_FILTER_ITEMS as HCC_MORE_FILTER_ITEMS } from './filters';
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
 *  - moreFilterItems ([{k, label, primary}])  Filter roster for the popover.
 *                                 Defaults to HCC's list so existing callers
 *                                 don't change; other worklists (e.g. HEDIS)
 *                                 pass their own.
 */
export function MoreFiltersPopover({ anchorRect, visibleKeys, onToggle, onClear, onClose, moreFilterItems = HCC_MORE_FILTER_ITEMS }) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Live set — used to render each row's checkbox state so toggling is
  // immediate.
  const visibleSet = useMemo(() => new Set(visibleKeys), [visibleKeys]);
  // Ordering snapshot — captured once when the popover opens (this component
  // is mounted on demand by FilterChipBar and unmounts on close, so
  // useState's lazy init runs exactly once per open). If a user unchecks a
  // row we DON'T want it to leap out from under the cursor — the change is
  // only reflected in position on the NEXT open.
  const [initialVisible] = useState(() => new Set(visibleKeys));
  // Layout: [all checked, in MORE_FILTER_ITEMS order] then [primary unchecked]
  // above the divider; only extended-unchecked below. This keeps all applied
  // filters grouped as one contiguous block regardless of primary/extended
  // designation.
  const { primary, extended } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (x) => !q || x.label.toLowerCase().includes(q);
    const inPrimary   = moreFilterItems.filter(x =>  x.primary && match(x));
    const inExtended  = moreFilterItems.filter(x => !x.primary && match(x));
    const wasChecked  = (x) => initialVisible.has(x.k);
    const checkedAll  = [...inPrimary.filter(wasChecked),  ...inExtended.filter(wasChecked)];
    const primaryOff  = inPrimary.filter(x => !wasChecked(x));
    const extendedOff = inExtended.filter(x => !wasChecked(x));
    return { primary: [...checkedAll, ...primaryOff], extended: extendedOff };
  }, [search, initialVisible, moreFilterItems]);

  if (!anchorRect) return null;

  const W = 280;
  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 440);
  const right = Math.max(8, window.innerWidth - anchorRect.right);

  return createPortal(
    <>
      <div aria-hidden="true" className={styles.overlay} onClick={onClose} />
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
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      className={styles.row}
      onClick={() => onToggle?.(item.k)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(item.k); } }}
    >
      <Checkbox checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none" />
      <span className={styles.label}>{item.label}</span>
    </div>
  );
}
