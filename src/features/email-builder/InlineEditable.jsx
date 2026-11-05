import { useEffect, useRef } from 'react';
import { getFontStack } from './googleFonts';
import { isGradient } from './colorHelpers';
import { formatLetterSpacingCss } from './dimUnits';
import { sanitizeRichText } from '../../lib/sanitizeHtml';

// In-place text editor for Heading/Text blocks. Renders a contentEditable
// element so users can click-and-type directly on the canvas, **and** select
// portions of the text for inline formatting (bold/italic/link/etc. applied
// via the floating SelectionToolbar). On blur we commit the new HTML back
// into the document.
//
// Text storage model: props.text is an HTML string. Inline tags like
// <strong>/<em>/<u>/<s>/<code>/<a> are preserved across edits so per-range
// formatting works. Plain text without HTML still works, it's valid HTML.
// Newlines (\n) and <br> are both supported; we normalize to <br> on save.

function paddingCss(padding) {
  if (!padding) return undefined;
  return `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`;
}

// Build CSS border shorthand from a per-side entry: `{ width, color, style }`.
function _sideBorder(side) {
  if (!side) return undefined;
  return `${side.width || 1}px ${side.style || 'solid'} ${side.color || '#3A485F'}`;
}

function buildStyle(style, type) {
  // Per-side wins over uniform when present. null sides simply omit
  // their border-* property so that edge has no border.
  const borderSides = style.borderSides;
  const perSide = borderSides && Object.values(borderSides).some(Boolean) ? {
    borderTop:    _sideBorder(borderSides.top),
    borderRight:  _sideBorder(borderSides.right),
    borderBottom: _sideBorder(borderSides.bottom),
    borderLeft:   _sideBorder(borderSides.left),
  } : null;
  const border = !perSide && style.borderWidth
    ? `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor || '#3A485F'}`
    : undefined;
  const textIsGradient = isGradient(style.color);
  const bgIsGradient = isGradient(style.backgroundColor);
  // Gradient text uses background-clip: text so the gradient becomes the
  // text fill. Color is made transparent so the gradient shows through.
  // Caret color is set to the gradient's first stop so typing stays visible.
  const gradTextStyles = textIsGradient ? {
    backgroundImage: style.color,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    caretColor: '#3A485F',
  } : {};
  return {
    margin: 0,
    color: textIsGradient ? undefined : style.color,
    fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
    // Default Heading weight to 700 so the canvas matches the exported
    // email even when Tailwind's preflight strips the browser's default
    // bold from <h1>/<h2>/<h3>. Text blocks default to 400 for the same
    // reason. Explicit user-set weights pass through unchanged.
    fontWeight: style.fontWeight ?? (type === 'Heading' ? 700 : 400),
    fontStyle: style.fontStyle,
    textDecoration: style.textDecoration,
    textAlign: style.blockAlign || style.textAlign,
    textTransform: style.textTransform,
    lineHeight: style.lineHeight ?? 1.5,
    letterSpacing: formatLetterSpacingCss(style.letterSpacing),
    padding: paddingCss(style.padding),
    // backgroundColor only takes solids; gradients go via backgroundImage.
    backgroundColor: bgIsGradient ? undefined : style.backgroundColor,
    backgroundImage: bgIsGradient ? style.backgroundColor : (textIsGradient ? style.color : undefined),
    border,
    ...(perSide || {}),
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    fontFamily: style.fontFamily ? getFontStack(style.fontFamily) : 'inherit',
    outline: 'none',
    whiteSpace: 'pre-wrap',
    ...gradTextStyles,
  };
}

// Convert stored text into the HTML the editable element holds in the DOM.
// - For lists, split on newline and wrap each non-empty line in <li>.
// - For non-lists, normalize raw newlines to <br/> so they show as line breaks.
// Empty content renders one <li><br></li> or nothing so the caret has a home.
// Stored text can come from a shared template authored by a teammate, so it is
// sanitized before it reaches the live DOM (the rich-text profile keeps the
// <b>/<i>/<u>/<s>/<strike>/<code>/<a> tags the SelectionToolbar produces).
function textToInnerHtml(text, listStyle) {
  const safe = text || '';
  if (listStyle === 'bullet' || listStyle === 'number') {
    const lines = safe.split(/\n/);
    const items = lines.length ? lines : [''];
    return sanitizeRichText(items.map(l => `<li>${l || '<br>'}</li>`).join(''));
  }
  // Preserve existing inline HTML; only convert bare newlines.
  return sanitizeRichText(safe.replace(/\n/g, '<br>'));
}

// Read the current DOM back into the stored text format. For lists we walk
// the <li> children; otherwise we read innerHTML and normalize <br> → \n.
function innerHtmlToText(el, listStyle) {
  if (!el) return '';
  if (listStyle === 'bullet' || listStyle === 'number') {
    const items = [...el.querySelectorAll('li')].map(li => li.innerHTML.trim().replace(/<br\s*\/?>$/i, ''));
    return items.join('\n');
  }
  return el.innerHTML.replace(/<br\s*\/?>/gi, '\n');
}

export function InlineEditable({ blockId, type, level, text, style, listStyle, onCommit }) {
  const ref = useRef(null);
  const isList = listStyle === 'bullet' || listStyle === 'number';
  const Tag = isList
    ? (listStyle === 'number' ? 'ol' : 'ul')
    : (type === 'Heading' ? (level || 'h2') : 'p');

  // Sync external text → DOM only when the element is not focused, so typing
  // never races with a re-render and the caret position is preserved.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const next = textToInnerHtml(text, listStyle);
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [text, listStyle]);

  // Structural rebuild on list-style change. When the user toggles bullet
  // or numbered while the element is focused, the effect above bails out
  // (to preserve caret): but we still need to rewrite the HTML so the
  // <p> ↔ <ul>/<ol> change actually takes hold. This runs only on
  // listStyle transitions, never on plain text edits.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = textToInnerHtml(text, listStyle);
    if (el.innerHTML !== next) {
      el.innerHTML = next;
      // Re-place the caret at the end of the new content so the user can
      // keep typing without losing context.
      if (document.activeElement === el) {
        const sel = window.getSelection?.();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel?.removeAllRanges?.();
        sel?.addRange?.(range);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listStyle]);

  const handleBlur = () => {
    const next = innerHtmlToText(ref.current, listStyle);
    if (next !== text) onCommit(blockId, next);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); ref.current?.blur(); }
  };

  return (
    <Tag
      ref={ref}
      data-eb-editable={type}
      data-eb-block-id={blockId}
      style={buildStyle(style, type)}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      spellCheck={false}
    />
  );
}
