import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { AddIconMinimalist } from '../../../components/Icon/AddIconMinimalist';
import { useAppStore } from '../../../store/useAppStore';
import { CARE_PROGRAM_CATALOG } from '../../patient/data/careProgramCatalog';
import { CHANNELS } from '../lib/catalog';
import { dynamicOptions, fieldsFor } from '../lib/conditionFields';
import { ANSWER_OPS, CONDITION_TYPES, EVENT_CATALOG, LAB_CATALOG, NUMERIC_OPS, SCORE_CATALOG } from '../lib/clinicalCriteria';
import { PanelRow, PanelSection } from './EditPanel';
import styles from './AutomationBuilder.module.css';

const toOpts = (list) => list.map(o => (typeof o === 'string' ? { value: o, label: o } : o));

/** The rows of one condition: field · operator · value, grouped as in the Figma. */
export function ConditionEditor({ def, config, onChange }) {
  if (def.type === 'clinicalCriteria') return <ClinicalCriteriaEditor config={config} onChange={onChange} />;
  if (def.type === 'preferredChannel') {
    return (
      <PanelSection title="Communication">
        <PanelRow label="Preferred mode is any of" required>
          <Select
            options={CHANNELS.map(c => ({ value: c.key, label: c.label }))}
            value={config.channels || []}
            onValueChange={v => onChange({ channels: v || [] })}
            multiple
            checkboxes
            badges
            placeholder="Select channels"
          />
        </PanelRow>
        <p className={styles.panelHint}>Each channel you pick becomes its own branch on the canvas.</p>
      </PanelSection>
    );
  }
  if (def.type === 'deactivated') {
    return <p className={styles.panelHint}>The automation continues for members whose account is deactivated. Nothing to set up.</p>;
  }
  return <RuleRows def={def} rules={config.rules || {}} onChange={rules => onChange({ rules })} />;
}

function RuleRows({ def, rules, onChange }) {
  const members = useAppStore(s => s.automationMembers);
  const fetchAutomationMembers = useAppStore(s => s.fetchAutomationMembers);
  useEffect(() => { fetchAutomationMembers(); }, [fetchAutomationMembers]);
  const dyn = useMemo(() => dynamicOptions(members, CARE_PROGRAM_CATALOG.map(p => p.code)), [members]);
  const groups = fieldsFor(def);

  const set = (key, patch) => {
    const cur = rules[key] || {};
    onChange({ ...rules, [key]: { ...cur, ...patch } });
  };

  return groups.map(g => (
    <PanelSection key={g.group} title={g.group}>
      {g.fields.map(f => {
        const r = rules[f.key] || {};
        const options = f.options || dyn[f.optionsFrom] || [];
        return (
          <PanelRow key={f.key} label={f.label}>
            <div className={styles.ruleControls}>
              {f.ops.length > 1 ? (
                <Select options={toOpts(f.ops)} value={r.op || f.ops[0]} onValueChange={v => set(f.key, { op: v })} className={styles.opSelect} />
              ) : (
                <span className={styles.opText}>{f.ops[0]}</span>
              )}
              {f.input === 'number' ? (
                <>
                  <Input
                    type="number"
                    value={r.value ?? ''}
                    min={0}
                    onChange={e => set(f.key, { value: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="0"
                    wrapperClassName={styles.numberInput}
                    aria-label={`${f.label} value`}
                  />
                  <Select options={f.units} value={r.unit || f.units[0].value} onValueChange={v => set(f.key, { unit: v })} className={styles.unitSelect} />
                  {f.suffix && <span className={styles.opText}>{f.suffix}</span>}
                </>
              ) : (
                <Select
                  options={options}
                  value={f.input === 'multi' || f.input === 'channels' ? (r.value || []) : (r.value ?? '')}
                  onValueChange={v => set(f.key, { value: v })}
                  multiple={f.input === 'multi' || f.input === 'channels'}
                  checkboxes={f.input === 'multi'}
                  badges={f.input === 'multi'}
                  searchable={options.length > 8}
                  placeholder="Select"
                  emptyText="No values on file"
                  className={styles.valueSelect}
                />
              )}
              {(r.value != null && r.value !== '' && !(Array.isArray(r.value) && !r.value.length)) && (
                <ActionButton size="sm" icon="solar:close-circle-linear" tooltip="Clear" onClick={() => set(f.key, { value: f.input === 'multi' ? [] : '' })} />
              )}
            </div>
          </PanelRow>
        );
      })}
    </PanelSection>
  ));
}

const CRITERIA_DEFAULTS = {
  condition: () => ({ type: 'condition', value: '' }),
  lab: () => ({ type: 'lab', lab: 'hba1c', op: '>', value: '', withinDays: 365 }),
  assessment: () => ({ type: 'assessment', formId: '', question: '', op: 'equals', value: '' }),
  score: () => ({ type: 'score', score: 'phq9', op: '>=', value: 10, withinDays: 90 }),
  event: () => ({ type: 'event', event: 'inpatient', withinDays: 30 }),
};
const opt = (list) => list.map(x => ({ value: x.key, label: x.label }));
const OPS = (list) => list.map(o => ({ value: o, label: o }));

// Chronic condition, lab, assessment answer or score, or recent event (the clinical
// criteria the former Automation Rules used; engine: lib/clinicalCriteria.js).
function ClinicalCriteriaEditor({ config, onChange }) {
  const criteria = config.criteria?.length ? config.criteria : [CRITERIA_DEFAULTS.condition()];
  const [forms, setForms] = useState([]);
  const fetchAssessmentFormOptions = useAppStore(s => s.fetchAssessmentFormOptions);
  const needsForms = criteria.some(c => c.type === 'assessment');
  useEffect(() => {
    if (!needsForms || forms.length) return undefined;
    let live = true;
    fetchAssessmentFormOptions().then(list => { if (live) setForms(list); });
    return () => { live = false; };
  }, [needsForms, forms.length, fetchAssessmentFormOptions]);

  const setAt = (i, p) => onChange({ criteria: criteria.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const fields = (c, i) => {
    if (c.type === 'condition') return <Input value={c.value} onChange={e => setAt(i, { value: e.target.value })} placeholder="e.g. Diabetes" aria-label="Condition" />;
    if (c.type === 'lab' || c.type === 'score') {
      const isLab = c.type === 'lab';
      return (
        <div className={styles.ruleControls}>
          <Select
            options={opt(isLab ? LAB_CATALOG : SCORE_CATALOG)}
            value={isLab ? c.lab : c.score}
            onValueChange={v => setAt(i, isLab ? { lab: v } : { score: v })}
          />
          <Select options={OPS(NUMERIC_OPS)} value={c.op} onValueChange={v => setAt(i, { op: v })} className={styles.opSelect} />
          <Input type="number" value={c.value ?? ''} onChange={e => setAt(i, { value: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Value" wrapperClassName={styles.numberInput} aria-label="Value" />
          <Input type="number" value={c.withinDays ?? ''} onChange={e => setAt(i, { withinDays: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Days" trailingText="days" wrapperClassName={styles.numberInput} aria-label="Within days" />
        </div>
      );
    }
    if (c.type === 'assessment') {
      return (
        <div className={styles.ruleColumn}>
          <Select options={[{ value: '', label: 'Any form' }, ...forms.map(f => ({ value: f.id, label: f.name }))]} value={c.formId || ''} onValueChange={v => setAt(i, { formId: v })} searchable />
          <div className={styles.ruleControls}>
            <Input value={c.question} onChange={e => setAt(i, { question: e.target.value })} placeholder="Question key" aria-label="Question" />
            <Select options={OPS(ANSWER_OPS)} value={c.op} onValueChange={v => setAt(i, { op: v })} className={styles.opSelect} />
            <Input value={c.value ?? ''} onChange={e => setAt(i, { value: e.target.value })} placeholder="Answer" aria-label="Answer" />
          </div>
        </div>
      );
    }
    return (
      <div className={styles.ruleControls}>
        <Select options={opt(EVENT_CATALOG)} value={c.event} onValueChange={v => setAt(i, { event: v })} />
        <Input type="number" value={c.withinDays ?? ''} onChange={e => setAt(i, { withinDays: e.target.value === '' ? null : Number(e.target.value) })} trailingText="days" wrapperClassName={styles.numberInput} aria-label="Within days" />
      </div>
    );
  };

  return (
    <PanelSection
      title="Patient matches"
      action={(
        <SegmentedControl size="sm" items={[{ key: 'all', label: 'All' }, { key: 'any', label: 'Any' }]} value={config.match === 'any' ? 'any' : 'all'} onValueChange={k => onChange({ match: k, criteria })} />
      )}
    >
      {criteria.map((c, i) => (
        <PanelRow key={i} label={<Select options={opt(CONDITION_TYPES)} value={c.type} onValueChange={v => setAt(i, CRITERIA_DEFAULTS[v]())} />}>
          <div className={styles.ruleControls}>
            {fields(c, i)}
            <ActionButton size="sm" icon="solar:trash-bin-trash-linear" tooltip="Remove" disabled={criteria.length === 1} onClick={() => onChange({ criteria: criteria.filter((_, j) => j !== i) })} />
          </div>
        </PanelRow>
      ))}
      <div className={styles.panelRow}>
        <Button variant="soft" size="sm" leadingIconElement={<AddIconMinimalist size={14} />} onClick={() => onChange({ criteria: [...criteria, CRITERIA_DEFAULTS.condition()] })}>
          Add criterion
        </Button>
      </div>
    </PanelSection>
  );
}
