import { useRef, useState } from 'react';
import { ColumnConfigPopover } from '../ColumnConfigPopover/ColumnConfigPopover';
import { toPopoverColumns } from './useColumnLayout';
import styles from './ColumnsHeaderButton.module.css';

/**
 * "Show / hide columns" trigger + popover used by every worklist's Actions
 * header. Renders the same 6-dot list icon HCC uses so all worklists share
 * one affordance. `columns`, `hiddenSet`, and the on* callbacks come from
 * useWorklistColumns.
 *
 * The optional `label` renders next to the button so callers can drop this
 * in directly as the Actions <th> content (label + button + native right
 * borders). When omitted, just the button renders.
 */
export function ColumnsHeaderButton({
  columns,
  hiddenSet,
  onToggle,
  onReorder,
  onReset,
  lockedTop,
  lockedBottom,
  label = 'Actions',
  showLabel = true,
}) {
  const btnRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);

  const openOrClose = (e) => {
    e.stopPropagation();
    if (anchorRect) { setAnchorRect(null); return; }
    setAnchorRect(e.currentTarget.getBoundingClientRect());
  };

  // When the caller passes an empty label (or opts out with showLabel),
  // drop the label span entirely and center the icon in the cell,
  // otherwise `justify-content: space-between` on the wrap pins a bare
  // icon to the right edge instead of centering it.
  const hasLabel = showLabel && !!label;

  return (
    <span className={`${styles.wrap} ${hasLabel ? '' : styles.wrapIconOnly}`}>
      {hasLabel && <span className={styles.label}>{label}</span>}
      <button
        ref={btnRef}
        type="button"
        className={[styles.btn, anchorRect ? styles.btnActive : ''].join(' ')}
        title="Show / hide columns"
        aria-label="Show or hide columns"
        onClick={openOrClose}
      >
        <ColumnsIcon size={14} color={anchorRect ? 'var(--primary-300)' : 'var(--neutral-300)'} />
      </button>

      {anchorRect && (
        <ColumnConfigPopover
          anchorRect={anchorRect}
          columns={toPopoverColumns(columns)}
          hidden={hiddenSet}
          onToggle={onToggle}
          onReorder={onReorder}
          onReset={onReset}
          onClose={() => setAnchorRect(null)}
          lockedTop={lockedTop}
          lockedBottom={lockedBottom}
        />
      )}
    </span>
  );
}

// Column icon: 3-panel rectangle glyph. Verbatim copy of the HCC
// worklist's `ColumnsIcon` (HccWorklistTableParts.jsx) so every
// worklist's Actions header shares one glyph. Uses a filled path (not
// stroked <rect>/<line>) so the hairlines match the HCC treatment at
// small sizes instead of thinning to a fainter stroke.
function ColumnsIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 1.37L5.97 0.87L6 1.37ZM6 14.63L5.97 15.13L6 14.63ZM10 1.37L10.02 0.87L10 1.37ZM10 14.63L10.02 15.13L10 14.63ZM1.33 8H0.83C0.83 9.56 0.83 10.78 0.96 11.72C1.09 12.688 1.36 13.448 1.95 14.04L2.31 13.691L2.66 13.34C2.28 12.96 2.06 12.44 1.95 11.59C1.83 10.72 1.83 9.59 1.83 8H1.33ZM14.67 8H14.17C14.17 9.59 14.16 10.72 14.05 11.59C13.93 12.44 13.72 12.96 13.34 13.34L13.69 13.691L14.04 14.04C14.64 13.448 14.91 12.688 15.04 11.72C15.17 10.78 15.17 9.56 15.17 8H14.67ZM14.67 8H15.17C15.17 6.44 15.17 5.23 15.04 4.28C14.91 3.31 14.64 2.55 14.04 1.96L13.69 2.31L13.34 2.66C13.72 3.04 13.93 3.56 14.05 4.41C14.16 5.28 14.17 6.42 14.17 8H14.67ZM1.33 8H1.83C1.83 6.42 1.83 5.28 1.95 4.41C2.06 3.56 2.28 3.04 2.66 2.66L2.31 2.31L1.95 1.96C1.36 2.55 1.09 3.31 0.96 4.28C0.83 5.23 0.83 6.44 0.83 8H1.33ZM8 1.33V0.83C6.94 0.83 6.72 0.83 5.97 0.87L6 1.37L6.02 1.87C6.75 1.83 6.95 1.83 8 1.83V1.33ZM6 1.37L5.97 0.87C5.23 0.91 4.44 0.98 3.74 1.14C3.06 1.28 2.39 1.53 1.95 1.96L2.31 2.31L2.66 2.66C2.88 2.45 3.32 2.25 3.96 2.11C4.58 1.98 5.3 1.91 6.02 1.87L6 1.37ZM8 14.67V14.17C6.95 14.17 6.75 14.17 6.02 14.13L6 14.63L5.97 15.13C6.72 15.17 6.94 15.17 8 15.17V14.67ZM6 14.63L6.02 14.13C5.3 14.1 4.58 14.02 3.96 13.89C3.32 13.75 2.88 13.56 2.66 13.34L2.31 13.691L1.95 14.04C2.39 14.48 3.06 14.72 3.74 14.87C4.44 15.02 5.23 15.09 5.97 15.13L6 14.63ZM6 1.37H5.5V14.63H6H6.5V1.37H6ZM8 1.33V1.83C9.05 1.83 9.25 1.83 9.97 1.87L10 1.37L10.02 0.87C9.27 0.83 9.05 0.83 8 0.83V1.33ZM10 1.37L9.97 1.87C10.69 1.91 11.42 1.98 12.04 2.11C12.68 2.25 13.12 2.45 13.34 2.66L13.69 2.31L14.04 1.96C13.61 1.53 12.93 1.28 12.256 1.14C11.56 0.98 10.77 0.91 10.02 0.87L10 1.37ZM8 14.67V15.17C9.05 15.17 9.27 15.17 10.02 15.13L10 14.63L9.97 14.13C9.25 14.17 9.05 14.17 8 14.17V14.67ZM10 14.63L10.02 15.13C10.77 15.09 11.56 15.02 12.256 14.87C12.93 14.72 13.61 14.48 14.04 14.04L13.69 13.691L13.34 13.34C13.12 13.56 12.68 13.75 12.04 13.89C11.42 14.02 10.69 14.1 9.97 14.13L10 14.63ZM10 1.37L9.5 1.37L9.5 14.63H10H10.5L10.5 1.37L10 1.37Z"
        fill={color}
      />
    </svg>
  );
}
