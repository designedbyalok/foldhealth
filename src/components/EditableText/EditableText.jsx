import { useLayoutEffect, useRef } from 'react';
import styles from './EditableText.module.css';

/**
 * Fold Health EditableText — text you edit where it stands. Unlike
 * InlineEditable it never swaps to an input: the text itself becomes
 * editable (contentEditable, plain text only), so its size, weight and
 * colour stay exactly as they are. Enter or leaving it commits, Escape
 * restores the last committed value.
 *
 * Props:
 *  - value       (string)               Committed text
 *  - onCommit    (fn(next: string))     Called with the trimmed text when it changed.
 *                                        The caller decides what an empty value means
 *                                        (e.g. revert to a default, or clear).
 *  - placeholder (string)               Shown, dimmed, while empty
 *  - maxLength   (number)               Character cap
 *  - ariaLabel   (string)               Accessible name for the text box
 *  - className   (string)               Carries the text styles (font, colour)
 *  - disabled    (boolean)              Plain, non-editable text
 */
export function EditableText({ value = '', onCommit, placeholder, maxLength, ariaLabel, className, disabled = false }) {
  const ref = useRef(null);
  const valueRef = useRef(value);

  // The DOM owns the text while editing; sync it from `value` otherwise.
  useLayoutEffect(() => {
    valueRef.current = value;
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value;
  }, [value]);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = next;
    if (next !== value) onCommit?.(next);
    // If the caller maps the edit back to the same value (e.g. blank means
    // "use the default"), no re-render follows, so restore the text here.
    requestAnimationFrame(() => {
      if (ref.current && document.activeElement !== ref.current && ref.current.textContent !== valueRef.current) {
        ref.current.textContent = valueRef.current;
      }
    });
  };

  const placeCaretAtEnd = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  if (disabled) return <span className={className}>{value}</span>;

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline="false"
      tabIndex={0}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      className={[styles.editable, className].filter(Boolean).join(' ')}
      onInput={(e) => {
        const el = e.currentTarget;
        if (maxLength && el.textContent.length > maxLength) {
          el.textContent = el.textContent.slice(0, maxLength);
          placeCaretAtEnd(el);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.textContent = value; e.currentTarget.blur(); }
      }}
      // Paste as plain, single-line text (Firefox ignores plaintext-only).
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
        document.execCommand('insertText', false, text);
      }}
      onBlur={commit}
    />
  );
}
