/**
 * Logic tab: the visual workflow / branching builder.
 *
 * A React-Flow node map (one node per field, edges for conditional rules) on the
 * left, and a rule editor on the right. Rules compile to the field's
 * `enableWhen[]` + `enableBehavior`, exactly what the engine evaluates and the
 * renderer now honors (Phase 1). "Show field B when A = Yes" ⇒ B.enableWhen =
 * [{question:'A', operator:'=', answer:'Yes'}], drawn as an edge A → B.
 */
import { useMemo, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, Handle, Position, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Icon } from '../../../components/Icon/Icon';
import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { Button } from '../../../components/Button/Button';
import { Toggle } from '../../../components/Toggle/Toggle';
import { OPERATOR } from '../scoring/types';
import { endingsOf } from '../render/flow';
import { fieldIcon } from '../analytics/formAnalyticsUi';
import styles from './LogicPanel.module.css';

const OPERATOR_LABELS = {
  [OPERATOR.EQ]: 'is', [OPERATOR.NE]: 'is not',
  [OPERATOR.GT]: 'greater than', [OPERATOR.LT]: 'less than',
  [OPERATOR.GTE]: 'at least', [OPERATOR.LTE]: 'at most',
  [OPERATOR.EXISTS]: 'is answered',
};
// Operators offered per trigger type.
const CHOICE_OPS = [OPERATOR.EQ, OPERATOR.NE, OPERATOR.EXISTS];
const NUM_OPS = [OPERATOR.EQ, OPERATOR.NE, OPERATOR.GT, OPERATOR.LT, OPERATOR.GTE, OPERATOR.LTE, OPERATOR.EXISTS];

/** Ordered, depth-tagged flatten of the field tree (groups + their children). */
function flatten(fields, depth = 0, out = []) {
  (fields || []).forEach((f) => {
    out.push({ field: f, depth });
    if (f.items) flatten(f.items, depth + 1, out);
  });
  return out;
}
function findField(items, id) {
  for (const it of items || []) {
    if (it.linkId === id) return it;
    if (it.items) { const hit = findField(it.items, id); if (hit) return hit; }
  }
  return null;
}
function updateField(items, id, patch) {
  return (items || []).map((it) => {
    if (it.linkId === id) {
      const next = { ...it, ...patch };
      // Drop keys explicitly set to undefined so the schema stays clean.
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete next[k]; });
      return next;
    }
    if (it.items) return { ...it, items: updateField(it.items, id, patch) };
    return it;
  });
}
const isAnswerable = (f) => f.type !== 'display' && f.type !== 'group';
const opsFor = (f) => (f && f.type === 'choice') || (f && f.type === 'boolean') ? CHOICE_OPS
  : (f && (f.type === 'integer' || f.type === 'decimal' || f.type === 'date')) ? NUM_OPS
  : [OPERATOR.EQ, OPERATOR.NE, OPERATOR.EXISTS];

/* ── Custom node ── */
function LogicNode({ data }) {
  const { field, index, hasRules, selected } = data;
  return (
    <div className={`${styles.node} ${selected ? styles.nodeSelected : ''} ${field.type === 'group' ? styles.nodeGroup : ''}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <span className={styles.nodeNum}>{index}</span>
      <Icon name={fieldIcon(field)} size={15} color={selected ? 'var(--primary-300)' : 'var(--neutral-400)'} />
      <span className={styles.nodeText}>{field.text || field.type}{field.required ? <span className={styles.req}>*</span> : null}</span>
      {hasRules && <span className={styles.nodeRule}><Icon name="solar:branching-paths-down-linear" size={13} color="var(--primary-300)" /></span>}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}
function EndingNode({ data }) {
  return (
    <div className={`${styles.node} ${styles.endingNode}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Icon name="solar:flag-2-linear" size={15} color="var(--status-success)" />
      <span className={styles.nodeText}>{data.title || 'Ending'}</span>
    </div>
  );
}
const nodeTypes = { logicNode: LogicNode, endingNode: EndingNode };

/* ── Reusable AND/OR condition list (shared by visibility + jump rules) ── */
function ConditionList({ conditions, behavior, triggers, fields, onConditions, onBehavior }) {
  const setCond = (i, patch) => onConditions(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCond = () => onConditions([...conditions, { question: triggers[0]?.linkId || '', operator: OPERATOR.EQ, answer: '' }]);
  const removeCond = (i) => onConditions(conditions.filter((_, idx) => idx !== i));
  return (
    <>
      {conditions.length > 1 && (
        <div className={styles.behaviorRow}>
          <span className={styles.behaviorLabel}>Match</span>
          <Toggle size="sm" items={[{ key: 'all', label: 'All' }, { key: 'any', label: 'Any' }]} value={behavior} onValueChange={onBehavior} />
          <span className={styles.behaviorLabel}>of these</span>
        </div>
      )}
      <div className={styles.condList}>
        {conditions.map((c, i) => {
          const trig = findField(fields, c.question);
          const ops = opsFor(trig);
          const showValue = c.operator !== OPERATOR.EXISTS;
          const optionVals = trig?.options?.map((o) => ({ value: String(o.value), label: String(o.value) }));
          return (
            <div key={i} className={styles.cond}>
              {i > 0 && <span className={styles.condJoin}>{behavior === 'all' ? 'AND' : 'OR'}</span>}
              <div className={styles.condGrid}>
                <Select value={c.question} onValueChange={(v) => setCond(i, { question: v })} placeholder="Question" options={triggers.map((t) => ({ value: t.linkId, label: t.text || t.linkId }))} />
                <Select value={c.operator} onValueChange={(v) => setCond(i, { operator: v })} options={ops.map((o) => ({ value: o, label: OPERATOR_LABELS[o] || o }))} />
                {showValue && (optionVals?.length ? (
                  <Select value={String(c.answer ?? '')} onValueChange={(v) => setCond(i, { answer: v })} placeholder="Value" options={optionVals} />
                ) : (
                  <Input value={c.answer ?? ''} placeholder="Value" onChange={(e) => setCond(i, { answer: e.target.value })} />
                ))}
              </div>
              <button className={styles.condRemove} onClick={() => removeCond(i)} aria-label="Remove condition">
                <Icon name="solar:trash-bin-minimalistic-linear" size={15} color="var(--neutral-300)" />
              </button>
            </div>
          );
        })}
      </div>
      <Button variant="ghost" size="sm" leadingIcon="solar:add-circle-linear" onClick={addCond}>Add condition</Button>
    </>
  );
}

/* ── Jump-to-ending rules ── */
function JumpEditor({ field, fields, triggers, endings, onApply }) {
  const jumps = field.jump || [];
  const write = (next) => onApply(field.linkId, { jump: next.length ? next : undefined });
  const update = (i, patch) => write(jumps.map((j, idx) => (idx === i ? { ...j, ...patch } : j)));
  const add = () => write([...jumps, { to: endings[0]?.id || 'default', behavior: 'all', conditions: [{ question: triggers[0]?.linkId || '', operator: OPERATOR.EQ, answer: '' }] }]);
  const remove = (i) => write(jumps.filter((_, idx) => idx !== i));
  return (
    <div className={styles.jumpSection}>
      <div className={styles.sectionLabel}>Jump to ending</div>
      {jumps.length === 0 && <p className={styles.editorHint}>End the form early on a specific ending screen when a condition is met.</p>}
      {jumps.map((j, i) => (
        <div key={i} className={styles.jumpCard}>
          <div className={styles.jumpHead}>
            <span className={styles.behaviorLabel}>Jump to</span>
            <Select value={j.to} onValueChange={(v) => update(i, { to: v })} options={endings.map((e) => ({ value: e.id, label: e.title || e.id }))} />
            <button className={styles.condRemove} onClick={() => remove(i)} aria-label="Remove jump"><Icon name="solar:trash-bin-minimalistic-linear" size={15} color="var(--neutral-300)" /></button>
          </div>
          <ConditionList
            conditions={j.conditions || []}
            behavior={j.behavior || 'all'}
            triggers={triggers}
            fields={fields}
            onConditions={(c) => update(i, { conditions: c })}
            onBehavior={(b) => update(i, { behavior: b })}
          />
        </div>
      ))}
      <Button variant="ghost" size="sm" leadingIcon="solar:add-circle-linear" onClick={add}>Add jump rule</Button>
    </div>
  );
}

/* ── Rule editor (right pane) ── */
function RuleEditor({ field, fields, endings, onApply }) {
  const ew = field.enableWhen || [];
  const conditional = ew.length > 0;
  const behavior = field.enableBehavior || 'all';
  const triggers = useMemo(() => {
    const out = [];
    for (const { field: f } of flatten(fields)) {
      if (isAnswerable(f) && f.linkId !== field.linkId) out.push(f);
    }
    return out;
  }, [fields, field.linkId]);

  const apply = (nextEw, nextBehavior = behavior) => onApply(field.linkId, {
    enableWhen: nextEw.length ? nextEw : undefined,
    enableBehavior: nextEw.length > 1 ? nextBehavior : undefined,
  });

  const setConditional = (on) => {
    if (on) apply([{ question: triggers[0]?.linkId || '', operator: OPERATOR.EQ, answer: '' }]);
    else apply([]);
  };

  return (
    <div className={styles.editor}>
      <div className={styles.editorHead}>
        <Icon name={fieldIcon(field)} size={16} color="var(--primary-300)" />
        <span className={styles.editorTitle}>{field.text || field.type}</span>
      </div>

      <div className={styles.sectionLabel}>Visibility</div>
      <div className={styles.visToggle}>
        <Toggle
          size="sm"
          items={[{ key: 'always', label: 'Always show' }, { key: 'cond', label: 'Show when…' }]}
          value={conditional ? 'cond' : 'always'}
          onValueChange={(k) => setConditional(k === 'cond')}
        />
      </div>

      {!conditional ? (
        <p className={styles.editorHint}>This field is always shown. Switch to “Show when…” to branch on an earlier answer.</p>
      ) : (
        <ConditionList
          conditions={ew}
          behavior={behavior}
          triggers={triggers}
          fields={fields}
          onConditions={(c) => apply(c, behavior)}
          onBehavior={(b) => apply(ew, b)}
        />
      )}

      {isAnswerable(field) && endings.length > 0 && (
        <JumpEditor field={field} fields={fields} triggers={triggers} endings={endings} onApply={onApply} />
      )}
    </div>
  );
}

export function LogicPanel({ fields, settings, onChange }) {
  const [selectedId, setSelectedId] = useState(null);
  const entries = useMemo(() => flatten(fields), [fields]);
  const endings = useMemo(() => endingsOf(settings), [settings]);

  const nodes = useMemo(() => {
    const fieldNodes = entries.map((e, i) => ({
      id: e.field.linkId,
      type: 'logicNode',
      draggable: false,
      position: { x: e.depth * 56, y: i * 84 },
      data: { field: e.field, index: i + 1, hasRules: (e.field.enableWhen || []).length > 0 || (e.field.jump || []).length > 0, selected: e.field.linkId === selectedId },
    }));
    // Ending nodes in a column to the right, below the fields.
    const baseY = entries.length * 84 + 40;
    const endingNodes = endings.map((e, i) => ({
      id: `ending:${e.id}`,
      type: 'endingNode',
      draggable: false,
      selectable: false,
      position: { x: 360, y: baseY + i * 72 },
      data: { title: e.title || 'Ending' },
    }));
    return [...fieldNodes, ...endingNodes];
  }, [entries, endings, selectedId]);

  const edges = useMemo(() => {
    const out = [];
    entries.forEach((e) => {
      // Show/hide edges (enableWhen): trigger → this field.
      (e.field.enableWhen || []).forEach((c, ci) => {
        if (!c.question) return;
        out.push({
          id: `vis:${c.question}->${e.field.linkId}:${ci}`,
          source: c.question,
          target: e.field.linkId,
          label: `${OPERATOR_LABELS[c.operator] || c.operator}${c.operator !== OPERATOR.EXISTS && c.answer != null && c.answer !== '' ? ` ${c.answer}` : ''}`,
          animated: true,
          style: { stroke: 'var(--primary-300)', strokeWidth: 1.5 },
          labelStyle: { fontSize: 'var(--font-xs)', fill: 'var(--neutral-400)', fontFamily: 'Inter, sans-serif' },
          labelBgStyle: { fill: 'var(--neutral-0)' },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary-300)' },
        });
      });
      // Jump edges: this field → ending.
      (e.field.jump || []).forEach((j, ji) => {
        if (!j.to) return;
        out.push({
          id: `jump:${e.field.linkId}->${j.to}:${ji}`,
          source: e.field.linkId,
          target: `ending:${j.to}`,
          label: 'jump',
          style: { stroke: 'var(--status-success)', strokeWidth: 1.5, strokeDasharray: '5 4' },
          labelStyle: { fontSize: 'var(--font-xs)', fill: 'var(--status-success)', fontFamily: 'Inter, sans-serif' },
          labelBgStyle: { fill: 'var(--neutral-0)' },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--status-success)' },
        });
      });
    });
    return out;
  }, [entries]);

  const selected = selectedId ? findField(fields, selectedId) : null;
  const applyRule = (linkId, patch) => onChange(updateField(fields, linkId, patch));

  // Drag a handle to wire a rule: field → field adds a show-when condition on
  // the target; field → ending adds a jump rule on the source. Then select the
  // edited node so the author fills in the value.
  const onConnect = (conn) => {
    const { source, target } = conn;
    if (!source || !target || source === target) return;
    if (target.startsWith('ending:')) {
      const to = target.slice('ending:'.length);
      const f = findField(fields, source);
      if (!f || !isAnswerable(f)) return;
      const jump = [...(f.jump || []), { to, behavior: 'all', conditions: [{ question: source, operator: OPERATOR.EQ, answer: '' }] }];
      onChange(updateField(fields, source, { jump }));
      setSelectedId(source);
    } else {
      const f = findField(fields, target);
      if (!f) return;
      const enableWhen = [...(f.enableWhen || []), { question: source, operator: OPERATOR.EQ, answer: '' }];
      onChange(updateField(fields, target, { enableWhen }));
      setSelectedId(target);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.canvas}>
        {entries.length === 0 ? (
          <div className={styles.empty}>
            <Icon name="solar:branching-paths-down-linear" size={32} color="var(--neutral-150)" />
            <span className={styles.emptyTitle}>No questions yet</span>
            <span className={styles.emptyDesc}>Add fields in the Edit tab, then wire up conditional logic here.</span>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_e, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            onConnect={onConnect}
            nodesDraggable={false}
            nodesConnectable
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.25 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--neutral-100)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>

      <div className={styles.side}>
        {!selected ? (
          <div className={styles.sideEmpty}>
            <Icon name="solar:cursor-linear" size={26} color="var(--neutral-150)" />
            <span className={styles.emptyTitle}>Select a question</span>
            <span className={styles.emptyDesc}>Click a node to control when it appears, based on earlier answers.</span>
          </div>
        ) : (
          <RuleEditor field={selected} fields={fields} endings={endings} onApply={applyRule} />
        )}
      </div>
    </div>
  );
}

export default LogicPanel;
