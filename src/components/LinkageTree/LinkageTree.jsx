import { useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection,
  useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { Icon } from '../Icon/Icon';
import styles from './LinkageTree.module.css';

// Pointer-downs on a row's own controls (title button, actions) are clicks, not drags.
const NO_DRAG = 'button:not([data-drag-handle]), input, textarea, select, a, [data-no-drag]';

// Collision with the group under the pointer first, so a tall neighbour can't steal the drop.
const collisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

const dragId = (groupKey, itemKey) => `${groupKey}::${itemKey}`;

// Takes the node whole: group and item objects carry `key`, which can't be spread into JSX.
function Row({ node, interactive = true }) {
  const { icon, iconColor, title, meta, trailing } = node;
  const onOpen = interactive ? node.onOpen : undefined;
  return (
    <>
      <span className={styles.icon}>
        <Icon name={icon} size={16} color={iconColor || 'var(--neutral-400)'} />
      </span>
      <span className={styles.text}>
        {onOpen ? (
          <button type="button" className={styles.title} onClick={onOpen} title={title}>{title}</button>
        ) : (
          <span className={styles.title} title={title}>{title}</span>
        )}
        {meta && <span className={styles.meta}>{meta}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </>
  );
}

function Item({ item, groupKey, readOnly, renderItemActions }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: dragId(groupKey, item.key),
    data: { item, groupKey },
    disabled: readOnly,
  });
  const onPointerDown = readOnly
    ? undefined
    : (e) => { if (!e.target.closest(NO_DRAG)) listeners.onPointerDown(e); };
  return (
    <li
      ref={setNodeRef}
      className={[styles.item, isDragging ? styles.itemDragging : ''].filter(Boolean).join(' ')}
      onPointerDown={onPointerDown}
    >
      <div className={styles.row}>
        <Row node={item} />
        {renderItemActions && <span className={styles.actions}>{renderItemActions(item, groupKey)}</span>}
        {!readOnly && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className={styles.handle}
            aria-label={`Move ${item.title}`}
            data-drag-handle
            {...attributes}
            {...listeners}
          >
            <Icon name="custom:drag-handle" size={16} color="var(--neutral-300)" />
          </button>
        )}
      </div>
    </li>
  );
}

function Group({ group, readOnly, renderItemActions, dragging }) {
  const { setNodeRef, isOver } = useDroppable({ id: group.key, disabled: readOnly });
  // The group an item is being dragged out of isn't a target for it.
  const target = isOver && dragging && dragging.groupKey !== group.key;
  const className = [
    styles.group,
    group.unlinked ? styles.unlinked : '',
    dragging && dragging.groupKey !== group.key ? styles.droppable : '',
    target ? styles.over : '',
  ].filter(Boolean).join(' ');

  return (
    <section ref={setNodeRef} className={className} aria-label={group.unlinked ? group.title : undefined}>
      {group.unlinked ? (
        <div className={styles.unlinkedHead}>
          <span className={styles.unlinkedTitle}>{group.title}</span>
          <span className={styles.count}>{group.items.length}</span>
        </div>
      ) : (
        <div className={`${styles.row} ${styles.parent}`}>
          <Row node={group} />
        </div>
      )}
      {group.items.length > 0 ? (
        <ul className={group.unlinked ? styles.flatList : styles.children}>
          {group.items.map(item => (
            <Item
              key={item.key}
              item={item}
              groupKey={group.key}
              readOnly={readOnly}
              renderItemActions={renderItemActions}
            />
          ))}
        </ul>
      ) : (
        <p className={group.unlinked ? styles.emptyFlat : styles.empty}>
          {target ? `Drop to link to ${group.title}` : group.emptyText}
        </p>
      )}
    </section>
  );
}

/**
 * LinkageTree: parents with their linked children nested beneath them,
 * joined by connecting lines, plus an optional "unlinked" group at the end.
 * Children drag between groups to re-link, by pointer (anywhere on the row
 * except its controls) or keyboard (focus the grip, Space, arrows, Space).
 * Used by the care plan's Linkage view (goals → interventions and barriers).
 *
 * A child can sit in more than one group (a barrier linked to two goals);
 * `item.key` only has to be unique within its group.
 *
 * @param {Array<{ key: string, title: string, icon: string, iconColor?: string,
 *   meta?: React.ReactNode, trailing?: React.ReactNode, onOpen?: () => void,
 *   emptyText?: string, unlinked?: boolean,
 *   items: Array<{ key: string, title: string, icon: string, iconColor?: string,
 *     meta?: React.ReactNode, trailing?: React.ReactNode, onOpen?: () => void }> }>} props.groups
 * @param {(item, fromGroupKey: string, toGroupKey: string) => void} [props.onMove]
 * @param {(item, groupKey: string) => React.ReactNode} [props.renderItemActions]
 * @param {boolean} [props.readOnly=false] – no dragging and no item actions
 */
export function LinkageTree({ groups, onMove, renderItemActions, readOnly = false }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const [dragging, setDragging] = useState(null);

  const handleDragEnd = ({ active, over }) => {
    setDragging(null);
    const from = active.data.current?.groupKey;
    if (!over || over.id === from) return;
    onMove?.(active.data.current.item, from, over.id);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }) => setDragging(active.data.current)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.tree}>
        {groups.map(group => (
          <Group
            key={group.key}
            group={group}
            readOnly={readOnly}
            renderItemActions={readOnly ? null : renderItemActions}
            dragging={dragging}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className={`${styles.row} ${styles.overlay}`}>
            <Row node={dragging.item} interactive={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
