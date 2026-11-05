import { useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { FIELD_BY_KEY, NEGATED_OP, EVENT_TYPES, groupAccent, groupAccentFg, groupChipStyle, todayLabel } from './fieldCatalog';
import { TerminologySearch } from './TerminologySearch';
import { LookbackWindowInput } from './LookbackWindowInput';
import styles from './ruleBuilder.module.css';

/* Rules seeded with `not: true` surface in the dropdown as the negated
   operator (e.g. not+includes → "does not include"); saving writes the
   plain operator back, so the editor never needs a separate NOT control. */
const effectiveOperator = (rule, field) => {
  const op = rule.operator || field.operators[0].name;
  return rule.not ? (NEGATED_OP[op] || op) : op;
};

/**
 * ConditionEditorPanel: the docked 400px editor (Figma 9:44005 right pane).
 * Dispatches to value editors by field.valueType: number, select, date, text
 * (profile-column originals) and codedTerm, observation, eventCount (new
 * healthcare types).
 */
export function ConditionEditorPanel({ rule, onSave, onClose }) {
  const field = FIELD_BY_KEY[rule.field];
  const vt = field.valueType;

  const [draft, setDraft] = useState(() => initDraft(rule, field));

  const committed = initDraft(rule, field);
  const dirty = JSON.stringify(draft) !== JSON.stringify(committed);

  const hasValue = checkHasValue(draft, vt);
  const canSave = dirty && hasValue;

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const commit = () => {
    if (!canSave) return;
    onSave(buildPatch(draft, field));
  };

  return (
    <aside className={styles.editor}>
      <div className={styles.editorInner}>
        <div className={styles.editorHeader}>
          <span className={styles.editorTitle}>{field.label}</span>
          <div className={styles.editorHeaderActions}>
            <Button disabled={!canSave} onClick={commit}>Save</Button>
            <span className={styles.headerDivider} />
            <ActionButton icon="solar:close-circle-linear" tooltip="Close" onClick={onClose} />
          </div>
        </div>

        <div className={styles.editorFields}>
          {/* Field identity chip */}
          <div className={styles.editorFieldChip} style={groupChipStyle(field.group)}>
            <span className={styles.fieldChipIcon} style={{ background: groupAccent(field.group) }}>
              <Icon name={field.icon} size={16} color={groupAccentFg(field.group)} />
            </span>
            {field.label}
          </div>

          {/* Operator */}
          <Select
            options={field.operators.map(o => ({ value: o.name, label: o.label }))}
            value={draft.operator}
            onValueChange={(v) => set('operator', v)}
            style={{ width: '100%' }}
          />

          {/* Value editor: dispatched by field type */}
          {vt === 'codedTerm' && (
            <CodedTermEditor draft={draft} field={field} onChange={set} onPatch={setDraft} />
          )}
          {vt === 'observation' && (
            <ObservationEditor draft={draft} field={field} onChange={set} onPatch={setDraft} />
          )}
          {vt === 'eventCount' && (
            <EventCountEditor draft={draft} field={field} onChange={set} onPatch={setDraft} />
          )}
          {vt === 'number' && (
            <NumberEditor draft={draft} field={field} onChange={set} />
          )}
          {vt === 'select' && (
            <SelectEditor draft={draft} field={field} onChange={set} />
          )}
          {vt === 'date' && (
            <TextEditor draft={draft} field={field} onChange={set} isDate />
          )}
          {vt !== 'codedTerm' && vt !== 'observation' && vt !== 'eventCount' &&
           vt !== 'number' && vt !== 'select' && vt !== 'date' && (
            <TextEditor draft={draft} field={field} onChange={set} />
          )}

          {/* As-of: date-anchored fields only (e.g. Patient Age) */}
          {field.supportsAsOf && (
            <>
              <span className={styles.editorSectionLabel}>As of</span>
              <Select
                options={[
                  { value: 'today', label: 'Today' },
                  { value: 'date', label: 'Date' },
                ]}
                value={draft.asOfMode}
                onValueChange={(v) => set('asOfMode', v)}
                style={{ width: '100%' }}
              />
              {draft.asOfMode === 'today' ? (
                <Input value={`Today (${todayLabel()})`} readOnly style={{ width: '100%', color: 'var(--neutral-300)' }} />
              ) : (
                <Input
                  type="date"
                  value={draft.asOfDate}
                  onChange={e => set('asOfDate', e.target.value)}
                  style={{ width: '100%' }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ── Value editors ── */

function CodedTermEditor({ draft, field, onChange, onPatch }) {
  return (
    <>
      <span className={styles.editorSectionLabel}>
        Search {field.terminology?.toUpperCase() || 'code'}
      </span>
      <TerminologySearch
        terminology={field.terminology}
        onSelect={(result) => onPatch(d => ({
          ...d,
          code: result.code,
          display: result.display,
          system: result.system,
        }))}
        autoFocus
      />
      {draft.code && (
        <div className={styles.selectedCode}>
          <Badge tone="info" size="sm" label={draft.code} />
          <span className={styles.selectedCodeText}>{draft.display}</span>
          <ActionButton
            icon="solar:close-circle-linear"
            size="sm"
            tooltip="Clear"
            onClick={() => onPatch(d => ({ ...d, code: '', display: '', system: '' }))}
          />
        </div>
      )}
      <LookbackWindowInput
        lookback={draft.lookback}
        onChange={(lb) => onChange('lookback', lb)}
      />
    </>
  );
}

function ObservationEditor({ draft, field, onChange, onPatch }) {
  return (
    <>
      <span className={styles.editorSectionLabel}>Analyte (LOINC)</span>
      <TerminologySearch
        terminology="loinc"
        onSelect={(result) => onPatch(d => ({
          ...d,
          analyte: { code: result.code, display: result.display, system: 'loinc' },
        }))}
        autoFocus
      />
      {draft.analyte?.code && (
        <div className={styles.selectedCode}>
          <Badge tone="info" size="sm" label={draft.analyte.code} />
          <span className={styles.selectedCodeText}>{draft.analyte.display}</span>
          <ActionButton
            icon="solar:close-circle-linear"
            size="sm"
            tooltip="Clear"
            onClick={() => onPatch(d => ({ ...d, analyte: null }))}
          />
        </div>
      )}
      <span className={styles.editorSectionLabel}>Value</span>
      <div className={styles.unitInputWrap}>
        <Input
          type="number"
          value={draft.numericValue ?? ''}
          onChange={e => onChange('numericValue', e.target.value)}
          placeholder="Enter numeric value"
          style={{ width: '100%', paddingRight: 56 }}
        />
        <span className={styles.unitSuffix}>
          <Input
            value={draft.unit || ''}
            onChange={e => onChange('unit', e.target.value)}
            placeholder="unit"
            style={{ width: 56, textAlign: 'right', border: 'none', padding: 0, fontSize: 'var(--font-md)' }}
          />
        </span>
      </div>
      <LookbackWindowInput
        lookback={draft.lookback}
        onChange={(lb) => onChange('lookback', lb)}
      />
    </>
  );
}

function EventCountEditor({ draft, field, onChange, onPatch }) {
  return (
    <>
      <span className={styles.editorSectionLabel}>Event type</span>
      <Select
        options={EVENT_TYPES.map(e => ({ value: e.value, label: e.label }))}
        value={draft.eventType || ''}
        onValueChange={v => onChange('eventType', v)}
        placeholder="Select event type"
        style={{ width: '100%' }}
      />
      <span className={styles.editorSectionLabel}>Threshold</span>
      <Input
        type="number"
        min={0}
        value={draft.count ?? ''}
        onChange={e => onChange('count', e.target.value)}
        placeholder="Count"
        style={{ width: '100%' }}
      />
      <span className={styles.editorSectionLabel}>Filter by code (optional)</span>
      <TerminologySearch
        terminology={draft.eventType === 'medication' ? 'rxnorm' : draft.eventType === 'lab' ? 'loinc' : 'cpt'}
        onSelect={(result) => onPatch(d => ({
          ...d,
          filter: { code: result.code, display: result.display, system: result.system },
        }))}
      />
      {draft.filter?.code && (
        <div className={styles.selectedCode}>
          <Badge tone="info" size="sm" label={draft.filter.code} />
          <span className={styles.selectedCodeText}>{draft.filter.display}</span>
          <ActionButton
            icon="solar:close-circle-linear"
            size="sm"
            tooltip="Clear"
            onClick={() => onPatch(d => ({ ...d, filter: null }))}
          />
        </div>
      )}
      <LookbackWindowInput
        lookback={draft.lookback}
        onChange={(lb) => onChange('lookback', lb)}
      />
    </>
  );
}

function NumberEditor({ draft, field, onChange }) {
  return (
    <div className={styles.unitInputWrap}>
      <Input
        type="number"
        value={draft.amount}
        onChange={e => onChange('amount', e.target.value)}
        placeholder="Enter value"
        style={{ width: '100%', paddingRight: 56 }}
      />
      {field.unit && <span className={styles.unitSuffix}>{field.unit}</span>}
    </div>
  );
}

function SelectEditor({ draft, field, onChange }) {
  return (
    <Select
      options={field.options.map(o => ({ value: o, label: o }))}
      value={draft.text}
      onValueChange={v => onChange('text', v)}
      placeholder={`Select ${field.label}`}
      style={{ width: '100%' }}
    />
  );
}

function TextEditor({ draft, field, onChange, isDate = false }) {
  return (
    <Input
      type={isDate ? 'date' : 'text'}
      value={draft.text}
      onChange={e => onChange('text', e.target.value)}
      placeholder={`Enter ${field.label}`}
      style={{ width: '100%' }}
    />
  );
}

/* ── Draft helpers ── */

function initDraft(rule, field) {
  const v = rule.value || {};
  const base = {
    operator: effectiveOperator(rule, field),
  };

  switch (field.valueType) {
    case 'codedTerm':
      return { ...base, code: v.code || '', display: v.display || '', system: v.system || '', lookback: v.lookback || null };
    case 'observation':
      return { ...base, analyte: v.analyte || null, numericValue: v.numericValue ?? '', unit: v.unit || '', lookback: v.lookback || null };
    case 'eventCount':
      return { ...base, eventType: v.eventType || '', count: v.count ?? '', filter: v.filter || null, lookback: v.lookback || null };
    default:
      return {
        ...base,
        amount: v.amount ?? '',
        text: v.text ?? '',
        asOfMode: v.asOfMode ?? 'today',
        asOfDate: v.asOfDate ?? '',
      };
  }
}

function checkHasValue(draft, valueType) {
  switch (valueType) {
    case 'codedTerm':
      return !!draft.code;
    case 'observation':
      return !!draft.analyte?.code && draft.numericValue !== '' && draft.numericValue != null;
    case 'eventCount':
      return !!draft.eventType && draft.count !== '' && draft.count != null;
    case 'number':
      return String(draft.amount).trim() !== '';
    default:
      return String(draft.text).trim() !== '';
  }
}

function buildPatch(draft, field) {
  switch (field.valueType) {
    case 'codedTerm':
      return {
        operator: draft.operator,
        value: {
          code: draft.code,
          display: draft.display,
          system: draft.system,
          ...(draft.lookback ? { lookback: draft.lookback } : {}),
        },
      };
    case 'observation':
      return {
        operator: draft.operator,
        value: {
          analyte: draft.analyte,
          numericValue: Number(draft.numericValue),
          unit: draft.unit,
          ...(draft.lookback ? { lookback: draft.lookback } : {}),
        },
      };
    case 'eventCount':
      return {
        operator: draft.operator,
        value: {
          eventType: draft.eventType,
          count: Number(draft.count),
          ...(draft.filter ? { filter: draft.filter } : {}),
          ...(draft.lookback ? { lookback: draft.lookback } : {}),
        },
      };
    default: {
      const value = field.valueType === 'number'
        ? { amount: draft.amount, ...(field.supportsAsOf ? { asOfMode: draft.asOfMode, asOfDate: draft.asOfDate } : {}) }
        : { text: draft.text };
      return { operator: draft.operator, value };
    }
  }
}
