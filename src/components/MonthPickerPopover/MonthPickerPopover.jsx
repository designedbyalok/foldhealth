import { useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Icon } from '../Icon/Icon';
import styles from './MonthPickerPopover.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WIDTH = 288;
const key = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`; // m: 0–11
const inside = (k, r) => !!r && k >= r.from && k <= r.to;

/**
 * Fold Health MonthPickerPopover: a year of months to pick one from, for
 * filters that work in whole months. One click picks the start month; the
 * range it gives (from `rangeFor`, e.g. a quarter or 12 months) shows
 * highlighted, and previews on hover. Months outside `min`–`max` can't be
 * picked, and neither can a start whose range would run past `max`.
 *
 * @param {object}   props
 * @param {DOMRect}  props.anchorRect – The trigger's rect; the popover opens below it
 * @param {string}   props.label      – What's being picked, for its accessible name
 * @param {{ from: string, to: string }} [props.value] – The current range ('YYYY-MM')
 * @param {(start: string) => { from: string, to: string }} [props.rangeFor] –
 *   The range a start month gives; defaults to just that month
 * @param {string}   [props.min]      – Earliest month ('YYYY-MM')
 * @param {string}   [props.max]      – Latest month ('YYYY-MM')
 * @param {(start: string) => void} props.onChange – The picked start month
 * @param {function} props.onClose
 */
export function MonthPickerPopover({ anchorRect, label, value, rangeFor = (s) => ({ from: s, to: s }), min, max, onChange, onClose }) {
  const [year, setYear] = useState(() => Number((value?.from || max || key(new Date().getFullYear(), new Date().getMonth())).slice(0, 4)));
  const [hover, setHover] = useState(null);

  if (!anchorRect) return null;

  const allowed = (k) => (!min || k >= min) && (!max || (k <= max && rangeFor(k).to <= max));
  const shown = hover ? rangeFor(hover) : value;
  const minYear = min ? Number(min.slice(0, 4)) : -Infinity;
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;

  return (
    <Popover
      anchor={anchorRect}
      onOpenChange={() => onClose?.()}
      offset={6}
      width={WIDTH}
      role="dialog"
      aria-label={`Select ${label}`}
      className={styles.popover}
    >
      <div className={styles.header}>
        <button type="button" className={styles.nav} onClick={() => setYear(y => y - 1)} disabled={year <= minYear} aria-label="Previous year">
          <Icon name="solar:double-alt-arrow-left-linear" size={16} color="currentColor" />
        </button>
        <span className={styles.year}>{year}</span>
        <button type="button" className={styles.nav} onClick={() => setYear(y => y + 1)} disabled={year >= maxYear} aria-label="Next year">
          <Icon name="solar:double-alt-arrow-right-linear" size={16} color="currentColor" />
        </button>
      </div>
      <div className={styles.grid} onMouseLeave={() => setHover(null)}>
        {MONTHS.map((name, m) => {
          const k = key(year, m);
          const ok = allowed(k);
          const isStart = shown?.from === k;
          const inRange = inside(k, shown);
          return (
            <button
              key={k}
              type="button"
              className={[styles.month, inRange ? styles.inRange : '', isStart ? styles.start : ''].filter(Boolean).join(' ')}
              disabled={!ok}
              aria-pressed={value?.from === k}
              onMouseEnter={() => ok && setHover(k)}
              onFocus={() => ok && setHover(k)}
              onClick={() => { onChange?.(k); onClose?.(); }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
