import { useCallback, useEffect, useMemo, useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Select } from '../Select/Select';
import { Button } from '../Button/Button';
import { ActionButton } from '../ActionButton/ActionButton';
import { CalendarPrevIcon } from '../Icon/CalendarPrevIcon';
import { CalendarNextIcon } from '../Icon/CalendarNextIcon';
import { CalendarPrevYearIcon } from '../Icon/CalendarPrevYearIcon';
import { CalendarNextYearIcon } from '../Icon/CalendarNextYearIcon';
import styles from './DatePickerPopover.module.css';

/**
 * Fold-brand calendar popover — Figma Fold-Pixel-1.0.
 *
 * Two variants, both driven off the same primitives:
 *   - Single (node 8646:12168):  one month grid.
 *   - Range  (node 8654:12785):  two side-by-side month grids with
 *     year + month nav flanking both edges, and a `--primary-100` strip
 *     under the days between the selected start and end.
 *
 * Portal-mounted so it escapes overflow-clipping drawers. Flips above
 * the anchor when the viewport can't fit the card downward.
 *
 * Props:
 *   mode      "single" | "range"
 *   value     ISO string (single) or `{ start, end }` (range)
 *   onChange  fires with the new value on commit
 *   anchorRect
 *   min / max ISO strings — bounds; days outside are disabled
 */
export function DatePickerPopover({
  open,
  onClose,
  value,
  onChange,
  anchorRect,
  min,
  max,
  mode = 'single',
  // Optional slot rendered below the month grid (single mode) or
  // between the month grid and the Clear/Save row (range mode).
  // Lets callers attach a controls strip — e.g. a Repeat toggle —
  // without forking the popover.
  footer = null,
  // Optional ISO (YYYY-MM-DD) strings to paint with a subtle grey
  // fill — used by callers with a recurrence config to show every
  // future occurrence at a glance. The primary selection still
  // renders in the solid primary swatch on top.
  highlightedDates = null,
}) {
  const highlightedSet = useMemo(() => {
    if (!highlightedDates || !highlightedDates.length) return null;
    const s = new Set();
    for (const iso of highlightedDates) {
      if (!iso) continue;
      const [y, m, d] = String(iso).split('-').map(Number);
      if (!y || !m || !d) continue;
      s.add(`${y}-${m}-${d}`);
    }
    return s.size ? s : null;
  }, [highlightedDates]);
  const isRange = mode === 'range';
  const initialDate = pickInitialFocusDate(value, isRange);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  // Range mode is a two-step commit: first click stakes `pendingStart`,
  // second click stakes `pendingEnd`, but neither writes to the parent
  // until the user clicks Save. This lets Clear/Save behave meaningfully
  // in the footer and mirrors the Figma range picker interaction.
  const [pendingStart, setPendingStart] = useState(null);
  const [pendingEnd, setPendingEnd] = useState(null);
  const [hoverEnd, setHoverEnd] = useState(null);

  useEffect(() => {
    if (!open) return;
    const d = pickInitialFocusDate(value, isRange);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    // Seed the pending pair from any committed range so reopening the
    // popover shows the current selection as the working draft.
    if (isRange) {
      setPendingStart(value?.start ? parseIsoLocal(value.start) : null);
      setPendingEnd(value?.end ? parseIsoLocal(value.end) : null);
    } else {
      setPendingStart(null);
      setPendingEnd(null);
    }
    setHoverEnd(null);
  }, [open, value, isRange]);

  const minDate = useMemo(() => (min ? parseIsoLocal(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseIsoLocal(max) : null), [max]);
  const today = todayLocal();

  const selectedSingle = !isRange && value ? parseIsoLocal(value) : null;
  // In range mode the popover works entirely off the pending pair —
  // clicking Save is what writes back to the parent. The `value` prop
  // seeds the pair on open (see the effect above).
  const rangeStart = isRange ? pendingStart : null;
  const rangeEnd = isRange ? pendingEnd : null;
  // Ephemeral range while the user hovers between the first and second
  // click — clamped so hovering LEFT of the pending start previews a
  // backwards range too.
  const previewStart = pendingStart && !pendingEnd && hoverEnd
    ? (hoverEnd < pendingStart ? hoverEnd : pendingStart)
    : null;
  const previewEnd = pendingStart && !pendingEnd && hoverEnd
    ? (hoverEnd < pendingStart ? pendingStart : hoverEnd)
    : null;

  const gotoPrev = () => stepMonth(-1);
  const gotoNext = () => stepMonth(1);
  const gotoPrevYear = () => stepMonth(-12);
  const gotoNextYear = () => stepMonth(12);
  function stepMonth(n) {
    const d = new Date(viewYear, viewMonth + n, 1);
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth());
  }

  const pickDate = useCallback((d) => {
    if (!isRange) {
      onChange?.(isoFromLocal(d));
      onClose?.();
      return;
    }
    // Third-click-after-completed-range starts a fresh pair.
    if (!pendingStart || (pendingStart && pendingEnd)) {
      setPendingStart(d);
      setPendingEnd(null);
      setHoverEnd(null);
      return;
    }
    // Second click completes the pair — always ordered so start ≤ end.
    const [start, end] = d < pendingStart ? [d, pendingStart] : [pendingStart, d];
    setPendingStart(start);
    setPendingEnd(end);
    setHoverEnd(null);
  }, [isRange, pendingStart, pendingEnd, onChange, onClose]);

  const handleClear = useCallback(() => {
    setPendingStart(null);
    setPendingEnd(null);
    setHoverEnd(null);
  }, []);

  const handleSave = useCallback(() => {
    if (pendingStart && pendingEnd) {
      onChange?.({ start: isoFromLocal(pendingStart), end: isoFromLocal(pendingEnd) });
    } else if (!pendingStart && !pendingEnd) {
      // Empty save = commit cleared state so the parent's input can blank.
      onChange?.({ start: '', end: '' });
    }
    onClose?.();
  }, [pendingStart, pendingEnd, onChange, onClose]);

  const yearOptions = useMemo(() => {
    const now = today.getFullYear();
    // Bounds narrow the year list too, so a future-only picker (min = today)
    // doesn't offer years whose every day is disabled.
    const start = minDate ? minDate.getFullYear() : Math.min(now - 80, viewYear - 5);
    const end = maxDate ? maxDate.getFullYear() : Math.max(now + 20, viewYear + 5);
    const out = [];
    for (let y = end; y >= start; y--) out.push({ value: String(y), label: String(y) });
    return out;
  }, [viewYear, today, minDate, maxDate]);

  const rightYearOptions = useMemo(() => {
    const start = viewYear - 80;
    const end = viewYear + 20;
    const out = [];
    for (let y = end; y >= start; y--) out.push({ value: String(y), label: String(y) });
    return out;
  }, [viewYear]);

  if (!open) return null;

  const renderMonth = (year, month) => (
    <MonthGrid
      year={year}
      month={month}
      today={today}
      minDate={minDate}
      maxDate={maxDate}
      selectedSingle={selectedSingle}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      pendingStart={pendingStart}
      previewStart={previewStart}
      previewEnd={previewEnd}
      isRange={isRange}
      onPick={pickDate}
      onHover={(d) => setHoverEnd(d)}
      highlightedSet={highlightedSet}
    />
  );

  const yearForMonth = (m) => (m < 12 ? viewYear : viewYear + 1);
  const rightMonthValue = (viewMonth + 1) % 12;
  const rightMonthYear = yearForMonth(viewMonth + 1);

  const header = isRange ? (
    <div className={styles.rangeHeader}>
      <div className={styles.titleLeft}>
        <div className={styles.navPair}>
          <ActionButton size="S" tooltip="Previous year" onClick={gotoPrevYear}>
            <CalendarPrevYearIcon size={16} />
          </ActionButton>
          <ActionButton size="S" tooltip="Previous month" onClick={gotoPrev}>
            <CalendarPrevIcon size={16} />
          </ActionButton>
        </div>
        <span className={styles.monthLabel}>{MONTHS_LONG[viewMonth]}</span>
        <div className={styles.yearSelect}>
          <Select
            options={yearOptions}
            value={String(viewYear)}
            onChange={(v) => setViewYear(Number(v))}
            menuAlign="left"
            searchable
            searchPlaceholder="Year"
          />
        </div>
      </div>
      <div className={styles.titleRight}>
        <span className={styles.monthLabel}>{MONTHS_LONG[rightMonthValue]}</span>
        <div className={styles.yearSelect}>
          <Select
            options={rightYearOptions}
            value={String(rightMonthYear)}
            onChange={(v) => setViewYear(Number(v) - (rightMonthValue < viewMonth ? 1 : 0))}
            menuAlign="left"
            searchable
            searchPlaceholder="Year"
          />
        </div>
        <div className={styles.navPair}>
          <ActionButton size="S" tooltip="Next month" onClick={gotoNext}>
            <CalendarNextIcon size={16} />
          </ActionButton>
          <ActionButton size="S" tooltip="Next year" onClick={gotoNextYear}>
            <CalendarNextYearIcon size={16} />
          </ActionButton>
        </div>
      </div>
    </div>
  ) : (
    <div className={styles.header}>
      <div className={styles.titleLeft}>
        <span className={styles.monthLabel}>{MONTHS_LONG[viewMonth]}</span>
        <div className={styles.yearSelect}>
          <Select
            options={yearOptions}
            value={String(viewYear)}
            onChange={(v) => setViewYear(Number(v))}
            menuAlign="left"
            searchable
            searchPlaceholder="Year"
          />
        </div>
      </div>
      <div className={styles.titleRight}>
        <div className={styles.navPair}>
          <ActionButton size="S" tooltip="Previous month" onClick={gotoPrev}>
            <CalendarPrevIcon size={16} />
          </ActionButton>
          <ActionButton size="S" tooltip="Next month" onClick={gotoNext}>
            <CalendarNextIcon size={16} />
          </ActionButton>
        </div>
      </div>
    </div>
  );

  // No overlay: a click on another field closes the calendar and lands there.
  // Focus stays in the date field so typing a date keeps working.
  return (
    <Popover
      open={open && !!anchorRect}
      anchor={anchorRect}
      onOpenChange={() => onClose?.()}
      offset={6}
      overlay={false}
      initialFocus={false}
      role="group"
      aria-label="Choose a date"
      className={[
        styles.card,
        isRange ? styles.cardRange : '',
        !isRange && footer ? styles.cardWithFooter : '',
      ].filter(Boolean).join(' ')}
    >
      {header}
      {isRange ? (
        <>
          <div className={styles.twoUp}>
            {renderMonth(viewYear, viewMonth)}
            {renderMonth(rightMonthYear, rightMonthValue)}
          </div>
          {footer ? <div className={styles.slot}>{footer}</div> : null}
          <div className={styles.footer}>
            <Button variant="tertiary" size="S" onClick={handleClear}>Clear</Button>
            <Button variant="primary" size="S" onClick={handleSave}>Save</Button>
          </div>
        </>
      ) : (
        <>
          {renderMonth(viewYear, viewMonth)}
          {footer ? <div className={styles.slot}>{footer}</div> : null}
        </>
      )}
    </Popover>
  );
}

// ── One month grid ───────────────────────────────────────────────────

function MonthGrid({
  year, month, today, minDate, maxDate,
  selectedSingle, rangeStart, rangeEnd, pendingStart, previewStart, previewEnd,
  isRange, onPick, onHover, highlightedSet,
}) {
  const gridStart = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    return addDays(firstOfMonth, -firstOfMonth.getDay());
  }, [year, month]);

  const cells = useMemo(() => {
    // Render only as many full weeks as we need to cover the current
    // month. A month that fits in 5 rows drops the trailing 6th row
    // of pure next-month spillover so the grid isn't padded with
    // muted numbers that aren't clickable in context.
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rowsNeeded = Math.ceil((firstOfMonth.getDay() + daysInMonth) / 7);
    const total = rowsNeeded * 7;
    const out = [];
    for (let i = 0; i < total; i++) out.push(addDays(gridStart, i));
    return out;
  }, [gridStart, year, month]);

  const rangeMarkers = cells.map((d) => {
    if (!isRange) return null;
    const effectiveStart = previewStart || rangeStart;
    const effectiveEnd = previewEnd || rangeEnd;
    if (!effectiveStart || !effectiveEnd) return null;
    const s = stripTime(effectiveStart);
    const e = stripTime(effectiveEnd);
    if (sameDay(s, e)) return null;
    const day = stripTime(d);
    if (day < s || day > e) return null;
    if (sameDay(day, s)) return 'start';
    if (sameDay(day, e)) return 'end';
    return 'middle';
  });

  return (
    <div className={styles.month}>
      <div className={styles.dow}>
        {DOW_LETTERS.map((d, i) => (
          <span key={i} className={styles.dowCell}>{d}</span>
        ))}
      </div>
      <div className={styles.grid}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isSelectedSingle = selectedSingle && sameDay(d, selectedSingle);
          const isRangeStart = rangeStart && sameDay(d, rangeStart);
          const isRangeEnd = rangeEnd && sameDay(d, rangeEnd);
          const isPendingStart = isRange && pendingStart && sameDay(d, pendingStart);
          const isSelected = isSelectedSingle || isRangeStart || isRangeEnd || isPendingStart;
          const isToday = sameDay(d, today);
          const disabled = (minDate && d < stripTime(minDate)) || (maxDate && d > stripTime(maxDate));
          const marker = rangeMarkers[i];
          const cellCls = [
            styles.cell,
            marker === 'middle' ? styles.rangeMiddle : '',
            marker === 'start' ? styles.rangeStart : '',
            marker === 'end' ? styles.rangeEnd : '',
          ].filter(Boolean).join(' ');
          const isHighlighted = highlightedSet
            ? highlightedSet.has(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)
            : false;
          const dayCls = [
            styles.day,
            !inMonth ? styles.dayMuted : '',
            isSelected ? styles.daySelected : '',
            isToday && !isSelected ? styles.dayToday : '',
            isHighlighted && !isSelected ? styles.dayHighlighted : '',
            disabled ? styles.dayDisabled : '',
          ].filter(Boolean).join(' ');
          return (
            <div key={d.toDateString()} className={cellCls}>
              <button
                type="button"
                className={dayCls}
                disabled={disabled}
                onClick={() => onPick(d)}
                onMouseEnter={isRange && pendingStart ? () => onHover(d) : undefined}
              >
                {d.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function todayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function parseIsoLocal(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function isoFromLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function pickInitialFocusDate(value, isRange) {
  if (isRange) {
    const iso = value?.start || value?.end;
    return iso ? parseIsoLocal(iso) : todayLocal();
  }
  return value ? parseIsoLocal(value) : todayLocal();
}
