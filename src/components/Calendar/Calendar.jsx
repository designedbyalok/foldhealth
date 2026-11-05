import { forwardRef, useMemo, useRef } from 'react';
import { Tooltip } from '../Tooltip/Tooltip';
import { addDays, isoFromLocal, sameDay, startOfDay } from '../../lib/localDate';
import styles from './Calendar.module.css';

const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LONG_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/**
 * Calendar: one month of days (Figma Fold-Pixel-1.0 nodes 8646:12168 and
 * 8654:12785). The grid only: the popover around it owns the month / year
 * navigation, the two-month layout and Save / Clear. `DatePickerPopover`
 * builds the single and range pickers from it.
 *
 * Shows the weeks the month needs (5 or 6), with the neighbouring months'
 * days muted. In range mode a pale strip runs under the days between the
 * ends, previewed while the second end is being chosen.
 *
 * Keyboard: the picked day (else today, else the first open day) is the tab
 * stop; Left / Right move a day, Up / Down a week, Home / End to the ends of
 * the week; Enter or Space picks.
 *
 * @param {object} props
 * @param {number} props.year
 * @param {number} props.month – 0-based
 * @param {(day: Date) => void} props.onPick
 * @param {'single'|'range'} [props.mode='single']
 * @param {Date} [props.selected] – single mode
 * @param {Date} [props.rangeStart] / [props.rangeEnd] – range mode, committed ends
 * @param {Date} [props.pendingStart] – range mode, first end picked, second pending
 * @param {Date} [props.previewStart] / [props.previewEnd] – range mode, hover preview
 * @param {(day: Date) => void} [props.onHover] – range mode, while a second end is pending
 * @param {Date} [props.min] / [props.max] – days outside are disabled
 * @param {(iso: string) => boolean|string} [props.isDayDisabled] – true or a reason (shown as a tooltip)
 * @param {Set<string>} [props.highlighted] – 'YYYY-M-D' keys tinted grey (e.g. future recurrences)
 * @param {Date} [props.today]
 */
export const Calendar = forwardRef(function Calendar({
  year, month, onPick, mode = 'single', selected, rangeStart, rangeEnd, pendingStart,
  previewStart, previewEnd, onHover, min, max, isDayDisabled, highlighted, today = startOfDay(new Date()),
  className, ...rest
}, ref) {
  const isRange = mode === 'range';
  const cells = useMemo(() => {
    // Only as many full weeks as the month needs, so a 5-row month isn't
    // padded with a row of next-month days.
    const first = new Date(year, month, 1);
    const gridStart = addDays(first, -first.getDay());
    const days = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((first.getDay() + days) / 7) * 7;
    return Array.from({ length: total }, (_, i) => addDays(gridStart, i));
  }, [year, month]);

  const minDay = min && startOfDay(min);
  const maxDay = max && startOfDay(max);
  const info = cells.map((d) => {
    const blocked = isDayDisabled ? isDayDisabled(isoFromLocal(d)) : false;
    const isSelected = (selected && sameDay(d, selected))
      || (rangeStart && sameDay(d, rangeStart)) || (rangeEnd && sameDay(d, rangeEnd))
      || (isRange && pendingStart && sameDay(d, pendingStart));
    return {
      d,
      isSelected: !!isSelected,
      disabled: (minDay && d < minDay) || (maxDay && d > maxDay) || !!blocked,
      reason: typeof blocked === 'string' ? blocked : '',
    };
  });

  const marker = (d) => {
    if (!isRange) return null;
    const s = previewStart || rangeStart;
    const e = previewEnd || rangeEnd;
    if (!s || !e || sameDay(s, e)) return null;
    const day = startOfDay(d);
    if (day < startOfDay(s) || day > startOfDay(e)) return null;
    if (sameDay(day, s)) return 'start';
    if (sameDay(day, e)) return 'end';
    return 'middle';
  };

  // One tab stop: the pick, else today, else the first open day of the month.
  const inMonthOpen = (i) => info[i].d.getMonth() === month && !info[i].disabled;
  const stop = [
    info.findIndex(c => c.isSelected && !c.disabled),
    info.findIndex((c, i) => sameDay(c.d, today) && inMonthOpen(i)),
    info.findIndex((c, i) => inMonthOpen(i)),
  ].find(i => i >= 0);

  const buttons = useRef([]);
  const onKeyDown = (e) => {
    const at = buttons.current.indexOf(document.activeElement);
    if (at === -1) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let next;
    if (step !== undefined) next = at + step;
    else if (e.key === 'Home') next = at - (at % 7);
    else if (e.key === 'End') next = at - (at % 7) + 6;
    else return;
    e.preventDefault();
    // Skip over disabled days in the direction of travel.
    const dir = Math.sign(next - at) || 1;
    while (next >= 0 && next < info.length && info[next].disabled) next += dir;
    if (next >= 0 && next < info.length) buttons.current[next]?.focus();
  };

  return (
    <div ref={ref} className={[styles.month, className].filter(Boolean).join(' ')} {...rest}>
      <div className={styles.dow} aria-hidden="true">
        {DOW_LETTERS.map((d, i) => <span key={i} className={styles.dowCell}>{d}</span>)}
      </div>
      <div className={styles.grid} role="group" onKeyDown={onKeyDown}>
        {info.map(({ d, isSelected, disabled, reason }, i) => {
          const m = marker(d);
          const isHighlighted = highlighted?.has(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
          const day = (
            <button
              ref={(el) => { buttons.current[i] = el; }}
              type="button"
              tabIndex={i === stop ? 0 : -1}
              aria-label={LONG_DATE.format(d)}
              aria-pressed={isSelected}
              className={[
                styles.day,
                d.getMonth() !== month ? styles.dayMuted : '',
                isSelected ? styles.daySelected : '',
                sameDay(d, today) && !isSelected ? styles.dayToday : '',
                isHighlighted && !isSelected ? styles.dayHighlighted : '',
                disabled ? styles.dayDisabled : '',
              ].filter(Boolean).join(' ')}
              disabled={disabled}
              onClick={() => onPick(d)}
              onMouseEnter={isRange && pendingStart && onHover ? () => onHover(d) : undefined}
            >
              {d.getDate()}
            </button>
          );
          return (
            <div
              key={d.toDateString()}
              className={[styles.cell, m === 'middle' ? styles.rangeMiddle : '', m === 'start' ? styles.rangeStart : '', m === 'end' ? styles.rangeEnd : ''].filter(Boolean).join(' ')}
            >
              {/* A disabled button gets no hover, so its wrapper carries the tooltip. */}
              {reason ? <Tooltip label={reason} maxWidth={220}><span className={styles.dayBlocked}>{day}</span></Tooltip> : day}
            </div>
          );
        })}
      </div>
    </div>
  );
});
