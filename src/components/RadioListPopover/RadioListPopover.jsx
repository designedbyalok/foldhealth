import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styles from './RadioListPopover.module.css';

/**
 * Fold Health RadioListPopover — anchored, portaled single-select.
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
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pos = useMemo(() => positionPopover(anchorRect, width), [anchorRect, width]);
  const current = selected[0] ?? null;

  if (!anchorRect) return null;

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.popover}
        style={{ top: pos.top, left: pos.left, width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={label}
      >
        {label && <div className={styles.header}>{label}</div>}
        <div className={styles.list}>
          {options.map((opt) => {
            const active = current === opt;
            return (
              <button
                key={opt}
                type="button"
                className={styles.row}
                onClick={() => onChange?.([opt])}
              >
                <span className={[styles.radio, active ? styles.radioActive : ''].join(' ')}>
                  {active && <span className={styles.dot} />}
                </span>
                <span className={styles.label}>{opt}</span>
              </button>
            );
          })}
        </div>
        {showClear && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => onChange?.([])}
          >
            Reset Selection
          </button>
        )}
      </div>
    </>,
    document.body,
  );
}

function positionPopover(rect, width) {
  if (!rect) return { top: 0, left: 0 };
  const margin = 8;
  const top = Math.min(rect.bottom + 6, window.innerHeight - 320);
  const left = Math.min(rect.left, window.innerWidth - width - margin);
  return { top, left: Math.max(margin, left) };
}
