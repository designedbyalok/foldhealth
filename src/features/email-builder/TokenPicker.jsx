import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button/Button';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { TOKEN_GROUPS } from './mergeTags';

// Walk up from a text node to the nearest contentEditable block wrapper the
// canvas tags with data-eb-editable / data-eb-block-id.
function findEditableAncestor(node) {
  let el = node;
  while (el && el.nodeType !== 1) el = el.parentElement;
  while (el) {
    if (el.dataset?.ebEditable) return el;
    el = el.parentElement;
  }
  return null;
}

const TEXTUAL_TYPES = new Set(['Text', 'Heading', 'Button']);

// Commit a contentEditable block's current innerHTML back to its props.text,
// mirroring SelectionToolbar's commit so an inserted token persists even if
// the block never blurs.
function commitEditable(editable) {
  const id = editable.dataset.ebBlockId;
  if (!id) return;
  const doc = useAppStore.getState().emailDocument;
  const listStyle = doc?.[id]?.data?.props?.listStyle;
  const isList = listStyle === 'bullet' || listStyle === 'number';
  const text = isList
    ? [...editable.querySelectorAll('li')].map(li => li.innerHTML.replace(/<br\s*\/?>$/i, '')).join('\n')
    : editable.innerHTML.replace(/<br\s*\/?>/gi, '\n');
  useAppStore.getState().updateBlock(id, prev => ({
    ...prev,
    data: { ...prev.data, props: { ...(prev.data?.props || {}), text } },
  }));
}

/**
 * Toolbar dropdown that inserts a personalization token ({{first_name}}, …).
 * Inserts at the caret in the last-focused text block; if the author hasn't
 * placed a cursor, appends to the currently-selected text block; otherwise
 * nudges them to click into a block first.
 */
export function TokenPicker() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const caretRef = useRef(null); // { editable, range }
  const showToast = useAppStore(s => s.showToast);

  // Track the most recent caret/selection that lives inside a canvas editable,
  // so a click on this dropdown (which blurs the editable) doesn't lose it.
  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const editable = findEditableAncestor(range.commonAncestorContainer);
      if (editable) caretRef.current = { editable, range: range.cloneRange() };
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const insert = (key) => {
    setOpen(false);
    const text = `{{${key}}}`;
    const cached = caretRef.current;

    if (cached?.editable?.isConnected) {
      cached.editable.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(cached.range);
      let ok = false;
      try { ok = document.execCommand('insertText', false, text); } catch { /* fall through to append */ }
      if (ok) {
        commitEditable(cached.editable);
        const s = document.getSelection();
        if (s?.rangeCount) caretRef.current = { editable: cached.editable, range: s.getRangeAt(0).cloneRange() };
        return;
      }
    }

    // Fallback: append to the selected text-ish block.
    const state = useAppStore.getState();
    const id = state.selectedBlockId;
    const block = state.emailDocument?.[id];
    if (block && TEXTUAL_TYPES.has(block.type)) {
      state.updateBlock(id, prev => {
        const cur = prev.data?.props?.text || '';
        return { ...prev, data: { ...prev.data, props: { ...(prev.data?.props || {}), text: cur ? `${cur} ${text}` : text } } };
      });
      showToast(`Inserted ${text}`);
    } else {
      showToast('Click into a text block, then insert a token');
    }
  };

  const items = TOKEN_GROUPS.flatMap(({ group, tokens }) => [
    { section: group },
    ...tokens.map(t => ({ key: t.key, label: t.label, hint: t.sample })),
  ]);

  return (
    <span ref={anchorRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <Button
        variant="secondary"
        size="L"
        leadingIcon="solar:tag-linear"
        onClick={() => setOpen(o => !o)}
      >
        Personalize
      </Button>
      {open && (
        <MenuPopover
          anchorRef={anchorRef}
          items={items}
          onSelect={insert}
          onClose={() => setOpen(false)}
          ariaLabel="Insert personalization token"
          width={240}
          align="left"
        />
      )}
    </span>
  );
}
