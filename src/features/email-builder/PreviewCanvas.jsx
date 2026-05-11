import { useState, useRef, useCallback, useEffect } from 'react';
import { Reader } from '@usewaypoint/email-builder';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { InlineEditable } from './InlineEditable';
import styles from './EmailBuilder.module.css';

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
  Table: 'Table',
};

function blockLabel(block) {
  const role = block.data?.role;
  if (role === 'header') return 'Header';
  if (role === 'body') return 'Body';
  if (role === 'footer') return 'Footer';
  return TYPE_LABELS[block.type] || block.type;
}

function paddingCss(p) {
  if (!p) return undefined;
  return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
}

// Six-dot drag handle that matches the Figma toolbar precisely.
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
    <div ref={wrapRef} className={styles.resizeWrap} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
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

export function PreviewCanvas() {
  const doc = useAppStore(s => s.emailDocument);
  const selectedBlockId = useAppStore(s => s.selectedBlockId);
  const bulkSelectedIds = useAppStore(s => s.bulkSelectedIds);
  const setSelectedBlockId = useAppStore(s => s.setSelectedBlockId);
  const removeBlock = useAppStore(s => s.removeBlock);
  const updateBlock = useAppStore(s => s.updateBlock);
  const duplicateBlock = useAppStore(s => s.duplicateBlock);
  const moveBlockUp = useAppStore(s => s.moveBlockUp);
  const htmlOverride = useAppStore(s => s.htmlPreviewOverride);

  if (!doc) return null;

  // HTML override → bypass the doc and render the user's edited markup.
  if (htmlOverride != null) {
    return (
      <div className={styles.canvasWrap}>
        <iframe className={styles.canvasIframe} title="Email preview" srcDoc={htmlOverride} sandbox="" />
      </div>
    );
  }

  const root = doc.root;
  const childrenIds = root?.data?.childrenIds || [];
  const layoutStyle = {
    background: root?.data?.canvasColor || '#fff',
    color: root?.data?.textColor || '#3A485F',
    fontFamily: 'Inter, sans-serif',
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

  const bulkSet = new Set(bulkSelectedIds);
  const ctx = {
    doc,
    selectedBlockId,
    bulkSet,
    setSelectedBlockId,
    removeBlock,
    updateBlock,
    duplicateBlock,
    moveBlockUp,
    commitText,
    commitTable,
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

// ── A sortable list of blocks belonging to a single parent slot. ────────────
function SortableList({ parentId, columnIdx, childrenIds, ctx }) {
  // If empty, render a droppable placeholder so the user has somewhere to drop.
  if (!childrenIds || childrenIds.length === 0) {
    return <EmptyDropzone parentId={parentId} columnIdx={columnIdx} />;
  }
  return (
    <SortableContext items={childrenIds} strategy={verticalListSortingStrategy}>
      {childrenIds.map(id => (
        <SortableBlock key={id} id={id} ctx={ctx} />
      ))}
    </SortableContext>
  );
}

function EmptyDropzone({ parentId, columnIdx }) {
  const dropId = columnIdx == null ? `__empty:${parentId}` : `__empty:${parentId}:${columnIdx}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <div ref={setNodeRef} className={[styles.emptyDrop, isOver ? styles.emptyDropOver : ''].join(' ')}>
      Drop here
    </div>
  );
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
  const isBody = block.data?.role === 'body';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        styles.blockWrap,
        isSelected && !isBody ? styles.blockWrapSelected : '',
        isBulkSelected ? styles.blockWrapBulk : '',
      ].join(' ')}
      onClick={(e) => { e.stopPropagation(); ctx.setSelectedBlockId(id); }}
    >
      {isSelected && !isBody && (
        <div className={styles.blockToolbar}>
          <button
            {...attributes}
            {...listeners}
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
            onClick={(e) => { e.stopPropagation(); ctx.moveBlockUp(id); }}
            aria-label="Move up"
            title="Move up"
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
        text={props.text || ''}
        style={style}
        onCommit={ctx.commitText}
      />
    );
  }

  if (type === 'Container') {
    const isSelected = ctx.selectedBlockId === id;
    const heightMode = props.heightMode || 'hug';
    const containerStyle = {
      position: 'relative',
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage ? `url(${style.backgroundImage})` : undefined,
      backgroundSize: style.backgroundSize || 'cover',
      backgroundPosition: style.backgroundPosition || 'center',
      backgroundRepeat: style.backgroundRepeat || 'no-repeat',
      padding: paddingCss(style.padding),
      color: style.color,
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    };
    if (heightMode === 'fixed' && props.height) {
      containerStyle.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
      containerStyle.overflow = 'auto';
    }
    return (
      <div style={containerStyle}>
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
    const fixedWidths = props.fixedWidths || [];
    const colsStyle = {
      position: 'relative',
      display: 'flex',
      flexDirection: direction,
      flexWrap: wrap,
      alignItems: align === 'top' ? 'flex-start' : align === 'middle' ? 'center' : 'flex-end',
      columnGap: `${hGap}px`,
      rowGap: `${vGap}px`,
      padding: paddingCss(style.padding),
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage ? `url(${style.backgroundImage})` : undefined,
      backgroundSize: style.backgroundSize || 'cover',
      backgroundPosition: style.backgroundPosition || 'center',
      backgroundRepeat: style.backgroundRepeat || 'no-repeat',
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    };
    if (heightMode === 'fixed' && props.height) {
      colsStyle.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
      colsStyle.overflow = 'auto';
    }
    return (
      <div style={colsStyle}>
        {visible.map((col, idx) => (
          <div
            key={idx}
            style={{
              flex: fixedWidths[idx] ? `0 0 ${fixedWidths[idx]}px` : '1 1 0',
              minWidth: 0,
            }}
          >
            <SortableList parentId={id} columnIdx={idx} childrenIds={col?.childrenIds || []} ctx={ctx} />
          </div>
        ))}
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

    const content = props.url ? (
      <img src={props.url} alt={props.alt || ''} style={imgStyle} />
    ) : (
      <div style={{ padding: 24, border: '1px dashed #CED4DD', borderRadius: 8, color: '#9CA3AF', fontSize: 12, width: imgStyle.width }}>
        No image
      </div>
    );

    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.textAlign || 'center', backgroundColor: style.backgroundColor }}>
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
      <div style={{ padding: paddingCss(style.padding), textAlign: style.textAlign || 'center' }}>
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
      <div style={{ padding: paddingCss(style.padding), textAlign: style.textAlign || 'center' }}>
        <a
          href={props.url || '#'}
          onClick={e => e.preventDefault()}
          style={{
            display: 'inline-block',
            padding: sz.padding,
            backgroundColor: props.buttonBackgroundColor || '#7C5CFA',
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
    <div style={{ padding: paddingCss(style.padding), overflowX: 'auto' }}>
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
