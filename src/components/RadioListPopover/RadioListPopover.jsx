import { useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Listbox } from '../Listbox/Listbox';
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
      <Listbox
        aria-label={label}
        indicator="radio"
        options={options.map(o => ({ value: o, label: o, disabled: disabledSet.has(o) }))}
        value={current}
        onValueChange={(v) => onChange?.([v])}
        query={searchable ? query : ''}
      />
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
