import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarIcon } from '../Icon/CalendarIcon';
import { ActionButton } from '../ActionButton/ActionButton';
import { parsePickerValue } from './parsePickerValue';
import inputStyles from '../Input/Input.module.css';
import styles from './DateTimePicker.module.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n) => String(n).padStart(2, '0');

const toDate = (mmddyyyy) => {
  const [mm, dd, yyyy] = mmddyyyy.split('/');
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
};

/**
 * Date + time in one popover: a month calendar beside scrolling hour and
 * minute columns, with Reset and Save. The value is a string,
 * "MM/DD/YYYY, HH:MM" (24-hour); Save calls `onChange` with it.
 *
 * @param {object}   props
 * @param {string}   [props.value]       – "MM/DD/YYYY, HH:MM", or '' when unset
 * @param {function} props.onChange      – (value) => void
 * @param {string}   [props.label]       – Field label above the trigger
 * @param {boolean}  [props.required]    – Red dot after the label (field chrome comes from Input)
 * @param {string}   [props.placeholder='MM/DD/YYYY, HH:MM']
 * @param {string}   [props.errorText]   – Red border and message below
 * @param {Date}     [props.minDate]     – Days before this can't be picked
 * @param {boolean}  [props.fullWidth]   – Fill the container instead of 200px
 * @param {string}   [props.className]   – Extra class on the trigger box
 * @param {boolean}  [props.disabled]    – Shown but not changeable
 * @param {string}   [props.helperText]  – Grey note below (e.g. why it's disabled); an error replaces it
 * @param {boolean}  [props.hour12]      – Show and pick 12-hour time with AM/PM ("10/01/2026, 09:30AM");
 *   the value stays 24-hour
 * @param {boolean}  [props.invalid]     – Red border with no message of its own (e.g. a problem
 *   with this field and another, explained once below both)
 * @param {boolean}  [props.autoCommit]  – Apply each pick (day, hour, minute, AM/PM) at once,
 *   with no Reset / Save footer; clicking outside closes it
 */
export function DateTimePicker({ value, onChange, label, required = false, placeholder = 'MM/DD/YYYY, HH:MM', errorText, minDate, fullWidth = false, className, disabled = false, helperText, hour12 = false, autoCommit = false, invalid = false }) {
  const id = useId();
  const parsed = parsePickerValue(value);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null); // the trigger's box, measured on open
  const [viewDate, setViewDate] = useState(() => (parsed.date ? toDate(parsed.date) : new Date()));
  const [selectedDate, setSelectedDate] = useState(parsed.date);
  const [pickerHour, setPickerHour] = useState(parsed.hour);
  const [pickerMinute, setPickerMinute] = useState(parsed.minute);
  const triggerRef = useRef(null);
  const hourColRef = useRef(null);
  const minColRef = useRef(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const minDay = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime() : null;

  const to12 = (h) => h % 12 || 12;
  const scrollToTime = (h, m) => {
    setTimeout(() => {
      hourColRef.current?.querySelector(`[data-h="${hour12 ? to12(h) : h}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      minColRef.current?.querySelector(`[data-m="${m}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
  };

  const handleReset = () => {
    const p = parsePickerValue(value);
    setSelectedDate(p.date);
    setPickerHour(p.hour);
    setPickerMinute(p.minute);
    if (p.date) setViewDate(toDate(p.date));
    scrollToTime(p.hour, p.minute);
  };

  // autoCommit: each pick is applied as soon as there's a day to go with it.
  const commit = (date, h, m) => {
    if (autoCommit && date) onChange(`${date}, ${pad(h)}:${pad(m)}`);
  };
  const pickDay = (key) => { setSelectedDate(key); commit(key, pickerHour, pickerMinute); };
  const pickHour = (h) => { setPickerHour(h); commit(selectedDate, h, pickerMinute); };
  const pickMinute = (m) => { setPickerMinute(m); commit(selectedDate, pickerHour, m); };

  const handleOk = () => {
    if (!selectedDate) return;
    onChange(`${selectedDate}, ${pad(pickerHour)}:${pad(pickerMinute)}`);
    setOpen(false);
  };

  const box = (
    <div
      ref={triggerRef}
      className={[inputStyles.shell, styles.dateInputWrap, fullWidth ? styles.fullWidth : '', errorText || invalid ? inputStyles.shellError : '', disabled ? `${inputStyles.shellDisabled} ${styles.isDisabled}` : '', className || ''].filter(Boolean).join(' ')}
    >
      <button
        id={id}
        className={styles.datePickerTrigger}
        onClick={() => { setRect(triggerRef.current?.getBoundingClientRect() || null); setOpen(v => !v); }}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={errorText || invalid ? true : undefined}
      >
        <span className={value ? styles.datePickerText : styles.datePickerPlaceholder}>
          {value && hour12 && parsed.date
            ? `${parsed.date}, ${pad(to12(parsed.hour))}:${pad(parsed.minute)}${parsed.hour < 12 ? 'AM' : 'PM'}`
            : value || placeholder}
        </span>
        <CalendarIcon size={16} color={disabled ? 'var(--neutral-150)' : 'var(--neutral-300)'} />
      </button>

      {open && createPortal(
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
          <div
            className={styles.dateTimeDropdown}
            role="dialog"
            aria-label={label || 'Pick a date and time'}
            style={{ top: rect ? rect.bottom + 4 : 0, right: rect ? window.innerWidth - rect.right : 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.dtPickerBody}>
              <div className={styles.calendarSection}>
                <div className={styles.calendarHeader}>
                  <ActionButton icon="solar:alt-arrow-left-linear" size="S" tooltip="Previous month"
                    onClick={() => setViewDate(new Date(year, month - 1, 1))} />
                  <span className={styles.calendarTitle}>{MONTH_NAMES[month]} {year}</span>
                  <ActionButton icon="solar:alt-arrow-right-linear" size="S" tooltip="Next month"
                    onClick={() => setViewDate(new Date(year, month + 1, 1))} />
                </div>
                <div className={styles.calendarGrid}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className={styles.calendarDayLabel}>{d}</div>
                  ))}
                  {days.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const key = `${pad(month + 1)}/${pad(d)}/${year}`;
                    const disabled = minDay != null && new Date(year, month, d).getTime() < minDay;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={disabled}
                        className={`${styles.calendarDay} ${selectedDate === key ? styles.calendarDaySelected : ''}`}
                        onClick={() => pickDay(key)}
                      >{d}</button>
                    );
                  })}
                </div>
              </div>

              <div className={hour12 ? `${styles.timeColumnsSection} ${styles.timeColumns12}` : styles.timeColumnsSection}>
                <div className={styles.timeColsRow}>
                  <div className={styles.timeColWrap}>
                    <span className={styles.timeColLabel}>Hr</span>
                    <div className={styles.timeCol} ref={hourColRef}>
                      {hour12
                        ? HOURS_12.map(h => (
                          <button key={h} type="button" data-h={h}
                            className={`${styles.timeColItem} ${to12(pickerHour) === h ? styles.timeColItemSelected : ''}`}
                            onClick={() => pickHour((h % 12) + (pickerHour >= 12 ? 12 : 0))}>
                            {pad(h)}
                          </button>
                        ))
                        : HOURS.map(h => (
                          <button key={h} type="button" data-h={h}
                            className={`${styles.timeColItem} ${pickerHour === h ? styles.timeColItemSelected : ''}`}
                            onClick={() => pickHour(h)}>
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
                          className={`${styles.timeColItem} ${pickerMinute === m ? styles.timeColItemSelected : ''}`}
                          onClick={() => pickMinute(m)}>
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
                            className={`${styles.timeColItem} ${(pickerHour >= 12) === (p === 'PM') ? styles.timeColItemSelected : ''}`}
                            onClick={() => pickHour((pickerHour % 12) + (p === 'PM' ? 12 : 0))}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {!autoCommit && (
              <div className={styles.pickerFooter}>
                <button type="button" className={styles.nowBtn} onClick={handleReset}>Reset</button>
                <button type="button"
                  className={`${styles.okBtn} ${!selectedDate ? styles.okBtnDisabled : ''}`}
                  onClick={handleOk} disabled={!selectedDate}>Save</button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );

  if (!label && !errorText && !helperText) return box;
  return (
    <div className={`${inputStyles.field} ${styles.field}`}>
      {label && (
        <label htmlFor={id} className={inputStyles.label}>
          <span className={inputStyles.labelText}>{label}</span>
          {required && <span className={inputStyles.required} aria-hidden="true" />}
        </label>
      )}
      {box}
      {errorText
        ? <span className={inputStyles.errorText}>{errorText}</span>
        : helperText && <span className={inputStyles.helperText}>{helperText}</span>}
    </div>
  );
}
