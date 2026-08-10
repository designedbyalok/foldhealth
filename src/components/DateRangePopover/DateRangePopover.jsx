import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import styles from './DateRangePopover.module.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();

/**
 * Fold Health DateRangePopover — dual-month calendar with click-and-click
 * range selection (no drag). First click sets `start`; second click sets
 * `end`. Hovering after the first click previews the range.
 *
 * Used by HCC filter chips of type `date` (DOB, Create Date, Last Visit
 * Date, etc.). Returns ISO date strings (YYYY-MM-DD) so the value round-trips
 * through `hccFilters` cleanly.
 *
 * Props:
 *  - anchorRect (DOMRect)              Trigger rect (popover anchors below).
 *  - label      (string)               Filter label e.g. "Create Date".
 *  - selected   (string[])             Current value as [startISO, endISO]
 *                                       or [] for none.
 *  - onChange   (fn(string[]))         Caller receives a 0- or 2-element ISO array.
 *  - onClose    (fn)                   Dismiss on overlay click / Escape /
 *                                       Apply / Clear.
 *  - width      (number)               Default 504.
 */
export function DateRangePopover({
  anchorRect,
  label,
  selected = [],
  onChange,
  onClose,
  width = 504,
}) {
  const today = useMemo(() => new Date(), []);
  const [viewL, setViewL] = useState(() => ({
    y: today.getFullYear(),
    m: today.getMonth() === 0 ? 11 : today.getMonth() - 1,
  }));
  const [viewR, setViewR] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));

  const [start, setStart] = useState(() => (selected[0] ? new Date(selected[0]) : null));
  const [end, setEnd]     = useState(() => (selected[1] ? new Date(selected[1]) : null));
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!anchorRect) return null;

  const isStart = (d) => sameDay(d, start);
  const isEnd   = (d) => sameDay(d, end);

  const inRange = (d) => {
    const lo = start && end ? (start <= end ? start : end) : start;
    const hi = start && end ? (start <= end ? end : start) : hover;
    if (!lo || !hi) return false;
    return d > lo && d < hi;
  };

  const handleDayClick = (d) => {
    if (!start || end) {
      // First click after a fresh open or after a committed range: restart.
      setStart(d);
      setEnd(null);
      return;
    }
    if (d < start) { setEnd(start); setStart(d); }
    else            { setEnd(d); }
  };

  const stepView = (delta) => {
    setViewL(v => stepMonth(v, delta));
    setViewR(v => stepMonth(v, delta));
  };

  const apply = () => {
    if (!start || !end) return;
    onChange?.([toISO(start), toISO(end)]);
    onClose?.();
  };

  const clear = () => {
    setStart(null);
    setEnd(null);
    onChange?.([]);
  };

  // Position the popover anchored to the trigger.
  const left = Math.min(anchorRect.left, window.innerWidth - width - 12);
  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 420);

  return createPortal(
    <>
      {/* Decorative click-catcher: the keyboard path to dismiss is the Escape
          handler above, so this must not become a full-viewport tab stop. */}
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.popover}
        style={{ top, left: Math.max(12, left), width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Select ${label}`}
      >
        <div className={styles.heading}>Select {label}</div>

        <div className={styles.calHeader}>
          <button type="button" className={styles.navBtn} onClick={() => stepView(-1)} aria-label="Previous month">
            <Icon name="solar:alt-arrow-left-linear" size={14} color="var(--neutral-300)" />
          </button>
          <div className={styles.monthLabels}>
            <span>{MONTH_NAMES[viewL.m]} {viewL.y}</span>
            <span>{MONTH_NAMES[viewR.m]} {viewR.y}</span>
          </div>
          <button type="button" className={styles.navBtn} onClick={() => stepView(1)} aria-label="Next month">
            <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-300)" />
          </button>
        </div>

        <div className={styles.calBody}>
          <MonthGrid
            view={viewL}
            isStart={isStart}
            isEnd={isEnd}
            inRange={inRange}
            onDay={handleDayClick}
            onHover={setHover}
            hasEnd={!!end}
          />
          <span className={styles.calDivider} />
          <MonthGrid
            view={viewR}
            isStart={isStart}
            isEnd={isEnd}
            inRange={inRange}
            onDay={handleDayClick}
            onHover={setHover}
            hasEnd={!!end}
          />
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" size="S" onClick={clear}>Clear</Button>
          <Button variant="primary" size="S" disabled={!start || !end} onClick={apply}>
            Apply
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function MonthGrid({ view, isStart, isEnd, inRange, onDay, onHover, hasEnd }) {
  const days = daysInMonth(view.y, view.m);
  const first = firstDow(view.y, view.m);

  const cells = [];
  for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} className={styles.cellEmpty} />);

  for (let d = 1; d <= days; d++) {
    const dt = new Date(view.y, view.m, d);
    const sel = isStart(dt) || isEnd(dt);
    const rng = inRange(dt);
    const roundLeft  = isStart(dt) || (rng && dt.getDay() === 0);
    const roundRight = isEnd(dt)   || (rng && dt.getDay() === 6);
    cells.push(
      <button
        key={d}
        type="button"
        className={[
          styles.cell,
          sel ? styles.cellSelected : '',
          rng && !sel ? styles.cellInRange : '',
          sel && roundLeft && roundRight ? styles.cellRoundFull : '',
          sel && roundLeft && !roundRight ? styles.cellRoundLeft : '',
          sel && roundRight && !roundLeft ? styles.cellRoundRight : '',
        ].filter(Boolean).join(' ')}
        onClick={() => onDay(dt)}
        onMouseEnter={() => !hasEnd && onHover(dt)}
        onMouseLeave={() => onHover(null)}
      >
        {d}
      </button>
    );
  }

  return (
    <div className={styles.month}>
      <div className={styles.dowRow}>
        {DOW.map((d) => <div key={d} className={styles.dow}>{d}</div>)}
      </div>
      <div className={styles.grid}>{cells}</div>
    </div>
  );
}

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDow(y, m)    { return new Date(y, m, 1).getDay(); }

function stepMonth(v, delta) {
  let m = v.m + delta;
  let y = v.y;
  if (m < 0)  { m = 11; y -= 1; }
  if (m > 11) { m = 0;  y += 1; }
  return { y, m };
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
