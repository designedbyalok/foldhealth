import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { CalendarPrevIcon } from '../../../components/Icon/CalendarPrevIcon';
import { CalendarNextIcon } from '../../../components/Icon/CalendarNextIcon';
import styles from './SelectNewDosPopover.module.css';

/**
 * "Select New DOS" calendar popover: the second view of the DOS Select in
 * the +ICD IcdCard flow. Opens where the DOS dropdown was and slides in
 * from the right on top of the Select's list, with a back arrow that
 * dismisses this view without picking a date.
 *
 * Props:
 *   open        boolean
 *   anchorRect  DOMRect of the DOS field wrapper (drives width + position)
 *   onBack      user clicked ← (closes the popover, list re-opens on next click)
 *   onSelect    (iso YYYY-MM-DD) => void: picks the date and closes
 *   max         ISO YYYY-MM-DD: dates past this are disabled (defaults to today)
 */
export function SelectNewDosPopover({ open, anchorRect, onBack, onSelect, max }) {
  const today = todayLocal();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const cardRef = useRef(null);
  const [placement, setPlacement] = useState({ top: 0, left: 0, width: 320 });

  useEffect(() => {
    if (!open) return;
    // Reset the viewed month to "today" each time the popover opens so
    // repeatedly picking + ICD doesn't strand the user on some past month.
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchorRect || !cardRef.current) return;
    const card = cardRef.current.getBoundingClientRect();
    const GAP = 6;
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const flipUp = spaceBelow < card.height + GAP && anchorRect.top > card.height + GAP;
    const top = flipUp ? anchorRect.top - card.height - GAP : anchorRect.bottom + GAP;
    let left = anchorRect.left;
    // The popover matches the anchor's width so the two views (Select list
    // and calendar) share the same footprint; nudge horizontally if it
    // would overflow.
    if (left + card.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - card.width - 8);
    }
    setPlacement({ top, left, width: Math.max(280, anchorRect.width) });
  }, [open, anchorRect]);

  // Deferred mousedown arming (skips the in-flight opening click); teardown
  // clears the timer AND removes the listener either way, the scanner's
  // cleanup matcher can't see through the setTimeout indirection.
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onBack?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onBack?.(); };
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onBack]);

  const maxDate = useMemo(() => (max ? parseIsoLocal(max) : null), [max]);

  const stepMonth = (n) => {
    const d = new Date(viewYear, viewMonth + n, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const handlePick = (d) => {
    if (maxDate && d > maxDate) return;
    onSelect?.(isoFromLocal(d));
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={cardRef}
      className={styles.card}
      style={{ top: placement.top, left: placement.left, width: placement.width }}
      role="group"
      aria-label="Select New DOS"
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={onBack}
          aria-label="Back to DOS list"
        >
          <Icon name="solar:alt-arrow-left-linear" size={16} color="var(--neutral-400)" />
        </button>
        <span className={styles.title}>Select New DOS</span>
      </div>

      <div className={styles.monthNav}>
        <ActionButton size="sm" tooltip="Previous month" onClick={() => stepMonth(-1)}>
          <CalendarPrevIcon size={16} />
        </ActionButton>
        <span className={styles.monthLabel}>
          {MONTHS_LONG[viewMonth]} {viewYear}
        </span>
        <ActionButton size="sm" tooltip="Next month" onClick={() => stepMonth(1)}>
          <CalendarNextIcon size={16} />
        </ActionButton>
      </div>

      <div className={styles.dowRow}>
        {DAYS_OF_WEEK.map((d) => (
          <span key={d} className={styles.dow}>{d}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((c, idx) => {
          const isToday = isSameDay(c.date, today);
          const disabled = !!(maxDate && c.date > maxDate);
          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              className={[
                styles.cell,
                c.outside ? styles.cellOutside : '',
                isToday ? styles.cellToday : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handlePick(c.date)}
            >
              {c.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

// ── Date helpers ────────────────────────────────────────────────────────

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Build a 6-row × 7-col grid so the layout stays stable across months.
// Starts on Sunday.
function buildMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const gridStart = new Date(year, month, 1 - startDow);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, outside: d.getMonth() !== month });
  }
  return cells;
}
