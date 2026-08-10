import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { useAppStore } from '../../store/useAppStore';
import { getNodeConfig } from './nodes/nodeConfig';
import styles from './NodeSettings.module.css';

/* ── Custom select dropdown ── */
function CustomSelect({ value, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div className={styles.customSelect} ref={ref}>
      <button className={`${styles.customSelectTrigger} ${open ? styles.customSelectTriggerOpen : ''}`} onClick={() => setOpen(!open)}>
        <span className={value ? styles.customSelectValue : styles.customSelectPlaceholder}>
          {selected?.label || placeholder || 'Select...'}
        </span>
        <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" />
      </button>
      {open && (
        <div className={styles.customSelectDropdown}>
          {options.map(o => (
            <div
              key={o.value}
              className={`${styles.customSelectItem} ${o.value === value ? styles.customSelectItemActive : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
          {options.length === 0 && (
            <div className={styles.customSelectEmpty}>No options</div>
          )}
        </div>
      )}
    </div>
  );
}

export function NodeSettings({ node, allNodes, onSave, onClose, onDelete }) {
  const updateNodeData = useAppStore(s => s.updateNodeData);
  const activeTransition = useAppStore(s => s.builderActiveTransition);
  const setActiveTransition = useAppStore(s => s.setBuilderActiveTransition);
  const [label, setLabel] = useState(node.data.label || '');
  const [prompt, setPrompt] = useState(node.data.prompt || '');
  const [guardrails, setGuardrails] = useState(node.data.guardrails || '');
  const [transitions, setTransitions] = useState(node.data.transitions || []);
  const [isEditing, setIsEditing] = useState(false);
  const nameInputRef = useRef(null);
  const lastSyncedJson = useRef(null);
  if (lastSyncedJson.current === null) {
    lastSyncedJson.current = JSON.stringify(node.data.transitions || []);
  }

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

  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef(null);

  useEffect(() => {
    if (!showAddMenu) return;
    const close = (e) => { if (addMenuRef.current && !addMenuRef.current.contains(e.target)) setShowAddMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showAddMenu]);

  const addTransition = (type) => {
    const newIdx = transitions.length;
    if (type === 'equation') {
      setTransitions(t => [...t, { type: 'equation', matchMode: 'all', rules: [{ variable: '', operator: '>', value: '' }], target: '' }]);
    } else {
      setTransitions(t => [...t, { type: 'prompt', condition: '', target: '' }]);
    }
    setActiveTransition(newIdx);
    setShowAddMenu(false);
  };
  const updateTransition = (i, field, val) => setTransitions(t => t.map((tr, idx) => idx === i ? { ...tr, [field]: val } : tr));
  const removeTransition = (i) => setTransitions(t => t.filter((_, idx) => idx !== i));

  const [shakeIdx, setShakeIdx] = useState(null);
  const handleTransitionClick = (e, i) => {
    // Don't shake when clicking form controls inside the block
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'LABEL' || e.target.closest('button') || e.target.closest('select')) {
      if (activeTransition !== i) setActiveTransition(i);
      return;
    }
    if (activeTransition === i) {
      setShakeIdx(null);
      requestAnimationFrame(() => setShakeIdx(i));
      setTimeout(() => setShakeIdx(null), 500);
    } else {
      setActiveTransition(i);
    }
  };

  const addRule = (tIdx) => setTransitions(t => t.map((tr, idx) => idx === tIdx ? { ...tr, rules: [...(tr.rules || []), { variable: '', operator: '>', value: '' }] } : tr));
  const updateRule = (tIdx, rIdx, field, val) => setTransitions(t => t.map((tr, idx) => idx === tIdx ? { ...tr, rules: tr.rules.map((r, ri) => ri === rIdx ? { ...r, [field]: val } : r) } : tr));
  const removeRule = (tIdx, rIdx) => setTransitions(t => t.map((tr, idx) => idx === tIdx ? { ...tr, rules: tr.rules.filter((_, ri) => ri !== rIdx) } : tr));

  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleDragStart = (idx) => { dragItem.current = idx; };
  const handleDragEnter = (idx) => { dragOverItem.current = idx; };
  const handleDragEnd = () => {
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === null || to === null || from === to) { dragItem.current = null; dragOverItem.current = null; return; }
    setTransitions(t => {
      const arr = [...t];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    if (activeTransition === from) setActiveTransition(to);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // promptExpanded removed — textarea now auto-resizes

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Node Settings</span>
        <div className={styles.headerActions}>
          <button className={styles.saveTextBtn} onClick={handleSave}>Save</button>
        </div>
      </div>

      <div className={styles.nodeIdentity}>
        <div className={styles.nodeIcon} style={{ background: config.color }}>
          {config.CustomIcon ? <config.CustomIcon size={16} color="#fff" /> : <Icon name={config.icon} size={16} color="#fff" />}
        </div>
        {isEditing ? (
          <input
            ref={nameInputRef}
            className={styles.nodeNameInputEditing}
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={() => { setIsEditing(false); updateNodeData(node.id, { label }); }}
            placeholder="Node name"
          />
        ) : (
          <span className={styles.nodeNameDisplay}>{label}</span>
        )}
        <button className={styles.editBtn} onClick={() => setIsEditing(!isEditing)} title={isEditing ? 'Done editing' : 'Rename node'}>
          <Icon name={isEditing ? 'solar:check-read-linear' : 'solar:pen-new-square-linear'} size={14} color="var(--primary-300)" />
        </button>
      </div>

      <div className={styles.divider} />

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
            <label className={styles.sectionLabel}>Conversation</label>
            <textarea
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

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Transition</span>
              <div className={styles.addBtnWrap} ref={addMenuRef}>
                <Button variant="secondary" size="S" className={styles.addBtn} onClick={() => setShowAddMenu(v => !v)}>+ Add New</Button>
                {showAddMenu && (
                  <div className={styles.addDropdown}>
                    <button className={styles.addDropdownItem} onClick={() => addTransition('prompt')}>
                      <Icon name="solar:notes-minimalistic-linear" size={16} color="var(--neutral-300)" />
                      <span>Prompt</span>
                    </button>
                    <button className={styles.addDropdownItem} onClick={() => addTransition('equation')}>
                      <Icon name="solar:calculator-minimalistic-linear" size={16} color="var(--neutral-300)" />
                      <span>Equation</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {transitions.map((t, i) => {
              const tType = t.type || 'prompt';
              const isEquation = tType === 'equation';
              const isActive = activeTransition === i;
              return (
                <div
                  key={i}
                  className={`${styles.transitionBlock} ${isActive ? styles.transitionBlockActive : ''} ${shakeIdx === i ? styles.transitionBlockShake : ''}`}
                  onClick={(e) => handleTransitionClick(e, i)}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragEnter={() => handleDragEnter(i)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className={styles.transitionIconCol}>
                    <span title={isEquation ? 'Equation condition' : 'Prompt condition'} className={styles.typeIconWrap}>
                      <Icon
                        name={isEquation ? 'solar:calculator-minimalistic-linear' : 'solar:notes-minimalistic-linear'}
                        size={16}
                        color={isActive ? 'var(--primary-300)' : 'var(--neutral-300)'}
                      />
                    </span>
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className={styles.dragHandle} title="Drag to reorder">
                      <circle cx="2" cy="2" r="1" fill="#8A94A8" /><circle cx="6" cy="2" r="1" fill="#8A94A8" />
                      <circle cx="2" cy="6" r="1" fill="#8A94A8" /><circle cx="6" cy="6" r="1" fill="#8A94A8" />
                      <circle cx="2" cy="10" r="1" fill="#8A94A8" /><circle cx="6" cy="10" r="1" fill="#8A94A8" />
                    </svg>
                  </div>
                  <div className={styles.transitionContentCol}>
                    {/* Condition header + delete */}
                    <div className={styles.conditionHeader}>
                      <label className={styles.fieldLabel}>Condition</label>
                      <button className={styles.removeTransitionBtn} onClick={() => removeTransition(i)} title="Remove transition">
                        <Icon name="solar:trash-bin-minimalistic-linear" size={13} color="var(--status-error)" />
                      </button>
                    </div>

                    {isEquation ? (
                      /* ── Equation rule builder ── */
                      <div className={styles.equationBox}>
                        <div className={styles.equationHeader}>
                          <div className={styles.toggleWrap}>
                            <button
                              className={`${styles.toggleBtn} ${(t.matchMode || 'all') === 'all' ? styles.toggleBtnActive : ''}`}
                              onClick={() => updateTransition(i, 'matchMode', 'all')}
                            >All</button>
                            <button
                              className={`${styles.toggleBtn} ${(t.matchMode || 'all') === 'any' ? styles.toggleBtnActive : ''}`}
                              onClick={() => updateTransition(i, 'matchMode', 'any')}
                            >Any</button>
                          </div>
                          <button className={styles.addRuleBtn} onClick={() => addRule(i)}>Add Rule</button>
                        </div>
                        <div className={styles.ruleRows}>
                          {(t.rules || []).map((r, ri) => (
                            <div key={ri} className={styles.ruleRow}>
                              <input
                                className={styles.ruleVarInput}
                                value={r.variable}
                                onChange={e => updateRule(i, ri, 'variable', e.target.value)}
                                placeholder="{Variable}"
                              />
                              <select
                                className={styles.ruleOpSelect}
                                value={r.operator}
                                onChange={e => updateRule(i, ri, 'operator', e.target.value)}
                              >
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value="=">=</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                                <option value="!=">!=</option>
                              </select>
                              <input
                                className={styles.ruleValInput}
                                value={r.value}
                                onChange={e => updateRule(i, ri, 'value', e.target.value)}
                                placeholder="Value"
                              />
                              <button className={styles.ruleDeleteBtn} onClick={() => removeRule(i, ri)} title="Remove rule">
                                <Icon name="solar:trash-bin-minimalistic-linear" size={13} color="var(--status-error)" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* ── Prompt condition input ── */
                      <input
                        className={styles.fieldInput}
                        value={t.condition || ''}
                        onChange={e => updateTransition(i, 'condition', e.target.value)}
                        placeholder="e.g. If Yes"
                      />
                    )}

                    {/* Jump to Node */}
                    <div className={styles.transitionField}>
                      <label className={styles.fieldLabel}>Jump to Node</label>
                      <CustomSelect
                        value={t.target || ''}
                        options={nodeOptions}
                        placeholder="Select Transfer Node"
                        onChange={val => updateTransition(i, 'target', val)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {transitions.length === 0 && (
              <div className={styles.emptyTransitions}>
                <Icon name="solar:transfer-horizontal-linear" size={20} color="var(--neutral-150)" />
                <span>No transitions configured</span>
              </div>
            )}
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <label className={styles.sectionLabel}>Guardrails</label>
            <textarea className={styles.textarea} value={guardrails} onChange={e => setGuardrails(e.target.value)} placeholder="Add guardrails for this node..." rows={3} />
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
