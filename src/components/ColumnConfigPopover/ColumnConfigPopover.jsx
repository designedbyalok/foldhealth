import { useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Icon } from '../Icon/Icon';
import { SortableList, SortableItem } from '../SortableList/SortableList';
import { CloseButton } from '../CloseButton/CloseButton';
import styles from './ColumnConfigPopover.module.css';

/**
 * Column visibility editor — searchable list of every column with a 6-dot
 * drag-grip + eye toggle, plus a Reset/Apply footer. Mirrors the Figma
 * "Show Columns" dropdown (node 9799:170254). The sticky Member and Actions
 * columns can't be hidden or reordered, but are still shown as locked rows
 * (top + bottom) for visual completeness.
 *
 * Props:
 *  - anchorRect (DOMRect)              Anchor ("Columns" button) rect.
 *  - columns    ({k,lb}[])             Column descriptors in current order.
 *  - hidden     (Set<string>)          Currently hidden column keys.
 *  - onToggle   (fn(k: string))        Toggle a column's visibility.
 *  - onReorder  (fn(from: string,
 *                  to: string))        Drag-reorder: move `from` to where
 *                                      `to` currently sits. Optional — if
 *                                      omitted, dragging is disabled.
 *  - onReset    (fn)                   Restore defaults (clears order + hidden).
 *  - onClose    (fn)                   Dismiss popover (used by Apply too).
 *  - lockedTop  ({k,lb}[])             Non-toggleable rows pinned at top
 *                                      (default: [{ k:'member', lb:'Member Name' }]).
 *  - lockedBottom ({k,lb}[])           Non-toggleable rows pinned at bottom
 *                                      (default: [{ k:'actions', lb:'Action' }]).
 *  - width      (number)               Default 240.
 *  - title      (string)               Default 'Show Columns'.
 *  - emptyText  (string)               Shown when the search matches nothing.
 */
export function ColumnConfigPopover({
  anchorRect,
  columns,
  hidden,
  onToggle,
  onReorder,
  onReset,
  onClose,
  lockedTop = [{ k: 'member', lb: 'Member Name' }],
  lockedBottom = [{ k: 'actions', lb: 'Action' }],
  width = 240,
  title = 'Show Columns',
  emptyText = 'No columns match',
}) {
  const [search, setSearch] = useState('');

  if (!anchorRect) return null;

  const q = search.trim().toLowerCase();
  const filtered = q ? columns.filter(c => c.lb.toLowerCase().includes(q)) : columns;

  // Reordering is off while searching: the visible list is only a subset.
  // dnd-kit (SortableList) rather than native drag events, which a real
  // mouse drag in this popover never completed.
  const dragEnabled = !q && !!onReorder;

  const renderRow = (c, handle) => {
    const visible = !hidden.has(c.k);
    return (
      <>
        {handle}
        <span className={[styles.label, visible ? '' : styles.labelHidden].join(' ')}>
          {c.lb}
        </span>
        <button
          type="button"
          className={styles.eye}
          onClick={() => onToggle?.(c.k)}
          aria-label={visible ? `Hide ${c.lb}` : `Show ${c.lb}`}
        >
          <Icon
            name={visible ? 'solar:eye-linear' : 'solar:eye-closed-linear'}
            size={16}
            color={visible ? 'var(--neutral-300)' : 'var(--neutral-200)'}
          />
        </button>
      </>
    );
  };

  // Locked rows are only rendered when no search is active (so they don't
  // disappear-and-reappear depending on the query).
  const showLocked = !q;

  return (
    <Popover
      anchor={anchorRect}
      onOpenChange={() => onClose?.()}
      placement="bottom-end"
      offset={6}
      width={width}
      maxHeight={520}
      role="group"
      aria-label={title}
      className={styles.popover}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{title}</span>
          <CloseButton size={14} onClick={onClose} className={styles.close} />
        </div>

        <div className={styles.searchRow}>
          <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-200)" />
          <input aria-label={`Search ${title.toLowerCase()}`}
            type="text"
            value={search}
            placeholder="Search"
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.list}>
        {showLocked && lockedTop.map((c) => (
          <LockedRow key={`locked-top-${c.k}`} label={c.lb} />
        ))}

        {filtered.length === 0 && (
          <div className={styles.empty}>{emptyText}</div>
        )}
        {dragEnabled ? (
          <SortableList ids={filtered.map(c => c.k)} onReorder={(_ids, from, to) => onReorder(from, to)}>
            {filtered.map((c) => (
              <SortableItem key={c.k} id={c.k} label={c.lb} className={styles.row} dragOnItem>
                {(handle) => renderRow(c, handle)}
              </SortableItem>
            ))}
          </SortableList>
        ) : filtered.map((c) => (
          <div key={c.k} className={styles.row}>
            {renderRow(c, (
              <span className={`${styles.dragHandle} ${styles.dragHandleDisabled}`}>
                <GripIcon color="var(--neutral-200)" />
              </span>
            ))}
          </div>
        ))}

        {showLocked && lockedBottom.map((c) => (
          <LockedRow key={`locked-bot-${c.k}`} label={c.lb} />
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnReset}
          onClick={() => onReset?.()}
        >
          <Icon name="solar:restart-linear" size={16} color="var(--neutral-300)" />
          <span>Reset</span>
        </button>
        <button
          type="button"
          className={styles.btnApply}
          onClick={onClose}
        >
          Apply
        </button>
      </div>
    </Popover>
  );
}

// Locked / non-interactive row — used for "Member Name" and "Action" entries
// which are always-visible columns the user can't toggle or reorder.
function LockedRow({ label }) {
  return (
    <div className={`${styles.row} ${styles.rowLocked}`} aria-disabled="true">
      <span className={`${styles.dragHandle} ${styles.dragHandleDisabled}`}>
        <GripIcon color="var(--neutral-200)" />
      </span>
      <span className={`${styles.label} ${styles.labelLocked}`}>{label}</span>
      <span className={styles.eyeLocked} aria-hidden="true">
        <Icon name="solar:eye-linear" size={16} color="var(--neutral-200)" />
      </span>
    </div>
  );
}

// 6-dot vertical grip — matches Figma's "Drag Handle 2" glyph. No matching
// Solar icon ships with the right dot pattern, so we inline it.
function GripIcon({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6"  cy="3.5" r="1.1" fill={color} />
      <circle cx="10" cy="3.5" r="1.1" fill={color} />
      <circle cx="6"  cy="8"   r="1.1" fill={color} />
      <circle cx="10" cy="8"   r="1.1" fill={color} />
      <circle cx="6"  cy="12.5" r="1.1" fill={color} />
      <circle cx="10" cy="12.5" r="1.1" fill={color} />
    </svg>
  );
}
