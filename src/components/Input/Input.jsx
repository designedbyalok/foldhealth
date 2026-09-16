import { forwardRef, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { CalendarIcon } from '../Icon/CalendarIcon';
import { CloseIcon } from '../Icon/CloseIcon';
import { Button } from '../Button/Button';
import { DatePickerPopover } from '../DatePicker/DatePickerPopover';
import styles from './Input.module.css';

// ── MM/DD/YYYY ↔ YYYY-MM-DD helpers ──────────────────────────────────
// `type="date"` inputs speak ISO at the value boundary (matching native
// <input type="date">) but display MM/DD/YYYY on-screen so the visible
// order is locale-independent.
function mdyFromIso(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return (y && m && d) ? `${m}/${d}/${y}` : '';
}
function isoFromMdy(mdy) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(mdy || '');
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const month = Number(mm), day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Sensible inputMode + autoComplete defaults per type. Callers can override
// by passing `inputMode` / `autoComplete` explicitly — they win.
const TYPE_DEFAULTS = {
  email:    { inputMode: 'email',    autoComplete: 'email' },
  password: { inputMode: 'text',     autoComplete: 'current-password' },
  number:   { inputMode: 'decimal',  autoComplete: 'off' },
  tel:      { inputMode: 'tel',      autoComplete: 'tel' },
  url:      { inputMode: 'url',      autoComplete: 'url' },
  search:   { inputMode: 'search',   autoComplete: 'off' },
  text:     { inputMode: undefined,  autoComplete: undefined },
  // Native date/time types — browser owns the calendar/clock UI. Field
  // chrome (border, radius, focus ring) still comes from Input so date
  // rows sit pixel-identical next to text rows in the same grid.
  date:            { inputMode: undefined, autoComplete: 'off' },
  time:            { inputMode: undefined, autoComplete: 'off' },
  'datetime-local':{ inputMode: undefined, autoComplete: 'off' },
};

/**
 * Fold Health Input — single source-of-truth text input control.
 *
 * Matches Figma Fold-Pixel design node 25:21239 across every state
 * (Placeholder, Filled, Hover, Focus, Disable, Error, Error Hover) and
 * every optional slot the design exposes as a boolean flag.
 *
 * Wrapper props (all optional — when NONE are set the component renders a
 * bare `<input>` so the many callers of `<Input placeholder="…" />` keep
 * working unchanged):
 *
 *   Label row
 *     - label          Text above the input.
 *     - required       Adds the red 4×4 mandatory dot next to the label.
 *     - showInfo       Adds an info icon next to the label; `infoText`
 *                      sets its native tooltip.
 *
 *   Field slots (all render inside the field shell around the <input>)
 *     - leadingIcon    Solar icon name (string) or a React node.
 *     - showPriority   Adds a leading priority flag icon.
 *     - trailingText   Static text on the right (e.g. "Days").
 *     - chevron        `true`/"down"/"up" adds a small trailing chevron.
 *     - trailingAction Boolean or Solar icon name for a small right-aligned
 *                      icon-only action button; wire via `onTrailingAction`.
 *     - trailingButton String label or `{ label, onClick }` for the small
 *                      purple pill button on the right.
 *     - characterLimit Number cap; shows "N/limit", turning error-dark at
 *                      the cap. Uses `value.length`
 *                      when controlled, otherwise tracks length internally.
 *
 *   Below the field
 *     - helperText     Muted text below the input, hidden while an error shows.
 *     - errorText      Explicit error message. Forces the error state.
 *
 * Password support
 *     - showPasswordToggle  Toggle-visibility eye button for `type="password"`.
 *
 * Native types accepted via `type` — text | email | password | number |
 * tel | url | search. Each type wires sensible `inputMode` +
 * `autoComplete` defaults.
 *
 * Validation
 *   - Pass `validate={(value) => string | null}` for a custom rule, OR
 *     lean on native constraints (`type`, `required`, `pattern`, `min`,
 *     `max`, `minLength`, `maxLength`, `step`) and Input will read
 *     `input.checkValidity()` / `validationMessage`.
 *   - `validateOn` — 'blur' (default), 'change', or 'none'.
 *   - The internal error clears the moment the user edits after a
 *     failed validation, so the message never nags.
 */
export const Input = forwardRef(function Input(
  {
    variant,
    type = 'text',
    // Label row
    label,
    required,
    showInfo = false,
    infoText,
    // Field slots
    leadingIcon,
    showPriority = false,
    trailingText,
    // Render `trailingText` as a filled segment flush to the field's right
    // edge (divider + grey fill) instead of inline text — e.g. a unit suffix.
    trailingTextSegment = false,
    chevron = false,
    trailingAction = false,
    trailingActionLabel = 'Voice input',
    onTrailingAction,
    trailingButton = false,   // boolean toggle — mirrors Figma "Trailing Button" flag
    trailingButtonText = 'Button Text',
    onTrailingButtonClick,
    characterLimit,           // number
    // Below the field
    helperText,
    errorText,
    // Password
    showPasswordToggle = false,
    // Validation
    validate,
    validateOn = 'blur',
    // Layout escape hatches
    className,
    wrapperClassName,
    // Native pass-through
    inputMode: inputModeProp,
    autoComplete: autoCompleteProp,
    value,
    defaultValue,
    onBlur,
    onChange,
    id,
    ...props
  },
  ref,
) {
  const [internalError, setInternalError] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  // Fallback char count for uncontrolled inputs when characterLimit is set.
  const [uncontrolledLen, setUncontrolledLen] = useState(
    typeof defaultValue === 'string' ? defaultValue.length : 0,
  );
  // Guarantee a stable label↔input association even when the caller
  // doesn't pass `id`. Only used when a label is actually rendered.
  const autoId = useId();
  const inputId = id || (label ? autoId : undefined);

  // Explicit errorText (or legacy variant='error') wins over internal
  // validation output. Internal state only kicks in when the caller
  // hasn't spoken.
  const activeError = errorText != null ? errorText : internalError;
  const isError = variant === 'error' || Boolean(activeError);

  const runValidate = useCallback((el) => {
    if (!el) return;
    if (validate) {
      const msg = validate(el.value);
      setInternalError(msg || null);
      return;
    }
    if (!el.checkValidity()) {
      setInternalError(el.validationMessage || 'Invalid input');
    } else {
      setInternalError(null);
    }
  }, [validate]);

  const handleBlur = useCallback((e) => {
    if (validateOn === 'blur') runValidate(e.currentTarget);
    onBlur?.(e);
  }, [validateOn, runValidate, onBlur]);

  const handleChange = useCallback((e) => {
    if (validateOn === 'change') {
      runValidate(e.currentTarget);
    } else if (internalError) {
      // Clear stale error the moment the user edits.
      setInternalError(null);
    }
    if (characterLimit != null && value === undefined) {
      setUncontrolledLen(e.currentTarget.value.length);
    }
    onChange?.(e);
  }, [validateOn, runValidate, internalError, onChange, characterLimit, value]);

  const typeDefaults = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.text;
  const inputMode = inputModeProp ?? typeDefaults.inputMode;
  const autoComplete = autoCompleteProp ?? typeDefaults.autoComplete;

  // `type="date"` is rendered as a text input under the hood so we can
  // paint the Fold-brand calendar popover instead of the browser's native
  // picker. Value in / out stays ISO (YYYY-MM-DD) to match the semantics
  // of native `<input type="date">`; the visible text renders MM/DD/YYYY.
  const isDateType = type === 'date';
  // `time` / `datetime-local` still fall through to native `showPicker()`
  // — a Fold time-picker UI isn't built yet.
  const isTimeLike = type === 'time' || type === 'datetime-local';
  const showPickerIcon = isDateType || isTimeLike;
  const effectiveType = type === 'password' && passwordVisible
    ? 'text'
    : (isDateType ? 'text' : type);

  // Local typed state for the date branch — decouples the visible text
  // from the parent's controlled ISO value while the user is mid-typing,
  // and snaps back on blur so partial edits ("07/03/") never linger.
  const [dateTyped, setDateTyped] = useState(() =>
    isDateType ? mdyFromIso(value != null ? value : defaultValue) : '',
  );
  useEffect(() => {
    if (isDateType) setDateTyped(mdyFromIso(value));
  }, [isDateType, value]);

  // Date popover — anchored to the shell so it flips with the trigger.
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [datePopoverAnchor, setDatePopoverAnchor] = useState(null);
  const shellRef = useRef(null);
  const openDatePopover = useCallback(() => {
    if (props.disabled) return;
    if (shellRef.current) setDatePopoverAnchor(shellRef.current.getBoundingClientRect());
    setDatePopoverOpen(true);
  }, [props.disabled]);
  const emitIsoDate = useCallback((iso) => {
    // Synthesise the same shape as a native <input> onChange for callers
    // that read `e.target.value` — the rest of the app expects that
    // contract from anything named "onChange".
    onChange?.({ target: { value: iso || '' }, currentTarget: { value: iso || '' } });
  }, [onChange]);

  // Merge the caller's forwarded ref with a local one so the picker-icon
  // handler can call `showPicker()` regardless of ref shape.
  const localInputRef = useRef(null);
  const setInputRef = useCallback((node) => {
    localInputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);
  const openNativePicker = useCallback((e) => {
    e.preventDefault();
    if (props.disabled) return;
    const el = localInputRef.current;
    if (el?.showPicker) {
      try { el.showPicker(); return; } catch (_) { /* fall through */ }
    }
    el?.focus();
  }, [props.disabled]);
  // The trailing icon opens the Fold popover for date, or falls through
  // to the browser's native picker for time / datetime-local.
  const openPickerAction = isDateType ? (e) => { e.preventDefault(); openDatePopover(); } : openNativePicker;

  // Normalise slot booleans into a single "any slot?" gate; slot booleans
  // also drive whether we render inside the shell (any slot ⇒ shell path).
  const hasLeading = Boolean(leadingIcon) || showPriority;
  const chevronDir = chevron === 'up' ? 'up' : (chevron ? 'down' : null);
  const trailingActionActive = Boolean(trailingAction);
  const showTrailingButton = Boolean(trailingButton);
  // Search fields clear through our own close glyph; the native WebKit cross
  // is hidden in CSS because it ignores the design system entirely.
  const showSearchClear = type === 'search' && !props.disabled && !props.readOnly
    && String(value ?? '').length > 0;
  const hasTrailing = Boolean(trailingText) || chevronDir || trailingActionActive
    || showTrailingButton || characterLimit != null
    || (type === 'password' && showPasswordToggle)
    || showSearchClear
    || showPickerIcon;
  const usesShell = hasLeading || hasTrailing;

  // Bare-input fast path — no wrapper markup for the many callers that
  // don't use the structural extras. Keeps flex/grid parents happy.
  const needsWrapper = label || helperText || activeError || usesShell;

  if (!needsWrapper) {
    const inputCls = [
      styles.input,
      isError ? styles.inputError : '',
      className || '',
    ].filter(Boolean).join(' ');
    return (
      <input
        ref={setInputRef}
        id={inputId}
        type={effectiveType}
        // Force en-US on date/time so the native placeholder renders as
        // MM/DD/YYYY even under a non-US OS/browser locale.
        lang={(type === 'date' || type === 'time' || type === 'datetime-local') ? 'en-US' : undefined}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        className={inputCls}
        value={value}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        onBlur={handleBlur}
        onChange={handleChange}
        aria-invalid={isError || undefined}
        {...props}
      />
    );
  }

  // Shell path — the input sits inside a styled row that owns the border,
  // padding, focus ring, and every optional slot the Figma component
  // exposes. The <input> itself becomes borderless.
  //
  // Date branch overrides: caller speaks ISO via `value`/`onChange`, we
  // display MM/DD/YYYY inside `dateTyped` and translate at the boundary.
  const shellInputValue = isDateType
    ? dateTyped
    : value;
  // Keep `undefined` as `undefined` so a controlled date field (value set, no
  // defaultValue) doesn't get a synthesized `defaultValue=""` alongside its
  // `value` — React warns on an input carrying both.
  const shellInputDefault = isDateType
    ? (defaultValue !== undefined ? mdyFromIso(defaultValue) : undefined)
    : defaultValue;
  const shellInputPlaceholder = isDateType && props.placeholder == null
    ? 'MM/DD/YYYY'
    : props.placeholder;
  const handleShellChange = isDateType
    ? (e) => {
        const next = e.currentTarget.value;
        setDateTyped(next);
        const iso = isoFromMdy(next);
        if (iso) emitIsoDate(iso);
        else if (next === '') emitIsoDate('');
      }
    : handleChange;
  const handleShellBlur = isDateType
    ? (e) => { setDateTyped(mdyFromIso(value)); onBlur?.(e); }
    : handleBlur;
  // Strip the caller's `placeholder` from `...props` for the date branch
  // so our MM/DD/YYYY default doesn't collide with a spread override.
  const { placeholder: _placeholderProp, ...restProps } = props;

  const bareInput = (
    <input
      ref={setInputRef}
      id={inputId}
      type={effectiveType}
      // Force en-US on any remaining native date/time input so the OS
      // format renders as MM/DD/YYYY. Harmless on plain text inputs.
      lang={showPickerIcon ? 'en-US' : undefined}
      inputMode={inputMode}
      autoComplete={autoComplete}
      required={required}
      className={[
        styles.inputBorderless,
        // Only time/datetime-local still hit the native picker indicator.
        (showPickerIcon && !isDateType) ? styles.inputNativePickerHidden : '',
        className || '',
      ].filter(Boolean).join(' ')}
      value={shellInputValue}
      {...(shellInputDefault !== undefined ? { defaultValue: shellInputDefault } : {})}
      placeholder={shellInputPlaceholder}
      onBlur={handleShellBlur}
      onChange={handleShellChange}
      aria-invalid={isError || undefined}
      {...restProps}
    />
  );

  const leading = hasLeading ? (
    <>
      {leadingIcon && (
        typeof leadingIcon === 'string'
          ? <Icon name={leadingIcon} size={16} color="var(--neutral-300)" className={styles.slotIcon} />
          : (isValidElement(leadingIcon) ? leadingIcon : null)
      )}
      {showPriority && (
        <Icon name="solar:flag-linear" size={16} color="var(--neutral-300)" className={styles.slotIcon} />
      )}
    </>
  ) : null;

  const currentLen = typeof value === 'string' ? value.length : uncontrolledLen;

  const trailing = hasTrailing ? (
    <>
      {showSearchClear && (
        <button
          type="button"
          className={styles.trailingAction}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange?.({ target: { value: '' }, currentTarget: { value: '' } });
            localInputRef.current?.focus();
          }}
          tabIndex={-1}
          aria-label="Clear search"
        >
          <CloseIcon size={16} color="var(--neutral-300)" />
        </button>
      )}
      {type === 'password' && showPasswordToggle && (
        <button
          type="button"
          className={styles.trailingAction}
          onClick={() => setPasswordVisible((v) => !v)}
          tabIndex={-1}
          aria-label={passwordVisible ? 'Hide password' : 'Show password'}
        >
          <Icon name={passwordVisible ? 'solar:eye-closed-linear' : 'solar:eye-linear'} size={16} />
        </button>
      )}
      {showPickerIcon && (
        <button
          type="button"
          className={styles.trailingAction}
          onMouseDown={openPickerAction}
          tabIndex={-1}
          aria-label={isTimeLike ? 'Open time picker' : 'Open date picker'}
        >
          {isTimeLike ? (
            <Icon
              name="solar:clock-circle-linear"
              size={16}
              color={props.disabled ? 'var(--neutral-150)' : 'var(--neutral-300)'}
            />
          ) : (
            <CalendarIcon
              size={16}
              color={props.disabled ? 'var(--neutral-150)' : 'var(--neutral-300)'}
            />
          )}
        </button>
      )}
      {trailingActionActive && (
        <button
          type="button"
          className={styles.trailingAction}
          onClick={onTrailingAction}
          aria-label={trailingActionLabel}
        >
          <Icon
            name={typeof trailingAction === 'string' ? trailingAction : 'solar:microphone-3-linear'}
            size={16}
            color="var(--neutral-300)"
          />
        </button>
      )}
      {trailingText && (
        <span className={trailingTextSegment
          ? `${styles.trailingText} ${styles.trailingTextSegment}`
          : styles.trailingText}
        >
          {trailingText}
        </span>
      )}
      {chevronDir && (
        <DownChevronIcon
          size={14}
          color="var(--neutral-300)"
          className={chevronDir === 'up' ? styles.chevronUp : styles.chevronDown}
        />
      )}
      {showTrailingButton && (
        <Button
          variant="tertiary"
          size="S"
          onClick={onTrailingButtonClick}
          className={styles.trailingButtonSlot}
        >
          {trailingButtonText}
        </Button>
      )}
      {characterLimit != null && (
        <span className={[
          styles.characterLimit,
          currentLen >= characterLimit ? styles.characterLimitFull : '',
        ].filter(Boolean).join(' ')}
        >
          {currentLen}/{characterLimit}
        </span>
      )}
    </>
  ) : null;

  const shellCls = [
    styles.shell,
    isError ? styles.shellError : '',
    props.disabled ? styles.shellDisabled : '',
    props.readOnly ? styles.shellReadonly : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={[styles.field, wrapperClassName || ''].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          <span className={styles.labelText}>{label}</span>
          {showInfo && (
            <Icon
              name="solar:info-circle-linear"
              size={12}
              color="var(--neutral-300)"
              className={styles.labelInfo}
              title={infoText}
            />
          )}
          {required && <span className={styles.required} aria-hidden="true" />}
        </label>
      )}
      <div className={shellCls} ref={shellRef}>
        {leading}
        {bareInput}
        {trailing}
      </div>
      {typeof activeError === 'string' && activeError && (
        <span className={styles.errorText}>{activeError}</span>
      )}
      {!activeError && helperText && (
        <span className={styles.helperText}>{helperText}</span>
      )}
      {isDateType && (
        <DatePickerPopover
          open={datePopoverOpen}
          onClose={() => setDatePopoverOpen(false)}
          value={value}
          onChange={(iso) => { setDateTyped(mdyFromIso(iso)); emitIsoDate(iso); }}
          anchorRect={datePopoverAnchor}
          min={props.min}
          max={props.max}
        />
      )}
    </div>
  );
});
