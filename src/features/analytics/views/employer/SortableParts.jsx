/**
 * Drag-to-reorder pieces shared by the Update Dashboard and Print drawers:
 * a sortable list, and an item whose grip (only) starts the drag.
 */
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
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

/**
 * A reorderable item. Only its grip starts a drag, so the Switch and text
 * stay clickable; `children(handle)` places the grip where the row needs it.
 */
export function SortableItem({ id, label, className, children }) {
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
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[className, isDragging ? styles.dragging : ''].filter(Boolean).join(' ')}
    >
      {children(handle)}
    </div>
  );
}

export function SortableList({ ids, onReorder, children }) {
  const sensors = useReorderSensors();
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
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
