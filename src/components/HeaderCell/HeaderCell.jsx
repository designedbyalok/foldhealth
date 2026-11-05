import { useRef } from 'react';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './HeaderCell.module.css';

// Per-column-type sort language (Notion convention). `sortType` picks the
// direction phrase used in the hover tooltip; defaults to `alpha`.
const SORT_LABELS = {
  alpha:    { asc: 'A to Z',             desc: 'Z to A' },
  date:     { asc: 'oldest to newest',   desc: 'newest to oldest' },
  number:   { asc: 'lowest to highest',  desc: 'highest to lowest' },
  priority: { asc: 'lowest to highest',  desc: 'highest to lowest' },
  generic:  { asc: 'in ascending order', desc: 'in descending order' },
};

/**
 * HeaderCell: the design system's column header cell for every worklist
 * / data-table in the app. Replaces the older `SortableHeader` primitive.
 *
 * Behaviour:
 *  - Idle sortable columns show a double-chevron affordance.
 *  - The column that owns the current sort morphs one chevron into a
 *    full arrow via a single SVG with three fade-in/out parts.
 *  - Hovering the icon paints a grey-50 chip and reveals a light tooltip
 *    (same treatment as ActionButton) whose copy is column-type-aware:
 *        alpha → "Sort A to Z" / "Sorted Z to A"
 *        date → "Sort oldest to newest" / "Sorted newest to oldest"
 *        number|priority → "Sort lowest to highest" / "Sorted highest to lowest"
 *        generic → "Sort in ascending order" / "Sorted in descending order"
 *  - Passing an `align` prop switches text alignment (left / right / center).
 *
 * @param {object}   props
 * @param {string}   props.label       Column display name.
 * @param {string}   [props.sortField] Field this column sorts by. Omit
 *                                     for a non-sortable header.
 * @param {'alpha'|'date'|'number'|'priority'|'generic'} [props.sortType='alpha']
 * @param {string}   [props.activeKey] Currently-active sort field.
 * @param {'asc'|'desc'|null} [props.activeDir] Currently-active sort direction.
 * @param {(field:string, rect:DOMRect) => void} [props.onSort]
 *                   Called when a sortable header is clicked. Receives the
 *                   sort field and the trigger `<th>`'s bounding rect so
 *                   callers can either toggle direction or anchor a popover.
 * @param {'left'|'right'|'center'} [props.align='left']
 * @param {boolean}  [props.hideSortIcon] When true, the header stays
 *                                     sortable but omits the chevron icon
 *                                     (for ultra-narrow columns like "P").
 * @param {string}   [props.className]
 * @param {object}   [props.style]
 */
export function HeaderCell({
  label,
  sortField,
  sortType = 'alpha',
  activeKey,
  activeDir,
  onSort,
  align = 'left',
  hideSortIcon = false,
  className,
  style,
}) {
  const ref = useRef(null);
  const isSortable = !!sortField && !!onSort;
  const isActive = isSortable && activeKey === sortField;

  const handleClick = () => {
    if (!isSortable) return;
    onSort(sortField, ref.current?.getBoundingClientRect());
  };

  const handleKeyDown = (e) => {
    if (!isSortable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSort(sortField, ref.current?.getBoundingClientRect());
    }
  };

  const cls = [
    styles.headerCell,
    isSortable ? styles.headerCellSortable : '',
    isActive ? styles.headerCellActive : '',
    className || '',
  ].filter(Boolean).join(' ');

  const labels = SORT_LABELS[sortType] || SORT_LABELS.alpha;
  const tooltip = isActive
    ? `${label} • Sorted ${activeDir === 'desc' ? labels.desc : labels.asc}`
    : `${label} • Sort ${labels.asc}`;

  // Three-part morphing icon, top chevron, bottom chevron, tail, each
  // fades independently so idle ↔ asc ↔ desc reads as one motion.
  const hideTop    = isActive && activeDir === 'desc';
  const hideBottom = isActive && activeDir === 'asc';
  const showTail   = isActive;

  return (
    <th
      ref={ref}
      className={cls}
      style={{ textAlign: align, ...style }}
      onClick={isSortable ? handleClick : undefined}
      onKeyDown={isSortable ? handleKeyDown : undefined}
      role={isSortable ? 'button' : undefined}
      tabIndex={isSortable ? 0 : undefined}
      aria-sort={isActive ? (activeDir === 'desc' ? 'descending' : 'ascending') : undefined}
      aria-label={isSortable && hideSortIcon ? tooltip : undefined}
      data-sort-field={sortField}
    >
      <span className={[styles.headerLabel, hideSortIcon ? styles.headerLabelNoIcon : ''].filter(Boolean).join(' ')}>
        <span className={styles.headerLabelText}>{label}</span>
        {isSortable && !hideSortIcon && (
          <Tooltip
            label={tooltip}
            placement="top"
            variant="light"
            className={[styles.sortIcon, isActive ? styles.sortIconActive : ''].filter(Boolean).join(' ')}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className={styles.sortIconSvg}
            >
              <path
                d="M12.67 6.67L8 2.67L3.33 6.67"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={[styles.sortIconPart, hideTop ? styles.sortIconPartHidden : ''].filter(Boolean).join(' ')}
              />
              <path
                d="M12.67 9.33L8 13.33L3.33 9.33"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={[styles.sortIconPart, hideBottom ? styles.sortIconPartHidden : ''].filter(Boolean).join(' ')}
              />
              <path
                d="M8 2.67L8 13.33"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={[styles.sortIconPart, showTail ? '' : styles.sortIconPartHidden].filter(Boolean).join(' ')}
              />
            </svg>
          </Tooltip>
        )}
      </span>
    </th>
  );
}
