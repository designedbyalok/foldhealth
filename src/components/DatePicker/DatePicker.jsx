import { forwardRef, useCallback, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Input } from '../Input/Input';
import { CalendarIcon } from '../Icon/CalendarIcon';
import { DatePickerPopover } from './DatePickerPopover';
import styles from './DatePicker.module.css';

/**
 * Fold date field — thin API-compat wrapper over `<Input type="date">`
 * for single-date usage, or a range-formatted text input + popover for
 * `mode="range"`.
 *
 * Single mode:
 *   value      ISO YYYY-MM-DD string
 *   onSelect   (iso) => void
 *
 * Range mode (mode="range"):
 *   value      { start, end } — each an ISO string
 *   onSelect   (range) => void — fires only after both endpoints are set
 *   Displayed as "MM/DD/YYYY - MM/DD/YYYY"
 *
 * Single mode also takes `isDayDisabled`: (iso) => true greys that day out, or
 * a string does and shows it as the day's tooltip (why it can't be picked).
 */
export const DatePicker = forwardRef(function DatePicker({
  mode = 'single',
  value = '',
  onSelect,
  hasError = false,
  id,
  disabled = false,
  placeholder,
  min,
  max,
  hidden = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  label,
  required = false,
  helperText,
  isDayDisabled,
}, ref) {
  const isRange = mode === 'range';
  const autoId = useId();
  const fieldId = id || autoId;
  // In single mode `label` renders a visible field label (via Input's own
  // label slot); the accessible name still falls back to it when nothing
  // else is supplied. Range mode continues to treat `label` as aria-only.
  const accessibleName = ariaLabel || label || (ariaLabelledBy ? undefined : (isRange ? 'Date range' : 'Date'));
  const inputRef = useRef(null);

  // Single-mode: delegate to `<Input type="date">` so any caller using
  // Input directly gets the same picker. Nothing else lives here.
  if (!isRange && !hidden) {
    const handleChange = (e) => onSelect?.(e?.target?.value || '');
    return (
      <Input
        ref={inputRef}
        id={fieldId}
        type="date"
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder || 'MM/DD/YYYY'}
        variant={hasError ? 'error' : undefined}
        min={min}
        max={max}
        isDayDisabled={isDayDisabled}
        label={label}
        required={required}
        helperText={helperText}
        aria-label={label ? undefined : accessibleName}
        aria-labelledby={ariaLabelledBy}
      />
    );
  }

  // Legacy `hidden` variant kept as a no-op mount so old call sites that
  // used to trigger `input.showPicker()` via ref keep a ref shape.
  if (hidden) return <RangeStub ref={ref} />;

  return (
    <RangeField
      ref={ref}
      id={fieldId}
      value={value}
      onSelect={onSelect}
      hasError={hasError}
      disabled={disabled}
      placeholder={placeholder}
      min={min}
      max={max}
      accessibleName={accessibleName}
      ariaLabelledBy={ariaLabelledBy}
    />
  );
});

// ── Range-mode field ────────────────────────────────────────────────

const RangeField = forwardRef(function RangeField({
  id,
  value,
  onSelect,
  hasError,
  disabled,
  placeholder,
  min,
  max,
  accessibleName,
  ariaLabelledBy,
}, ref) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const displayValue = useMemo(() => {
    const s = mdyFromIso(value?.start);
    const e = mdyFromIso(value?.end);
    if (s && e) return `${s} - ${e}`;
    if (s) return `${s} -`;
    return '';
  }, [value?.start, value?.end]);

  const openPopover = useCallback(() => {
    if (disabled) return;
    const trigger = wrapRef.current;
    if (trigger) setAnchorRect(trigger.getBoundingClientRect());
    setOpen(true);
  }, [disabled]);

  useImperativeHandle(ref, () => ({
    open: openPopover,
    focus: () => wrapRef.current?.querySelector('input')?.focus(),
    showPicker: openPopover,
  }), [openPopover]);

  const handlePickerChange = (range) => {
    onSelect?.(range);
  };

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <Input
        id={id}
        type="text"
        value={displayValue}
        readOnly
        onFocus={openPopover}
        disabled={disabled}
        placeholder={placeholder || 'MM/DD/YYYY - MM/DD/YYYY'}
        variant={hasError ? 'error' : undefined}
        className={styles.dateInput}
        aria-label={accessibleName}
        aria-labelledby={ariaLabelledBy}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        aria-haspopup="dialog"
        onMouseDown={(e) => { e.preventDefault(); openPopover(); }}
        disabled={disabled}
        className={styles.iconTrigger}
      >
        <CalendarIcon
          size={16}
          color={disabled ? 'var(--neutral-150)' : 'var(--neutral-300)'}
        />
      </button>
      <DatePickerPopover
        mode="range"
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onChange={handlePickerChange}
        anchorRect={anchorRect}
        min={min}
        max={max}
      />
    </div>
  );
});

const RangeStub = forwardRef(function RangeStub(_, ref) {
  useImperativeHandle(ref, () => ({
    open: () => {},
    focus: () => {},
    showPicker: () => {},
  }), []);
  return <span aria-hidden="true" style={{ display: 'none' }} />;
});

// ── MM/DD/YYYY helper ───────────────────────────────────────────────

function mdyFromIso(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return (y && m && d) ? `${m}/${d}/${y}` : '';
}
