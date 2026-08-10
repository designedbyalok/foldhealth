import { useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { blockStyleToCss, EDITABLE_INPUT_BASE_STYLE, EDITABLE_DISPLAY_STYLE } from './PreviewCanvas.utils';
import styles from './EmailBuilder.module.css';


export function EditableHtmlIframe({ html, doc }) {
  const setEmailDocument = useAppStore(s => s.setEmailDocument);
  const setSelectedBlockId = useAppStore(s => s.setSelectedBlockId);
  const selectedBlockId = useAppStore(s => s.selectedBlockId);
  const iframeRef = useRef(null);
  const lastLoadedRef = useRef(null);
  const editingRef = useRef(false);

  // (Re)load the iframe only when the html prop changes from the outside —
  // not in response to our own writes. editingRef gates against echoing
  // user typing back into srcDoc, which would blow away the selection.
  // We skip the initial mount since the load-listener effect below owns
  // the first srcdoc assignment (and must attach `load` first).
  useEffect(() => {
    if (lastLoadedRef.current === null) return; // initial mount
    if (editingRef.current) return;
    if (lastLoadedRef.current === html) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    lastLoadedRef.current = html;
    iframe.srcdoc = html;
  }, [html]);

  // Apply each block's style to its tagged element. Runs on every doc
  // change so Design-tab edits land in the iframe immediately.
  useEffect(() => {
    const iframe = iframeRef.current;
    const idoc = iframe?.contentDocument;
    if (!idoc?.body) return;
    Object.keys(doc).forEach(id => {
      if (id === 'root') return;
      const block = doc[id];
      const el = idoc.querySelector(`[data-eb-block-id="${id}"]`);
      if (!el) return;
      const css = blockStyleToCss(block?.data?.style);
      // Preserve the editor outline if this is the currently selected block.
      const isSelected = selectedBlockId === id;
      const outline = isSelected ? '; outline: 2px solid #7C5CFA; outline-offset: 2px' : '';
      el.setAttribute('style', css + outline);
    });
  }, [doc, selectedBlockId]);

  // Visual highlight for the selected block. Separate from the style effect
  // so click highlights show up even when the block has no inline style.
  useEffect(() => {
    const iframe = iframeRef.current;
    const idoc = iframe?.contentDocument;
    if (!idoc?.body) return;
    idoc.querySelectorAll('[data-eb-block-id]').forEach(el => {
      const id = el.getAttribute('data-eb-block-id');
      if (id === selectedBlockId) {
        el.style.outline = '2px solid #7C5CFA';
        el.style.outlineOffset = '2px';
      } else {
        el.style.removeProperty('outline');
        el.style.removeProperty('outline-offset');
      }
    });
  }, [selectedBlockId]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Every `load` swaps in a fresh document, so the previous document's
    // listeners have to come off before the new ones go on — and the last set
    // has to come off at unmount. Track whatever is currently subscribed.
    let subscribed = null;
    // Scoped to the effect rather than a ref so the timer is created and
    // cleared in one place, and cannot outlive the subscription that feeds it.
    let debounceTimer = null;
    const unsubscribeDoc = () => {
      if (!subscribed) return;
      subscribed.doc.removeEventListener('input', subscribed.onInput);
      subscribed.doc.removeEventListener('click', subscribed.onClick);
      subscribed = null;
    };

    const handleLoad = () => {
      const idoc = iframe.contentDocument;
      if (!idoc) return;
      unsubscribeDoc();
      const body = idoc.body;
      if (!body) return;
      body.setAttribute('contenteditable', 'true');
      body.style.outline = 'none';
      body.style.minHeight = '100%';

      const flush = () => {
        // Clone the document so we can strip editor-only attributes (the
        // contenteditable flag, the injected outline/min-height styles, the
        // per-block outlines) without disturbing the live DOM.
        const cloneDoc = idoc.cloneNode(true);
        const cloneBody = cloneDoc.body;
        if (cloneBody) {
          cloneBody.removeAttribute('contenteditable');
          const s = cloneBody.style;
          s.removeProperty('outline');
          s.removeProperty('min-height');
          if (!cloneBody.getAttribute('style')) cloneBody.removeAttribute('style');
        }
        cloneDoc.querySelectorAll('[data-eb-block-id]').forEach(el => {
          el.style.removeProperty('outline');
          el.style.removeProperty('outline-offset');
          if (!el.getAttribute('style')) el.removeAttribute('style');
        });
        const full = '<!doctype html>\n' + cloneDoc.documentElement.outerHTML;
        lastLoadedRef.current = full;
        const cur = useAppStore.getState().emailDocument;
        if (!cur?.root) return;
        setEmailDocument({
          ...cur,
          root: { ...cur.root, data: { ...(cur.root.data || {}), customHtml: full } },
        });
      };

      const onInput = () => {
        editingRef.current = true;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          flush();
          editingRef.current = false;
        }, 300);
      };

      const onClick = (e) => {
        const tagged = e.target.closest?.('[data-eb-block-id]');
        if (tagged) {
          const id = tagged.getAttribute('data-eb-block-id');
          useAppStore.getState().setSelectedBlockId(id);
        }
      };

      idoc.addEventListener('input', onInput);
      idoc.addEventListener('click', onClick);
      subscribed = { doc: idoc, onInput, onClick };
    };

    iframe.addEventListener('load', handleLoad);
    // Initial srcdoc — assigning srcdoc fires `load` once it parses.
    iframe.srcdoc = html;
    lastLoadedRef.current = html;
    return () => {
      iframe.removeEventListener('load', handleLoad);
      unsubscribeDoc();
      clearTimeout(debounceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <iframe
      ref={iframeRef}
      className={styles.canvasIframe}
      title="Email preview (editable)"
      sandbox="allow-same-origin"
    />
  );
}

function DragHandleDots() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
      <circle cx="3" cy="3" r="1.2" fill="#fff" />
      <circle cx="9" cy="3" r="1.2" fill="#fff" />
      <circle cx="3" cy="7" r="1.2" fill="#fff" />
      <circle cx="9" cy="7" r="1.2" fill="#fff" />
      <circle cx="3" cy="11" r="1.2" fill="#fff" />
      <circle cx="9" cy="11" r="1.2" fill="#fff" />
    </svg>
  );
}

function parseSize(v) {
  if (v == null || v === '') return { num: null, unit: 'px' };
  const s = String(v);
  if (s.endsWith('%')) return { num: parseFloat(s), unit: '%' };
  return { num: parseFloat(s) || null, unit: 'px' };
}

