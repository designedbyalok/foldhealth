import { useEffect, useRef, useState } from 'react';
import styles from './InlineEditable.module.css';

/**
 * Fold Health InlineEditable — click-to-edit single-line text.
 *
 * Renders as a static span until clicked, then swaps to an input. Commits on
 * blur or Enter, cancels on Escape. Useful for editable list titles, column
 * headers, etc.
 *
 * Props:
 *  - value      (string)               Current text
 *  - onCommit   (fn(next: string))     Called when the user commits a new value.
 *                                       Not called if the value is unchanged or empty.
 *  - placeholder(string)               Shown when value is empty
 *  - size       ('M'|'L')              M = 14px / 500, L = 15px / 500 (default M)
 *  - maxLength  (number)               Optional character cap on the input
 *  - className  (string)               Extra class on the outer wrapper
 *  - inputClassName (string)           Extra class on the <input> element
 *  - disabled   (boolean)              When true, behaves as static text
 *  - title      (string)               Tooltip / accessible label for the trigger
 */
export function InlineEditable({
  value,
  onCommit,
  placeholder = 'Untitled',
  size = 'M',
  maxLength,
  className,
  inputClassName,
  disabled = false,
  title,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit?.(next);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value ?? '');
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') cancel();
        }}
        aria-label={title}
        className={[styles.input, styles[`size_${size}`], inputClassName || ''].filter(Boolean).join(' ')}
      />
    );
  }

  return (
    <span
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      title={title}
      className={[styles.text, styles[`size_${size}`], disabled ? styles.disabled : '', className || ''].filter(Boolean).join(' ')}
      onClick={() => !disabled && setEditing(true)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setEditing(true);
        }
      }}
    >
      {value || <span className={styles.placeholder}>{placeholder}</span>}
    </span>
  );
}
