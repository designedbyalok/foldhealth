import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { NODE_LIST } from './nodes/nodeConfig';
import styles from './NodePanel.module.css';

const COMPONENTS = [
  { type: 'greeting', icon: 'solar:hand-shake-linear', label: 'Greeting', desc: 'Standard greeting message' },
  { type: 'verification', icon: 'solar:shield-user-linear', label: 'Verification', desc: 'Identity verification block' },
  { type: 'medCheck', icon: 'solar:pill-linear', label: 'Med Check', desc: 'Medication reconciliation' },
  { type: 'scheduling', icon: 'solar:calendar-mark-linear', label: 'Scheduling', desc: 'Appointment scheduling' },
];

function NodeItem({ node, onDragStart }) {
  const [hovered, setHovered] = useState(false);
  const itemRef = useRef(null);
  const hoverTimer = useRef(null);

  const handleEnter = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(true), 250);
  };
  const handleLeave = () => {
    clearTimeout(hoverTimer.current);
    setHovered(false);
  };

  const rect = itemRef.current?.getBoundingClientRect();

  return (
    <>
      <div
        ref={itemRef}
        className={styles.nodeItem}
        draggable
        onDragStart={e => { handleLeave(); onDragStart(e, node.type, node.label); }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div
          className={styles.nodeIcon}
          style={{
            background: `color-mix(in srgb, ${node.color} 12%, var(--neutral-0))`,
            borderColor: `color-mix(in srgb, ${node.color} 25%, transparent)`,
          }}
        >
          {node.CustomIcon
            ? <node.CustomIcon size={16} color={node.color} />
            : <Icon name={node.icon} size={16} color={node.color} />}
        </div>
        <span className={styles.nodeLabel}>{node.label}</span>
      </div>
      {hovered && rect && createPortal(
        <div
          className={styles.nodeTooltip}
          style={{ top: rect.top + rect.height / 2, left: rect.right + 8 }}
        >
          <div className={styles.nodeTooltipHeader}>
            <div
              className={styles.nodeTooltipIcon}
              style={{ background: node.drawerBg, borderColor: node.drawerBorder }}
            >
              {node.CustomIcon
                ? <node.CustomIcon size={16} color={node.color} />
                : <Icon name={node.icon} size={16} color={node.color} />}
            </div>
            <span className={styles.nodeTooltipTitle} style={{ color: node.color }}>
              {node.label}
            </span>
          </div>
          <p className={styles.nodeTooltipDesc}>{node.description}</p>
        </div>,
        document.body
      )}
    </>
  );
}

export function NodePanel({ onDragStart }) {
  const [activeTab, setActiveTab] = useState('Node');

  const handleDragStart = (e, nodeType, label) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label }));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(nodeType);
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.toggleWrap}>
        <SegmentedControl items={['Node', 'Components']} value={activeTab} onValueChange={setActiveTab} fullWidth />
      </div>

      <div className={styles.list}>
        {activeTab === 'Node' ? (
          NODE_LIST.map(n => (
            <NodeItem key={n.type} node={n} onDragStart={handleDragStart} />
          ))
        ) : (
          COMPONENTS.map(c => (
            <div
              key={c.type}
              className={styles.componentItem}
              draggable
              onDragStart={e => handleDragStart(e, c.type, c.label)}
            >
              <div className={styles.componentIcon}>
                <Icon name={c.icon} size={16} color="var(--primary-300)" />
              </div>
              <div className={styles.componentText}>
                <span className={styles.componentLabel}>{c.label}</span>
                <span className={styles.componentDesc}>{c.desc}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
