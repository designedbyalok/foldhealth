import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { TimeColumns } from './TimeColumns';
import inputStyles from '../Input/Input.module.css';
import dtStyles from '../DateTimePicker/DateTimePicker.module.css';
import styles from './TimePicker.module.css';

const pad = (n) => String(n).padStart(2, '0');

// The popover's size (CSS: 15rem columns + frame), for keeping it on screen.
const POP_H = 248;
const POP_W = 168;
const GAP = 4;

/** Open below the field, or above it when there isn't room; never off the side. */
const placement = (rect) => {
  if (!rect) return { top: 0, left: 0 };
  const left = Math.max(GAP, Math.min(rect.left, window.innerWidth - POP_W - GAP));
  const roomBelow = window.innerHeight - rect.bottom;
  return roomBelow >= POP_H + GAP * 2 || roomBelow >= rect.top
    ? { top: rect.bottom + GAP, left }
    : { bottom: window.innerHeight - rect.top + GAP, left };
};

/** "09:30" → { hour: 9, minute: 30 }; '' → null. */
const parse = (v) => {
  const [h, m] = String(v || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? { hour: h, minute: m } : null;
};

/** "13:05" → "1:05 PM". */
const formatTime12 = (v) => {
  const t = parse(v);
  if (!t) return '';
  return `${t.hour % 12 || 12}:${pad(t.minute)} ${t.hour >= 12 ? 'PM' : 'AM'}`;
};

/**
 * TimePicker — a time field that opens the date-time picker's Hr / Min /
 * AM-PM columns (no calendar). Each pick applies at once; clicking outside
 * closes it. Use instead of `<input type="time">`, whose own picker doesn't
 * open in every browser (none on Mac Chrome).
 *
 * @param {object}   props
 * @param {string}   [props.value]        – "HH:MM" (24-hour), or '' when unset
 * @param {function} props.onChange       – ("HH:MM") => void
 * @param {string}   [props.label]        – Field label above the trigger
 * @param {boolean}  [props.required]     – Red dot after the label
 * @param {string}   [props.placeholder='Select time']
 * @param {string}   [props.errorText]    – Red border and message below
 * @param {boolean}  [props.disabled]
 * @param {boolean}  [props.hour12=true]  – 12-hour columns with AM/PM
 * @param {string}   [props.defaultTime]  – "HH:MM" the lists open at when there's
 *   no value yet (e.g. an end time opens at its start time); 09:00 otherwise
 * @param {string}   [props.className]    – Extra class on the trigger box
 * @param {string}   [props.wrapperClassName] – Extra class on the outer field
 * @param {string}   [props['aria-label']]
 */
export function TimePicker({
  value, onChange, label, required = false, placeholder = 'Select time', errorText, disabled = false,
  hour12 = true, defaultTime, className, wrapperClassName, 'aria-label': ariaLabel,
}) {
  const id = useId();
  const t = parse(value);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const boxRef = useRef(null);
  const hourColRef = useRef(null);
  const minColRef = useRef(null);
  // Nothing picked yet: the lists start at defaultTime, else 9:00 AM.
  const start = parse(defaultTime);
  const hour = t?.hour ?? start?.hour ?? 9;
  const minute = t?.minute ?? start?.minute ?? 0;

  // On open, bring the current hour and minute into view.
  useEffect(() => {
    if (!open) return;
    const k = setTimeout(() => {
      hourColRef.current?.querySelector(`[data-h="${hour12 ? hour % 12 || 12 : hour}"]`)?.scrollIntoView({ block: 'center' });
      minColRef.current?.querySelector(`[data-m="${minute}"]`)?.scrollIntoView({ block: 'center' });
    }, 0);
    return () => clearTimeout(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const emit = (h, m) => onChange?.(`${pad(h)}:${pad(m)}`);

  const box = (
    <div
      ref={boxRef}
      className={[inputStyles.shell, styles.box, errorText ? inputStyles.shellError : '', disabled ? inputStyles.shellDisabled : '', className || ''].filter(Boolean).join(' ')}
    >
      <button
        id={id}
        type="button"
        className={dtStyles.datePickerTrigger}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setRect(boxRef.current?.getBoundingClientRect() || null); setOpen(v => !v); }}
      >
        <span className={t ? dtStyles.datePickerText : dtStyles.datePickerPlaceholder}>
          {t ? (hour12 ? formatTime12(value) : `${pad(t.hour)}:${pad(t.minute)}`) : placeholder}
        </span>
        <Icon name="solar:clock-circle-linear" size={16} color={disabled ? 'var(--neutral-150)' : 'var(--neutral-300)'} />
      </button>

      {open && createPortal(
        <div className={dtStyles.backdrop} onClick={() => setOpen(false)}>
          <div
            className={`${dtStyles.dateTimeDropdown} ${styles.dropdown}`}
            role="dialog"
            aria-label={label || ariaLabel || 'Pick a time'}
            style={placement(rect)}
            onClick={e => e.stopPropagation()}
          >
            <TimeColumns
              hour={hour}
              minute={minute}
              hour12={hour12}
              hourColRef={hourColRef}
              minColRef={minColRef}
              onHour={(h) => emit(h, minute)}
              onMinute={(m) => emit(hour, m)}
              className={styles.columns}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );

  if (!label && !errorText) return <div className={wrapperClassName}>{box}</div>;
  return (
    <div className={[inputStyles.field, wrapperClassName || ''].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={id} className={inputStyles.label}>
          <span className={inputStyles.labelText}>{label}</span>
          {required && <span className={inputStyles.required} aria-hidden="true" />}
        </label>
      )}
      {box}
      {errorText && <span className={inputStyles.errorText}>{errorText}</span>}
    </div>
  );
}
