import { useRef, useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { getFontStack } from './googleFonts';
import { parseSize } from './PreviewCanvas.utils';
import { EditableHtmlIframe } from './PreviewCanvasEditableHtml';
import { SortableList } from './PreviewCanvasSortable';
import styles from './EmailBuilder.module.css';

export function ContainerResizeHandle({ id, block, updateBlock }) {
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

export function ResizeWrap({ id, block, updateBlock, isSelected, canWidth, canHeight, children }) {
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
        <SortableList parentId="root" childrenIds={childrenIds} ctx={ctx} gap={root?.data?.gap} />
      </div>
    </div>
  );
}

