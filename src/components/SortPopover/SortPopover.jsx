import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import styles from './SortPopover.module.css';

/**
 * Fold Health SortPopover — explicit ascending/descending sort picker.
 *
 * Two layouts depending on `items`:
 *  - 1 item → simple per-column sort (mirrors prototype's SortPopup).
 *  - 2+ items → "Sort by [Field]" multi-row variant (prototype's MemberSortPopup).
 *
 * The popover is anchored to a trigger rect, renders into the body via portal,
 * and closes on overlay click / Escape. Sort selections close automatically;
 * the "Clear Sort" footer appears only when one of the items is the current
 * active sort.
 *
 * Props:
 *  - anchorRect (DOMRect)              Trigger's bounding rect.
 *  - items      ({key,label}[])        One or more sortable axes for the column.
 *  - currentKey (string|null)          Currently active sort key (across the table).
 *  - currentDir ('asc'|'desc')         Currently active sort direction.
 *  - onSort     (fn(key, dir))         Apply this sort selection.
 *  - onClear    (fn)                   Clear sort.
 *  - onClose    (fn)                   Dismiss popover.
 *  - width      (number)               Default 208.
 */
export function SortPopover({
  anchorRect,
  items,
  currentKey,
  currentDir,
  onSort,
  onClear,
  onClose,
  width = 208,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pos = useMemo(() => positionPopover(anchorRect, width), [anchorRect, width]);
  const keys = useMemo(() => new Set(items.map(i => i.key)), [items]);
  const showClear = keys.has(currentKey);

  if (!anchorRect) return null;

  const select = (key, dir) => {
    onSort?.(key, dir);
    onClose?.();
  };

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.popover}
        style={{ top: pos.top, left: pos.left, width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className={styles.heading}>Sort by</div>
        {items.map((item) => {
          const isActive = currentKey === item.key;
          return (
            <div
              key={item.key}
              className={[styles.row, isActive ? styles.rowActive : ''].join(' ')}
            >
              <span className={[styles.label, isActive ? styles.labelActive : ''].join(' ')}>
                {item.label}
              </span>
              <div className={styles.dirGroup}>
                <DirButton dir="asc"  active={isActive && currentDir === 'asc'}  onClick={() => select(item.key, 'asc')}  />
                <DirButton dir="desc" active={isActive && currentDir === 'desc'} onClick={() => select(item.key, 'desc')} />
              </div>
            </div>
          );
        })}
        {showClear && (
          <>
            <div className={styles.divider} />
            <button
              type="button"
              className={styles.clear}
              onClick={() => { onClear?.(); onClose?.(); }}
            >
              Clear Sort
            </button>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}

function DirButton({ dir, active, onClick }) {
  const iconName = dir === 'asc' ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear';
  return (
    <button
      type="button"
      className={[styles.dirBtn, active ? styles.dirBtnActive : ''].join(' ')}
      onClick={onClick}
      aria-label={dir === 'asc' ? 'Sort ascending' : 'Sort descending'}
    >
      <Icon name={iconName} size={12} color={active ? 'var(--neutral-0)' : 'var(--neutral-300)'} />
    </button>
  );
}

function positionPopover(rect, width) {
  if (!rect) return { top: 0, left: 0 };
  const margin = 8;
  const top = Math.min(rect.bottom + 4, window.innerHeight - 220);
  const left = Math.min(rect.left, window.innerWidth - width - margin);
  return { top, left: Math.max(margin, left) };
}
