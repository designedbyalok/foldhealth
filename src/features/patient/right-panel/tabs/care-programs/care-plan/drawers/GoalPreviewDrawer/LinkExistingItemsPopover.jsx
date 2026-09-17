import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckboxTick } from '../../../../../../../../components/CheckboxTick/CheckboxTick';
import { Button } from '../../../../../../../../components/Button/Button';
import styles from './LinkExistingItemsPopover.module.css';

/**
 * Checkbox list popover for linking existing plan items (interventions /
 * barriers) onto the open goal. Stays open while toggling; closes on outside
 * click or Escape.
 *
 * Two commit models:
 *   - No `onConfirm`: each toggle persists immediately (Goal Details drawer).
 *   - With `onConfirm`: toggles only stage a pending selection in the parent,
 *     and a Cancel / Link footer commits or discards (care-plan row menu).
 */
export function LinkExistingItemsPopover({
  anchorRef,
  anchorRect,
  align = 'right',
  width = 280,
  ariaLabel = 'Link existing items',
  title,
  items = [],
  emptyLabel = 'Nothing to link yet.',
  onToggle,
  onConfirm,
  confirmLabel = 'Link',
  confirmDisabled = false,
  onClose,
}) {
  const popRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const onMouseDown = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose, anchorRef]);

  const rect = anchorRect || anchorRef?.current?.getBoundingClientRect();
  if (!rect) return null;

  const estHeight = Math.min(320, 56 + items.length * 36);
  const openAbove = (rect.top + rect.bottom) / 2 > window.innerHeight / 2;
  const style = { width };
  if (openAbove) {
    style.bottom = Math.max(8, window.innerHeight - rect.top + 4);
  } else {
    style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - estHeight - 8));
  }
  if (align === 'right') {
    style.right = Math.max(8, window.innerWidth - rect.right);
  } else {
    style.left = Math.max(8, rect.left);
  }

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        ref={popRef}
        className={styles.menu}
        style={style}
        role="dialog"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.scroll}>
          {title && <div className={styles.title}>{title}</div>}
          {items.length === 0 ? (
            <div className={styles.empty}>{emptyLabel}</div>
          ) : (
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!item.checked}
                    className={styles.row}
                    onClick={() => onToggle?.(item.id, !item.checked)}
                  >
                    <span className={styles.check}>
                      <CheckboxTick checked={!!item.checked} size={15} />
                    </span>
                    <span className={styles.stack}>
                      <span className={styles.rowTitle}>{item.title}</span>
                      {item.subtitle && <span className={styles.rowSub}>{item.subtitle}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {onConfirm && (
          <div className={styles.footer}>
            <Button variant="secondary" size="S" onClick={onClose}>Cancel</Button>
            <Button size="S" disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
