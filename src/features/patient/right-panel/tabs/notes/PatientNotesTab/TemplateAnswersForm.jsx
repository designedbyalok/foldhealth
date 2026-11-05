import { Input } from '../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { Select } from '../../../../../../components/Select/Select';
import { RadioButton } from '../../../../../../components/RadioButton/RadioButton';
import { DatePicker } from '../../../../../../components/DatePicker/DatePicker';
import { useAppStore } from '../../../../../../store/useAppStore';
import { derivedPatch, isFieldVisible, userSelectOptions } from '../../../../../../lib/noteTemplateRules';
import styles from './TemplateAnswersForm.module.css';

/**
 * TemplateAnswersForm: renders a Note Template's `schema.items` as a
 * flat form and reports the answers back as `{ [key]: value }`.
 *
 * Deliberately decoupled from the Care Gap Visit workspace's own
 * `GenericEvidenceForm`, which routes updates through
 * `useClinicalNotePanel`. This component owns nothing, it just paints
 * the fields the caller hands it and pushes answers up via `onChange`.
 *
 * Field descriptor shape (matches `GAP_TEMPLATES` and the Form Builder):
 *   { key, label, type, options?, required?, placeholder?, description?, column? }
 *   type ∈ 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox'
 *          | 'content' | 'user-select'  (rules in src/lib/noteTemplateRules.js)
 *
 * Fields with `column: 2` pair up into a two-column row (adjacent pairs
 * only), matching the visit-note form's convention.
 */
export function TemplateAnswersForm({ items = [], answers, onChange, submitted = false }) {
  const users = useAppStore(s => s.platformUsers);
  if (!items.length) return null;
  const visible = items.filter(f => isFieldVisible(f, answers));
  const rows = [];
  let i = 0;
  while (i < visible.length) {
    const f = visible[i];
    const next = visible[i + 1];
    if (f.column === 2 && next && next.column === 2) {
      rows.push({ kind: 'pair', a: f, b: next });
      i += 2;
    } else {
      rows.push({ kind: 'single', field: f });
      i += 1;
    }
  }
  const set = (key, value) => {
    const next = { ...(answers || {}), [key]: value };
    onChange?.({ ...next, ...derivedPatch(items, next) });
  };

  return (
    <div className={styles.form}>
      {rows.map((row, idx) => (
        row.kind === 'pair' ? (
          <div key={idx} className={styles.grid2}>
            <Field field={row.a} answers={answers} onSet={set} submitted={submitted} users={users} />
            <Field field={row.b} answers={answers} onSet={set} submitted={submitted} users={users} />
          </div>
        ) : (
          <Field key={idx} field={row.field} answers={answers} onSet={set} submitted={submitted} users={users} />
        )
      ))}
    </div>
  );
}

function Field({ field, answers, onSet, submitted, users }) {
  const { key, label, type = 'text', options, required, placeholder, description, readOnly } = field;
  const value = answers?.[key] ?? (type === 'checkbox' ? false : '');
  const hasError = submitted && required
    && (type === 'checkbox' ? value !== true : (value === '' || value == null));
  const errorText = hasError ? `${label || key} is required` : null;

  if (type === 'content') {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{field.title}</span>
        <ul className={styles.contentBullets}>
          {(field.bullets || []).map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </div>
    );
  }

  if (type === 'user-select') {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          {label || key}{required && <span className={styles.required}> •</span>}
        </span>
        <Select
          options={userSelectOptions(field, users)}
          value={value || ''}
          onValueChange={(v) => onSet(key, v)}
          placeholder={placeholder || 'Choose an option'}
          searchable
        />
        {errorText && <span className={styles.error}>{errorText}</span>}
      </div>
    );
  }

  if (type === 'checkbox') {
    return (
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onSet(key, e.target.checked)}
        />
        <span className={styles.fieldLabel}>{field.checkboxLabel || label || key}{required && <span className={styles.required}> •</span>}</span>
      </label>
    );
  }

  if (type === 'radio') {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          {label || key}{required && <span className={styles.required}> •</span>}
        </span>
        <div className={styles.radioStack}>
          {(options || []).map(opt => (
            <RadioButton
              key={opt.value}
              checked={value === opt.value}
              onChange={() => onSet(key, opt.value)}
              label={opt.label}
              disabled={readOnly}
            />
          ))}
        </div>
        {description && <span className={styles.help}>{description}</span>}
        {errorText && <span className={styles.error}>{errorText}</span>}
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          {label || key}{required && <span className={styles.required}> •</span>}
        </span>
        <Select
          options={(options || []).map(o => ({ value: o.value, label: o.label }))}
          value={value || ''}
          onValueChange={(v) => onSet(key, v)}
          placeholder={placeholder || 'Choose an option'}
        />
        {description && <span className={styles.help}>{description}</span>}
        {errorText && <span className={styles.error}>{errorText}</span>}
      </div>
    );
  }

  if (type === 'date') {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          {label || key}{required && <span className={styles.required}> •</span>}
        </span>
        <DatePicker value={value || ''} onChange={(v) => onSet(key, v)} />
        {description && <span className={styles.help}>{description}</span>}
        {errorText && <span className={styles.error}>{errorText}</span>}
      </div>
    );
  }

  if (type === 'textarea') {
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          {label || key}{required && <span className={styles.required}> •</span>}
        </span>
        <Textarea
          value={value || ''}
          onChange={(e) => onSet(key, e.target.value)}
          placeholder={placeholder}
          rows={4}
        />
        {description && <span className={styles.help}>{description}</span>}
        {errorText && <span className={styles.error}>{errorText}</span>}
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        {label || key}{required && <span className={styles.required}> •</span>}
      </span>
      <Input
        type={type === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        onChange={(e) => onSet(key, e.target.value)}
        placeholder={placeholder}
        trailingText={field.unit}
        invalid={hasError}
      />
      {description && <span className={styles.help}>{description}</span>}
      {errorText && <span className={styles.error}>{errorText}</span>}
    </div>
  );
}
