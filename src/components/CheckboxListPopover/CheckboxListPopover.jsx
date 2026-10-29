import { Fragment, useMemo, useState } from 'react';
import { Popover } from '../Popover/Popover';
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
 *  - renderOptionLeading (fn(option) => node)  Optional node before each
 *                                 option's label (e.g. a person's avatar).
 *  - labelOf    (fn(option) => string)  Text shown for an option (default: itself).
 *  - sectionOf  (fn(option) => string)  Groups options under an uppercase header;
 *                                 options of one section must be adjacent.
 *  - searchPlaceholder (string)  Search box placeholder (default "Search").
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
  renderOptionLeading,
  labelOf = (o) => o,
  sectionOf,
  searchPlaceholder = 'Search',
}) {
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
  const q = query.trim().toLowerCase();
  const visible = searchable && q
    ? options.filter(o => `${labelOf(o)} ${sectionOf?.(o) || ''}`.toLowerCase().includes(q))
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
          placeholder={searchPlaceholder}
          aria-label={label ? `Search ${label}` : 'Search options'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      <div className={styles.list}>
        {visible.map((opt, i) => {
          const checked = sel.has(opt);
          const section = sectionOf?.(opt);
          return (
            <Fragment key={opt}>
            {section && section !== sectionOf(visible[i - 1] ?? null) && <div className={styles.section}>{section}</div>}
            <div
              role="checkbox"
              aria-checked={checked}
              tabIndex={0}
              className={styles.row}
              onClick={() => toggle(opt)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(opt); } }}
            >
              <Checkbox checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none" />
              {renderOptionLeading?.(opt)}
              <span className={styles.label} title={labelOf(opt)}>{labelOf(opt)}</span>
            </div>
            </Fragment>
          );
        })}
        {visible.length === 0 && <div className={styles.empty}>No matches</div>}
      </div>
    </Popover>
  );
}
