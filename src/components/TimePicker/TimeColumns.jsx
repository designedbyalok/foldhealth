import styles from '../DateTimePicker/DateTimePicker.module.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n) => String(n).padStart(2, '0');
const to12 = (h) => h % 12 || 12;

/**
 * TimeColumns — the scrolling Hr / Min (/ AM-PM) lists from the date-time
 * picker, on their own so DateTimePicker and TimePicker share one set.
 *
 * @param {object}   props
 * @param {number}   props.hour      – 0–23
 * @param {number}   props.minute    – 0–59
 * @param {function} props.onHour    – (hour 0–23) => void
 * @param {function} props.onMinute  – (minute) => void
 * @param {boolean}  [props.hour12]  – 12-hour lists plus an AM/PM column
 * @param {object}   [props.hourColRef] / [props.minColRef] – refs on the
 *   scrolling lists, for scrolling the picked item into view
 * @param {string}   [props.className] – Extra class on the section
 */
export function TimeColumns({ hour, minute, onHour, onMinute, hour12 = false, hourColRef, minColRef, className }) {
  return (
    <div className={[styles.timeColumnsSection, hour12 ? styles.timeColumns12 : '', className || ''].filter(Boolean).join(' ')}>
      <div className={styles.timeColsRow}>
        <div className={styles.timeColWrap}>
          <span className={styles.timeColLabel}>Hr</span>
          <div className={styles.timeCol} ref={hourColRef}>
            {hour12
              ? HOURS_12.map(h => (
                <button key={h} type="button" data-h={h}
                  className={`${styles.timeColItem} ${to12(hour) === h ? styles.timeColItemSelected : ''}`}
                  onClick={() => onHour((h % 12) + (hour >= 12 ? 12 : 0))}>
                  {pad(h)}
                </button>
              ))
              : HOURS.map(h => (
                <button key={h} type="button" data-h={h}
                  className={`${styles.timeColItem} ${hour === h ? styles.timeColItemSelected : ''}`}
                  onClick={() => onHour(h)}>
                  {pad(h)}
                </button>
              ))}
          </div>
        </div>
        <div className={styles.timeColWrap}>
          <span className={styles.timeColLabel}>Min</span>
          <div className={styles.timeCol} ref={minColRef}>
            {MINUTES.map(m => (
              <button key={m} type="button" data-m={m}
                className={`${styles.timeColItem} ${minute === m ? styles.timeColItemSelected : ''}`}
                onClick={() => onMinute(m)}>
                {pad(m)}
              </button>
            ))}
          </div>
        </div>
        {hour12 && (
          <div className={styles.timeColWrap}>
            <span className={styles.timeColLabel}>&nbsp;</span>
            <div className={styles.timeCol}>
              {['AM', 'PM'].map(p => (
                <button key={p} type="button"
                  className={`${styles.timeColItem} ${(hour >= 12) === (p === 'PM') ? styles.timeColItemSelected : ''}`}
                  onClick={() => onHour((hour % 12) + (p === 'PM' ? 12 : 0))}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
