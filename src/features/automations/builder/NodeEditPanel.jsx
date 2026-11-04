import { useMemo, useState } from 'react';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { DELAY_UNITS, FAMILY, nodeDef } from '../lib/catalog';
import { nodeProblems, nodeSummary } from '../lib/graph';
import { ConditionEditor } from './ConditionEditor';
import { ActionEditor } from './ActionEditor';
import { EditPanel, PanelRow, PanelSection } from './EditPanel';
import styles from './AutomationBuilder.module.css';

const EMPTY = 'This field can’t be empty';

/**
 * Edit one step. Works on a draft of the step's config; Save writes it to the
 * graph, close discards it. Save with a required field empty marks the field
 * instead of closing (the same check a test run makes).
 */
export function NodeEditPanel({ node, onSave, onClose, onEditTemplate, initialErrors = null }) {
  const def = nodeDef(node.type);
  const [draft, setDraft] = useState(() => structuredClone(node.config || {}));
  const [showErrors, setShowErrors] = useState(!!initialErrors);
  const patch = (p) => setDraft(d => ({ ...d, ...p }));

  const candidate = useMemo(() => ({ ...node, config: draft }), [node, draft]);
  const problems = nodeProblems(candidate);
  const errors = showErrors ? Object.fromEntries(problems.map(p => [p.field, EMPTY])) : {};
  const summary = nodeSummary(candidate);

  const family = FAMILY[def?.family] || FAMILY.add;
  const kind = def?.kind;
  const title = kind === 'condition' ? 'Edit Condition' : kind === 'logic' ? `Edit ${def.label}` : 'Edit Action';

  const save = () => {
    // Conditions may be saved half-done (an empty one matches everyone);
    // actions, delays and repeats are checked so a run never reaches an empty step.
    if (kind !== 'condition' && problems.length) { setShowErrors(true); return; }
    onSave(draft);
  };

  let body;
  if (kind === 'condition') body = <ConditionEditor def={def} config={draft} onChange={patch} />;
  else if (kind === 'action') body = <ActionEditor type={node.type} config={draft} onChange={patch} errors={errors} onEditTemplate={onEditTemplate} />;
  else body = <LogicEditor type={node.type} config={draft} onChange={patch} errors={errors} />;

  return (
    <EditPanel
      title={title}
      icon={def?.icon}
      iconColor={family.color}
      iconBg={family.bg}
      heading={def?.nodeLabel || def?.label}
      onSave={save}
      onClose={onClose}
      summary={summary}
    >
      {def?.helper && <p className={styles.panelHint}>{def.helper}</p>}
      {body}
    </EditPanel>
  );
}

function LogicEditor({ type, config, onChange, errors }) {
  if (type === 'delay') {
    return (
      <PanelSection title="Wait">
        <PanelRow label="Wait for" required error={errors.amount}>
          <div className={styles.ruleControls}>
            <Input type="number" min={1} value={config.amount ?? ''} onChange={e => onChange({ amount: e.target.value === '' ? '' : Number(e.target.value) })} wrapperClassName={styles.numberInput} aria-label="Wait for" />
            <Select options={DELAY_UNITS} value={config.unit || 'days'} onValueChange={v => onChange({ unit: v })} className={styles.unitSelect} />
          </div>
        </PanelRow>
        <p className={styles.panelHint}>Members wait here before the next step. A test run skips the wait.</p>
      </PanelSection>
    );
  }
  if (type === 'repeat') {
    return (
      <PanelSection title="Repeat">
        <PanelRow label="Every" required error={errors.every}>
          <div className={styles.ruleControls}>
            <Input type="number" min={1} value={config.every ?? ''} onChange={e => onChange({ every: e.target.value === '' ? '' : Number(e.target.value) })} wrapperClassName={styles.numberInput} aria-label="Repeat every" />
            <Select options={DELAY_UNITS.filter(u => u.value !== 'minutes')} value={config.unit || 'days'} onValueChange={v => onChange({ unit: v })} className={styles.unitSelect} />
          </div>
        </PanelRow>
        <PanelRow label="Up to" required error={errors.times}>
          <Input type="number" min={1} max={30} value={config.times ?? ''} onChange={e => onChange({ times: e.target.value === '' ? '' : Number(e.target.value) })} trailingText="times" wrapperClassName={styles.numberInput} aria-label="Repeat up to" />
        </PanelRow>
        <p className={styles.panelHint}>Repeats the message step above until the member moves to another branch or the limit is reached.</p>
      </PanelSection>
    );
  }
  return (
    <p className={styles.panelHint}>
      {type === 'and'
        ? 'Add the conditions a member must also match below this connector.'
        : 'Add alternative conditions below this connector. A member continues down every branch they match.'}
    </p>
  );
}
