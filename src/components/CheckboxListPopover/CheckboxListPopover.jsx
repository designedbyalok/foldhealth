import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Checkbox } from '../ShadcnCheckbox/ShadcnCheckbox';
import styles from './CheckboxListPopover.module.css';

const EMPTY_SELECTED = [];

/**
 * Fold Health CheckboxListPopover — anchored, portaled multi-select.
 *
 * Use as the popover behind a filter chip: pass an array of options, the
 * currently selected values, and an onChange to receive the new array.
 *
 * Props:
 *  - anchorRect (DOMRect-like)   Anchor's bounding rect (caller's responsibility
 *                                 to compute via `e.currentTarget.getBoundingClientRect()`).
 *  - label      (string)         Header label shown at the top of the popover.
 *  - options    (string[])       Available choices.
 *  - selected   (string[])       Currently selected values.
 *  - onChange   (fn(string[]))   New value array (already in option order).
 *  - onClose    (fn)             Called on overlay click or Escape.
 *  - width      (number)         Defaults to 240px.
 *  - showClear  (boolean)        Show the "Select All / Clear All" controls row
 *                                 (default true). Matches Figma 4240-110454.
 *  - searchable (boolean)        Show a search box above the list (default false).
 */
export function CheckboxListPopover({
  anchorRect,
  label,
  options,
  selected = EMPTY_SELECTED,
  onChange,
  onClose,
  width = 240,
  showClear = true,
  searchable = false,
}) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pos = useMemo(() => positionPopover(anchorRect, width), [anchorRect, width]);
  const sel = useMemo(() => new Set(selected), [selected]);
  const [query, setQuery] = useState('');

  const toggle = (v) => {
    const next = sel.has(v) ? selected.filter(x => x !== v) : [...selected, v];
    const nextSet = new Set(next);
    // Keep the option-order stable
    onChange?.(options.filter(o => nextSet.has(o)));
  };

  // With an active search query, the Select All / Clear All controls and the
  // header checkbox state operate on the *visible* (filtered) rows — not the
  // whole list — so they never touch options the user can't see.
  const visible = searchable && query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const allSelected = visible.length > 0 && visible.every(o => sel.has(o));
  const someSelected = visible.some(o => sel.has(o)) && !allSelected;
  const selectVisible = () => {
    const next = new Set([...selected, ...visible]);
    onChange?.(options.filter(o => next.has(o)));
  };
  const clearVisible = () => {
    const visibleSet = new Set(visible);
    onChange?.(selected.filter(x => !visibleSet.has(x)));
  };
  const toggleAll = () => (allSelected ? clearVisible() : selectVisible());

  if (!anchorRect) return null;

  return createPortal(
    <>
      {/* Decorative click-catcher: the keyboard path to dismiss is the Escape
          handler above, so this must not become a full-viewport tab stop. */}
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.popover}
        style={{ top: pos.top, left: pos.left, width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={label}
      >
        {label && <div className={styles.header}>{label}</div>}

        {showClear && (
          <div className={styles.controls}>
            <div
              role="checkbox"
              aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
              tabIndex={0}
              className={styles.selectAll}
              onClick={toggleAll}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAll(); } }}
            >
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none"
              />
              <span className={styles.label}>Select All</span>
            </div>
            <button
              type="button"
              className={styles.clearLink}
              onClick={clearVisible}
            >
              Clear All
            </button>
          </div>
        )}

        {searchable && (
          <input
            className={styles.search}
            type="text"
            placeholder="Search"
            aria-label={label ? `Search ${label}` : 'Search options'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        )}

        <div className={styles.list}>
          {visible.map((opt) => {
            const checked = sel.has(opt);
            return (
              <div
                key={opt}
                role="checkbox"
                aria-checked={checked}
                tabIndex={0}
                className={styles.row}
                onClick={() => toggle(opt)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(opt); } }}
              >
                <Checkbox checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none" />
                <span className={styles.label}>{opt}</span>
              </div>
            );
          })}
          {visible.length === 0 && <div className={styles.empty}>No matches</div>}
        </div>
      </div>
    </>,
    document.body,
  );
}

// Compute a fixed-position location below the anchor, clamped to the viewport.
function positionPopover(rect, width) {
  if (!rect) return { top: 0, left: 0 };
  const margin = 8;
  const top = Math.min(rect.bottom + 6, window.innerHeight - 320);
  const left = Math.min(rect.left, window.innerWidth - width - margin);
  return { top, left: Math.max(margin, left) };
}
