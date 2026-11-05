import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { Button } from '../Button/Button';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import styles from './EmailEditor.module.css';

const FONTS = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Courier New'];
const SIZES = [10, 12, 14, 16, 18, 24];
// Email clients need literal colors, so these aren't tokens.
const COLORS = [
  { key: '#3A485F', label: 'Default' },
  { key: '#8C5AE2', label: 'Purple' },
  { key: '#D72825', label: 'Red' },
  { key: '#12B76A', label: 'Green' },
  { key: '#1570EF', label: 'Blue' },
];
const LISTS = [
  { key: 'insertUnorderedList', label: 'Bulleted list', icon: 'solar:list-linear' },
  { key: 'insertOrderedList', label: 'Numbered list', icon: 'solar:list-arrow-down-linear' },
];
const ALIGNS = [
  { key: 'justifyLeft', label: 'Align left', icon: 'solar:align-left-linear' },
  { key: 'justifyCenter', label: 'Align center', icon: 'solar:align-horizontal-center-linear' },
  { key: 'justifyRight', label: 'Align right', icon: 'solar:align-right-linear' },
];

/**
 * EmailEditor: the email text area from the Communications compose design
 * (Figma 2906:39503): a PHI notice strip, a formatting bar (undo / redo,
 * font, size, bold, italic, underline, strikethrough, text color, lists,
 * alignment), the message, and a bar of insert actions supplied by the host
 * (attach, form, article, booking link, image …).
 *
 * Controlled: `value` is the message HTML; `onChange(html)` fires on edits.
 * The ref exposes `insertHtml(html)`, which inserts at the last caret
 * position (insert actions open a picker first, so focus has moved away).
 *
 * A pasted web address becomes a real link (info blue, underlined), so it
 * reads as a link here and in the sent email.
 *
 * @param {string}   props.value
 * @param {function} props.onChange
 * @param {string}   [props.notice] – the warning strip on top ('' hides it)
 * @param {string}   [props.placeholder='Type your email here']
 * @param {Array<{ key: string, icon: string, label: string, onClick: function, disabled?: boolean }>} [props.actions]
 *   – the bottom bar; onClick receives the click event (for anchoring a picker)
 */
const LINK_RE = /https?:\/\/[^\s<>"]+/;
const LINK_RE_G = /https?:\/\/[^\s<>"]+/g;
const escapeHtml = (t) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const EmailEditor = forwardRef(function EmailEditor({
  value,
  onChange,
  notice = 'Do not send PHI via email or text without verifying and obtaining consent.',
  placeholder = 'Type your email here',
  actions = [],
}, ref) {
  const editorRef = useRef(null);
  const emitted = useRef(null);
  const savedRange = useRef(null);
  const [menu, setMenu] = useState(null); // { kind, rect }
  const [font, setFont] = useState('Inter');
  const [size, setSize] = useState(12);
  const [empty, setEmpty] = useState(!value);

  // Write external values in; the editor's own edits come back as `value`.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || value === emitted.current) return;
    el.innerHTML = value || '';
    emitted.current = value;
    setEmpty(!el.textContent.trim());
  }, [value]);

  const emit = () => {
    const el = editorRef.current;
    if (!el) return;
    emitted.current = el.innerHTML;
    setEmpty(!el.textContent.trim() && !el.querySelector('img'));
    onChange?.(el.innerHTML);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel?.rangeCount && editorRef.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const el = editorRef.current;
    el?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } else if (el && sel) {
      // No caret yet: put it at the end.
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };

  const run = (cmd, arg = null) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, arg);
    saveSelection();
    emit();
  };

  // execCommand('fontSize') only knows 1–7; mark with 7, then set the real size.
  const applySize = (px) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      span.innerHTML = f.innerHTML;
      f.replaceWith(span);
    });
    setSize(px);
    saveSelection();
    emit();
  };

  // A pasted web address becomes a real link (shown in info blue, underlined),
  // so it reads as a link here and in the sent email.
  const paste = (e) => {
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!LINK_RE.test(text)) return;
    e.preventDefault();
    const html = escapeHtml(text)
      .replace(LINK_RE_G, url => `<a href="${url}">${url}</a>`)
      .replace(/\r?\n/g, '<br>');
    document.execCommand('insertHTML', false, html);
    saveSelection();
    emit();
  };

  useImperativeHandle(ref, () => ({
    insertHtml: (html) => {
      restoreSelection();
      document.execCommand('insertHTML', false, html);
      saveSelection();
      emit();
    },
  }));

  const open = (kind) => (e) => { saveSelection(); setMenu({ kind, rect: e.currentTarget.getBoundingClientRect() }); };
  const pick = (key) => {
    const kind = menu?.kind;
    setMenu(null);
    if (kind === 'font') { setFont(key); run('fontName', key); }
    if (kind === 'size') applySize(Number(key));
    if (kind === 'color') run('foreColor', key);
    if (kind === 'list' || kind === 'align') run(key);
  };
  const menuItems = {
    font: FONTS.map(f => ({ key: f, label: f })),
    size: SIZES.map(s => ({ key: String(s), label: String(s) })),
    color: COLORS.map(c => ({ key: c.key, label: c.label, iconElement: <span className={styles.swatch} style={{ background: c.key }} /> })),
    list: LISTS,
    align: ALIGNS,
  };

  const tool = (icon, tooltip, onClick) => (
    // mousedown keeps the selection in the editor while the button is pressed.
    <span onMouseDown={(e) => e.preventDefault()}>
      <ActionButton icon={icon} size="sm" tooltip={tooltip} tooltipBelow onClick={onClick} />
    </span>
  );
  const divider = <span className={styles.divider} aria-hidden="true" />;

  return (
    <div className={styles.root}>
      {notice && (
        <div className={styles.notice}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
          <span>{notice}</span>
        </div>
      )}

      <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
        {tool('solar:undo-left-round-linear', 'Undo', () => run('undo'))}
        {tool('solar:undo-right-round-linear', 'Redo', () => run('redo'))}
        {divider}
        <span onMouseDown={(e) => e.preventDefault()}>
          <Button variant="outline" size="sm" trailingIcon="solar:alt-arrow-down-linear" className={styles.fontButton} onClick={open('font')}>{font}</Button>
        </span>
        <span onMouseDown={(e) => e.preventDefault()}>
          <Button variant="outline" size="sm" trailingIcon="solar:alt-arrow-down-linear" onClick={open('size')}>{String(size)}</Button>
        </span>
        {divider}
        {tool('solar:text-bold-linear', 'Bold (Ctrl + B)', () => run('bold'))}
        {tool('solar:text-italic-linear', 'Italic (Ctrl + I)', () => run('italic'))}
        {tool('solar:text-underline-linear', 'Underline (Ctrl + U)', () => run('underline'))}
        {tool('solar:text-cross-linear', 'Strikethrough', () => run('strikeThrough'))}
        <span onMouseDown={(e) => e.preventDefault()}>
          <ActionButton icon="solar:text-field-linear" size="sm" tooltip="Font Color" tooltipBelow onClick={open('color')} />
        </span>
        {divider}
        <span onMouseDown={(e) => e.preventDefault()}>
          <ActionButton icon="solar:list-linear" size="sm" tooltip="Bullets" tooltipBelow chevron onClick={open('list')} />
        </span>
        {divider}
        <span onMouseDown={(e) => e.preventDefault()}>
          <ActionButton icon="solar:align-left-linear" size="sm" tooltip="Align" tooltipBelow chevron onClick={open('align')} />
        </span>
      </div>

      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label="Message"
        contentEditable
        suppressContentEditableWarning
        className={styles.editor}
        data-empty={empty ? 'true' : 'false'}
        data-placeholder={placeholder}
        onInput={emit}
        onPaste={paste}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
      />

      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((a, i) => (
            <span key={a.key} className={styles.actionItem}>
              {i > 0 && divider}
              {/* mousedown keeps the editor's text selection for the action. */}
              <ActionButton icon={a.icon} size="sm" tooltip={a.label} disabled={a.disabled} onClick={a.onClick} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} />
            </span>
          ))}
        </div>
      )}

      {menu && (
        <MenuPopover
          anchorRect={menu.rect}
          align="left"
          width={menu.kind === 'font' ? 180 : 160}
          items={menuItems[menu.kind]}
          onSelect={pick}
          onClose={() => setMenu(null)}
          ariaLabel="Formatting options"
        />
      )}
    </div>
  );
});
