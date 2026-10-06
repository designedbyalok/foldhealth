import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { Avatar } from '../Avatar/Avatar';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import {
  serializePlain,
  createMentionChip,
  collectMentions,
  detectMention,
  caretAfter,
} from './mentions';
import styles from './Textarea.module.css';
import { sanitizeRichText } from '../../lib/sanitizeHtml';
import { exitEmptyListItem, applyListShortcut, numberListItems, nestListItem, outdentListItem, unlistItem, textToListHtml } from './richTextLists';

/**
 * Fold Health Textarea (Figma Fold-Pixel 5786:1273 / 25:78337).
 *
 * Two shapes in one component so consumers can grow from a plain
 * multi-line input into the full labeled + toolbar treatment without
 * swapping components:
 *
 *   • Plain — no `title`, `richText`, `supportingText`, `bottomButton`,
 *     `speechToText`, `maxLength`, `mandatory`, or `info` prop. Renders a
 *     bare <textarea> exactly like it always has. Existing consumers
 *     don't need to change.
 *
 *   • Enhanced — any of the props above are set. Renders the labeled
 *     card: header (title + optional info + required "*"), body
 *     (contentEditable in `richText` mode, else <textarea>), footer
 *     (formatting toolbar, speech-to-text, character counter, and an
 *     optional primary CTA), and a supporting-text helper below.
 *
 * States (Figma 25:78337):
 *   • default (placeholder) / hover / focus
 *   • filled
 *   • error   → red border + light-red fill (see `variant='error'`)
 *   • disabled
 */
export const Textarea = forwardRef(function Textarea({
  variant = 'default',
  className,
  rows = 3,
  disabled,
  // Enhanced-mode props — presence toggles the labeled/card layout.
  //
  // `title`, `supportingText` and `info` each accept BOTH a string and a
  // boolean so callers can flip them on/off from a design-system control
  // (Storybook, code-connect) without hunting for a default label.
  //   true          → render the region with the default text below
  //   'My label'    → render with that string
  //   false / null  → omit the region entirely
  //
  // `showInfo` + `infoText` are Input's shape and win when both are passed,
  // so callers already using Input's contract don't have to relearn it.
  title,
  showInfo = false,
  infoText,
  info,
  mandatory = false,
  supportingText,
  richText = false,
  maxLength,
  bottomButton,          // { label, onClick, disabled, variant }
  speechToText = false,
  onSpeechClick,
  attachment = false,    // boolean toggle (attaches paperclip button) OR { onClick } / accept
  onAttachmentClick,
  onAttachmentFiles,     // (FileList) → parent handles the upload
  moreActions,           // [{ icon, label, onClick, disabled }] — appended to the toolbar
  // Mentions — richText-only. Pass an array of `{ id, name, initials, role?
  // realProfile? }` and the editor will pop a picker on "@". `onMentionSelect`
  // and `onMentionsChange` mirror CommentComposer's contract so consumers
  // moving off it don't have to relearn the callback shape.
  mentions = false,
  mentionUsers,
  onMentionsChange,
  onChange,
  value,
  defaultValue,
  placeholder = 'Enter Task Title',
  ...rest
}, ref) {
  // Resolve string-or-boolean toggles → the string that actually renders.
  const titleText = title === true ? 'Title' : (title || null);
  const supportingTextText = supportingText === true
    ? 'This is supporting text'
    : (supportingText || null);
  // Info supports either shape: `showInfo` + `infoText` (Input's shape) OR
  // `info` alone (`true` → default tooltip, string → that tooltip).
  const infoResolved = showInfo
    ? (infoText || 'More info')
    : (info === true ? 'More info' : (info || null));

  // Attachment / speech-to-text / bottomButton / moreActions are all
  // richText-only affordances so they don't contribute to the enhanced
  // gate on their own — see `showFooter` below. Only real label + helper
  // props (title, info, mandatory, supportingText, maxLength) or richText
  // itself toggle the enhanced layout.
  const enhanced = !!(titleText || infoResolved || mandatory || supportingTextText || richText ||
                     maxLength);

  if (!enhanced) {
    // Legacy plain textarea — untouched contract.
    const cls = [
      styles.textarea,
      variant === 'error' ? styles.textareaError : '',
      className || '',
    ].filter(Boolean).join(' ');
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cls}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        maxLength={maxLength}
        {...rest}
      />
    );
  }

  return (
    <EnhancedTextarea
      ref={ref}
      variant={variant}
      className={className}
      rows={rows}
      disabled={disabled}
      title={titleText}
      info={infoResolved}
      mandatory={mandatory}
      supportingText={supportingTextText}
      richText={richText}
      maxLength={maxLength}
      bottomButton={bottomButton}
      speechToText={speechToText}
      onSpeechClick={onSpeechClick}
      attachment={attachment}
      onAttachmentClick={onAttachmentClick}
      onAttachmentFiles={onAttachmentFiles}
      moreActions={moreActions}
      mentions={mentions}
      mentionUsers={mentionUsers}
      onMentionsChange={onMentionsChange}
      onChange={onChange}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      {...rest}
    />
  );
});

// ────────────────────────────────────────────────────────────────────────
// Enhanced layout — labeled card with optional rich-text toolbar. Kept as
// an inner component so the exported Textarea can still forward its ref
// to the underlying editor node in either shape.

// Custom bullet-list glyph — Solar's list icons don't include the leading
// dot markers, so we ship a hand-drawn SVG at 1px stroke to match the
// design-system icon weight. Kept inline so it lives with the toolbar
// definition instead of a one-off shared file.
const BulletListIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="3" cy="4"  r="1" fill={color} />
    <circle cx="3" cy="8"  r="1" fill={color} />
    <circle cx="3" cy="12" r="1" fill={color} />
    <line x1="6" y1="4"  x2="14" y2="4"  stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="6" y1="8"  x2="14" y2="8"  stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="6" y1="12" x2="14" y2="12" stroke={color} strokeWidth="1" strokeLinecap="round" />
  </svg>
);

// Numbered-list glyph (design-supplied): 1 / 2 / 3 beside three lines, an
// outlined 1px shape like the other toolbar icons. Tints with currentColor.
const NumberedListIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path fill={color} d="M9.3 11.5C9.02386 11.5 8.8 11.7239 8.8 12C8.8 12.2761 9.02386 12.5 9.3 12.5V11.5ZM21 12.5C21.2761 12.5 21.5 12.2761 21.5 12C21.5 11.7239 21.2761 11.5 21 11.5V12.5ZM9.3 5.5C9.02386 5.5 8.8 5.72386 8.8 6C8.8 6.27614 9.02386 6.5 9.3 6.5V5.5ZM21 6.5C21.2761 6.5 21.5 6.27614 21.5 6C21.5 5.72386 21.2761 5.5 21 5.5V6.5ZM9.3 17.5C9.02386 17.5 8.8 17.7239 8.8 18C8.8 18.2761 9.02386 18.5 9.3 18.5V17.5ZM21 18.5C21.2761 18.5 21.5 18.2761 21.5 18C21.5 17.7239 21.2761 17.5 21 17.5V18.5ZM2.91032 4.42243C2.68428 4.58105 2.62963 4.89288 2.78825 5.11892C2.94688 5.34496 3.25871 5.39961 3.48474 5.24099L2.91032 4.42243ZM4.38272 4H4.88272C4.88272 3.81346 4.77887 3.64243 4.61336 3.55637C4.44785 3.47032 4.2482 3.48357 4.0955 3.59072L4.38272 4ZM3.88272 7.95062C3.88272 8.22676 4.10657 8.45062 4.38272 8.45062C4.65886 8.45062 4.88272 8.22676 4.88272 7.95062H3.88272ZM2.5 11.2099C2.5 11.486 2.72386 11.7099 3 11.7099C3.27614 11.7099 3.5 11.486 3.5 11.2099H2.5ZM5.37037 11.2099L5.75 11.5353C5.82767 11.4447 5.87037 11.3292 5.87037 11.2099H5.37037ZM3 13.9753L2.62037 13.6499C2.4933 13.7982 2.46415 14.0068 2.54574 14.1842C2.62734 14.3616 2.80474 14.4753 3 14.4753V13.9753ZM5.37037 14.4753C5.64651 14.4753 5.87037 14.2515 5.87037 13.9753C5.87037 13.6992 5.64651 13.4753 5.37037 13.4753V14.4753ZM2.5 17.037C2.5 17.3132 2.72386 17.537 3 17.537C3.27614 17.537 3.5 17.3132 3.5 17.037H2.5ZM4.18519 17.5247C3.90904 17.5247 3.68519 17.7485 3.68519 18.0247C3.68519 18.3008 3.90904 18.5247 4.18519 18.5247V17.5247ZM3.5 19.0123C3.5 18.7362 3.27614 18.5123 3 18.5123C2.72386 18.5123 2.5 18.7362 2.5 19.0123H3.5ZM9.3 12.5H21V11.5H9.3V12.5ZM9.3 6.5H21V5.5H9.3V6.5ZM9.3 18.5H21V17.5H9.3V18.5ZM3.48474 5.24099L4.66993 4.40928L4.0955 3.59072L2.91032 4.42243L3.48474 5.24099ZM3.88272 4V7.95062H4.88272V4H3.88272ZM3.5 11.2099C3.5 10.8315 3.80677 10.5247 4.18519 10.5247V9.52469C3.25448 9.52469 2.5 10.2792 2.5 11.2099H3.5ZM4.18519 10.5247C4.5636 10.5247 4.87037 10.8315 4.87037 11.2099H5.87037C5.87037 10.2792 5.11589 9.52469 4.18519 9.52469V10.5247ZM4.99074 10.8845L2.62037 13.6499L3.37963 14.3007L5.75 11.5353L4.99074 10.8845ZM3 14.4753H5.37037V13.4753H3V14.4753ZM5.87037 17.037C5.87037 16.1339 5.02666 15.5494 4.18519 15.5494V16.5494C4.65283 16.5494 4.87037 16.8492 4.87037 17.037H5.87037ZM4.18519 15.5494C3.34371 15.5494 2.5 16.1339 2.5 17.037H3.5C3.5 16.8492 3.71754 16.5494 4.18519 16.5494V15.5494ZM4.18519 18.5247C5.02666 18.5247 5.87037 17.9401 5.87037 17.037H4.87037C4.87037 17.2249 4.65283 17.5247 4.18519 17.5247V18.5247ZM4.87037 19.0123C4.87037 19.2002 4.65283 19.5 4.18519 19.5V20.5C5.02666 20.5 5.87037 19.9154 5.87037 19.0123H4.87037ZM4.18519 19.5C3.71754 19.5 3.5 19.2002 3.5 19.0123H2.5C2.5 19.9154 3.34371 20.5 4.18519 20.5V19.5ZM4.18519 18.5247C4.65283 18.5247 4.87037 18.8245 4.87037 19.0123H5.87037C5.87037 18.1093 5.02666 17.5247 4.18519 17.5247V18.5247Z" />
  </svg>
);

// Attachment is a slot the parent wires up (file input, upload drawer, …)
// so it renders outside the formatting toggles that just call execCommand.
// Order matches Figma: Bold | Italic | Underline | Strikethrough | Bullets,
// then Numbered list.
const RICH_TOOLBAR = [
  { cmd: 'bold',                icon: 'solar:text-bold-linear',      label: 'Bold' },
  { cmd: 'italic',              icon: 'solar:text-italic-linear',    label: 'Italic' },
  { cmd: 'underline',           icon: 'solar:text-underline-linear', label: 'Underline' },
  { cmd: 'strikeThrough',       icon: 'solar:text-cross-linear',     label: 'Strikethrough' },
  { cmd: 'insertUnorderedList', icon: <BulletListIcon />,            label: 'Bullet list' },
  { cmd: 'insertOrderedList',   icon: <NumberedListIcon />,          label: 'Numbered list' },
];

// eslint-disable-next-line no-unused-vars — split out purely for readability
const EnhancedTextarea = forwardRef(function EnhancedTextarea({
  variant,
  className,
  rows,
  disabled,
  title,
  info,
  mandatory,
  supportingText,
  richText,
  maxLength,
  bottomButton,
  speechToText,
  onSpeechClick,
  attachment,
  onAttachmentClick,
  onAttachmentFiles,
  moreActions,
  mentions,
  mentionUsers,
  onMentionsChange,
  onChange,
  value,
  defaultValue,
  placeholder,
  ...rest
}, ref) {
  const isControlled = value !== undefined;
  const initial = isControlled ? value : (defaultValue ?? '');
  const [text, setText] = useState(initial);
  const [focused, setFocused] = useState(false);
  const editorRef = useRef(null);

  // Attach the forwarded ref to the underlying editable node so callers
  // can focus / measure the input in either shape.
  const setRefs = useCallback((el) => {
    editorRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }, [ref]);

  // Keep controlled contentEditable in sync — otherwise React's reconciler
  // never touches innerHTML after mount and the field ignores prop updates.
  // The editor's own edits come back as `value`; rewriting innerHTML for
  // those would throw the caret to the start (e.g. after a paste, whose
  // markup never matches its sanitized copy exactly), so they're skipped.
  const emittedRef = useRef(null);
  useEffect(() => {
    if (!richText || !isControlled) return;
    if (value === emittedRef.current) return;
    const safe = sanitizeRichText(value ?? '');
    if (editorRef.current && editorRef.current.innerHTML !== safe) {
      editorRef.current.innerHTML = safe;
      numberListItems(editorRef.current);
    }
  }, [richText, isControlled, value]);

  // Count the value on screen: the prop when controlled (local `text` is
  // only kept for uncontrolled use, so it would stay at its first value).
  const current = isControlled ? (value ?? '') : text;
  // Controlled rich text counts the prop: the sync effect writes innerHTML
  // after this render, so the editor's innerText would still be the old
  // value and a value set from code would keep showing the placeholder.
  const plainLen = richText
    ? (isControlled ? plainTextLen(current) : (editorRef.current?.innerText?.length ?? plainTextLen(current)))
    : current.length;

  const handleTextareaChange = (e) => {
    if (!isControlled) setText(e.target.value);
    onChange?.(e.target.value, e);
  };

  // ── Mention state (richText only) ──────────────────────────────────
  const mentionsOn = !!(richText && mentions && Array.isArray(mentionUsers));
  const [mentionCtx, setMentionCtx] = useState(null); // { range, query } | null
  const [mentionIdx, setMentionIdx] = useState(0);
  const mentionMatches = useMemo(() => {
    if (!mentionCtx || !mentionsOn) return [];
    const q = (mentionCtx.query || '').toLowerCase();
    const pool = mentionUsers || [];
    const filtered = q
      ? pool.filter(u => (u.name || '').toLowerCase().includes(q))
      : pool;
    return filtered.slice(0, 8);
  }, [mentionCtx, mentionsOn, mentionUsers]);
  useEffect(() => { setMentionIdx(0); }, [mentionCtx?.query]);

  const handleRichInput = () => {
    const el = editorRef.current;
    if (!el) return;
    // Deleting everything leaves a stray line break behind (innerText "\n"),
    // which would hide the placeholder and count as a character; clear it.
    // An empty bullet or numbered list is kept.
    if (!el.innerText.replace(/\n/g, '') && !el.querySelector('ul, ol')) el.innerHTML = '';
    // Blank list items are spacing: unnumbered, and skipped by the numbers.
    numberListItems(el);
    const html = el.innerHTML;
    // Use the shared serializer so mention chips report as "@Name" and
    // don't inflate the plain-text length with their inner HTML.
    const plain = mentionsOn ? serializePlain(el) : (el.innerText || '');
    // Enforce maxLength on the serialized plain-text length so the counter
    // and the cap agree (an <b>bold</b> tag doesn't cost characters).
    if (maxLength && plain.length > maxLength) {
      el.innerHTML = sanitizeRichText(current);
      return;
    }
    if (!isControlled) setText(html);
    emittedRef.current = html;
    onChange?.(html, plain);
    if (mentionsOn) {
      setMentionCtx(detectMention(el));
      onMentionsChange?.(collectMentions(el));
    }
  };

  const handleRichSelect = () => {
    if (!mentionsOn) return;
    const el = editorRef.current;
    if (!el) return;
    setMentionCtx(detectMention(el));
  };

  const insertMentionChip = (user) => {
    const el = editorRef.current;
    if (!el || !mentionCtx) return;
    el.focus();
    mentionCtx.range.deleteContents();
    const chip = createMentionChip(user);
    const space = document.createTextNode(' ');
    mentionCtx.range.insertNode(space);
    mentionCtx.range.insertNode(chip);
    caretAfter(space);
    setMentionCtx(null);
    // Re-serialize now that the DOM changed under React.
    handleRichInput();
  };

  const handleRichKeyDown = (e) => {
    const mentionOpen = mentionsOn && mentionCtx && mentionMatches.length > 0;
    // Enter on an empty list item steps out of the list (see richTextLists).
    if (!mentionOpen && e.key === 'Enter' && !e.shiftKey && exitEmptyListItem(editorRef.current)) {
      e.preventDefault();
      handleRichInput();
      return;
    }
    // "1. " starts a numbered list, "- " or "* " a bullet list.
    if (!mentionOpen && e.key === ' ' && applyListShortcut(editorRef.current)) {
      e.preventDefault();
      handleRichInput();
      return;
    }
    // Backspace at the start of a list item removes its bullet or number.
    if (!mentionOpen && e.key === 'Backspace' && unlistItem(editorRef.current)) {
      e.preventDefault();
      handleRichInput();
      return;
    }
    // Tab indents a list item under the one above; Shift+Tab brings it back.
    if (!mentionOpen && e.key === 'Tab') {
      const moved = e.shiftKey ? outdentListItem(editorRef.current) : nestListItem(editorRef.current);
      if (moved) {
        e.preventDefault();
        handleRichInput();
        return;
      }
    }
    if (!mentionOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIdx((i) => (i + 1) % mentionMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIdx((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMentionChip(mentionMatches[mentionIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionCtx(null);
    }
  };

  // Paste sanitized, at the caret: clipboard HTML (Word, web pages) is
  // cleaned first, and plain text keeps its line breaks (the editor is
  // pre-wrap). execCommand inserts at the selection and keeps undo working.
  const handleRichPaste = (e) => {
    const data = e.clipboardData;
    if (!data) return;
    const html = data.getData('text/html');
    const text = data.getData('text/plain');
    if (!html && !text) return;
    e.preventDefault();
    // A list copied as HTML stays a list. Otherwise lines like "1. …" or
    // "- …" in the text become one (sources such as Word and PDFs often
    // copy lists as plain paragraphs).
    const htmlHasList = /<(ul|ol)[\s>]/i.test(html);
    const listHtml = !htmlHasList ? textToListHtml(text) : null;
    if (listHtml) {
      document.execCommand('insertHTML', false, sanitizeRichText(listHtml));
    } else if (html) {
      // Drop the page wrapper and <style>/<meta> a copy from Word or a
      // browser carries, keeping only the formatting the editor supports.
      const body = html.replace(/^[\s\S]*?<body[^>]*>|<\/body>[\s\S]*$/gi, '').replace(/<!--[\s\S]*?-->/g, '');
      document.execCommand('insertHTML', false, sanitizeRichText(body));
    } else {
      document.execCommand('insertText', false, text);
    }
    handleRichInput();
  };

  const handleBeforeInput = (e) => {
    if (!maxLength) return;
    const el = editorRef.current;
    if (!el) return;
    const inserting = typeof e.data === 'string' ? e.data.length : 0;
    if (!inserting) return;
    const remaining = maxLength - (el.innerText?.length ?? 0);
    if (remaining <= 0) { e.preventDefault(); return; }
    if (inserting > remaining) e.preventDefault();
  };

  // Which formatting applies at the caret / selection, so the toolbar can
  // show those buttons as on. Read from the browser's editing state.
  const [activeFormats, setActiveFormats] = useState(() => new Set());
  const refreshFormats = useCallback(() => {
    const el = editorRef.current;
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
    const next = new Set();
    RICH_TOOLBAR.forEach(({ cmd }) => {
      try { if (document.queryCommandState(cmd)) next.add(cmd); } catch { /* unsupported */ }
    });
    setActiveFormats(prev => (prev.size === next.size && [...next].every(c => prev.has(c)) ? prev : next));
  }, []);
  useEffect(() => {
    if (!richText) return undefined;
    document.addEventListener('selectionchange', refreshFormats);
    return () => document.removeEventListener('selectionchange', refreshFormats);
  }, [richText, refreshFormats]);

  const runFormat = (cmd) => {
    editorRef.current?.focus();
    // Bullets started inside a numbered item nest under the number above,
    // rather than the browser turning that numbered item into a bullet.
    if (cmd === 'insertUnorderedList') {
      const sel = window.getSelection();
      const anchor = sel?.anchorNode?.nodeType === 1 ? sel.anchorNode : sel?.anchorNode?.parentElement;
      if (anchor?.closest('li')?.parentElement?.tagName === 'OL' && nestListItem(editorRef.current, 'UL')) {
        handleRichInput();
        refreshFormats();
        return;
      }
    }
    // execCommand is the pragmatic path here — a full ProseMirror stack
    // would dwarf everything else this component does, and every browser
    // still supports the four toggles the Figma toolbar shows.
    document.execCommand(cmd, false, null);
    handleRichInput();
    refreshFormats();
  };

  const wrapClass = [
    styles.enhWrap,
    variant === 'error' ? styles.enhError : '',
    disabled ? styles.enhDisabled : '',
    focused ? styles.enhFocused : '',
    className || '',
  ].filter(Boolean).join(' ');

  // Attachment, speech-to-text, moreActions, and the bottomButton are all
  // rich-text-only affordances — they live inside the formatting footer,
  // so none of them surface when richText is off. Toggling richText on
  // reveals the whole footer bar; the sub-flags then decide which slots
  // are populated.
  const showAttachment = richText && !!attachment;
  const showFooter = richText;
  const showCounter = typeof maxLength === 'number';
  const attachmentAccept = typeof attachment === 'object' && attachment ? attachment.accept : undefined;
  const attachmentMultiple = typeof attachment === 'object' && attachment ? !!attachment.multiple : false;
  const attachInputRef = useRef(null);
  const handleAttachClick = () => {
    // If the parent wired an explicit click handler use that (e.g. it wants
    // to open its own upload drawer). Otherwise fall back to the native
    // file picker via a hidden <input type="file">.
    if (onAttachmentClick) { onAttachmentClick(); return; }
    attachInputRef.current?.click();
  };

  return (
    <div className={styles.enhRoot}>
      {(title || mandatory || info) && (
        <div className={styles.enhLabelRow}>
          <label className={styles.enhLabel}>{title}</label>
          {info && (
            <Tooltip label={info}>
              <span className={styles.enhInfo} aria-label={info}>
                <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-300)" />
              </span>
            </Tooltip>
          )}
          {mandatory && (
            <span className={styles.enhRequired} aria-hidden="true" />
          )}
        </div>
      )}

      <div className={wrapClass}>
        <div className={styles.enhBody}>
          {richText ? (
            <div
              ref={setRefs}
              role="textbox"
              aria-multiline="true"
              aria-label={title || placeholder}
              contentEditable={!disabled}
              suppressContentEditableWarning
              className={styles.enhEditor}
              data-empty={plainLen === 0 ? 'true' : 'false'}
              data-placeholder={placeholder}
              onInput={handleRichInput}
              onBeforeInput={handleBeforeInput}
              onKeyDown={handleRichKeyDown}
              onPaste={handleRichPaste}
              onKeyUp={handleRichSelect}
              onClick={handleRichSelect}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                // Give a click on a picker item time to register before
                // the popover unmounts.
                setTimeout(() => setMentionCtx(null), 150);
              }}
              {...rest}
            />
          ) : (
            <textarea
              ref={setRefs}
              rows={rows}
              className={styles.enhTextarea}
              disabled={disabled}
              placeholder={placeholder}
              value={isControlled ? value : undefined}
              defaultValue={isControlled ? undefined : defaultValue}
              onChange={handleTextareaChange}
              maxLength={maxLength}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              {...rest}
            />
          )}
          {showCounter && (
            <span className={styles.enhCounter} aria-live="polite">
              {plainLen}/{maxLength}
            </span>
          )}
        </div>

        {showFooter && (
          <div className={styles.enhFooter}>
            <div className={styles.enhToolbar}>
              {showAttachment && (
                <>
                  <ToolbarButton
                    icon="solar:paperclip-linear"
                    label="Attach file"
                    onClick={handleAttachClick}
                    disabled={disabled}
                  />
                  {!onAttachmentClick && (
                    <input
                      ref={attachInputRef}
                      type="file"
                      accept={attachmentAccept}
                      multiple={attachmentMultiple}
                      hidden
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length) onAttachmentFiles?.(files);
                        // reset so selecting the same file twice re-fires.
                        e.target.value = '';
                      }}
                    />
                  )}
                  <span className={styles.enhToolbarDivider} aria-hidden="true" />
                </>
              )}
              {richText && RICH_TOOLBAR.map((btn, i) => (
                <ToolbarButton
                  key={btn.cmd}
                  icon={btn.icon}
                  label={btn.label}
                  onClick={() => runFormat(btn.cmd)}
                  disabled={disabled}
                  showDivider={i > 0}
                  active={activeFormats.has(btn.cmd)}
                />
              ))}
              {moreActions && moreActions.map((a, i) => (
                <ToolbarButton
                  key={`m-${i}`}
                  icon={a.icon}
                  label={a.label}
                  onClick={a.onClick}
                  disabled={disabled || a.disabled}
                  showDivider
                />
              ))}
            </div>
            <div className={styles.enhFooterEnd}>
              {speechToText && (
                <ToolbarButton
                  icon="solar:microphone-3-linear"
                  label="Speech to text"
                  onClick={onSpeechClick}
                  disabled={disabled}
                  tone="primary"
                />
              )}
              {bottomButton && (() => {
                // Accept `true` (default Publish) OR a config object so
                // Storybook can drive it via a plain boolean toggle.
                const cfg = typeof bottomButton === 'object' ? bottomButton : {};
                return (
                  <Button
                    variant={cfg.variant || 'primary'}
                    size="S"
                    disabled={disabled || cfg.disabled}
                    onClick={cfg.onClick}
                  >
                    {cfg.label || 'Publish'}
                  </Button>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {supportingText && (
        <span
          className={[
            styles.enhSupporting,
            variant === 'error' ? styles.enhSupportingError : '',
          ].filter(Boolean).join(' ')}
        >
          {supportingText}
        </span>
      )}

      {mentionsOn && mentionCtx && mentionMatches.length > 0 && editorRef.current && (
        <MentionMenu
          anchor={editorRef.current}
          matches={mentionMatches}
          activeIdx={mentionIdx}
          onPick={insertMentionChip}
        />
      )}
    </div>
  );
});

// Portaled @mention picker — anchored under (or above) the editor. Kept
// inline so the enhanced textarea is a self-contained primitive with no
// cross-package coupling.
function MentionMenu({ anchor, matches, activeIdx, onPick }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const compute = () => {
      const r = anchor.getBoundingClientRect();
      const margin = 8;
      const menuH = Math.min(280, 40 + matches.length * 40);
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const flipUp = spaceBelow < menuH && r.top > menuH + margin;
      const top = flipUp ? Math.max(margin, r.top - menuH - 4) : r.bottom + 4;
      setPos({ top, left: r.left, width: Math.max(r.width, 240) });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [anchor, matches.length]);
  if (!pos) return null;
  return createPortal(
    <div className={styles.mentionMenu} style={{ top: pos.top, left: pos.left, width: pos.width }} role="menu">
      {matches.map((u, i) => (
        <button
          key={u.id || u.name}
          type="button"
          role="menuitem"
          className={[styles.mentionItem, i === activeIdx ? styles.mentionItemActive : ''].filter(Boolean).join(' ')}
          // mousedown fires before the editor's blur closes us; use it so the
          // click actually reaches this handler.
          onMouseDown={(e) => { e.preventDefault(); onPick(u); }}
        >
          <Avatar variant="staff" initials={u.initials} size="XS" />
          <span className={styles.mentionName}>{u.name}</span>
          {u.role && <span className={styles.mentionRole}>{u.role}</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
}

function ToolbarButton({ icon, label, onClick, disabled, showDivider, tone, active = false }) {
  return (
    <>
      {showDivider && <span className={styles.enhToolbarDivider} aria-hidden="true" />}
      <button
        type="button"
        className={styles.enhToolbarBtn}
        onMouseDown={(e) => e.preventDefault()}     // preserve selection
        onClick={onClick}
        disabled={disabled}
        title={label}
        aria-label={label}
        data-tone={tone || undefined}
        data-active={active || undefined}
        aria-pressed={active}
      >
        {typeof icon === 'string'
          ? <Icon name={icon} size={16} color="currentColor" />
          : icon}
      </button>
    </>
  );
}

// Strip tags to count characters against maxLength in richText mode when
// the editor node hasn't mounted yet (e.g. the very first render).
function plainTextLen(html) {
  if (!html) return 0;
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '').length;
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.innerText || el.textContent || '').length;
}
