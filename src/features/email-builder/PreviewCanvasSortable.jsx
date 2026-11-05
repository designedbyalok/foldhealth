import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store/useAppStore';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { BlockBody } from './PreviewCanvasBlockBody';
import { blockLabel } from './PreviewCanvas.utils';
import styles from './EmailBuilder.module.css';

function DragHandleDots() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
      <circle cx="3" cy="3" r="1.2" fill="currentColor" />
      <circle cx="9" cy="3" r="1.2" fill="currentColor" />
      <circle cx="3" cy="7" r="1.2" fill="currentColor" />
      <circle cx="9" cy="7" r="1.2" fill="currentColor" />
      <circle cx="3" cy="11" r="1.2" fill="currentColor" />
      <circle cx="9" cy="11" r="1.2" fill="currentColor" />
    </svg>
  );
}

function DropIndicatorLine() {
  return <div className={styles.dropIndicatorLine} />;
}

export function SortableList({ parentId, columnIdx, childrenIds, ctx, gap }) {
  if (!childrenIds || childrenIds.length === 0) {
    return <EmptyDropzone parentId={parentId} columnIdx={columnIdx} />;
  }
  const ind = ctx.dropIndicator;
  const showHere = ind && ind.parentId === parentId && (ind.columnIdx ?? undefined) === (columnIdx ?? undefined) && !ind.isNest;
  const wrapperStyle = gap ? { display: 'flex', flexDirection: 'column', gap: `${gap}px` } : undefined;
  const content = (
    <>
      {showHere && ind.index === 0 && <DropIndicatorLine />}
      {childrenIds.map((id, idx) => (
        <div key={id}>
          <SortableBlock id={id} ctx={ctx} />
          {showHere && ind.index === idx + 1 && <DropIndicatorLine />}
        </div>
      ))}
    </>
  );
  return (
    <SortableContext items={childrenIds} strategy={verticalListSortingStrategy}>
      {wrapperStyle ? <div style={wrapperStyle}>{content}</div> : content}
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

function holdListeners(listeners, delay = 250) {
  if (!listeners?.onPointerDown) return listeners;
  return {
    ...listeners,
    onPointerDown: (e) => {
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
            type="button"
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
          <ActionButton
            icon="solar:undo-left-round-linear"
            size="sm"
            tooltip="Select parent (⇧↵)"
            className={styles.blockToolbarAction}
            iconColor="currentColor"
            onClick={(e) => { e.stopPropagation(); ctx.selectParentBlock(id); }}
            aria-label="Select parent"
          />
          <span className={styles.blockToolbarDivider} />
          <ActionButton
            icon="solar:copy-linear"
            size="sm"
            tooltip="Duplicate"
            className={styles.blockToolbarAction}
            iconColor="currentColor"
            onClick={(e) => { e.stopPropagation(); ctx.duplicateBlock(id); }}
            aria-label="Duplicate"
          />
          <span className={styles.blockToolbarDivider} />
          <ActionButton
            icon="solar:trash-bin-trash-linear"
            size="sm"
            tooltip="Delete"
            className={styles.blockToolbarAction}
            iconColor="currentColor"
            onClick={(e) => { e.stopPropagation(); ctx.removeBlock(id); }}
            aria-label="Delete"
          />
        </div>
      )}
      <BlockBody id={id} block={block} ctx={ctx} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}
