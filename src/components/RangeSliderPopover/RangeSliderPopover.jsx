import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Button } from '../Button/Button';
import styles from './RangeSliderPopover.module.css';

/**
 * Fold Health RangeSliderPopover — dual-thumb range picker in a popover.
 *
 * Used by the HCC Decile filter (1–10) but kept generic enough to drop in
 * anywhere a min/max numeric range chip is needed.
 *
 * Props:
 *  - anchorRect (DOMRect)         Trigger's bounding rect.
 *  - label      (string)          Header label.
 *  - min        (number)          Lower bound (inclusive). Default 0.
 *  - max        (number)          Upper bound (inclusive). Default 10.
 *  - step       (number)          Step increment. Default 1.
 *  - initialMin (number)          Starting min. Defaults to `min`.
 *  - initialMax (number)          Starting max. Defaults to `max`.
 *  - onApply    (fn(min, max))    Called when user clicks Apply.
 *  - onClose    (fn)              Dismiss without applying.
 *  - width      (number)          Default 280.
 *  - unitLabel  (string)          Optional suffix shown next to each end value
 *                                 (e.g. "decile", "yrs"). Empty for plain numbers.
 */
export function RangeSliderPopover({
  anchorRect,
  label,
  min = 0,
  max = 10,
  step = 1,
  initialMin,
  initialMax,
  onApply,
  onClose,
  width = 280,
  unitLabel = '',
}) {
  const start = clamp(initialMin ?? min, min, max);
  const end   = clamp(initialMax ?? max, min, max);
  const [vals, setVals] = useState([start, end]);

  // Re-sync when the popover is reopened with a different starting range
  useEffect(() => { setVals([start, end]); }, [start, end]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pos = useMemo(() => positionPopover(anchorRect, width), [anchorRect, width]);

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

        <div className={styles.valueRow}>
          <div className={styles.endcap}>
            <span className={styles.endcapValue}>{vals[0]}</span>
            {unitLabel && <span className={styles.endcapUnit}>{unitLabel}</span>}
          </div>
          <span className={styles.divider}>—</span>
          <div className={styles.endcap}>
            <span className={styles.endcapValue}>{vals[1]}</span>
            {unitLabel && <span className={styles.endcapUnit}>{unitLabel}</span>}
          </div>
        </div>

        <SliderPrimitive.Root
          className={styles.sliderRoot}
          min={min}
          max={max}
          step={step}
          value={vals}
          onValueChange={setVals}
          minStepsBetweenThumbs={0}
        >
          <SliderPrimitive.Track className={styles.track}>
            <SliderPrimitive.Range className={styles.range} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className={styles.thumb} aria-label="Minimum" />
          <SliderPrimitive.Thumb className={styles.thumb} aria-label="Maximum" />
        </SliderPrimitive.Root>

        <div className={styles.scale}>
          <span>{min}</span>
          <span>{max}</span>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" size="S" onClick={() => setVals([min, max])}>
            Reset
          </Button>
          <Button variant="primary" size="S" onClick={() => onApply?.(vals[0], vals[1])}>
            Apply
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function positionPopover(rect, width) {
  if (!rect) return { top: 0, left: 0 };
  const margin = 8;
  const top = Math.min(rect.bottom + 6, window.innerHeight - 220);
  const left = Math.min(rect.left, window.innerWidth - width - margin);
  return { top, left: Math.max(margin, left) };
}
