/**
 * Drag-to-reorder pieces shared by the Update Dashboard and Print drawers:
 * a sortable list, and an item whose grip (only) starts the drag.
 */
import { DndContext, closestCenter, KeyboardSensor, MeasuringStrategy, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../../../../components/Icon/Icon';
import styles from './UpdateDashboardDrawer.module.css';

function useReorderSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

// Pointer-downs that belong to a control, not to a drag of the whole item.
const NO_DRAG = 'button, input, textarea, select, a, [role="switch"], [role="textbox"], [contenteditable], [data-no-drag]';

/**
 * A reorderable item. By default only its grip starts a drag, so the Switch
 * and text stay clickable; `children(handle)` places the grip where the row
 * needs it. With `dragOnItem`, a pointer drag can start anywhere on the item
 * except on its controls (NO_DRAG); keyboard reordering stays on the grip.
 */
export function SortableItem({ id, label, className, dragOnItem = false, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={styles.handle}
      aria-label={`Reorder ${label}`}
      {...attributes}
      {...listeners}
    >
      <Icon name="custom:drag-handle" size={16} color="var(--neutral-300)" />
    </button>
  );
  const onItemPointerDown = dragOnItem
    ? (e) => { if (!e.target.closest(NO_DRAG)) listeners.onPointerDown(e); }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[className, isDragging ? styles.dragging : ''].filter(Boolean).join(' ')}
      data-dragging={isDragging || undefined}
      onPointerDown={onItemPointerDown}
    >
      {children(handle)}
    </div>
  );
}

// Items that change size mid-drag (e.g. cards that shrink to their titles
// while reordering) need their drop targets re-measured as they move.
const REMEASURE = { droppable: { strategy: MeasuringStrategy.Always } };

/**
 * @param {string[]} ids
 * @param {(ids: string[]) => void} onReorder
 * @param {() => void} [onDragStart]   – A drag began
 * @param {() => void} [onDragFinish]  – It ended (dropped or cancelled)
 */
export function SortableList({ ids, onReorder, onDragStart, onDragFinish, children }) {
  const sensors = useReorderSensors();
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={onDragStart ? REMEASURE : undefined}
      onDragStart={onDragStart}
      onDragCancel={onDragFinish}
      onDragEnd={({ active, over }) => {
        onDragFinish?.();
        if (!over || active.id === over.id) return;
        onReorder(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
