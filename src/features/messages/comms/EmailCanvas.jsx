import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import styles from './ComposeEmail.module.css';
import { sanitizeRichText } from '../../../lib/sanitizeHtml';

const TOOLS = [
  { cmd: 'undo', icon: 'solar:undo-left-linear', tip: 'Undo' },
  { cmd: 'redo', icon: 'solar:undo-right-linear', tip: 'Redo' },
  null,
  { cmd: 'bold', icon: 'solar:text-bold-linear', tip: 'Bold' },
  { cmd: 'italic', icon: 'solar:text-italic-linear', tip: 'Italic' },
  { cmd: 'underline', icon: 'solar:text-underline-linear', tip: 'Underline' },
  { cmd: 'strikeThrough', icon: 'solar:text-cross-linear', tip: 'Strikethrough' },
  null,
  { cmd: 'insertUnorderedList', icon: 'solar:list-linear', tip: 'Bulleted list' },
  { cmd: 'insertOrderedList', icon: 'solar:list-arrow-down-linear', tip: 'Numbered list' },
  { cmd: 'createLink', icon: 'solar:link-linear', tip: 'Link' },
];

/**
 * The email as the patient will get it, in an isolated frame. With
 * `editing`, its text is editable in place (the frame turns on designMode)
 * and the formatting bar shows. `getHtml()` returns the edited document.
 * The frame allows no scripts, so template markup can't run in the app.
 */
export const EmailCanvas = forwardRef(function EmailCanvas({ html, editing }, ref) {
  const frameRef = useRef(null);

  const doc = () => frameRef.current?.contentDocument;
  const applyMode = () => {
    const d = doc();
    if (d) d.designMode = editing ? 'on' : 'off';
  };

  useImperativeHandle(ref, () => ({
    getHtml: () => {
      const d = doc();
      if (!d?.documentElement) return html;
      return `<!doctype html>\n${d.documentElement.outerHTML}`;
    },
    /** Put generated text in the message part (or at the top of the email). */
    setBody: (bodyHtml) => {
      const d = doc();
      if (!d?.body) return false;
      // allow-same-origin makes this frame our origin, so injected markup is sanitized.
      const safe = sanitizeRichText(bodyHtml);
      const slot = d.querySelector('[data-fold-body]');
      if (slot) slot.innerHTML = safe;
      else d.body.insertAdjacentHTML('afterbegin', `<div style="padding:24px 32px">${safe}</div>`);
      return true;
    },
  }), [html]);

  // designMode follows `editing`; onLoad covers a frame that reloads (a new
  // template) while editing is on.
  useEffect(() => {
    const d = frameRef.current?.contentDocument;
    if (d) d.designMode = editing ? 'on' : 'off';
  }, [editing]);

  const run = (cmd) => {
    const d = doc();
    if (!d) return;
    if (cmd === 'createLink') {
      const url = window.prompt('Link address');
      if (url) d.execCommand('createLink', false, url);
      return;
    }
    d.execCommand(cmd, false, null);
    frameRef.current?.contentWindow?.focus();
  };

  return (
    <div className={styles.canvas}>
      {editing && (
        <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
          {TOOLS.map((t, i) => t
            ? <ActionButton key={t.cmd} icon={t.icon} size="sm" tooltip={t.tip} onClick={() => run(t.cmd)} />
            : <span key={`d${i}`} className={styles.toolbarDivider} />)}
        </div>
      )}
      <iframe
        ref={frameRef}
        title="Email preview"
        className={styles.frame}
        sandbox="allow-same-origin"
        srcDoc={html}
        onLoad={applyMode}
      />
    </div>
  );
});
