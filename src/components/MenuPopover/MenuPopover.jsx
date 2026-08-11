import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import styles from './MenuPopover.module.css';

/**
 * MenuPopover — shared action-list popover. Standardises every "click a
 * trigger → see a list of actions" surface in the app (worklist row
 * actions, Upload toolbar, DOS status menu, etc.) so they all look and
 * feel identical.
 *
 * The popover is portal-rendered so it never gets clipped by a parent's
 * overflow. Anchor positioning takes one of two shapes:
 *   anchorRect — a DOMRect (or { top, bottom, left, right }) from the
 *                trigger's getBoundingClientRect(). Cheapest for portals.
 *   anchorRef  — a React ref to the trigger element; the popover reads
 *                its rect on mount. Use when the parent already has a ref.
 *
 * @param {object}   props
 * @param {DOMRect}  [props.anchorRect]
 * @param {object}   [props.anchorRef]
 * @param {Array}    props.items          – [{ key, icon, label, trailing, danger, disabled, hint }]
 *                                          Also accepts { section: 'Label' } for an uppercase
 *                                          group header and { divider: true } for a rule line.
 * @param {function} props.onSelect       – (key, item) => void
 * @param {function} props.onClose
 * @param {string}   [props.ariaLabel='Menu']
 * @param {number}   [props.width=200]    – Pixel width of the menu
 * @param {'left'|'right'} [props.align='right']
 *                                          'right' = right edge of menu aligns with right edge of anchor;
 *                                          'left'  = left edge aligns with left edge of anchor.
 */
export function MenuPopover({
  anchorRect,
  anchorRef,
  items = [],
  onSelect,
  onClose,
  ariaLabel = 'Menu',
  width = 200,
  align = 'right',
}) {
  const popRef = useRef(null);

  // Close on Escape + click outside.
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

  // Cap so the menu can't overflow the viewport vertically. Sections and
  // dividers are shorter than action rows, so estimate per item type.
  const estHeight = items.reduce(
    (h, it) => h + (it.divider ? 5 : it.section ? 25 : 34), 16,
  );
  // Anchor in the bottom half of the viewport → open upward so the menu grows
  // toward the top instead of getting clamped/clipped at the bottom edge.
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
        onClick={(e) => e.stopPropagation()}
        role="menu"
        aria-label={ariaLabel}
      >
        {items.map((item, idx) => {
          if (item.section) {
            return <div key={`section-${item.section}`} className={styles.section}>{item.section}</div>;
          }
          if (item.divider) {
            return <div key={`divider-${idx}`} className={styles.divider} />;
          }
          return (
          <button
            key={item.key || item.label}
            type="button"
            role="menuitem"
            disabled={!!item.disabled}
            title={item.hint}
            className={[
              styles.row,
              item.danger ? styles.danger : '',
              item.disabled ? styles.disabled : '',
            ].filter(Boolean).join(' ')}
            onClick={() => {
              if (item.disabled) return;
              onSelect?.(item.key || item.label, item);
              onClose?.();
            }}
          >
            {item.icon && (
              <Icon name={item.icon} size={16} color={item.danger ? 'var(--status-error)' : 'var(--neutral-400)'} />
            )}
            <span className={styles.label}>{item.label}</span>
            {item.trailing && (
              <Icon name="solar:alt-arrow-right-linear" size={10} color="var(--neutral-300)" />
            )}
          </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}
