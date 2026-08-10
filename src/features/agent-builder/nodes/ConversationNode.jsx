import { memo, useRef, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { getNodeConfig } from './nodeConfig';
import styles from './ConversationNode.module.css';

function DragDots({ className, onPointerDown }) {
  return (
    <svg
      width="8" height="12" viewBox="0 0 8 12" fill="none"
      className={className}
      onPointerDown={onPointerDown}
      style={{ touchAction: 'none' }}
    >
      <circle cx="2" cy="2" r="1" fill="currentColor" /><circle cx="6" cy="2" r="1" fill="currentColor" />
      <circle cx="2" cy="6" r="1" fill="currentColor" /><circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="2" cy="10" r="1" fill="currentColor" /><circle cx="6" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

export const ConversationNode = memo(function ConversationNode({ data, id }) {
  const config = getNodeConfig(data.nodeType);
  const transitions = data.transitions || [];
  const builderSelectedNode = useAppStore(s => s.builderSelectedNode);
  const activeTransitionIdx = useAppStore(s => s.builderActiveTransition);
  const setActiveTransition = useAppStore(s => s.setBuilderActiveTransition);
  const updateNodeData = useAppStore(s => s.updateNodeData);
  const isThisNodeSelected = builderSelectedNode === id;

  // Shake animation for already-selected clicks
  const [shakeIdx, setShakeIdx] = useState(null);

  const handleRowClick = useCallback((e, i) => {
    e.stopPropagation();
    if (activeTransitionIdx === i) {
      // Already selected — trigger shake
      setShakeIdx(null);
      requestAnimationFrame(() => setShakeIdx(i));
      setTimeout(() => setShakeIdx(null), 500);
    } else {
      setActiveTransition(i);
    }
  }, [activeTransitionIdx, setActiveTransition]);

  // Pointer-based drag reorder (works inside React Flow nodes)
  const dragIdx = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const listRef = useRef(null);

  const handlePointerDown = useCallback((e, idx) => {
    e.stopPropagation();
    e.preventDefault();
    dragIdx.current = idx;
    setDraggingIdx(idx);
    setDragOverIdx(null);

    const onPointerMove = (ev) => {
      if (!listRef.current) return;
      const rows = listRef.current.querySelectorAll('[data-row-idx]');
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
          const overIdx = Number(row.dataset.rowIdx);
          setDragOverIdx(overIdx !== dragIdx.current ? overIdx : null);
          break;
        }
      }
    };

    const onPointerUp = () => {
      const from = dragIdx.current;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);

      if (!listRef.current) { dragIdx.current = null; setDragOverIdx(null); setDraggingIdx(null); return; }
      const rows = listRef.current.querySelectorAll('[data-row-idx]');
      let targetIdx = null;
      for (const row of rows) {
        if (row.classList.contains(styles.transitionRowDragOver)) {
          targetIdx = Number(row.dataset.rowIdx);
          break;
        }
      }

      dragIdx.current = null;
      setDragOverIdx(null);
      setDraggingIdx(null);

      if (targetIdx !== null && targetIdx !== from) {
        const arr = [...transitions];
        const [moved] = arr.splice(from, 1);
        arr.splice(targetIdx, 0, moved);
        updateNodeData(id, { transitions: arr });
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, [transitions, id, updateNodeData]);

  // + button: add transition via store (shared with NodeSettings)
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef(null);

  const handleAddTransition = useCallback((type) => {
    const newTransition = type === 'equation'
      ? { type: 'equation', matchMode: 'all', rules: [{ variable: '', operator: '>', value: '' }], target: '' }
      : { type: 'prompt', condition: '', target: '' };
    const newTransitions = [...transitions, newTransition];
    updateNodeData(id, { transitions: newTransitions });
    setActiveTransition(transitions.length);
    setShowAddMenu(false);
  }, [transitions, id, updateNodeData, setActiveTransition]);

  return (
    <div className={`${styles.node} ${isThisNodeSelected ? styles.nodeSelected : ''}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerIcon} style={{ background: config.color }}>
          {config.CustomIcon ? <config.CustomIcon size={16} color="#fff" /> : <Icon name={config.icon} size={16} color="#fff" />}
        </div>
        <span className={styles.headerLabel} style={{ color: config.color }}>{data.label}</span>
        {data.verified && (
          <span className={styles.verifiedBadge}>
            <Icon name="solar:shield-check-bold" size={10} color="var(--status-success)" />
            Verified Node
          </span>
        )}
      </div>

      {/* Body */}
      {data.prompt && (
        <div className={styles.body}>
          {data.prompt}
        </div>
      )}

      {/* Transitions */}
      {transitions.length > 0 && (
        <div className={styles.transitions}>
          <div className={styles.transitionHeader}>
            <Icon name="solar:tuning-2-linear" size={14} color="var(--neutral-300)" />
            <span>Transition</span>
            <div className={styles.addBtnWrap} ref={addMenuRef}>
              <button className={`${styles.addTransitionBtn} nodrag nopan`} onClick={(e) => { e.stopPropagation(); setShowAddMenu(v => !v); }} aria-label="Add transition">
                <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
              </button>
              {showAddMenu && (
                <div className={`${styles.addDropdown} nodrag nopan`}>
                  <button className={styles.addDropdownItem} onClick={(e) => { e.stopPropagation(); handleAddTransition('prompt'); }}>
                    <Icon name="solar:notes-minimalistic-linear" size={14} color="var(--neutral-300)" />
                    <span>Prompt</span>
                  </button>
                  <button className={styles.addDropdownItem} onClick={(e) => { e.stopPropagation(); handleAddTransition('equation'); }}>
                    <Icon name="solar:calculator-minimalistic-linear" size={14} color="var(--neutral-300)" />
                    <span>Equation</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className={styles.transitionList} ref={listRef}>
            {transitions.map((t, i) => {
              const isActiveRow = isThisNodeSelected && activeTransitionIdx === i;
              const condLabel = t.type === 'equation'
                ? (t.rules || []).map(r => `${r.variable || '?'} ${r.operator} ${r.value || '?'}`).join(', ') || 'Equation'
                : (t.condition || '—');
              return (
                <div
                  key={i}
                  data-row-idx={i}
                  className={`${styles.transitionRow} nodrag nopan ${isActiveRow ? styles.transitionRowActive : ''} ${dragOverIdx === i ? styles.transitionRowDragOver : ''} ${draggingIdx === i ? styles.transitionRowDragging : ''} ${shakeIdx === i ? styles.transitionRowShake : ''}`}
                  onClick={(e) => handleRowClick(e, i)}
                >
                  <DragDots className={styles.dragDots} onPointerDown={(e) => handlePointerDown(e, i)} />
                  <span className={styles.transitionText}>{condLabel} &rarr; {t.target || '—'}</span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`t-${i}`}
                    className={styles.transitionHandle}
                    style={{ top: 'auto', right: -6 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback source handle if no transitions */}
      {transitions.length === 0 && (
        <Handle type="source" position={Position.Right} className={styles.handle} />
      )}
    </div>
  );
});

export const StartNode = memo(function StartNode({ data }) {
  return (
    <div className={styles.startNode}>
      <div className={styles.startIcon}>
        <Icon name="solar:play-bold" size={16} color="#fff" />
      </div>
      <span className={styles.startLabel}>{data.label || 'Starts Here'}</span>
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
});

export const EndNode = memo(function EndNode({ data }) {
  return (
    <div className={styles.endNode}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <div className={styles.endIcon}>
        <Icon name="solar:stop-bold" size={14} color="#fff" />
      </div>
      <span className={styles.endLabel}>{data.label || 'End'}</span>
    </div>
  );
});
