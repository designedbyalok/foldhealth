import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { IcdSearch } from '../../../components/IcdSearch/IcdSearch';
import { Icon } from '../../../components/Icon/Icon';
import { LAB_PRIORITIES, LAB_TEST_CATALOG, PERFORMING_LABS } from './labRules';
import styles from './CareGapLabs.module.css';

/**
 * "Order Lab" pane. One order = one requisition to one performing lab; it
 * can carry several tests (one collection) and several diagnoses (each test
 * needs a diagnosis that justifies it). Controlled; the host owns `values`
 * and the Place Lab Order action in its header.
 *
 * @param {object}   props
 * @param {object}   props.values    – { tests[], diagnoses[{code,title}], priority, performingLab, orderingProvider }
 * @param {function} props.onChange  – (key, value) => void
 * @param {Array}    props.providers – [{ id, name }]
 * @param {object}   props.labs      – from useCareGapLabs() (rule + period)
 */
export function LabOrderForm({ values, onChange, providers = [], labs }) {
  const catalog = labs.rule ? [labs.rule.test, ...LAB_TEST_CATALOG.filter(t => t !== labs.rule.test)] : LAB_TEST_CATALOG;
  const missingGapTest = labs.rule && !values.tests.includes(labs.rule.test);
  const removeDx = (code) => onChange('diagnoses', values.diagnoses.filter(d => d.code !== code));

  return (
    <div className={styles.form}>
      <Select
        label="Tests"
        required
        multiple
        searchable
        checkboxes
        badges
        searchPlaceholder="Search tests"
        options={catalog.map(t => ({ value: t, label: t }))}
        value={values.tests}
        onValueChange={v => onChange('tests', v)}
        placeholder="Select tests"
        helperText={labs.rule ? `${labs.rule.test} is the evidence this measure needs. Add other tests to draw them at the same time.` : 'Add every test to collect in this draw.'}
      />
      {missingGapTest && (
        <p className={styles.formWarn}>
          <Icon name="solar:danger-triangle-linear" size={14} color="currentColor" />
          Without {labs.rule.short || labs.rule.test}, this order will not close the Care Gap.
        </p>
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          Diagnoses
          <span className={styles.required} aria-hidden="true" />
        </span>
        <IcdSearch
          placeholder="Search ICD-10 code or description"
          excludeCodes={values.diagnoses.map(d => d.code)}
          onSelect={(icd) => onChange('diagnoses', [...values.diagnoses, { code: icd.code, title: icd.title }])}
        />
        {values.diagnoses.length > 0 && (
          <ul className={styles.dxList} aria-label="Selected diagnoses">
            {values.diagnoses.map((d, i) => (
              <li key={d.code} className={styles.dxChip}>
                <span className={styles.dxCode}>{d.code}</span>
                <span className={styles.dxTitle} title={d.title}>{d.title}</span>
                {i === 0 && <span className={styles.dxPrimary}>Primary</span>}
                <button type="button" className={styles.dxRemove} onClick={() => removeDx(d.code)} aria-label={`Remove ${d.code}`}>
                  <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <span className={styles.fieldHint}>Each test needs a diagnosis that supports it. The first one is the primary diagnosis.</span>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Priority</span>
        <div className={styles.radioRow} role="radiogroup" aria-label="Priority">
          {LAB_PRIORITIES.map(p => (
            <RadioButton key={p} name="lab-priority" value={p} label={p} checked={values.priority === p} onChange={() => onChange('priority', p)} />
          ))}
        </div>
      </div>
      <div className={styles.formGrid}>
        <Select
          label="Performing Lab"
          required
          options={PERFORMING_LABS.map(l => ({ value: l, label: l }))}
          value={values.performingLab}
          onValueChange={v => onChange('performingLab', v)}
          helperText="One lab per order. Split tests across labs into separate orders."
        />
        <Select
          label="Ordering Provider"
          required
          searchable
          options={providers.map(p => ({ value: p.name, label: p.name }))}
          value={values.orderingProvider}
          onValueChange={v => onChange('orderingProvider', v)}
        />
      </div>
      <Input label="Measurement Period" value={labs.period.label} readOnly disabled helperText="Results must be collected in this period to count toward the Care Gap." />
      <p className={styles.formNote}>
        <Icon name="solar:info-circle-linear" size={14} color="currentColor" />
        Placing the order does not close the Care Gap. The gap is evaluated when the result arrives.
      </p>
    </div>
  );
}
