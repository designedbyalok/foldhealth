import { Badge } from '../../../../../components/Badge/Badge';
import { RadioOptionGroup } from '../../../../../components/RadioOptionGroup/RadioOptionGroup';
import { TEMPLATE_SCOPES, templateScopeOf } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/templateScope';
import { RENEWAL_CHOICES, TEMPLATE_RENEWALS } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/templateRenewal';

/** Org / Private / Patient indicator for a template row. */
export function TemplateScopeBadge({ template, className }) {
  const s = TEMPLATE_SCOPES[templateScopeOf(template)];
  return <Badge size="sm" tone={s.tone} icon={s.icon} label={s.badge} className={className} />;
}

/**
 * "Who is this template for?", asked whenever a template is created.
 * `choices` lists the scopes this surface allows (the library offers
 * Organization / Only me; a patient's care plan adds This patient).
 */
export function TemplateScopeChoice({ value, onChange, choices, label = 'Who is this template for?' }) {
  return (
    <RadioOptionGroup
      label={label}
      name="template-scope"
      value={value}
      onChange={onChange}
      options={choices.map(key => ({ value: key, label: TEMPLATE_SCOPES[key].label, hint: TEMPLATE_SCOPES[key].hint }))}
    />
  );
}

/** "When applied again", what adding this template to a plan that has it does. */
export function TemplateRenewalChoice({ value, onChange, label = 'When applied again' }) {
  return (
    <RadioOptionGroup
      label={label}
      name="template-renewal"
      value={value}
      onChange={onChange}
      options={RENEWAL_CHOICES.map(key => ({ value: key, label: TEMPLATE_RENEWALS[key].label, hint: TEMPLATE_RENEWALS[key].hint }))}
    />
  );
}
