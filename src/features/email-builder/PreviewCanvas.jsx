import { useState, useRef, useCallback, useEffect } from 'react';
import { Reader } from '@usewaypoint/email-builder';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { InlineEditable } from './InlineEditable';
import { getFontStack } from './googleFonts';
import { isGradient } from './colorHelpers';
import { tintSvgMarkup } from './svgTint';
import styles from './EmailBuilder.module.css';

// Turns a (solid OR gradient) value into the right pair of style props.
// Gradients can't use `backgroundColor` — they go on `backgroundImage`.
// Returns an object you can spread onto a style prop.
function bgProps(value) {
  if (!value) return {};
  if (isGradient(value)) return { backgroundImage: value };
  return { backgroundColor: value };
}

const TYPE_LABELS = {
  EmailLayout: 'Email',
  Heading: 'Heading',
  Text: 'Text',
  Button: 'Button',
  Image: 'Image',
  Avatar: 'Avatar',
  Divider: 'Divider',
  Spacer: 'Spacer',
  Container: 'Wrapper',
  ColumnsContainer: 'Columns',
  Social: 'Social',
  NavBar: 'Nav Bar',
  Table: 'Table',
};

function blockLabel(block) {
  const role = block.data?.role;
  if (role === 'header') return 'Header';
  if (role === 'body') return 'Body';
  if (role === 'footer') return 'Footer';
  // alias wins over the generic type label so the selection toolbar reads
  // "Section" (or any user rename) rather than the underlying "Wrapper".
  if (block.data?.alias) return block.data.alias;
  return TYPE_LABELS[block.type] || block.type;
}

function paddingCss(p) {
  if (!p) return undefined;
  return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
}

function perSideBorderStyle(borderSides) {
  if (!borderSides || !Object.values(borderSides).some(Boolean)) return null;
  const out = {};
  const fmt = (s) => `${s.width || 1}px ${s.style || 'solid'} ${s.color || '#3A485F'}`;
  if (borderSides.top)    out.borderTop    = fmt(borderSides.top);
  if (borderSides.right)  out.borderRight  = fmt(borderSides.right);
  if (borderSides.bottom) out.borderBottom = fmt(borderSides.bottom);
  if (borderSides.left)   out.borderLeft   = fmt(borderSides.left);
  return out;
}

function applyBorder(target, style) {
  const perSide = perSideBorderStyle(style.borderSides);
  if (perSide) Object.assign(target, perSide);
  else if (style.borderWidth) target.border = `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor || '#3A485F'}`;
}

// Six-dot drag handle that matches the Figma toolbar precisely.
// Translate the block's style object into the inline CSS string the
// matching iframe element should carry. Inline styles win over CSS class
// rules so Design-tab edits live-update the canvas without us having to
// rewrite the original <style> block.
function blockStyleToCss(s) {
  if (!s) return '';
  const parts = [];
  if (s.color) parts.push(`color: ${s.color}`);
  if (s.backgroundColor) {
    // Gradient strings go on background-image; solids on background-color.
    if (/^(linear|radial)-gradient/.test(s.backgroundColor)) {
      parts.push(`background-image: ${s.backgroundColor}`);
    } else {
      parts.push(`background-color: ${s.backgroundColor}`);
    }
  }
  if (s.backgroundImage && !/^(linear|radial)-gradient/.test(s.backgroundColor || '')) {
    parts.push(`background-image: url("${s.backgroundImage}")`);
    if (s.backgroundSize) parts.push(`background-size: ${s.backgroundSize}`);
    if (s.backgroundPosition) parts.push(`background-position: ${s.backgroundPosition}`);
    if (s.backgroundRepeat) parts.push(`background-repeat: ${s.backgroundRepeat}`);
  }
  if (s.fontFamily) parts.push(`font-family: ${s.fontFamily}`);
  if (s.fontSize != null) parts.push(`font-size: ${s.fontSize}px`);
  if (s.fontWeight) parts.push(`font-weight: ${s.fontWeight}`);
  if (s.fontStyle) parts.push(`font-style: ${s.fontStyle}`);
  if (s.textDecoration) parts.push(`text-decoration: ${s.textDecoration}`);
  if (s.textTransform) parts.push(`text-transform: ${s.textTransform}`);
  if (s.textAlign) parts.push(`text-align: ${s.textAlign}`);
  if (s.letterSpacing) parts.push(`letter-spacing: ${s.letterSpacing}`);
  if (s.lineHeight) parts.push(`line-height: ${s.lineHeight}`);
  if (s.padding) {
    const p = s.padding;
    parts.push(`padding: ${p.top || 0}px ${p.right || 0}px ${p.bottom || 0}px ${p.left || 0}px`);
  }
  if (s.borderRadius != null) parts.push(`border-radius: ${s.borderRadius}px`);
  if (s.borderWidth) {
    parts.push(`border: ${s.borderWidth}px ${s.borderStyle || 'solid'} ${s.borderColor || '#000'}`);
  }
  return parts.join('; ');
}

// Editable iframe for confirmed custom HTML bodies. Loads the HTML once,
// makes the body contenteditable, and writes outerHTML back to
// `doc.root.data.customHtml` on input. Clicks on tagged elements
// (`[data-eb-block-id]`) select the matching block; block-style changes
// from the Design tab are written into the iframe as inline CSS.
function EditableHtmlIframe({ html, doc }) {
  const setEmailDocument = useAppStore(s => s.setEmailDocument);
  const setSelectedBlockId = useAppStore(s => s.setSelectedBlockId);
  const selectedBlockId = useAppStore(s => s.selectedBlockId);
  const iframeRef = useRef(null);
  const lastLoadedRef = useRef(null);
  const editingRef = useRef(false);
  const debounceRef = useRef(null);

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

    const handleLoad = () => {
      const idoc = iframe.contentDocument;
      if (!idoc) return;
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
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
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
    };

    iframe.addEventListener('load', handleLoad);
    // Initial srcdoc — assigning srcdoc fires `load` once it parses.
    iframe.srcdoc = html;
    lastLoadedRef.current = html;
    return () => {
      iframe.removeEventListener('load', handleLoad);
      if (debounceRef.current) clearTimeout(debounceRef.current);
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

function ContainerResizeHandle({ id, block, updateBlock }) {
  const ref = useRef(null);

  const startDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const container = ref.current?.parentElement;
    if (!container) return;
    const startY = e.clientY;
    const startH = container.getBoundingClientRect().height;
    const target = e.target;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const newH = Math.max(20, Math.round(startH + (ev.clientY - startY)));
      updateBlock(id, b => ({
        ...b, data: { ...b.data, props: { ...b.data.props, heightMode: 'fixed', height: newH } },
      }));
    };

    const onUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [id, block, updateBlock]);

  return <div ref={ref} className={styles.containerResizeBottom} onPointerDown={startDrag} />;
}

function ResizeWrap({ id, block, updateBlock, isSelected, canWidth, canHeight, children }) {
  const [ratioLock, setRatioLock] = useState(true);
  const wrapRef = useRef(null);

  const startDrag = useCallback((e, edge) => {
    e.preventDefault();
    e.stopPropagation();
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const parentWidth = el.parentElement?.getBoundingClientRect().width || rect.width;
    const startX = e.clientX;
    const startY = e.clientY;

    const props = block.data?.props || {};
    const wParsed = parseSize(props.width);
    const hParsed = parseSize(props.height);
    const startW = rect.width;
    const startH = rect.height;
    const aspect = startW / (startH || 1);
    const wUnit = wParsed.unit;
    const hUnit = hParsed.unit;

    const target = e.target;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newW, newH;

      if (edge === 'right' || edge === 'corner') {
        const rawW = Math.max(20, startW + dx);
        newW = wUnit === '%' ? `${Math.max(5, Math.min(100, Math.round((rawW / parentWidth) * 100)))}%` : Math.round(rawW);
      }
      if (edge === 'bottom' || edge === 'corner') {
        const rawH = Math.max(8, startH + dy);
        newH = hUnit === '%' ? `${Math.round(rawH)}%` : Math.round(rawH);
      }

      if (edge === 'right' && canWidth) {
        const rawW = Math.max(20, startW + dx);
        newW = wUnit === '%' ? `${Math.max(5, Math.min(100, Math.round((rawW / parentWidth) * 100)))}%` : Math.round(rawW);
        updateBlock(id, b => {
          const p = { ...b.data.props, width: newW };
          if (ratioLock && canHeight) {
            const pxW = rawW;
            const pxH = Math.round(pxW / aspect);
            p.height = hUnit === '%' ? `${pxH}%` : pxH;
          }
          return { ...b, data: { ...b.data, props: p } };
        });
      } else if (edge === 'bottom' && canHeight) {
        const rawH = Math.max(8, startH + dy);
        newH = hUnit === '%' ? `${rawH}%` : Math.round(rawH);
        updateBlock(id, b => {
          const p = { ...b.data.props, height: newH };
          if (ratioLock && canWidth) {
            const pxH = rawH;
            const pxW = Math.round(pxH * aspect);
            p.width = wUnit === '%' ? `${Math.max(5, Math.min(100, Math.round((pxW / parentWidth) * 100)))}%` : Math.round(pxW);
          }
          return { ...b, data: { ...b.data, props: p } };
        });
      } else if (edge === 'corner') {
        const rawW = Math.max(20, startW + dx);
        const rawH = ratioLock ? rawW / aspect : Math.max(8, startH + dy);
        newW = wUnit === '%' ? `${Math.max(5, Math.min(100, Math.round((rawW / parentWidth) * 100)))}%` : Math.round(rawW);
        newH = hUnit === '%' ? `${Math.round(rawH)}%` : Math.round(rawH);
        updateBlock(id, b => ({ ...b, data: { ...b.data, props: { ...b.data.props, width: newW, height: newH } } }));
      }
    };

    const onUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = edge === 'right' ? 'ew-resize' : edge === 'bottom' ? 'ns-resize' : 'nwse-resize';
    document.body.style.userSelect = 'none';
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [block, id, updateBlock, canWidth, canHeight, ratioLock]);

  return (
    <div ref={wrapRef} className={styles.resizeWrap} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', width: block.data?.props?.width != null ? (typeof block.data.props.width === 'number' ? `${block.data.props.width}px` : block.data.props.width) : undefined }}>
      {children}
      {isSelected && (
        <>
          {canWidth && <div className={styles.resizeRight} onPointerDown={e => startDrag(e, 'right')} />}
          {canHeight && <div className={styles.resizeBottom} onPointerDown={e => startDrag(e, 'bottom')} />}
          {canWidth && canHeight && <div className={styles.resizeCorner} onPointerDown={e => startDrag(e, 'corner')} />}
          {canWidth && canHeight && (
            <button
              className={`${styles.ratioLockBtn} ${ratioLock ? styles.ratioLockActive : ''}`}
              onClick={e => { e.stopPropagation(); setRatioLock(v => !v); }}
              title={ratioLock ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            >
              <Icon name={ratioLock ? 'solar:lock-linear' : 'solar:lock-unlocked-linear'} size={12} color="currentColor" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function PreviewCanvas({ dropIndicator }) {
  const doc = useAppStore(s => s.emailDocument);
  const selectedBlockId = useAppStore(s => s.selectedBlockId);
  const selectedColumnIdx = useAppStore(s => s.selectedColumnIdx);
  const bulkSelectedIds = useAppStore(s => s.bulkSelectedIds);
  const setSelectedBlockId = useAppStore(s => s.setSelectedBlockId);
  const selectColumn = useAppStore(s => s.selectColumn);
  const removeBlock = useAppStore(s => s.removeBlock);
  const updateBlock = useAppStore(s => s.updateBlock);
  const duplicateBlock = useAppStore(s => s.duplicateBlock);
  const selectParentBlock = useAppStore(s => s.selectParentBlock);
  const htmlOverride = useAppStore(s => s.htmlPreviewOverride);

  if (!doc) return null;

  // HTML override → bypass the doc and render the user's edited markup.
  // Live override (htmlPreviewOverride) takes precedence so the user sees
  // their pending edits. Persisted customHtml is only used as a fallback
  // when there are no parsed blocks — that way imported HTML (which always
  // produces childrenIds) flows through the normal SortableBlock pipeline
  // so the toolbar, drag handles, drop indicator, and reorder all work.
  const customHtml = doc.root?.data?.customHtml;
  const hasBlocks = (doc.root?.data?.childrenIds?.length ?? 0) > 0;
  if (htmlOverride != null) {
    return (
      <div className={styles.canvasWrap}>
        <iframe className={styles.canvasIframe} title="Email preview" srcDoc={htmlOverride} sandbox="allow-same-origin" />
      </div>
    );
  }
  if (customHtml != null && !hasBlocks) {
    return (
      <div className={styles.canvasWrap}>
        <EditableHtmlIframe html={customHtml} doc={doc} />
      </div>
    );
  }

  const root = doc.root;
  const childrenIds = root?.data?.childrenIds || [];
  const layoutStyle = {
    background: root?.data?.canvasColor || '#fff',
    color: root?.data?.textColor || '#3A485F',
    fontFamily: getFontStack(root?.data?.fontFamily),
  };

  const commitText = (id, text) => {
    updateBlock(id, prev => ({ ...prev, data: { ...prev.data, props: { ...(prev.data?.props || {}), text } } }));
  };

  const commitTable = (id, { columns, rows }) => {
    updateBlock(id, prev => ({
      ...prev,
      data: { ...prev.data, props: { ...(prev.data?.props || {}), ...(columns !== undefined && { columns }), ...(rows !== undefined && { rows }) } },
    }));
  };

  const handleCanvasClick = (e) => {
    if (e.target === e.currentTarget) setSelectedBlockId('root');
  };

  const toggleBulkSelected = useAppStore.getState().toggleBulkSelected;
  const bulkSet = new Set(bulkSelectedIds);
  const ctx = {
    doc,
    selectedBlockId,
    selectedColumnIdx,
    bulkSet,
    setSelectedBlockId,
    selectColumn,
    toggleBulkSelected,
    removeBlock,
    updateBlock,
    duplicateBlock,
    selectParentBlock,
    commitText,
    commitTable,
    dropIndicator,
  };

  return (
    <div
      className={styles.canvasWrap}
      style={{ background: root?.data?.backdropColor || 'var(--neutral-25)' }}
      onClick={handleCanvasClick}
    >
      <div
        className={styles.canvas}
        style={layoutStyle}
        onClick={(e) => { e.stopPropagation(); setSelectedBlockId('root'); }}
      >
        <SortableList parentId="root" childrenIds={childrenIds} ctx={ctx} />
      </div>
    </div>
  );
}

function DropIndicatorLine() {
  return <div className={styles.dropIndicatorLine} />;
}

// ── A sortable list of blocks belonging to a single parent slot. ────────────
function SortableList({ parentId, columnIdx, childrenIds, ctx }) {
  if (!childrenIds || childrenIds.length === 0) {
    return <EmptyDropzone parentId={parentId} columnIdx={columnIdx} />;
  }
  const ind = ctx.dropIndicator;
  const showHere = ind && ind.parentId === parentId && (ind.columnIdx ?? undefined) === (columnIdx ?? undefined) && !ind.isNest;
  return (
    <SortableContext items={childrenIds} strategy={verticalListSortingStrategy}>
      {showHere && ind.index === 0 && <DropIndicatorLine />}
      {childrenIds.map((id, idx) => (
        <div key={id}>
          <SortableBlock id={id} ctx={ctx} />
          {showHere && ind.index === idx + 1 && <DropIndicatorLine />}
        </div>
      ))}
    </SortableContext>
  );
}

function EmptyDropzone({ parentId, columnIdx }) {
  const dropId = columnIdx == null ? `__empty:${parentId}` : `__empty:${parentId}:${columnIdx}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  const doc = useAppStore(s => s.emailDocument);
  const parentBlock = doc?.[parentId];
  const isContainer = parentBlock?.type === 'Container';

  if (isContainer) {
    return (
      <div ref={setNodeRef} className={[styles.emptyDrop, styles.emptyDropRich, isOver ? styles.emptyDropOver : ''].join(' ')}>
        <EmptyDropIllustration />
        <span className={styles.emptyDropLabel}>Drop a Column block here</span>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className={[styles.emptyDrop, isOver ? styles.emptyDropOver : ''].join(' ')}>
      Drop here
    </div>
  );
}

function EmptyDropIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="16" width="48" height="48" rx="6" stroke="var(--neutral-200)" strokeWidth="1" strokeDasharray="6 4" />
      <rect x="30" y="10" width="36" height="42" rx="5" fill="white" stroke="var(--neutral-200)" strokeWidth="1" />
      <rect x="34" y="20" width="10" height="8" rx="2" stroke="var(--neutral-300)" strokeWidth="1" />
      <rect x="34" y="34" width="10" height="8" rx="2" stroke="var(--neutral-300)" strokeWidth="1" />
      <line x1="48" y1="22" x2="62" y2="22" stroke="var(--neutral-200)" strokeWidth="1" strokeLinecap="round" />
      <line x1="48" y1="26" x2="58" y2="26" stroke="var(--neutral-200)" strokeWidth="1" strokeLinecap="round" />
      <line x1="48" y1="36" x2="62" y2="36" stroke="var(--neutral-200)" strokeWidth="1" strokeLinecap="round" />
      <line x1="48" y1="40" x2="58" y2="40" stroke="var(--neutral-200)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// Wrap dnd-kit's pointer listeners with a hold gate so text-editable
// blocks don't grab on a single click (which would prevent entering text-
// edit mode). Holds the pointer for `delay` ms — if still pressed, calls
// the wrapped onPointerDown so dnd-kit picks up the drag. Cancels on
// pointerup or significant movement before the delay elapses.
function holdListeners(listeners, delay = 250) {
  if (!listeners?.onPointerDown) return listeners;
  return {
    ...listeners,
    onPointerDown: (e) => {
      // Let clicks that target an interactive child (drag handle, button)
      // go through immediately — those have their own listeners spread.
      if (e.target.closest('[data-no-drag]')) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const evClone = { ...e, clientX: e.clientX, clientY: e.clientY, target: e.target, currentTarget: e.currentTarget, nativeEvent: e.nativeEvent, preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation() };
      let cancelled = false;
      const cancel = () => { cancelled = true; cleanup(); };
      const move = (mv) => {
        if (Math.abs(mv.clientX - startX) > 5 || Math.abs(mv.clientY - startY) > 5) cancel();
      };
      const cleanup = () => {
        window.removeEventListener('pointerup', cancel);
        window.removeEventListener('pointermove', move);
      };
      window.addEventListener('pointerup', cancel, { once: true });
      window.addEventListener('pointermove', move);
      setTimeout(() => {
        cleanup();
        if (!cancelled) listeners.onPointerDown(evClone);
      }, delay);
    },
  };
}

// ── One sortable wrapper around a block of any type. ────────────────────────
function SortableBlock({ id, ctx }) {
  const sortable = useSortable({ id });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const block = ctx.doc[id];
  if (!block) return null;
  const isSelected = ctx.selectedBlockId === id;
  const isBulkSelected = ctx.bulkSet.has(id);
  // Heading/Text blocks use contentEditable for inline editing — wrap the
  // wrapper-level drag listener with a hold gate so a normal click goes
  // into edit mode. Other block types use the listeners directly.
  const isTextBlock = block.type === 'Heading' || block.type === 'Text';
  const wrapListeners = isTextBlock ? holdListeners(listeners) : listeners;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        styles.blockWrap,
        isSelected ? styles.blockWrapSelected : '',
        isBulkSelected ? styles.blockWrapBulk : '',
      ].join(' ')}
      onClick={(e) => {
        e.stopPropagation();
        // Cmd/Ctrl/Shift-click → add this block to (or remove from) the
        // bulk-selection set so the right panel opens BulkDesignTab.
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          ctx.toggleBulkSelected(id);
        } else {
          ctx.setSelectedBlockId(id);
        }
      }}
      {...attributes}
      {...wrapListeners}
    >
      {isSelected && (
        <div className={styles.blockToolbar}>
          <button
            {...attributes}
            {...listeners}
            data-no-drag
            className={styles.blockToolbarBtn}
            aria-label="Drag"
            onClick={(e) => e.stopPropagation()}
          >
            <DragHandleDots />
          </button>
          <span className={styles.blockToolbarDivider} />
          <span className={styles.blockToolbarLabel}>{blockLabel(block)}</span>
          <span className={styles.blockToolbarDivider} />
          <button
            className={styles.blockToolbarBtn}
            onClick={(e) => { e.stopPropagation(); ctx.selectParentBlock(id); }}
            aria-label="Select parent"
            title="Select parent (⇧↵)"
          >
            <Icon name="solar:undo-left-round-linear" size={14} color="#fff" />
          </button>
          <span className={styles.blockToolbarDivider} />
          <button
            className={styles.blockToolbarBtn}
            onClick={(e) => { e.stopPropagation(); ctx.duplicateBlock(id); }}
            aria-label="Duplicate"
            title="Duplicate"
          >
            <Icon name="solar:copy-linear" size={14} color="#fff" />
          </button>
          <span className={styles.blockToolbarDivider} />
          <button
            className={styles.blockToolbarBtn}
            onClick={(e) => { e.stopPropagation(); ctx.removeBlock(id); }}
            aria-label="Delete"
            title="Delete"
          >
            <Icon name="solar:trash-bin-trash-linear" size={14} color="#fff" />
          </button>
        </div>
      )}
      <BlockBody id={id} block={block} ctx={ctx} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}

// ── Per-type rendering. Container / ColumnsContainer recurse so their children
// are also draggable. Heading / Text use the contentEditable surface. Other
// primitives fall back to Reader. ───────────────────────────────────────────
function BlockBody({ id, block, ctx, dragAttributes, dragListeners }) {
  const { type, data } = block;
  const props = data?.props || {};
  const style = data?.style || {};

  if (type === 'Heading' || type === 'Text') {
    return (
      <InlineEditable
        blockId={id}
        type={type}
        level={props.level}
        listStyle={props.listStyle}
        text={props.text || ''}
        style={style}
        onCommit={ctx.commitText}
      />
    );
  }

  if (type === 'Container') {
    const isSelected = ctx.selectedBlockId === id;
    const heightMode = props.heightMode || 'hug';
    // bgProps() routes gradients to backgroundImage and solids to
    // backgroundColor. If the user has a Background Image set, it
    // overrides whatever's in bgColor.
    const containerStyle = {
      position: 'relative',
      ...bgProps(style.backgroundColor),
      ...(style.backgroundImage ? {
        backgroundImage: `url(${style.backgroundImage})`,
        backgroundSize: style.backgroundSize || 'cover',
        backgroundPosition: style.backgroundPosition || 'center',
        backgroundRepeat: style.backgroundRepeat || 'no-repeat',
      } : {}),
      padding: paddingCss(style.padding),
      color: style.color,
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    };
    applyBorder(containerStyle, style);
    // Centred-email + hero-section fidelity. `max-width` paired with
    // auto side margins is the standard centring pattern; `min-height`
    // lets a hero hold its height even when content is short. The parser
    // emits these from CSS classes that the original HTML used; without
    // the fields here they were silently dropped on the canvas.
    if (style.maxWidth) {
      containerStyle.maxWidth = typeof style.maxWidth === 'number' ? `${style.maxWidth}px` : style.maxWidth;
      containerStyle.marginLeft = 'auto';
      containerStyle.marginRight = 'auto';
    }
    if (style.minHeight) {
      containerStyle.minHeight = typeof style.minHeight === 'number' ? `${style.minHeight}px` : style.minHeight;
    }
    // SVG tint for backgroundImage — substitute fills inline and emit
    // as a data-URI so the existing background-image: url(…) path keeps
    // working without changing CSS plumbing.
    if (style.bgSvgRaw && style.bgTintColor) {
      const tinted = tintSvgMarkup(style.bgSvgRaw, style.bgTintColor);
      containerStyle.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(tinted)}")`;
      containerStyle.backgroundSize = style.backgroundSize || 'contain';
      containerStyle.backgroundPosition = style.backgroundPosition || 'center';
      containerStyle.backgroundRepeat = style.backgroundRepeat || 'no-repeat';
    }
    if (heightMode === 'fixed' && props.height) {
      // Fixed-height containers position their child content via flex
      // instead of scrolling. contentAlignH/contentAlign (left/center/
      // right + top/middle/bottom) map to justify- and align-items so
      // the user can park content in any of 9 spots. overflow-x: hidden
      // stops a too-wide child (e.g. a background gradient bleed) from
      // forcing a horizontal scrollbar inside the container.
      containerStyle.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
      containerStyle.overflow = 'hidden';
      containerStyle.display = 'flex';
      containerStyle.flexDirection = 'column';
      containerStyle.minWidth = 0;
      const vMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
      const hMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
      containerStyle.justifyContent = vMap[props.contentAlign] || 'flex-start';
      containerStyle.alignItems = hMap[props.contentAlignH] || 'stretch';
    }
    const isNestTarget = ctx.dropIndicator?.isNest && ctx.dropIndicator?.parentId === id;
    return (
      <div style={containerStyle} className={isNestTarget ? styles.dropNestTarget : undefined}>
        <SortableList parentId={id} childrenIds={props.childrenIds || []} ctx={ctx} />
        {isSelected && <ContainerResizeHandle id={id} block={block} updateBlock={ctx.updateBlock} />}
      </div>
    );
  }

  if (type === 'ColumnsContainer') {
    const isSelected = ctx.selectedBlockId === id;
    const heightMode = props.heightMode || 'hug';
    const cols = props.columns || [];
    const count = props.columnsCount || cols.length || 2;
    const hGap = props.columnsGap ?? 16;
    const vGap = props.rowGap ?? 0;
    const align = props.contentAlignment || 'top';
    const direction = props.direction || 'row';
    const wrap = props.flexWrap || 'nowrap';
    const visible = cols.slice(0, count);
    const columnWidths = props.columnWidths || Array.from({ length: count }, () => Math.round(10000 / count) / 100);
    const colsStyle = {
      position: 'relative',
      display: 'flex',
      flexDirection: direction,
      flexWrap: wrap,
      alignItems: align === 'top' ? 'flex-start' : align === 'middle' ? 'center' : 'flex-end',
      gap: `${vGap}px ${hGap}px`,
      padding: paddingCss(style.padding),
      ...bgProps(style.backgroundColor),
      ...(style.backgroundImage ? {
        backgroundImage: `url(${style.backgroundImage})`,
        backgroundSize: style.backgroundSize || 'cover',
        backgroundPosition: style.backgroundPosition || 'center',
        backgroundRepeat: style.backgroundRepeat || 'no-repeat',
      } : {}),
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    };
    applyBorder(colsStyle, style);
    if (style.bgSvgRaw && style.bgTintColor) {
      const tinted = tintSvgMarkup(style.bgSvgRaw, style.bgTintColor);
      colsStyle.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(tinted)}")`;
      colsStyle.backgroundSize = style.backgroundSize || 'contain';
      colsStyle.backgroundPosition = style.backgroundPosition || 'center';
      colsStyle.backgroundRepeat = style.backgroundRepeat || 'no-repeat';
    }
    if (heightMode === 'fixed' && props.height) {
      colsStyle.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
      colsStyle.overflow = 'hidden';
    }
    const isColumn = direction === 'column';
    const totalGap = hGap * (count - 1);
    const isNestTargetCols = ctx.dropIndicator?.isNest && ctx.dropIndicator?.parentId === id;
    return (
      <div style={colsStyle} className={isNestTargetCols ? styles.dropNestTarget : undefined}>
        {visible.map((col, idx) => {
          const w = columnWidths[idx] || (100 / count);
          // In row direction the column-width % drives flex-basis along the
          // main (horizontal) axis. When the user flips direction to column,
          // the main axis is vertical — applying the % there would size each
          // column as a fraction of the parent's height (≈0 in hug mode), so
          // every column would collapse. Stack them at full width instead.
          const colAlign = col?.align || 'left';
          const colValign = col?.valign || 'top';
          const vMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
          const isColSelected = ctx.selectedBlockId === id && ctx.selectedColumnIdx === idx;
          const colPad = col?.padding;
          const colBg = col?.backgroundColor;
          const itemStyle = isColumn
            ? { width: '100%', minWidth: 0, textAlign: colAlign, display: 'flex', flexDirection: 'column', justifyContent: vMap[colValign] || 'flex-start' }
            : { flex: `0 0 calc(${w}% - ${totalGap * w / 100}px)`, minWidth: 0, textAlign: colAlign, display: 'flex', flexDirection: 'column', justifyContent: vMap[colValign] || 'flex-start' };
          const colHeight = col?.heightMode || 'hug';
          if (colHeight === 'fill') {
            itemStyle.alignSelf = 'stretch';
          } else if (colHeight === 'custom' && col?.customHeight) {
            itemStyle.height = typeof col.customHeight === 'number' ? `${col.customHeight}px` : col.customHeight;
            itemStyle.overflow = 'hidden';
          }
          if (colPad) {
            itemStyle.padding = `${colPad.top || 0}px ${colPad.right || 0}px ${colPad.bottom || 0}px ${colPad.left || 0}px`;
          }
          if (colBg) itemStyle.backgroundColor = colBg;
          return (
            <div
              key={idx}
              style={itemStyle}
              className={isColSelected ? styles.selectedColumn : undefined}
              onClick={(e) => { e.stopPropagation(); ctx.selectColumn(id, idx); }}
            >
              <SortableList parentId={id} columnIdx={idx} childrenIds={col?.childrenIds || []} ctx={ctx} />
            </div>
          );
        })}
        {isSelected && <ContainerResizeHandle id={id} block={block} updateBlock={ctx.updateBlock} />}
      </div>
    );
  }

  if (type === 'Image') {
    const isSelected = ctx.selectedBlockId === id;
    const imgStyle = {
      display: 'block',
      width: props.width ?? '100%',
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    };
    if (props.height) imgStyle.height = props.height;
    else imgStyle.height = 'auto';
    if (typeof imgStyle.width === 'number') imgStyle.width = `${imgStyle.width}px`;
    if (typeof imgStyle.height === 'number') imgStyle.height = `${imgStyle.height}px`;
    if (props.objectFit && props.objectFit !== 'fill') imgStyle.objectFit = props.objectFit;
    if (props.objectPosition && props.objectPosition !== 'center') imgStyle.objectPosition = props.objectPosition;

    // If we have the raw SVG markup cached (set on upload of an .svg) and
    // a Tint colour, recolor in-place via inline SVG. The wrapper div takes
    // the image's sizing so the SVG scales the same way as the <img> path.
    const hasTintedSvg = props.svgRaw && props.tintColor;
    const content = hasTintedSvg ? (
      <div
        style={{ ...imgStyle, display: 'inline-block', lineHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: tintSvgMarkup(props.svgRaw, props.tintColor) }}
      />
    ) : props.url ? (
      <img src={props.url} alt={props.alt || ''} style={imgStyle} />
    ) : (
      <div style={{ padding: 24, border: '1px dashed #CED4DD', borderRadius: 8, color: '#9CA3AF', fontSize: 12, width: imgStyle.width }}>
        No image
      </div>
    );

    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || style.textAlign || 'center', ...bgProps(style.backgroundColor) }}>
        <ResizeWrap id={id} block={block} updateBlock={ctx.updateBlock} isSelected={isSelected} canWidth canHeight>
          {content}
        </ResizeWrap>
      </div>
    );
  }

  // Avatar
  if (type === 'Avatar') {
    const size = props.size || 64;
    const radius = props.shape === 'circle' ? '50%' : props.shape === 'rounded' ? 8 : 0;
    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || style.textAlign || 'center' }}>
        {props.imageUrl && <img src={props.imageUrl} alt={props.alt || ''} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover' }} />}
      </div>
    );
  }

  if (type === 'Divider') {
    const thickness = props.lineHeight || 1;
    const color = props.lineColor || '#E1E4EA';
    const lineStyle = props.lineStyle || 'solid';
    const endLeft = props.endLeft || 'none';
    const endRight = props.endRight || 'none';
    const hasEndpoints = endLeft !== 'none' || endRight !== 'none';
    const markerSize = Math.max(8, thickness * 4);
    const orientation = props.orientation || 'horizontal';

    // Vertical dividers ignore the endpoint markers — they're a horizontal
    // pattern. Render a thin tall bar with an explicit height (defaults to
    // 40px, mirrors patchEmailHtml.js).
    if (orientation === 'vertical') {
      const h = props.height ?? 40;
      return (
        <div style={{ padding: paddingCss(style.padding), display: 'flex', justifyContent: style.blockAlign === 'left' ? 'flex-start' : style.blockAlign === 'right' ? 'flex-end' : 'center' }}>
          <div style={{
            width: `${thickness}px`,
            height: `${h}px`,
            borderLeft: `${thickness}px ${lineStyle} ${color}`,
          }} />
        </div>
      );
    }

    if (!hasEndpoints) {
      return (
        <div style={{ padding: paddingCss(style.padding) }}>
          <hr style={{ width: '100%', border: 'none', borderTop: `${thickness}px ${lineStyle} ${color}`, margin: 0 }} />
        </div>
      );
    }

    return (
      <div style={{ padding: paddingCss(style.padding) }}>
        <svg width="100%" height={markerSize + 2} style={{ display: 'block', overflow: 'visible' }}>
          <line
            x1={endLeft !== 'none' ? markerSize / 2 : 0}
            y1={(markerSize + 2) / 2}
            x2="100%"
            y2={(markerSize + 2) / 2}
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={lineStyle === 'dashed' ? `${thickness * 6} ${thickness * 4}` : 'none'}
          />
          {endLeft === 'circle' && (
            <circle cx={markerSize / 2} cy={(markerSize + 2) / 2} r={markerSize / 2 - 0.5} fill={color} />
          )}
          {endLeft === 'arrow' && (
            <polygon
              points={`0,${(markerSize + 2) / 2} ${markerSize},${1} ${markerSize},${markerSize + 1}`}
              fill={color}
            />
          )}
          {endRight === 'circle' && (
            <circle cx="100%" cy={(markerSize + 2) / 2} r={markerSize / 2 - 0.5} fill={color} style={{ transform: `translateX(-${markerSize / 2}px)` }} />
          )}
          {endRight === 'arrow' && (
            <polygon
              points={`0,1 0,${markerSize + 1} ${markerSize},${(markerSize + 2) / 2}`}
              fill={color}
              style={{ transform: `translateX(calc(100% - ${markerSize}px))` }}
            />
          )}
        </svg>
      </div>
    );
  }

  if (type === 'Spacer') {
    const isSelected = ctx.selectedBlockId === id;
    const h = props.height || 16;
    return (
      <ResizeWrap id={id} block={block} updateBlock={ctx.updateBlock} isSelected={isSelected} canWidth={false} canHeight>
        <div style={{ height: typeof h === 'number' ? `${h}px` : h, width: '100%' }} />
      </ResizeWrap>
    );
  }

  if (type === 'Button') {
    const sizeStyles = { 'x-small': { padding: '6px 12px', fontSize: 12 }, small: { padding: '8px 16px', fontSize: 13 }, medium: { padding: '12px 20px', fontSize: 14 }, large: { padding: '14px 28px', fontSize: 16 } };
    const presetRadius = { rectangle: 0, rounded: 6, pill: 9999 };
    const sz = sizeStyles[props.size || 'medium'] || sizeStyles.medium;
    const radius = style.borderRadius ?? presetRadius[props.buttonStyle || 'rectangle'] ?? 0;
    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || style.textAlign || 'center' }}>
        <a
          href={props.url || '#'}
          onClick={e => e.preventDefault()}
          style={{
            display: 'inline-block',
            padding: sz.padding,
            ...bgProps(props.buttonBackgroundColor || '#7C5CFA'),
            color: props.buttonTextColor || '#fff',
            borderRadius: `${radius}px`,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: sz.fontSize,
            fontFamily: 'inherit',
            border: props.borderWidth ? `${props.borderWidth}px solid ${props.borderColor || 'transparent'}` : 'none',
          }}
        >
          {props.text || 'Button'}
        </a>
      </div>
    );
  }

  if (type === 'Social') {
    const platforms = props.platforms || [];
    const iconSize = props.iconSize || 24;
    const gap = props.gap || 16;
    const alignment = props.alignment || 'center';
    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || alignment, ...bgProps(style.backgroundColor) }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${gap}px`,
        }}>
          {platforms.map(p => (
            <a key={p.id} href={p.url || '#'} onClick={e => e.preventDefault()} title={p.label} style={{ display: 'inline-flex' }}>
              {p.iconUrl
                ? <img src={p.iconUrl} alt={p.label} width={iconSize} height={iconSize} style={{ display: 'block' }} />
                : <div style={{ width: iconSize, height: iconSize, borderRadius: 4, border: '1px dashed #CED4DD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#9CA3AF' }}>?</div>}
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'NavBar') {
    const links = props.links || [];
    const gap = props.gap || 24;
    const alignment = props.alignment || 'center';
    const linkColor = props.linkColor || '#7C5CFA';
    const fontSize = props.fontSize || 14;
    const fontWeight = props.fontWeight || 'bold';
    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || alignment, ...bgProps(style.backgroundColor) }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${gap}px`,
        }}>
          {links.map((link, i) => (
            <a
              key={i}
              href={link.url || '#'}
              onClick={e => e.preventDefault()}
              style={{ color: linkColor, fontSize, fontWeight, textDecoration: 'none', fontFamily: 'inherit' }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'Table') {
    return <InlineTable id={id} props={props} style={style} commitTable={ctx.commitTable} />;
  }

  // Other primitives — delegate to Reader.
  return <Reader document={ctx.doc} rootBlockId={id} />;
}

function InlineTable({ id, props, style, commitTable }) {
  const cols = props.columns || [];
  const rows = props.rows || [];
  const borderColor = props.borderColor || '#E1E4EA';
  const headerBg = props.headerBg || '#7C5CFA';
  const headerColor = props.headerColor || '#fff';
  const stripedRows = props.stripedRows;
  const stripedColor = props.stripedColor || '#F6F4FF';

  const commitHeader = useCallback((ci, value) => {
    const next = cols.map((c, i) => i === ci ? { ...c, header: value } : c);
    commitTable(id, { columns: next });
  }, [id, cols, commitTable]);

  const commitCell = useCallback((ri, key, value) => {
    const next = rows.map((r, i) => i === ri ? { ...r, [key]: value } : r);
    commitTable(id, { rows: next });
  }, [id, rows, commitTable]);

  return (
    <div style={{ padding: paddingCss(style.padding), overflowX: 'auto', textAlign: style.blockAlign || 'left' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: style.fontSize || 13, fontFamily: 'inherit', minWidth: cols.length > 3 ? cols.length * 120 : undefined }}>
        <thead>
          <tr>
            {cols.map((col, ci) => (
              <th key={ci} style={{ padding: 0, textAlign: 'left', backgroundColor: headerBg, color: headerColor, fontWeight: 600, border: `1px solid ${borderColor}` }}>
                <EditableCell
                  value={col.header}
                  onCommit={v => commitHeader(ci, v)}
                  style={{ color: headerColor, fontWeight: 600 }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {cols.map((col, ci) => (
                <td key={ci} style={{ padding: 0, border: `1px solid ${borderColor}`, backgroundColor: stripedRows && ri % 2 === 1 ? stripedColor : 'transparent' }}>
                  <EditableCell
                    value={row[col.key] || ''}
                    onCommit={v => commitCell(ri, col.key, v)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableCell({ value, onCommit, style: extraStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const finish = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={e => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: 'var(--primary-25, #FAFAFF)',
          outline: '2px solid var(--primary-300)',
          outlineOffset: -2,
          fontSize: 'inherit',
          fontFamily: 'inherit',
          ...extraStyle,
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={startEdit}
      style={{ padding: '8px 12px', cursor: 'text', minHeight: 20, ...extraStyle }}
    >
      {value || ' '}
    </div>
  );
}
