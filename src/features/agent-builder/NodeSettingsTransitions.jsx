import { useState, useEffect, useRef, useId } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { CustomSelect } from './CustomSelect';
import styles from './NodeSettings.module.css';

export function NodeSettingsTransitions({
  transitions,
  activeTransition,
  setActiveTransition,
  nodeOptions,
  onAddTransition,
  onUpdateTransition,
  onRemoveTransition,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onReorderTransitions,
}) {
  const uid = useId();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef(null);
  const [shakeIdx, setShakeIdx] = useState(null);

  useEffect(() => {
    if (!showAddMenu) return;
    const close = (e) => { if (addMenuRef.current && !addMenuRef.current.contains(e.target)) setShowAddMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showAddMenu]);

  const addTransition = (type) => {
    onAddTransition(type);
    setShowAddMenu(false);
  };

  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleDragStart = (idx) => { dragItem.current = idx; };
  const handleDragEnter = (idx) => { dragOverItem.current = idx; };
  const handleDragEnd = () => {
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === null || to === null || from === to) { dragItem.current = null; dragOverItem.current = null; return; }
    onReorderTransitions(from, to);
    dragItem.current = null;
    dragOverItem.current = null;
  };

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

  return (
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
                <span className={styles.fieldLabel}>Condition</span>
                <button className={styles.removeTransitionBtn} onClick={() => onRemoveTransition(i)} title="Remove transition">
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
                        onClick={() => onUpdateTransition(i, 'matchMode', 'all')}
                      >All</button>
                      <button
                        className={`${styles.toggleBtn} ${(t.matchMode || 'all') === 'any' ? styles.toggleBtnActive : ''}`}
                        onClick={() => onUpdateTransition(i, 'matchMode', 'any')}
                      >Any</button>
                    </div>
                    <button className={styles.addRuleBtn} onClick={() => onAddRule(i)}>Add Rule</button>
                  </div>
                  <div className={styles.ruleRows}>
                    {(t.rules || []).map((r, ri) => (
                      <div key={ri} className={styles.ruleRow}>
                        <input
                          className={styles.ruleVarInput}
                          value={r.variable}
                          onChange={e => onUpdateRule(i, ri, 'variable', e.target.value)}
                          placeholder="{Variable}"
                        />
                        <select
                          className={styles.ruleOpSelect}
                          aria-label="Comparison operator"
                          value={r.operator}
                          onChange={e => onUpdateRule(i, ri, 'operator', e.target.value)}
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
                          onChange={e => onUpdateRule(i, ri, 'value', e.target.value)}
                          placeholder="Value"
                        />
                        <button className={styles.ruleDeleteBtn} onClick={() => onRemoveRule(i, ri)} title="Remove rule">
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
                  onChange={e => onUpdateTransition(i, 'condition', e.target.value)}
                  placeholder="e.g. If Yes"
                />
              )}

              {/* Jump to Node */}
              <div className={styles.transitionField}>
                <label className={styles.fieldLabel} htmlFor={`${uid}-transition-${i}-target`}>Jump to Node</label>
                <CustomSelect
                  id={`${uid}-transition-${i}-target`}
                  value={t.target || ''}
                  options={nodeOptions}
                  placeholder="Select Transfer Node"
                  onChange={val => onUpdateTransition(i, 'target', val)}
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
  );
}
