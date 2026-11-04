import { useMemo, useRef, useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { Select } from '../Select/Select';
import { Badge } from '../Badge/Badge';
import { SearchListPopover } from '../SearchListPopover/SearchListPopover';
import { Tabs } from '../Tabs/Tabs';
import { Calendar } from '../Calendar/Calendar';
import styles from './DateRangePopover.module.css';
import { isoFromLocal as toISO, parseLocalDate } from '../../lib/localDate';
import { yearSpan, monthSpan } from './yearSpan';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];



/**
 * Fold Health DateRangePopover: dual-month calendar with click-and-click
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
 *  - years      (boolean)              Adds a Years | Month & Year | Custom
 *                                       Dates switch (e.g. DOB): Years picks a
 *                                       From and To year, saved as Jan 1 to
 *                                       Dec 31; Month & Year picks a From and
 *                                       To month, saved as the 1st to the last
 *                                       day of the month; Custom Dates is the
 *                                       calendar, with a year jump.
 */
export function DateRangePopover({
  anchorRect,
  label,
  selected = [],
  onChange,
  onClose,
  width = 504,
  years = false,
}) {
  const today = useMemo(() => new Date(), []);
  // Open on the saved range when there is one (a 1950s DOB shouldn't start
  // on this month), else on last month | this month.
  const [viewL, setViewL] = useState(() => {
    const s = parseLocalDate(selected[0]);
    if (s) return { y: s.getFullYear(), m: s.getMonth() };
    return { y: today.getFullYear(), m: today.getMonth() === 0 ? 11 : today.getMonth() - 1 };
  });
  const [viewR, setViewR] = useState(() => {
    const s = parseLocalDate(selected[0]);
    return s ? stepMonth({ y: s.getFullYear(), m: s.getMonth() }, 1) : { y: today.getFullYear(), m: today.getMonth() };
  });
  const savedYears = yearSpan(selected);
  const savedMonths = savedYears ? null : monthSpan(selected);
  const [mode, setMode] = useState(() => {
    if (!years) return 'custom';
    if (savedYears || !selected.length) return 'years';
    return savedMonths ? 'months' : 'custom';
  });
  const [fromYear, setFromYear] = useState(savedYears ? String(savedYears[0]) : '');
  const [toYear, setToYear] = useState(savedYears ? String(savedYears[1]) : '');
  // Month & Year values are 'YYYY-MM'. With nothing saved they start on last
  // month to this month, so Apply works straight away.
  const [fromYM, setFromYM] = useState(() => (savedMonths ? ymKey(...savedMonths[0]) : defaultMonths(today)[0]));
  const [toYM, setToYM] = useState(() => (savedMonths ? ymKey(...savedMonths[1]) : defaultMonths(today)[1]));
  const monthYearOptions = useMemo(() => {
    const out = [];
    for (let i = today.getFullYear() * 12 + today.getMonth(); i >= (today.getFullYear() - YEAR_SPAN) * 12; i -= 1) {
      const y = Math.floor(i / 12);
      const m = i % 12;
      out.push({
        value: ymKey(y, m + 1),
        label: `${MONTH_NAMES[m]} ${y}`,
        searchText: `${MONTH_NAMES[m]} ${y} ${MONTH_NAMES[m].slice(0, 3)} ${y} ${pad2(m + 1)}/${y}`,
      });
    }
    return out;
  }, [today]);
  const yearOptions = useMemo(() => {
    const out = [];
    for (let y = today.getFullYear(); y >= today.getFullYear() - YEAR_SPAN; y -= 1) out.push({ value: String(y), label: String(y) });
    return out;
  }, [today]);

  const [start, setStart] = useState(() => parseLocalDate(selected[0]));
  const [end, setEnd]     = useState(() => parseLocalDate(selected[1]));
  const [hover, setHover] = useState(null);

  if (!anchorRect) return null;

  // Committed ends draw the range; with only a start, hovering previews it.
  const calendarRange = end
    ? { rangeStart: start, rangeEnd: end }
    : {
      pendingStart: start,
      previewStart: start && hover ? (hover < start ? hover : start) : undefined,
      previewEnd: start && hover ? (hover < start ? start : hover) : undefined,
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

  // The year dropdown in either month's title moves both months together.
  const setLeftYear = (y) => {
    const next = { y: Number(y), m: viewL.m };
    setViewL(next);
    setViewR(stepMonth(next, 1));
  };
  const setRightYear = (y) => {
    const next = { y: Number(y), m: viewR.m };
    setViewR(next);
    setViewL(stepMonth(next, -1));
  };
  const title = (view, onYear) => (
    <div className={styles.monthTitle}>
      <span>{MONTH_NAMES[view.m]}</span>
      {years ? (
        <YearBadge value={String(view.y)} options={yearOptions} onChange={onYear} />
      ) : (
        <span>{view.y}</span>
      )}
    </div>
  );

  const yearsReady = !!fromYear && !!toYear;
  const monthsReady = !!fromYM && !!toYM;
  const canApply = mode === 'years' ? yearsReady : mode === 'months' ? monthsReady : !!(start && end);

  const apply = () => {
    if (mode === 'years') {
      if (!yearsReady) return;
      const [lo, hi] = [Number(fromYear), Number(toYear)].sort((a, b) => a - b);
      onChange?.([`${lo}-01-01`, `${hi}-12-31`]);
      onClose?.();
      return;
    }
    if (mode === 'months') {
      if (!monthsReady) return;
      const [lo, hi] = [fromYM, toYM].sort().map(k => k.split('-').map(Number));
      const lastDay = new Date(hi[0], hi[1], 0).getDate();
      onChange?.([`${lo[0]}-${pad2(lo[1])}-01`, `${hi[0]}-${pad2(hi[1])}-${pad2(lastDay)}`]);
      onClose?.();
      return;
    }
    if (!start || !end) return;
    onChange?.([toISO(start), toISO(end)]);
    onClose?.();
  };

  const clear = () => {
    setStart(null);
    setEnd(null);
    setFromYear('');
    setToYear('');
    const [d0, d1] = defaultMonths(today);
    setFromYM(d0);
    setToYM(d1);
    onChange?.([]);
  };

  return (
    <Popover
      anchor={anchorRect}
      onOpenChange={() => onClose?.()}
      offset={6}
      width={width}
      role="group"
      aria-label={`Select ${label}`}
      className={styles.popover}
    >
      <div className={styles.heading}>Select {label}</div>

      {years && (
        <Tabs
          variant="pill"
          className={styles.modeTabs}
          items={[
            { key: 'years', label: 'Years' },
            { key: 'months', label: 'Month & Year' },
            { key: 'custom', label: 'Custom Dates' },
          ]}
          value={mode}
          onValueChange={setMode}
        />
      )}

      {mode === 'years' ? (
        <div className={styles.yearRow}>
          <Select label="From" searchable placeholder="Year" options={yearOptions} value={fromYear} onValueChange={setFromYear} />
          <Select label="To" searchable placeholder="Year" options={yearOptions} value={toYear} onValueChange={setToYear} />
        </div>
      ) : mode === 'months' ? (
        <div className={styles.yearRow}>
          <Select label="From" searchable searchPlaceholder="e.g. Apr 1958" placeholder="Month & Year" options={monthYearOptions} value={fromYM} onValueChange={setFromYM} />
          <Select label="To" searchable searchPlaceholder="e.g. Dec 1961" placeholder="Month & Year" options={monthYearOptions} value={toYM} onValueChange={setToYM} />
        </div>
      ) : (
      <div className={styles.calBody}>
        <div className={styles.month}>
          <div className={styles.calHeader}>
            <button type="button" className={styles.navBtn} onClick={() => stepView(-1)} aria-label="Previous month">
              <Icon name="solar:alt-arrow-left-linear" size={14} color="var(--neutral-300)" />
            </button>
            {title(viewL, setLeftYear)}
            <span className={styles.navSpacer} />
          </div>
          <Calendar
            mode="range"
            year={viewL.y}
            month={viewL.m}
            today={today}
            {...calendarRange}
            onPick={handleDayClick}
            onHover={setHover}
          />
        </div>
        <span className={styles.calDivider} />
        <div className={styles.month}>
          <div className={styles.calHeader}>
            <span className={styles.navSpacer} />
            {title(viewR, setRightYear)}
            <button type="button" className={styles.navBtn} onClick={() => stepView(1)} aria-label="Next month">
              <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-300)" />
            </button>
          </div>
          <Calendar
            mode="range"
            year={viewR.y}
            month={viewR.m}
            today={today}
            {...calendarRange}
            onPick={handleDayClick}
            onHover={setHover}
          />
        </div>
      </div>
      )}

      <div className={styles.footer}>
        <Button variant="outline" size="sm" onClick={clear}>Clear</Button>
        <Button size="sm" disabled={!canApply} onClick={apply}>
          Apply
        </Button>
      </div>
    </Popover>
  );
}

// The year in a month title: a Badge with a chevron that opens a searchable
// list of years. The badge keeps its size while the list is open.
function YearBadge({ value, options, onChange }) {
  const ref = useRef(null);
  const [rect, setRect] = useState(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.yearTrigger}
        aria-haspopup="listbox"
        aria-expanded={!!rect}
        aria-label={`Year: ${value}`}
        onClick={() => setRect(rect ? null : ref.current?.getBoundingClientRect() ?? null)}
      >
        <Badge variant="outline" size="md" label={value} chevron />
      </button>
      {rect && (
        <SearchListPopover
          anchorRect={rect}
          options={options}
          selected={value}
          width={120}
          searchPlaceholder="Year"
          onSelect={onChange}
          onClose={() => setRect(null)}
        />
      )}
    </>
  );
}

// How far back the year pickers go (birth years).
const YEAR_SPAN = 120;


function stepMonth(v, delta) {
  let m = v.m + delta;
  let y = v.y;
  if (m < 0)  { m = 11; y -= 1; }
  if (m > 11) { m = 0;  y += 1; }
  return { y, m };
}


function pad2(n) { return String(n).padStart(2, '0'); }

function ymKey(y, m) { return `${y}-${pad2(m)}`; } // m: 1–12

/** Last month and this month, as 'YYYY-MM' (January's last month is last December). */
function defaultMonths(today) {
  const prev = stepMonth({ y: today.getFullYear(), m: today.getMonth() }, -1);
  return [ymKey(prev.y, prev.m + 1), ymKey(today.getFullYear(), today.getMonth() + 1)];
}
