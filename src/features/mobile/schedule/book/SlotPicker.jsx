import { useMemo, useState } from 'react';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { minutesToTime } from '../../../calendar/openSlots';
import { isoOfDate } from './scheduling';
import styles from './SlotPicker.module.css';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const timeText = (min) => minutesToTime(min).toUpperCase();

/**
 * Date and Time cards of the booking screen (Figma 1082:58707): a month
 * calendar whose bar under each day says whether it has open slots, then that
 * day's open start times. Slots come from `slotsOn` (openSlots), so the
 * provider's availability, time off, holidays, other bookings and the
 * 15-minute lead are all respected.
 *
 * @param {object}   props
 * @param {string}   props.date            – picked ISO day, or ''
 * @param {number|null} props.minutes      – picked start, minutes from midnight
 * @param {(iso: string) => {minutes: number}[]} props.slotsOn
 * @param {(iso: string) => string} props.whyNone
 * @param {(next: { date: string, minutes: number|null }) => void} props.onChange
 * @param {number}   props.durationMin
 * @param {string}   [props.blockedText]   – shown instead of slots (e.g. no provider yet)
 */
export function SlotPicker({ date, minutes, slotsOn, whyNone, onChange, durationMin, blockedText }) {
  const [month, setMonth] = useState(() => {
    const base = date ? new Date(`${date}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const todayIso = isoOfDate(new Date());
  const thisMonth = new Date();
  const atFirstMonth = month.getFullYear() === thisMonth.getFullYear() && month.getMonth() === thisMonth.getMonth();

  const weeks = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = isoOfDate(d);
      const inMonth = d.getMonth() === month.getMonth();
      const past = iso < todayIso;
      const open = !blockedText && inMonth && !past ? slotsOn(iso).length : 0;
      return { iso, day: d.getDate(), inMonth, past, open };
    });
    const rows = [];
    for (let i = 0; i < 42; i += 7) rows.push(cells.slice(i, i + 7));
    // A trailing week wholly in the next month adds nothing.
    return rows.filter(r => r.some(c => c.inMonth));
  }, [month, slotsOn, todayIso, blockedText]);

  const daySlots = useMemo(() => (date && !blockedText ? slotsOn(date) : []), [date, slotsOn, blockedText]);
  const shift = (n) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className={styles.wrap}>
      <section className={styles.card} aria-label="Date">
        <h3 className={styles.cardTitle}>Date</h3>
        <div className={styles.monthRow}>
          <span className={styles.month}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          <ActionButton size="lg" icon="solar:alt-arrow-left-linear" aria-label="Previous month" disabled={atFirstMonth} onClick={() => shift(-1)} />
          <ActionButton size="lg" icon="solar:alt-arrow-right-linear" aria-label="Next month" onClick={() => shift(1)} />
        </div>
        <div className={styles.grid} role="grid">
          <div className={styles.week} role="row">
            {DOW.map((d, i) => <span key={i} className={styles.dow} role="columnheader">{d}</span>)}
          </div>
          {weeks.map(w => (
            <div key={w[0].iso} className={styles.week} role="row">
              {w.map((c) => {
                const state = !c.inMonth || c.past ? 'off' : c.open ? 'open' : 'none';
                const picked = c.iso === date;
                const label = new Date(`${c.iso}T00:00:00`).toDateString();
                return (
                  <button
                    key={c.iso}
                    type="button"
                    role="gridcell"
                    className={[styles.day, styles[state], picked ? styles.picked : ''].join(' ')}
                    aria-selected={picked}
                    aria-label={state === 'open' ? `${label}, ${c.open} open slots` : `${label}, ${state === 'off' ? 'unavailable' : (whyNone(c.iso) || 'no open slots')}`}
                    disabled={state !== 'open'}
                    onClick={() => onChange({ date: c.iso, minutes: null })}
                  >
                    <span className={styles.num}>{c.day}</span>
                    <span className={styles.bar} aria-hidden="true"><span className={styles.barFill} /></span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      <section className={styles.card} aria-label="Time">
        <div className={styles.timeHead}>
          <h3 className={styles.cardTitle}>Time</h3>
          {!date || blockedText ? (
            <p className={styles.hint}>{blockedText || 'Select a date to see slots'}</p>
          ) : daySlots.length === 0 ? (
            <p className={styles.hint}>{whyNone(date)}</p>
          ) : (
            <p className={styles.hint}>Open slots ({durationMin} min)</p>
          )}
        </div>
        {daySlots.length > 0 && (
          <div className={styles.slots} role="radiogroup" aria-label="Open slots">
            {daySlots.map(s => (
              <button
                key={s.minutes}
                type="button"
                role="radio"
                aria-checked={s.minutes === minutes}
                className={[styles.slot, s.minutes === minutes ? styles.slotPicked : ''].join(' ')}
                onClick={() => onChange({ date, minutes: s.minutes })}
              >
                {timeText(s.minutes)}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
