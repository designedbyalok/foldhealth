import { useState, useEffect, useRef, useId } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { getNodeConfig } from './nodes/nodeConfig';
import { NodeSettingsHeader } from './NodeSettingsHeader';
import { NodeSettingsTransitions } from './NodeSettingsTransitions';
import styles from './NodeSettings.module.css';

export function NodeSettings({ node, allNodes, onSave, onClose, onDelete }) {
  const uid = useId();
  const updateNodeData = useAppStore(s => s.updateNodeData);
  const activeTransition = useAppStore(s => s.builderActiveTransition);
  const setActiveTransition = useAppStore(s => s.setBuilderActiveTransition);
  const [label, setLabel] = useState(node.data.label || '');
  const [prompt, setPrompt] = useState(node.data.prompt || '');
  const [guardrails, setGuardrails] = useState(node.data.guardrails || '');
  const [transitions, setTransitions] = useState(node.data.transitions || []);
  const [isEditing, setIsEditing] = useState(false);
  const nameInputRef = useRef(null);
  // Seed via a useState initializer rather than mutating the ref during
  // render: the lazy-init guard avoided recomputing on every render but wrote
  // to a ref mid-render, which React may replay or discard.
  const [initialSyncedJson] = useState(() => JSON.stringify(node.data.transitions || []));
  const lastSyncedJson = useRef(initialSyncedJson);

  useEffect(() => {
    setLabel(node.data.label || '');
    setPrompt(node.data.prompt || '');
    setGuardrails(node.data.guardrails || '');
    const t = node.data.transitions || [];
    setTransitions(t);
    lastSyncedJson.current = JSON.stringify(t);
    setIsEditing(false);
  }, [node.id]);

  // Auto-sync transitions to store so ConversationNode updates in real-time
  useEffect(() => {
    const json = JSON.stringify(transitions);
    if (json !== lastSyncedJson.current) {
      lastSyncedJson.current = json;
      updateNodeData(node.id, { transitions });
    }
  }, [transitions, node.id]);

  // Sync transitions from store when changed externally (e.g. + button on node card)
  useEffect(() => {
    const storeTransitions = node.data.transitions || [];
    const storeJson = JSON.stringify(storeTransitions);
    if (storeJson !== lastSyncedJson.current) {
      lastSyncedJson.current = storeJson;
      setTransitions(storeTransitions);
    }
  }, [node.data.transitions]);

  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditing]);

  const isEndNode = node.data.nodeType === 'end' || node.type === 'endNode';
  const config = getNodeConfig(isEndNode ? 'end' : node.data.nodeType);
  const otherNodes = allNodes.filter(n => n.id !== node.id && n.type !== 'startNode');
  const nodeOptions = otherNodes.map(n => ({ value: n.data.label || n.id, label: n.data.label || n.id }));

  const handleSave = () => {
    updateNodeData(node.id, { label, prompt, guardrails, transitions });
    if (onSave) onSave();
    setIsEditing(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') { setIsEditing(false); updateNodeData(node.id, { label }); }
    else if (e.key === 'Escape') { setLabel(node.data.label || ''); setIsEditing(false); }
  };

  const addTransition = (type) => {
    const newIdx = transitions.length;
    if (type === 'equation') {
      setTransitions(t => [...t, { type: 'equation', matchMode: 'all', rules: [{ variable: '', operator: '>', value: '' }], target: '' }]);
    } else {
      setTransitions(t => [...t, { type: 'prompt', condition: '', target: '' }]);
    }
    setActiveTransition(newIdx);
  };
  const updateTransition = (i, field, val) => setTransitions(t => t.map((tr, idx) => idx === i ? { ...tr, [field]: val } : tr));
  const removeTransition = (i) => setTransitions(t => t.filter((_, idx) => idx !== i));

  const addRule = (tIdx) => setTransitions(t => t.map((tr, idx) => idx === tIdx ? { ...tr, rules: [...(tr.rules || []), { variable: '', operator: '>', value: '' }] } : tr));
  const updateRule = (tIdx, rIdx, field, val) => setTransitions(t => t.map((tr, idx) => idx === tIdx ? { ...tr, rules: tr.rules.map((r, ri) => ri === rIdx ? { ...r, [field]: val } : r) } : tr));
  const removeRule = (tIdx, rIdx) => setTransitions(t => t.map((tr, idx) => idx === tIdx ? { ...tr, rules: tr.rules.filter((_, ri) => ri !== rIdx) } : tr));

  const handleReorderTransitions = (from, to) => {
    setTransitions(t => {
      const arr = [...t];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    if (activeTransition === from) setActiveTransition(to);
  };

  // promptExpanded removed — textarea now auto-resizes

  return (
    <div className={styles.panel}>
      <NodeSettingsHeader
        onSave={handleSave}
        config={config}
        isEditing={isEditing}
        label={label}
        onLabelChange={e => setLabel(e.target.value)}
        onNameKeyDown={handleNameKeyDown}
        onEditBlur={() => { setIsEditing(false); updateNodeData(node.id, { label }); }}
        onToggleEditing={() => setIsEditing(!isEditing)}
        nameInputRef={nameInputRef}
      />

      {isEndNode ? (
        /* End node: simplified view — no transitions, just a description */
        <div className={styles.section}>
          <div className={styles.endNodeInfo}>
            <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
            <span>This is the terminal node of the conversation flow. All paths should eventually lead here.</span>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.section}>
            <label className={styles.sectionLabel} htmlFor={`${uid}-conversation`}>Conversation</label>
            <textarea
              id={`${uid}-conversation`}
              className={styles.textarea}
              value={prompt}
              onChange={e => {
                setPrompt(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 400) + 'px';
              }}
              ref={el => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 400) + 'px';
                }
              }}
              placeholder="Enter the conversation prompt for this node..."
            />
          </div>

          <div className={styles.divider} />

          <NodeSettingsTransitions
            transitions={transitions}
            activeTransition={activeTransition}
            setActiveTransition={setActiveTransition}
            nodeOptions={nodeOptions}
            onAddTransition={addTransition}
            onUpdateTransition={updateTransition}
            onRemoveTransition={removeTransition}
            onAddRule={addRule}
            onUpdateRule={updateRule}
            onRemoveRule={removeRule}
            onReorderTransitions={handleReorderTransitions}
          />

          <div className={styles.divider} />

          <div className={styles.section}>
            <label className={styles.sectionLabel} htmlFor={`${uid}-guardrails`}>Guardrails</label>
            <textarea id={`${uid}-guardrails`} className={styles.textarea} value={guardrails} onChange={e => setGuardrails(e.target.value)} placeholder="Add guardrails for this node..." rows={3} />
          </div>
        </>
      )}

      <div className={styles.deleteSection}>
        <button className={styles.deleteBtn} onClick={onDelete}>
          <Icon name="solar:trash-bin-minimalistic-linear" size={14} />
          Delete Node
        </button>
      </div>
    </div>
  );
}
