import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { FAMILY, nodeDef, triggerDef } from '../lib/catalog';
import { branchesOf, nodeProblems, outcomeSetOf } from '../lib/graph';
import { nodeStatusOf } from '../lib/analytics';
import { useCanvas } from './canvasContext';
import styles from './AutomationCanvas.module.css';

const DRAG_TYPE = 'application/x-automation-node';

// Invisible handles: edges need an anchor, users never connect by hand.
function Handles({ loop = false }) {
  return (
    <>
      <Handle type="target" position={Position.Top} className={styles.handle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className={styles.handle} isConnectable={false} />
      {loop && <Handle id="right" type="source" position={Position.Right} className={styles.handle} isConnectable={false} />}
      {loop && <Handle id="right" type="target" position={Position.Right} className={styles.handle} isConnectable={false} />}
    </>
  );
}

const STATUS_CLASS = {
  current: styles.isCurrent,
  running: styles.isRunning,
  success: styles.isSuccess,
  error: styles.isError,
  skipped: styles.isSkipped,
  pending: styles.isPending,
  in_progress: styles.isWaiting,
  not_run: styles.isPending,
};

function StatusBadge({ state }) {
  if (state === 'success') return <span className={`${styles.statusBadge} ${styles.badgeSuccess}`}><Icon name="solar:check-circle-linear" size={16} /></span>;
  if (state === 'running') return <span className={`${styles.statusBadge} ${styles.badgeRunning}`}><Icon name="solar:refresh-linear" size={14} /></span>;
  if (state === 'error') return <span className={`${styles.statusBadge} ${styles.badgeError}`}><Icon name="solar:danger-circle-linear" size={16} /></span>;
  if (state === 'skipped') return <span className={`${styles.statusBadge} ${styles.badgeSkipped}`}><Icon name="solar:skip-next-linear" size={14} /></span>;
  return null;
}

function nodeClasses(ctx, id, base) {
  const state = ctx.nodeState?.[id];
  return [
    base,
    ctx.mode === 'edit' && ctx.selectedId === id ? styles.isSelected : '',
    ctx.flagged?.has(id) ? styles.isFlagged : '',
    state ? STATUS_CLASS[state] : '',
  ].filter(Boolean).join(' ');
}

function StartNode({ data }) {
  const ctx = useCanvas();
  return (
    <div className={styles.startWrap}>
      <div className={styles.start}>
        <Icon name="solar:star-fall-minimalistic-linear" size={16} />
        Starts here
      </div>
      {data?.dangling ? <span className={styles.looseEnd} aria-hidden="true" /> : (
      <Tooltip label={ctx.anyCollapsed ? 'Expand All Nodes' : 'Collapse All Nodes'}>
        <button type="button" className={styles.collapseAll} onClick={ctx.toggleAll} aria-label={ctx.anyCollapsed ? 'Expand all nodes' : 'Collapse all nodes'}>
          <Icon name={ctx.anyCollapsed ? 'solar:square-double-alt-arrow-down-linear' : 'solar:square-double-alt-arrow-up-linear'} size={16} />
        </button>
      </Tooltip>
      )}
      <Handle type="source" position={Position.Bottom} className={styles.handle} isConnectable={false} />
    </div>
  );
}

function StatBlock({ id }) {
  const ctx = useCanvas();
  const s = ctx.stats?.nodes?.[id];
  const status = nodeStatusOf(s);
  return (
    <div className={`${styles.statBlock} ${styles[`stat_${status}`]}`}>
      <span className={styles.statValue}>{s?.members ?? 0} member{s?.members === 1 ? '' : 's'}</span>
      <span className={styles.statSub}>{s?.minutes ?? 0} mins saved</span>
    </div>
  );
}

function CardNode({ data }) {
  const ctx = useCanvas();
  const { node, outcomeCount, folded, helper } = data;
  const isTrigger = node.id === 'trigger';
  const def = isTrigger ? triggerDef(node.type) : nodeDef(node.type);
  const family = FAMILY[isTrigger ? 'trigger' : def?.family] || FAMILY.add;
  const label = isTrigger ? 'Trigger' : (def?.nodeLabel || node.type);
  const summary = isTrigger ? def?.label : ctx.summaryOf(node);
  const editing = ctx.mode === 'edit';
  const problems = editing && !isTrigger ? nodeProblems(node) : [];
  const set = outcomeSetOf(node);
  const icon = isTrigger ? 'solar:bolt-linear' : def?.icon;

  return (
    <div
      className={nodeClasses(ctx, node.id, [styles.card, ctx.mode === 'stats' ? styles.cardWithStats : '', editing && !summary ? styles.isUnset : ''].filter(Boolean).join(' '))}
      onClick={(e) => { e.stopPropagation(); ctx.onSelectNode?.(node.id); }}
      role={ctx.onSelectNode ? 'button' : undefined}
      tabIndex={ctx.onSelectNode ? 0 : undefined}
      onKeyDown={(e) => { if (e.key === 'Enter') ctx.onSelectNode?.(node.id); }}
    >
      <Handles />
      <div className={styles.cardMain}>
        {ctx.mode === 'stats' && <StatBlock id={node.id} />}
        <span className={styles.iconTile} style={{ color: family.color, background: family.bg }}>
          <Icon name={icon || 'solar:bolt-linear'} size={18} />
        </span>
        <div className={styles.cardText}>
          <span className={styles.cardLabel}>{label}</span>
          {summary
            ? <span className={styles.cardSummary}>{summary}</span>
            : <span className={styles.cardEdit}>{isTrigger ? 'Select Trigger' : 'Edit'}</span>}
        </div>
        {editing && !isTrigger && (
          <span className={styles.cardActions}>
            <ActionButton
              size="sm"
              icon="solar:trash-bin-trash-linear"
              tooltip="Delete"
              onClick={(e) => { e.stopPropagation(); ctx.onDeleteNode?.(node.id); }}
            />
          </span>
        )}
        {problems.length > 0 && summary && (
          <Tooltip label={`Needs: ${problems.map(p => p.label).join(', ')}`}>
            <span className={styles.problemDot} aria-label="Needs setup" />
          </Tooltip>
        )}
        <StatusBadge state={ctx.nodeState?.[node.id]} />
      </div>
      {helper && (
        <div className={styles.helperFooter}>Trigger will run when the applied conditions match the member.</div>
      )}
      {outcomeCount > 0 && (
        <button
          type="button"
          className={styles.outcomeFooter}
          onClick={(e) => { e.stopPropagation(); ctx.toggleCollapse(node.id); }}
          aria-expanded={!folded}
        >
          {branchesOf(node).length} {(set?.label || 'Outcomes').toUpperCase()}
          <Icon name={folded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'} size={12} />
        </button>
      )}
    </div>
  );
}


function PillNode({ data }) {
  const ctx = useCanvas();
  const { node } = data;
  const def = nodeDef(node.type);
  const text = node.type === 'delay' || node.type === 'repeat' ? ctx.summaryOf(node) : def?.label;
  const count = ctx.mode === 'stats' ? ctx.stats?.nodes?.[node.id]?.members : null;
  return (
    <div
      className={nodeClasses(ctx, node.id, `${styles.pill} ${node.type === 'and' || node.type === 'or' ? styles.pillLogic : ''}`)}
      onClick={(e) => { e.stopPropagation(); ctx.onSelectNode?.(node.id); }}
    >
      <Handles loop={node.type === 'repeat'} />
      <Icon name={def?.icon} size={14} />
      <span className={styles.pillText}>{text}</span>
      {count != null && <span className={styles.pillCount}>{count}</span>}
      {ctx.mode === 'edit' && (
        <button type="button" className={styles.pillDelete} aria-label="Delete" onClick={(e) => { e.stopPropagation(); ctx.onDeleteNode?.(node.id); }}>
          <Icon name="solar:close-circle-linear" size={14} />
        </button>
      )}
      <StatusBadge state={ctx.nodeState?.[node.id]} />
    </div>
  );
}

function GroupHeaderNode({ data }) {
  const ctx = useCanvas();
  const { node } = data;
  return (
    <div
      className={nodeClasses(ctx, node.id, styles.groupHeader)}
      onClick={(e) => { e.stopPropagation(); ctx.onSelectNode?.(node.id); }}
    >
      <Handles />
      <Tooltip label={node.config?.title || 'Micro automation'}>
        <span className={styles.groupLabel}>
          <Icon name="solar:bolt-linear" size={12} color="var(--ai-gradient-from)" />
          <span className={styles.groupLabelText}>Micro automation</span>
        </span>
      </Tooltip>
      {ctx.mode === 'edit' && (
        <button type="button" className={styles.pillDelete} aria-label="Delete micro automation" onClick={(e) => { e.stopPropagation(); ctx.onDeleteNode?.(node.id); }}>
          <Icon name="solar:close-circle-linear" size={14} />
        </button>
      )}
    </div>
  );
}

function GroupBoxNode() {
  return <div className={styles.groupBox} />;
}

function ChipNode({ data }) {
  const ctx = useCanvas();
  const count = ctx.stats?.branches?.[`${data.parentId}::${data.branch.key}`];
  return (
    <div className={styles.chip}>
      <Handles />
      {data.branch.icon && <Icon name={data.branch.icon} size={14} />}
      <span>{data.branch.label}</span>
      {ctx.mode === 'stats' && <span className={styles.chipCount}>{count || 0}</span>}
    </div>
  );
}

function SlotNode({ data }) {
  const ctx = useCanvas();
  const [over, setOver] = useState(false);
  const selected = ctx.selectedSlot && ctx.selectedSlot.parentId === data.parentId && ctx.selectedSlot.branch === data.branch;
  const slot = { parentId: data.parentId, branch: data.branch };
  return (
    <Tooltip label="Drop the step here">
      <button
        type="button"
        className={[styles.slot, selected ? styles.slotSelected : '', ctx.dragging ? styles.slotLive : '', over ? styles.slotOver : ''].filter(Boolean).join(' ')}
        aria-label="Drop the step here"
        onClick={(e) => { e.stopPropagation(); ctx.onSelectSlot?.(selected ? null : slot); }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const type = e.dataTransfer.getData(DRAG_TYPE);
          if (type) ctx.onDropType?.(type, slot);
        }}
      >
        <Handle type="target" position={Position.Top} className={styles.handle} isConnectable={false} />
        Drop here
      </button>
    </Tooltip>
  );
}

function AnnotationNode({ data }) {
  return <div className={styles.annotation} onClick={e => e.stopPropagation()}>{data.content}</div>;
}

export const NODE_TYPES = {
  start: StartNode,
  card: CardNode,
  pill: PillNode,
  groupHeader: GroupHeaderNode,
  groupBox: GroupBoxNode,
  chip: ChipNode,
  slot: SlotNode,
  annotation: AnnotationNode,
};

export { DRAG_TYPE };
