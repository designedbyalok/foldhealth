import { useRef, useState } from 'react';
import { ColumnConfigPopover } from '../ColumnConfigPopover/ColumnConfigPopover';
import { toPopoverColumns } from './useWorklistColumns';
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

  return (
    <span className={styles.wrap}>
      {showLabel && <span className={styles.label}>{label}</span>}
      <button
        ref={btnRef}
        type="button"
        className={[styles.btn, anchorRect ? styles.btnActive : ''].join(' ')}
        title="Show / hide columns"
        aria-label="Show or hide columns"
        onClick={openOrClose}
      >
        <ColumnsIcon size={16} color={anchorRect ? 'var(--primary-300)' : 'var(--neutral-300)'} />
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

// Column icon — 3-panel rectangle glyph. Mirrors the one HCC ships inline
// (see HccWorklistTableParts), colocated here so the shared component is
// self-contained.
function ColumnsIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke={color} strokeWidth="1" fill="none">
        <rect x="1.33" y="1.33" width="13.33" height="13.33" rx="1.67" />
        <line x1="6" y1="1.33" x2="6" y2="14.67" />
        <line x1="10" y1="1.33" x2="10" y2="14.67" />
      </g>
    </svg>
  );
}
