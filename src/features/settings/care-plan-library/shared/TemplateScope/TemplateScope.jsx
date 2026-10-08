import { Badge } from '../../../../../components/Badge/Badge';
import { RadioButton } from '../../../../../components/RadioButton/RadioButton';
import { TEMPLATE_SCOPES, templateScopeOf } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/templateScope';
import styles from './TemplateScope.module.css';

/** Org / Private / Patient indicator for a template row. */
export function TemplateScopeBadge({ template, className }) {
  const s = TEMPLATE_SCOPES[templateScopeOf(template)];
  return <Badge size="S" tone={s.tone} icon={s.icon} label={s.badge} className={className} />;
}

/**
 * "Who is this template for?" — asked whenever a template is created.
 * `choices` lists the scopes this surface allows (the library offers
 * Organization / Only me; a patient's care plan adds This patient).
 */
export function TemplateScopeChoice({ value, onChange, choices, label = 'Who is this template for?' }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.group} role="radiogroup" aria-label={label}>
        {choices.map(key => (
          <div key={key} className={styles.option}>
            <RadioButton
              name="template-scope"
              value={key}
              label={TEMPLATE_SCOPES[key].label}
              checked={value === key}
              onChange={() => onChange(key)}
            />
            <p className={styles.hint}>{TEMPLATE_SCOPES[key].hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
