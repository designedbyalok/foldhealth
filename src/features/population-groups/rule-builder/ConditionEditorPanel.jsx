import { useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Icon } from '../../../components/Icon/Icon';
import { FIELD_BY_KEY, groupAccent, todayLabel } from './fieldCatalog';
import styles from './ruleBuilder.module.css';

/**
 * ConditionEditorPanel — the docked 400px editor (Figma 9:44005 right pane).
 * Holds a local draft of the rule; Save commits it back to the query. The
 * Save button tracks dirtiness, so after a save it disables again exactly
 * like the Figma's resting state.
 */
export function ConditionEditorPanel({ rule, onSave, onClose }) {
  const field = FIELD_BY_KEY[rule.field];
  const [draft, setDraft] = useState(() => ({
    operator: rule.operator || field.operators[0].name,
    amount: rule.value?.amount ?? '',
    text: rule.value?.text ?? '',
    asOfMode: rule.value?.asOfMode ?? 'today',
    asOfDate: rule.value?.asOfDate ?? '',
  }));

  const committed = {
    operator: rule.operator || field.operators[0].name,
    amount: rule.value?.amount ?? '',
    text: rule.value?.text ?? '',
    asOfMode: rule.value?.asOfMode ?? 'today',
    asOfDate: rule.value?.asOfDate ?? '',
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(committed);

  const isNumber = field.valueType === 'number';
  const isSelect = field.valueType === 'select';
  const isDate = field.valueType === 'date';
  const hasValue = isNumber
    ? String(draft.amount).trim() !== ''
    : String(draft.text).trim() !== '';
  const asOfOk = !field.supportsAsOf || draft.asOfMode === 'today' || draft.asOfDate;
  const canSave = dirty && hasValue && asOfOk;

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const commit = () => {
    if (!canSave) return;
    const value = isNumber
      ? { amount: draft.amount, ...(field.supportsAsOf ? { asOfMode: draft.asOfMode, asOfDate: draft.asOfDate } : {}) }
      : { text: draft.text };
    onSave({ operator: draft.operator, value });
  };

  return (
    <aside className={styles.editor}>
      <div className={styles.editorInner}>
        <div className={styles.editorHeader}>
          <span className={styles.editorTitle}>{field.label}</span>
          <div className={styles.editorHeaderActions}>
            <Button variant="primary" size="L" disabled={!canSave} onClick={commit}>Save</Button>
            <span className={styles.headerDivider} />
            <ActionButton icon="solar:close-circle-linear" size="L" tooltip="Close" onClick={onClose} />
          </div>
        </div>

        <div className={styles.editorFields}>
          {/* Field identity chip — full width, accent surface */}
          <div className={styles.editorFieldChip} style={{ background: groupAccent(field.group) }}>
            <span className={styles.fieldChipIcon} style={{ background: groupAccent(field.group) }}>
              <Icon name={field.icon} size={16} color="var(--neutral-400)" />
            </span>
            {field.label}
          </div>

          {/* Operator */}
          <Select
            options={field.operators.map(o => ({ value: o.name, label: o.label }))}
            value={draft.operator}
            onChange={(v) => set('operator', v)}
            style={{ width: '100%' }}
          />

          {/* Value */}
          {isNumber && (
            <div className={styles.unitInputWrap}>
              <Input
                type="number"
                value={draft.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="Enter value"
                style={{ width: '100%', paddingRight: 56 }}
              />
              {field.unit && <span className={styles.unitSuffix}>{field.unit}</span>}
            </div>
          )}
          {isSelect && (
            <Select
              options={field.options.map(o => ({ value: o, label: o }))}
              value={draft.text}
              onChange={(v) => set('text', v)}
              placeholder={`Select ${field.label}`}
              style={{ width: '100%' }}
            />
          )}
          {!isNumber && !isSelect && (
            <Input
              type={isDate ? 'date' : 'text'}
              value={draft.text}
              onChange={e => set('text', e.target.value)}
              placeholder={`Enter ${field.label}`}
              style={{ width: '100%' }}
            />
          )}

          {/* As-of — date-anchored fields only (e.g. Patient Age) */}
          {field.supportsAsOf && (
            <>
              <span className={styles.editorSectionLabel}>As of</span>
              <Select
                options={[
                  { value: 'today', label: 'Today' },
                  { value: 'date', label: 'Date' },
                ]}
                value={draft.asOfMode}
                onChange={(v) => set('asOfMode', v)}
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
