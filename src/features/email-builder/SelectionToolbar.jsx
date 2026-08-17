import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import styles from './EmailBuilder.module.css';

// Floating toolbar that pops up when the user selects text inside a Text or
// Heading block on the canvas. Provides quick access to **range-level**
// formatting — bold, italic, underline, strikethrough, inline code, link —
// applied via document.execCommand. Block-level controls (font size, padding,
// etc.) continue to live in the right-hand property panel.
//
// Discovery flow:
//   1. Select text on the canvas → toolbar floats above the selection.
//   2. Click a button → execCommand applies inline formatting to the range.
//   3. Click outside / collapse the selection → toolbar disappears.
//   4. "Edit" jumps to the Design tab of the property panel for block-level
//      adjustments.

const STYLE_PRESETS = [
  { key: 'title',    label: 'Title',    fontSize: 24, fontWeight: 'bold',   level: 'h1' },
  { key: 'subtitle', label: 'Subtitle', fontSize: 18, fontWeight: 'bold',   level: 'h2' },
  { key: 'heading',  label: 'Heading',  fontSize: 16, fontWeight: 'bold',   level: 'h3' },
  { key: 'body',     label: 'Body',     fontSize: 14, fontWeight: 'normal', level: null  },
];

function findEditableAncestor(node) {
  let el = node;
  while (el && el.nodeType !== 1) el = el.parentElement;
  while (el) {
    if (el.dataset?.ebEditable) return el;
    el = el.parentElement;
  }
  return null;
}

// Re-focus the editable element and restore the selection (a Range we cached
// before the toolbar button click). Without this the act of clicking a button
// blurs the contentEditable and the execCommand has nothing to operate on.
function restoreSelection(range) {
  if (!range) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function SelectionToolbar() {
  const [state, setState] = useState({ visible: false, top: 0, left: 0 });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const rangeRef = useRef(null);              // last selection range
  const editableElRef = useRef(null);          // last editable element
  const updateBlock = useAppStore(s => s.updateBlock);
  const selectedBlockId = useAppStore(s => s.selectedBlockId);
  const doc = useAppStore(s => s.emailDocument);
  const selectedBlock = doc?.[selectedBlockId];

  // Listen for selection changes anywhere in the document. When the selection
  // is non-empty and sits inside one of our editables, position the toolbar.
  useEffect(() => {
    const onChange = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        // Don't hide if the focus moved to the toolbar (link input etc.)
        if (document.activeElement?.closest?.('[data-eb-selection-toolbar]')) return;
        setState(s => s.visible ? { ...s, visible: false } : s);
        setLinkOpen(false);
        return;
      }
      const range = sel.getRangeAt(0);
      const editable = findEditableAncestor(range.commonAncestorContainer);
      if (!editable) {
        setState(s => s.visible ? { ...s, visible: false } : s);
        return;
      }
      rangeRef.current = range.cloneRange();
      editableElRef.current = editable;
      const rect = range.getBoundingClientRect();
      // Center toolbar above the selection. Clamp inside the viewport.
      const top = Math.max(8, rect.top - 52 + window.scrollY);
      const left = Math.max(8, Math.min(window.innerWidth - 360, rect.left + rect.width / 2 - 180 + window.scrollX));
      setState({ visible: true, top, left });
    };
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, []);

  // Hide the toolbar on Escape.
  useEffect(() => {
    if (!state.visible) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setState(s => ({ ...s, visible: false }));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.visible]);

  // Apply an inline format to the current selection via execCommand. Buttons
  // call this with one of the supported commands. Pre-restores the selection
  // because the button click stole focus from the contentEditable.
  const apply = (command, value = null) => {
    const editable = editableElRef.current;
    if (!editable) return;
    editable.focus();
    restoreSelection(rangeRef.current);
    try {
      document.execCommand(command, false, value);
    } catch { /* fall back silently */ }
    // Commit the new HTML to the document immediately so the change persists
    // even if the user clicks elsewhere before the editable blurs.
    const id = editable.dataset.ebBlockId;
    const listStyle = doc?.[id]?.data?.props?.listStyle;
    const isList = listStyle === 'bullet' || listStyle === 'number';
    let text;
    if (isList) {
      text = [...editable.querySelectorAll('li')].map(li => li.innerHTML.replace(/<br\s*\/?>$/i, '')).join('\n');
    } else {
      text = editable.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    }
    if (id) updateBlock(id, prev => ({ ...prev, data: { ...prev.data, props: { ...(prev.data?.props || {}), text } } }));
    // Re-cache the (possibly modified) range
    const sel = document.getSelection();
    if (sel?.rangeCount) rangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  // Wrap selection with <code>…</code>. execCommand doesn't have a code op,
  // so we do it by hand using the Range API.
  const wrapCode = () => {
    const editable = editableElRef.current;
    const r = rangeRef.current;
    if (!editable || !r) return;
    editable.focus();
    restoreSelection(r);
    const code = document.createElement('code');
    try { r.surroundContents(code); }
    catch { /* selection spans block boundaries — execCommand fallback */ }
    apply('styleWithCSS', false); // no-op: just triggers a commit cycle
  };

  // Open / close link mini-input.
  const startLink = () => {
    setLinkOpen(true);
    // Pre-fill from existing <a> if the cursor is inside one
    const node = rangeRef.current?.commonAncestorContainer;
    let el = node?.nodeType === 1 ? node : node?.parentElement;
    while (el && el.tagName !== 'A' && el !== editableElRef.current) el = el.parentElement;
    setLinkValue(el?.tagName === 'A' ? el.getAttribute('href') || '' : '');
  };
  const submitLink = () => {
    const url = linkValue.trim();
    if (!url) {
      apply('unlink');
    } else {
      apply('createLink', url.startsWith('http') ? url : `https://${url}`);
    }
    setLinkOpen(false);
  };

  // Apply a style preset to the **whole** block (block-level, not selection).
  const applyPreset = (preset) => {
    const id = editableElRef.current?.dataset?.ebBlockId;
    if (!id) return;
    updateBlock(id, prev => {
      const next = structuredClone(prev);
      next.data = next.data || {};
      next.data.style = next.data.style || {};
      next.data.style.fontSize = preset.fontSize;
      next.data.style.fontWeight = preset.fontWeight;
      next.data.props = next.data.props || {};
      if (next.type === 'Heading' && preset.level) next.data.props.level = preset.level;
      return next;
    });
  };

  if (!state.visible) return null;

  const blockType = selectedBlock?.type;
  const showStyleDropdown = blockType === 'Heading' || blockType === 'Text';

  return createPortal(
    <div
      data-eb-selection-toolbar
      className={styles.selectionToolbar}
      style={{ top: state.top, left: state.left }}
      // Stop mousedown from collapsing the selection.
      onMouseDown={(e) => e.preventDefault()}
    >
      {showStyleDropdown && (
        <>
          <StyleDropdown onPick={applyPreset} />
          <div className={styles.selectionToolbarDivider} />
        </>
      )}
      {!linkOpen ? (
        <>
          <button className={styles.selectionToolbarBtn} title="Link" onClick={startLink} aria-label="Link">
            <Icon name="solar:link-linear" size={14} color="currentColor" />
          </button>
          <div className={styles.selectionToolbarDivider} />
          <button className={styles.selectionToolbarBtn} title="Bold" onClick={() => apply('bold')} aria-label="Bold"><b>B</b></button>
          <button className={styles.selectionToolbarBtn} title="Italic" onClick={() => apply('italic')} aria-label="Italic"><i>I</i></button>
          <button className={styles.selectionToolbarBtn} title="Underline" onClick={() => apply('underline')} aria-label="Underline"><u>U</u></button>
          <button className={styles.selectionToolbarBtn} title="Strikethrough" onClick={() => apply('strikeThrough')} aria-label="Strikethrough"><s>S</s></button>
          <button className={styles.selectionToolbarBtn} title="Code" onClick={wrapCode} aria-label="Code">{'<>'}</button>
        </>
      ) : (
        <>
          <input aria-label="Link URL"
            autoFocus
            className={styles.selectionToolbarLinkInput}
            value={linkValue}
            placeholder="https://example.com"
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submitLink(); }
              if (e.key === 'Escape') { e.preventDefault(); setLinkOpen(false); }
            }}
          />
          <button
            className={styles.selectionToolbarBtn}
            title={linkValue ? 'Apply link' : 'Remove link'}
            onClick={submitLink}
          >
            <Icon name="solar:check-circle-linear" size={14} color="currentColor" />
          </button>
        </>
      )}
    </div>,
    document.body
  );
}

function StyleDropdown({ onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div ref={ref} className={styles.selectionToolbarStyle}>
      <button
        className={styles.selectionToolbarStyleBtn}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Text
        <Icon name="solar:alt-arrow-down-linear" size={10} color="currentColor" />
      </button>
      {open && (
        <div className={styles.selectionToolbarStyleMenu}>
          {STYLE_PRESETS.map(p => (
            <button
              key={p.key}
              className={styles.selectionToolbarStyleItem}
              onClick={() => { onPick(p); setOpen(false); }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
