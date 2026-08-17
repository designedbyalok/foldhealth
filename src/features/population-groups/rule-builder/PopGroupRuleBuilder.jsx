import { useState } from 'react';
import { add, remove, update } from 'react-querybuilder';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { AddConditionPopover } from './AddConditionPopover';
import { ConditionEditorPanel } from './ConditionEditorPanel';
import { FIELD_BY_KEY, groupAccent, ruleSummary } from './fieldCatalog';
import styles from './ruleBuilder.module.css';

let ruleSeq = 0;
const nextRuleId = () => `rb-${Date.now()}-${ruleSeq++}`;

/* Six-dot grip — Solar has no drag-handle glyph, so this is the one custom
   SVG in the builder (dots, so fill rather than stroke). */
function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {[4.5, 8, 11.5].flatMap(y => [5.5, 10.5].map(x => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />
      )))}
    </svg>
  );
}

/**
 * PopGroupRuleBuilder — full-page takeover for defining a Dynamic population
 * group as a rule tree (Figma 1:3915 / 9:44005). The query state is a
 * react-querybuilder RuleGroupType ({ combinator, rules }); add/remove/update
 * go through the library's immutability helpers so the stored shape stays
 * portable to formatQuery when rule evaluation lands.
 */
export function PopGroupRuleBuilder() {
  const session = useAppStore(s => s.pgRuleBuilder);
  const closePgRuleBuilder = useAppStore(s => s.closePgRuleBuilder);
  const createPopGroup = useAppStore(s => s.createPopGroup);
  const updatePopGroup = useAppStore(s => s.updatePopGroup);
  const showToast = useAppStore(s => s.showToast);

  const [query, setQuery] = useState(() => session?.rule || { combinator: 'and', rules: [] });
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [pickerRect, setPickerRect] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!session) return null;

  const rules = query.rules;
  const editingIndex = rules.findIndex(r => r.id === editingRuleId);
  const editingRule = editingIndex >= 0 ? rules[editingIndex] : null;

  const addCondition = (field) => {
    const rule = { id: nextRuleId(), field: field.key, operator: field.operators[0].name, value: {} };
    setQuery(q => add(q, rule, []));
    setPickerRect(null);
    setEditingRuleId(rule.id);
  };

  const removeRule = (index) => {
    const removed = rules[index];
    setQuery(q => remove(q, [index]));
    if (removed?.id === editingRuleId) setEditingRuleId(null);
  };

  const commitRule = (index, patch) => {
    setQuery(q => {
      let next = update(q, 'operator', patch.operator, [index]);
      next = update(next, 'value', patch.value, [index]);
      return next;
    });
  };

  const setCombinator = (value) => setQuery(q => update(q, 'combinator', value, []));

  /* A rule is complete once its editor has committed a value. */
  const isComplete = (r) => {
    const v = r.value || {};
    return (v.amount ?? v.text ?? '') !== '';
  };
  const canSaveGroup = rules.length > 0 && rules.every(isComplete);

  const handleNext = async () => {
    if (!canSaveGroup || saving) return;
    setSaving(true);
    const payload = {
      name: session.name,
      description: session.description || '',
      type: 'Dynamic',
      filterType: 'dynamic',
      memberStatus: session.memberStatus || 'All Status',
      memberIds: [],
      count: session.count ?? 0,
      inactive: session.inactive ?? 0,
      rule: query,
    };
    const saved = session.groupId
      ? await updatePopGroup(session.groupId, payload)
      : await createPopGroup(payload);
    setSaving(false);
    if (!saved) return; // store already toasted the failure
    showToast(session.groupId ? 'Population Group Updated Successfully' : 'Population Group Added Successfully');
    closePgRuleBuilder();
  };

  return (
    <div className={styles.view}>
      {/* Sub-bar: group identity + Cancel / Next */}
      <div className={styles.subBar}>
        <div className={styles.subBarName}>
          <Avatar type="icon" variant="patient" iconName="solar:users-group-rounded-linear" size="XS" />
          <span className={styles.groupName}>{session.name}</span>
          <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit" onClick={() => showToast('Rename — coming soon')} />
        </div>
        <div className={styles.subBarActions}>
          <Button variant="secondary" size="L" onClick={closePgRuleBuilder}>Cancel</Button>
          <Button variant="primary" size="L" disabled={!canSaveGroup || saving} onClick={handleNext}>
            {saving ? 'Saving…' : 'Next'}
          </Button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.canvas}>
          {/* IF chip with its tail */}
          <div className={styles.ifChip}>
            <Button variant="secondary" size="S">IF</Button>
            <span className={styles.ifTail} />
          </div>

          {rules.map((rule, index) => {
            const field = FIELD_BY_KEY[rule.field];
            if (!field) return null;
            const summary = ruleSummary(rule);
            return (
              <div key={rule.id} className={styles.node}>
                <span className={styles.dragHandle}><GripIcon /></span>
                <button
                  type="button"
                  className={styles.fieldChip}
                  style={{ background: groupAccent(field.group) }}
                  onClick={() => setEditingRuleId(rule.id)}
                >
                  <span className={styles.fieldChipIcon} style={{ background: groupAccent(field.group) }}>
                    <Icon name={field.icon} size={16} color="var(--neutral-400)" />
                  </span>
                  {field.label}
                </button>
                <span className={styles.nodeBadges}>
                  {summary.map(text => <Badge key={text} tone="grey" size="S" label={text} />)}
                </span>
                <span className={styles.nodeRight}>
                  <span className={styles.combo}>
                    <button
                      type="button"
                      className={`${styles.comboBtn} ${query.combinator === 'and' ? styles.comboBtnActive : ''}`}
                      onClick={() => setCombinator('and')}
                    >AND</button>
                    <span className={styles.comboDivider} />
                    <button
                      type="button"
                      className={`${styles.comboBtn} ${query.combinator === 'or' ? styles.comboBtnActive : ''}`}
                      onClick={() => setCombinator('or')}
                    >OR</button>
                    <span className={styles.comboDivider} />
                    <button
                      type="button"
                      className={styles.comboBtn}
                      aria-label="Add condition"
                      onClick={(e) => setPickerRect(e.currentTarget.getBoundingClientRect())}
                    ><Icon name="solar:add-circle-linear" size={14} color="currentColor" /></button>
                  </span>
                  <ActionButton
                    icon="solar:trash-bin-minimalistic-linear"
                    size="S"
                    tooltip="Remove condition"
                    onClick={() => removeRule(index)}
                  />
                </span>
              </div>
            );
          })}

          {rules.length === 0 && (
            <Button
              variant="tertiary"
              size="S"
              leadingIcon="solar:add-circle-linear"
              className={styles.addConditionBtn}
              onClick={(e) => setPickerRect(e.currentTarget.getBoundingClientRect())}
            >
              Add Condition
            </Button>
          )}
        </div>

        {editingRule && (
          <ConditionEditorPanel
            key={editingRule.id}
            rule={editingRule}
            onSave={(patch) => commitRule(editingIndex, patch)}
            onClose={() => setEditingRuleId(null)}
          />
        )}
      </div>

      {pickerRect && (
        <AddConditionPopover
          anchorRect={pickerRect}
          onSelect={addCondition}
          onClose={() => setPickerRect(null)}
        />
      )}
    </div>
  );
}
