import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
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
}) {
  const [search, setSearch] = useState('');
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!anchorRect) return null;

  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 520);
  const right = Math.max(8, window.innerWidth - anchorRect.right);

  const q = search.trim().toLowerCase();
  const filtered = q ? columns.filter(c => c.lb.toLowerCase().includes(q)) : columns;

  // Drag handlers — only active when not searching (drag-reorder while a
  // search filter is on would be confusing since the visible list is a subset).
  const dragEnabled = !q && !!onReorder;
  const handleDragStart = (k) => (e) => {
    if (!dragEnabled) { e.preventDefault(); return; }
    setDragKey(k);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', k); } catch { /* noop */ }
  };
  const handleDragOver = (k) => (e) => {
    if (!dragKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overKey !== k) setOverKey(k);
  };
  const handleDrop = (k) => (e) => {
    e.preventDefault();
    if (dragKey && dragKey !== k) onReorder?.(dragKey, k);
    setDragKey(null);
    setOverKey(null);
  };
  const handleDragEnd = () => {
    setDragKey(null);
    setOverKey(null);
  };

  // Locked rows are only rendered when no search is active (so they don't
  // disappear-and-reappear depending on the query).
  const showLocked = !q;

  return createPortal(
    <>
      <div aria-hidden="true" className={styles.overlay} onClick={onClose} />
      <div
        className={styles.popover}
        style={{ top, right, width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Show columns"
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.title}>Show Columns</span>
            <CloseButton size={14} onClick={onClose} className={styles.close} />
          </div>

          <div className={styles.searchRow}>
            <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-200)" />
            <input aria-label="Search columns"
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
            <div className={styles.empty}>No columns match</div>
          )}
          {filtered.map((c) => {
            const visible = !hidden.has(c.k);
            const isDragging = dragKey === c.k;
            const isOver = overKey === c.k && dragKey && dragKey !== c.k;
            return (
              <div
                key={c.k}
                className={[
                  styles.row,
                  isDragging ? styles.rowDragging : '',
                  isOver ? styles.rowDropTarget : '',
                ].filter(Boolean).join(' ')}
                draggable={dragEnabled}
                onDragStart={handleDragStart(c.k)}
                onDragOver={handleDragOver(c.k)}
                onDrop={handleDrop(c.k)}
                onDragEnd={handleDragEnd}
              >
                <span
                  className={[styles.dragHandle, dragEnabled ? '' : styles.dragHandleDisabled].join(' ')}
                  aria-label={dragEnabled ? `Drag to reorder ${c.lb}` : undefined}
                  title={dragEnabled ? 'Drag to reorder' : undefined}
                >
                  <GripIcon color="var(--neutral-200)" />
                </span>
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
              </div>
            );
          })}

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
      </div>
    </>,
    document.body,
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
