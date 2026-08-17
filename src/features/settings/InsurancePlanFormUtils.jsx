import { useState, useRef, useEffect } from 'react';
import { sanitizeRichText } from '../../lib/sanitizeHtml';
import { Icon } from '../../components/Icon/Icon';
import { Input } from '../../components/Input/Input';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import styles from './InsurancePlanFormUtils.module.css';

/* ── FieldLabel — label row with optional required dot and info-icon tooltip ── */
export function FieldLabel({ children, required, info }) {
  return (
    <div className={styles.label}>
      {children}
      {required && <span className={styles.required} />}
      {info && (
        <Tooltip label={info} maxWidth={260}>
          <button type="button" className={styles.infoBtn} aria-label="More information">
            <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-200)" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/* ── PrefixInput — Input with an inline leading symbol (e.g. "$") ── */
export function PrefixInput({ prefix, ...inputProps }) {
  return (
    <div className={styles.prefixInputWrap}>
      <span className={styles.prefixSymbol}>{prefix}</span>
      <Input className={styles.prefixInputField} {...inputProps} />
    </div>
  );
}

/* ── DateRangePicker — Fold-styled start→end calendar (matches Figma 2006:121957) ── */
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s) => (s ? new Date(`${s}T00:00:00`) : null);
const fmtDisplay = (d) => (d ? `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}` : '');
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function DateRangePicker({
  startDate, endDate, onChange,
  startPlaceholder = 'Plan Start Date',
  endPlaceholder = 'Plan End Date',
}) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState('start'); // which segment is being picked
  const wrapRef = useRef(null);
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const [viewDate, setViewDate] = useState(() => start || new Date());

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openPicker = (seg) => {
    setSelecting(seg);
    setOpen(true);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const handleDayClick = (day) => {
    const clicked = new Date(year, month, day);
    if (selecting === 'start') {
      // set start, clear end if now invalid, then move selection to end
      const newEnd = end && clicked <= end ? endDate : '';
      onChange({ start: toISO(clicked), end: newEnd });
      setSelecting('end');
    } else {
      if (start && clicked < start) {
        // clicked before start → restart the range from here
        onChange({ start: toISO(clicked), end: '' });
        setSelecting('end');
      } else {
        onChange({ start: startDate, end: toISO(clicked) });
        setOpen(false);
      }
    }
  };

  const activeStart = open && selecting === 'start';
  const activeEnd = open && selecting === 'end';

  return (
    <div className={styles.rangeWrap} ref={wrapRef}>
      <button type="button" className={styles.rangeTrigger} onClick={() => openPicker(start && !end ? 'end' : 'start')}>
        <span
          className={`${start ? styles.rangeValue : styles.rangePlaceholder} ${activeStart ? styles.rangeSegActive : ''}`}
          onClick={(e) => { e.stopPropagation(); openPicker('start'); }}
        >
          {start ? fmtDisplay(start) : startPlaceholder}
        </span>
        <Icon name="solar:arrow-right-linear" size={14} color="var(--neutral-200)" />
        <span
          className={`${end ? styles.rangeValue : styles.rangePlaceholder} ${activeEnd ? styles.rangeSegActive : ''}`}
          onClick={(e) => { e.stopPropagation(); openPicker('end'); }}
        >
          {end ? fmtDisplay(end) : endPlaceholder}
        </span>
        <Icon name="solar:calendar-linear" size={16} color="var(--neutral-300)" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div className={styles.calPopover}>
          <div className={styles.calHeader}>
            <button type="button" className={styles.calNav} onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Previous month">
              <Icon name="solar:alt-arrow-left-linear" size={16} color="var(--neutral-300)" />
            </button>
            <span className={styles.calTitle}>{MONTH_NAMES[month]} {year}</span>
            <button type="button" className={styles.calNav} onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Next month">
              <Icon name="solar:alt-arrow-right-linear" size={16} color="var(--neutral-300)" />
            </button>
          </div>
          <div className={styles.calGrid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={`l${i}`} className={styles.calDayLabel}>{d}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const cur = new Date(year, month, day);
              const isStart = sameDay(cur, start);
              const isEnd = sameDay(cur, end);
              const inRange = start && end && cur > start && cur < end;
              const cls = [
                styles.calDay,
                (isStart || isEnd) ? styles.calDayEndpoint : '',
                inRange ? styles.calDayInRange : '',
              ].filter(Boolean).join(' ');
              return (
                <button key={`d${i}`} type="button" className={cls} onClick={() => handleDayClick(day)}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CollapsibleSection — reusable accordion card used by each form section ── */
export function CollapsibleSection({ icon, title, children }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={styles.sectionCard}>
      <div
        className={`${styles.sectionHeader} ${collapsed ? styles.collapsed : ''}`}
        onClick={() => setCollapsed(v => !v)}
      >
        <Icon name={icon} size={16} color="var(--primary-300)" />
        <span className={styles.sectionTitle}>{title}</span>
        <Icon
          name={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'}
          size={12}
          color="var(--neutral-300)"
        />
      </div>
      <div className={`${styles.collapseOuter} ${collapsed ? styles.collapsed : ''}`}>
        <div className={styles.collapseInner}>
          <div className={styles.sectionBody}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── RichTextNote — contenteditable field with B/I/U toolbar and char counter ── */
export function RichTextNote({ value, onChange, placeholder = 'Add Additional Note', maxLength = 150 }) {
  const editorRef = useRef(null);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // `value` is stored rich text read back from Supabase, so it is sanitized
    // on the way in — the same treatment InsuranceCardPreview already gives it
    // on the way out.
    const clean = sanitizeRichText(value);
    if (clean && el.innerHTML !== clean) {
      el.innerHTML = clean;
      setCharCount(el.textContent?.length || 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.textContent || '';
    if (text.length > maxLength) {
      document.execCommand('undo');
      return;
    }
    setCharCount(text.length);
    onChange(el.innerHTML);
  };

  const applyFormat = (cmd) => {
    document.execCommand(cmd, false, null);
    editorRef.current?.focus();
  };

  return (
    <div className={styles.noteEditor}>
      <div
        ref={editorRef}
        className={styles.noteEditable}
        contentEditable
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      <div className={styles.noteToolbar}>
        <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold"
          onMouseDown={e => { e.preventDefault(); applyFormat('bold'); }} />
        <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic"
          onMouseDown={e => { e.preventDefault(); applyFormat('italic'); }} />
        <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline"
          onMouseDown={e => { e.preventDefault(); applyFormat('underline'); }} />
        <span className={styles.noteCount}>{charCount}/{maxLength}</span>
      </div>
    </div>
  );
}
