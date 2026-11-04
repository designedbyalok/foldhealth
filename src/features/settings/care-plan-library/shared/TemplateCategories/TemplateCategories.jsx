import { SubTabs } from '../../../../../components/SubTabs/SubTabs';
import { Button } from '../../../../../components/Button/Button';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Input } from '../../../../../components/Input/Input';
import { Select } from '../../../../../components/Select/Select';
import { Toggle } from '../../../../../components/Toggle/Toggle';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import {
  CATEGORY_CRITERION_TYPES, CATEGORY_DEFAULT_CRITERION, LAB_CATALOG, NUMERIC_OPS,
} from '../../lib/templateCategories';
import { COMMON } from './useTemplateCategories';
import styles from './TemplateCategories.module.css';

const LAB_OPTIONS = LAB_CATALOG.map(l => ({ value: l.key, label: l.label }));
const OP_OPTIONS = NUMERIC_OPS.map(o => ({ value: o, label: o }));
const TYPE_OPTIONS = CATEGORY_CRITERION_TYPES.map(t => ({ value: t.key, label: t.label }));
const MATCH_ITEMS = [{ key: 'all', label: 'All' }, { key: 'any', label: 'Any' }];

/**
 * The section switch above a template's goals, interventions and barriers:
 * Common (every patient) and one tab per category, plus Add Category.
 */
export function TemplateCategoryBar({ categories, active, onSelect, onAdd, counts }) {
  const tabs = [
    { key: COMMON, label: 'Common', count: counts?.[COMMON] },
    ...categories.map(c => ({ key: c.id, label: c.name.trim() || 'Untitled', count: counts?.[c.id] })),
  ];
  return (
    <div className={styles.bar}>
      <SubTabs size="sm" tabs={tabs} value={active} onValueChange={onSelect} />
      <Button variant="ghost" size="sm" leadingIconElement={<AddIconMinimalist size={14} />} onClick={onAdd}>
        Add Category
      </Button>
    </div>
  );
}

/** What the Common tab means once a template has categories. */
export function CommonSectionNote() {
  return (
    <p className={styles.note}>
      Common goals, interventions and barriers go to every patient. Each category adds its own for the patients who match it.
    </p>
  );
}

/**
 * A category's name and entry criteria (chronic conditions and latest lab
 * results). Categories are checked in order; the first match wins.
 */
export function CategoryCriteriaCard({ category, index, total, onChange, onRemove, onMove }) {
  const criteria = category.criteria || [];
  const setAt = (i, patch) => onChange({ criteria: criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const number = (v) => (v === '' ? '' : Number(v));

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.nameInput}>
          <Input
            value={category.name}
            onChange={e => onChange({ name: e.target.value.slice(0, 80) })}
            placeholder="Category name, e.g. A1C 9% or above"
            aria-label="Category name"
          />
        </span>
        <ActionButton icon="solar:alt-arrow-left-linear" size="sm" tooltip="Check earlier" disabled={index === 0} onClick={() => onMove(-1)} />
        <ActionButton icon="solar:alt-arrow-right-linear" size="sm" tooltip="Check later" disabled={index === total - 1} onClick={() => onMove(1)} />
        <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Delete category" onClick={onRemove} />
      </div>

      <div className={styles.matchRow}>
        <span className={styles.matchLabel}>Patients who match</span>
        <Toggle size="sm" items={MATCH_ITEMS} value={category.match === 'any' ? 'any' : 'all'} onValueChange={k => onChange({ match: k })} />
        <span className={styles.matchLabel}>of these:</span>
      </div>

      <div className={styles.criteria}>
        {criteria.map((c, i) => (
          // Criteria have no ids; their order is their identity while editing.
          <div key={i} className={styles.criterion}>
            <Select
              options={TYPE_OPTIONS}
              value={c.type}
              onValueChange={t => onChange({ criteria: criteria.map((x, j) => (j === i ? CATEGORY_DEFAULT_CRITERION[t]() : x)) })}
              className={styles.typeSelect}
            />
            {c.type === 'lab' ? (
              <>
                <Select options={LAB_OPTIONS} value={c.lab} onValueChange={v => setAt(i, { lab: v })} className={styles.labSelect} />
                <Select options={OP_OPTIONS} value={c.op} onValueChange={v => setAt(i, { op: v })} className={styles.opSelect} />
                <span className={styles.numberInput}>
                  <Input type="number" value={c.value ?? ''} onChange={e => setAt(i, { value: number(e.target.value) })} placeholder="Value" aria-label="Value" />
                </span>
                <span className={styles.daysInput}>
                  <Input
                    type="number"
                    value={c.withinDays ?? ''}
                    onChange={e => setAt(i, { withinDays: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="Any"
                    trailingText="days"
                    aria-label="Result within days"
                  />
                </span>
              </>
            ) : (
              <span className={styles.conditionInput}>
                <Input value={c.value} onChange={e => setAt(i, { value: e.target.value })} placeholder="e.g. Heart failure" aria-label="Condition" />
              </span>
            )}
            <ActionButton
              icon="solar:trash-bin-trash-linear"
              size="sm"
              tooltip="Remove criterion"
              disabled={criteria.length === 1}
              onClick={() => onChange({ criteria: criteria.filter((_, j) => j !== i) })}
            />
          </div>
        ))}
      </div>

      <div className={styles.cardFoot}>
        <Button variant="soft" size="sm" leadingIconElement={<AddIconMinimalist size={14} />} onClick={() => onChange({ criteria: [...criteria, CATEGORY_DEFAULT_CRITERION.lab()] })}>
          Add Criterion
        </Button>
        <span className={styles.hint}>
          {total > 1 ? `Checked ${ordinal(index + 1)} of ${total}; the first category a patient matches is applied.` : 'Lab criteria use the latest result in the window.'}
        </span>
      </div>
    </div>
  );
}

const ordinal = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
