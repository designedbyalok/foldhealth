import { useState } from 'react';
import { Popover } from '../Popover/Popover';
import styles from './RadioListPopover.module.css';

/**
 * Fold Health RadioListPopover: anchored, portaled single-select.
 *
 * Mirrors CheckboxListPopover but with radio semantics: at most one value
 * selected at a time. Reset clears the selection. Used by filter chips whose
 * underlying `FILTER_DEFS` type is `radio` (e.g. Open ICDs gap buckets).
 *
 * Props:
 *  - anchorRect (DOMRect-like)   Anchor's bounding rect.
 *  - label      (string)         Header label.
 *  - options    (string[])       Available choices.
 *  - selected   (string[])       Currently selected values (0 or 1 element).
 *  - onChange   (fn(string[]))   Caller receives a 0- or 1-element array.
 *  - onClose    (fn)             Called on overlay click or Escape.
 *  - width      (number)         Defaults to 240px.
 *  - showClear  (boolean)        Show a "Reset Selection" footer (default true).
 *  - disabledOptions (string[])  Choices shown greyed out that can't be picked.
 *  - searchable (boolean)        Show a search box above the list (default false).
 */
export function RadioListPopover({
  anchorRect,
  label,
  options,
  selected = [],
  onChange,
  onClose,
  width = 240,
  showClear = true,
  disabledOptions,
  searchable = false,
}) {
  const current = selected[0] ?? null;
  const disabledSet = new Set(disabledOptions);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = searchable && q ? options.filter(o => String(o).toLowerCase().includes(q)) : options;

  if (!anchorRect) return null;

  return (
    <Popover
      anchor={anchorRect}
      onOpenChange={() => onClose?.()}
      offset={6}
      listNavigation
      width={width}
      maxHeight={320}
      role="group"
      aria-label={label}
      className={styles.popover}
    >
      {label && <div className={styles.header}>{label}</div>}
      {searchable && (
        <input
          className={styles.search}
          type="text"
          placeholder="Search"
          aria-label={label ? `Search ${label}` : 'Search options'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className={styles.list}>
        {visible.length === 0 && <div className={styles.empty}>No matches</div>}
        {visible.map((opt) => {
          const active = current === opt;
          const disabled = disabledSet.has(opt);
          return (
            <button
              key={opt}
              type="button"
              className={[styles.row, disabled ? styles.rowDisabled : ''].join(' ')}
              disabled={disabled}
              onClick={() => onChange?.([opt])}
            >
              <span className={[styles.radio, active ? styles.radioActive : ''].join(' ')}>
                {active && <span className={styles.dot} />}
              </span>
              <span className={styles.label}>{opt}</span>
            </button>
          );
        })}
      </div>
      {showClear && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange?.([])}
        >
          Reset Selection
        </button>
      )}
    </Popover>
  );
}
