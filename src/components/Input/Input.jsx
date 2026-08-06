import { forwardRef, useCallback, useId, useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './Input.module.css';

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
};

/**
 * Fold Health Input — single source-of-truth text input control.
 *
 * Matches Figma Fold-Pixel design node 25:21239 across every state
 * (Placeholder, Filled, Hover, Focus, Disable, Error, Error Hover).
 *
 * Structural props (all optional — when NONE of them are set the component
 * still renders a bare `<input>` so existing 20+ callers of
 * `<Input placeholder="…" />` keep working unchanged):
 *
 *   - label         Text above the input. Renders in --neutral-300.
 *   - helperText    Muted text below the input, hidden while an error shows.
 *   - errorText     Explicit error message. Forces the error state; supersedes
 *                   internal validation output.
 *   - required      Adds a red asterisk to the label and forwards `required`.
 *
 * Native types accepted via `type` — text | email | password | number |
 * tel | url | search. Each type wires sensible `inputMode` +
 * `autoComplete` defaults. `password` supports `showPasswordToggle` for
 * an inline eye toggle button.
 *
 * Validation:
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
    label,
    helperText,
    errorText,
    required,
    showPasswordToggle = false,
    validate,
    validateOn = 'blur',
    className,
    wrapperClassName,
    inputMode: inputModeProp,
    autoComplete: autoCompleteProp,
    onBlur,
    onChange,
    id,
    ...props
  },
  ref,
) {
  const [internalError, setInternalError] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    onChange?.(e);
  }, [validateOn, runValidate, internalError, onChange]);

  const typeDefaults = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.text;
  const inputMode = inputModeProp ?? typeDefaults.inputMode;
  const autoComplete = autoCompleteProp ?? typeDefaults.autoComplete;
  const effectiveType = type === 'password' && passwordVisible ? 'text' : type;

  const inputCls = [
    styles.input,
    isError ? styles.inputError : '',
    type === 'password' && showPasswordToggle ? styles.inputWithTrailing : '',
    className || '',
  ].filter(Boolean).join(' ');

  const inputEl = (
    <input
      ref={ref}
      id={inputId}
      type={effectiveType}
      inputMode={inputMode}
      autoComplete={autoComplete}
      required={required}
      className={inputCls}
      onBlur={handleBlur}
      onChange={handleChange}
      aria-invalid={isError || undefined}
      {...props}
    />
  );

  // Bare-input fast path — no wrapper markup for the many callers that
  // don't use the structural extras. Keeps flex/grid parents happy.
  const needsWrapper = label || helperText || activeError || (type === 'password' && showPasswordToggle);
  if (!needsWrapper) return inputEl;

  const trailingButton = type === 'password' && showPasswordToggle ? (
    <button
      type="button"
      className={styles.trailingButton}
      onClick={() => setPasswordVisible((v) => !v)}
      tabIndex={-1}
      aria-label={passwordVisible ? 'Hide password' : 'Show password'}
    >
      <Icon
        name={passwordVisible ? 'solar:eye-closed-linear' : 'solar:eye-linear'}
        size={16}
      />
    </button>
  ) : null;

  return (
    <div className={[styles.field, wrapperClassName || ''].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {required && <span className={styles.required} aria-hidden> *</span>}
        </label>
      )}
      <div className={styles.control}>
        {inputEl}
        {trailingButton}
      </div>
      {typeof activeError === 'string' && activeError && (
        <span className={styles.errorText}>{activeError}</span>
      )}
      {!activeError && helperText && (
        <span className={styles.helperText}>{helperText}</span>
      )}
    </div>
  );
});
