/**
 * Condition field catalog for the dynamic population group rule builder.
 *
 * Every condition a rule can reference is a field on the patient profile
 * (`p360_profiles`) — `profileColumn` names the column each condition reads,
 * so the catalog doubles as the contract between the builder UI and the data
 * layer that will evaluate rules. Columns marked with (†) did not exist on
 * the profile before this feature; supabase/pop_group_rule_builder_migration.sql
 * adds them.
 *
 * `operators` use react-querybuilder's canonical operator names where one
 * exists; the label is what the UI renders (Figma copy).
 */

/* Operator sets by value shape. Names align with react-querybuilder's
   defaultOperators so a stored rule stays portable to formatQuery later. */
const NUMBER_OPS = [
  { name: '>=', label: 'is more than and equal to' },
  { name: '<=', label: 'is less than and equal to' },
  { name: '>', label: 'is more than' },
  { name: '<', label: 'is less than' },
  { name: '=', label: 'is equal to' },
  { name: '!=', label: 'is not equal to' },
];

const TEXT_OPS = [
  { name: '=', label: 'is' },
  { name: '!=', label: 'is not' },
  { name: 'contains', label: 'contains' },
];

const LIST_OPS = [
  { name: 'contains', label: 'includes' },
  { name: 'doesNotContain', label: 'does not include' },
];

const DATE_OPS = [
  { name: '<=', label: 'is on or before' },
  { name: '>=', label: 'is on or after' },
  { name: '=', label: 'is on' },
];

/* Category accents — chip background token + the Solar icon color stays
   currentColor (grey-300) per the Figma. */
export const FIELD_GROUPS = [
  { key: 'personal', label: 'Personal Info', accent: 'var(--accent-light-purple)' },
  { key: 'location', label: 'Location', accent: 'var(--accent-light-pink)' },
  { key: 'medical', label: 'Medical Records', accent: 'var(--accent-light-light-green)' },
  { key: 'patientInfo', label: 'Patient Information', accent: 'var(--accent-light-amber)' },
  { key: 'others', label: 'Others', accent: 'var(--accent-light-cyan)' },
];

export const RULE_FIELDS = [
  /* ── Personal Info ── */
  { key: 'patientAge', label: 'Patient Age', group: 'personal', icon: 'solar:calendar-minimalistic-linear',
    profileColumn: 'age', valueType: 'number', unit: 'Years', operators: NUMBER_OPS, supportsAsOf: true },
  { key: 'sexAtBirth', label: 'Sex At Birth', group: 'personal', icon: 'solar:men-linear',
    profileColumn: 'sex_at_birth', valueType: 'select', options: ['Male', 'Female', 'Intersex', 'Unknown'], operators: TEXT_OPS },
  { key: 'gender', label: 'Gender', group: 'personal', icon: 'solar:women-linear',
    profileColumn: 'gender_identity', valueType: 'select',
    options: ['Male', 'Female', 'Non-binary', 'Transgender', 'Other', 'Prefer not to say'], operators: TEXT_OPS },

  /* ── Location ── */
  { key: 'state', label: 'State', group: 'location', icon: 'solar:point-on-map-linear',
    profileColumn: 'state', valueType: 'text', operators: TEXT_OPS },
  { key: 'zipCode', label: 'ZipCode', group: 'location', icon: 'solar:global-linear',
    profileColumn: 'zipcode', valueType: 'text', operators: TEXT_OPS },

  /* ── Medical Records ── */
  { key: 'vital', label: 'Vital', group: 'medical', icon: 'solar:heart-pulse-linear',
    profileColumn: 'recent_vitals', valueType: 'text', operators: LIST_OPS },
  { key: 'problem', label: 'Problem', group: 'medical', icon: 'solar:clipboard-list-linear',
    profileColumn: 'problems' /* † */, valueType: 'text', operators: LIST_OPS },
  { key: 'diagnosis', label: 'Diagnosis', group: 'medical', icon: 'solar:stethoscope-linear',
    profileColumn: 'diagnoses' /* † */, valueType: 'text', operators: LIST_OPS },
  { key: 'diagnosisGroup', label: 'Diagnosis Group', group: 'medical', icon: 'solar:stethoscope-linear',
    profileColumn: 'diagnosis_groups' /* † */, valueType: 'text', operators: LIST_OPS, isNew: true },
  { key: 'immunization', label: 'Immunization', group: 'medical', icon: 'solar:syringe-linear',
    profileColumn: 'immunizations' /* † */, valueType: 'text', operators: LIST_OPS },
  { key: 'medicationOrder', label: 'Medication Order', group: 'medical', icon: 'solar:jar-of-pills-linear',
    profileColumn: 'medication_orders' /* † */, valueType: 'text', operators: LIST_OPS },
  { key: 'procedure', label: 'Procedure', group: 'medical', icon: 'solar:clipboard-add-linear',
    profileColumn: 'procedures' /* † */, valueType: 'text', operators: LIST_OPS },
  { key: 'labResult', label: 'Lab Result', group: 'medical', icon: 'solar:test-tube-linear',
    profileColumn: 'lab_results' /* † */, valueType: 'text', operators: LIST_OPS },

  /* ── Patient Information ── */
  { key: 'patientTag', label: 'Patient Tag', group: 'patientInfo', icon: 'solar:tag-horizontal-linear',
    profileColumn: 'tags', valueType: 'text', operators: LIST_OPS },
  { key: 'membershipStatus', label: 'Membership status', group: 'patientInfo', icon: 'solar:crown-line-linear',
    profileColumn: 'membership_status' /* † */, valueType: 'select',
    options: ['Active', 'Inactive', 'Churned', 'Pending'], operators: TEXT_OPS },
  { key: 'pastMembershipStatus', label: 'Past membership Status', group: 'patientInfo', icon: 'solar:clipboard-add-linear',
    profileColumn: 'past_membership_status' /* † */, valueType: 'select',
    options: ['Active', 'Inactive', 'Churned', 'Pending'], operators: TEXT_OPS },
  { key: 'patientEngagement', label: 'Patient Engagement', group: 'patientInfo', icon: 'solar:call-chat-linear',
    profileColumn: 'engagement_level' /* † */, valueType: 'select',
    options: ['High', 'Medium', 'Low', 'Unreachable'], operators: TEXT_OPS },
  { key: 'wearable', label: 'Wearable', group: 'patientInfo', icon: 'solar:watch-square-linear',
    profileColumn: 'wearables' /* † */, valueType: 'text', operators: LIST_OPS, isNew: true },

  /* ── Others ── */
  { key: 'practitioner', label: 'Practitioner', group: 'others', icon: 'solar:user-heart-linear',
    profileColumn: 'care_team', valueType: 'text', operators: LIST_OPS },
  { key: 'appointment', label: 'Appointment', group: 'others', icon: 'solar:calendar-date-linear',
    profileColumn: 'next_appointment_date', valueType: 'date', operators: DATE_OPS },
  { key: 'form', label: 'Form', group: 'others', icon: 'solar:document-add-linear',
    profileColumn: 'forms_submitted' /* † */, valueType: 'text', operators: LIST_OPS },
  { key: 'employer', label: 'Employer', group: 'others', icon: 'solar:buildings-2-linear',
    profileColumn: 'employer', valueType: 'text', operators: TEXT_OPS },
];

export const FIELD_BY_KEY = Object.fromEntries(RULE_FIELDS.map(f => [f.key, f]));

export const groupAccent = (groupKey) =>
  FIELD_GROUPS.find(g => g.key === groupKey)?.accent || 'var(--neutral-50)';

/* Badge descriptors for a rule's node row: [{ text, tone }]. Complex
   conditions (metrics, negations, qualifiers — e.g. "Vital · Blood Pressure ·
   is more than 140/90 mmHg") carry an explicit `display` array authored when
   the rule was built; simple builder-authored rules derive their badges from
   operator + value. Editing a display-carrying rule through the generic
   editor replaces it with the derived form. */
export function ruleSummary(rule) {
  if (Array.isArray(rule.display)) {
    return rule.display.map(d => (typeof d === 'string' ? { text: d, tone: 'grey' } : { text: d.text, tone: d.tone || 'grey' }));
  }
  const field = FIELD_BY_KEY[rule.field];
  if (!field) return [];
  const op = field.operators.find(o => o.name === rule.operator);
  const v = rule.value || {};
  const parts = [];
  if (op && (v.amount ?? v.text ?? '') !== '') {
    const val = field.valueType === 'number' ? `${v.amount} ${field.unit || ''}`.trim() : v.text;
    parts.push({ text: `${op.label} ${val}`, tone: 'grey' });
  }
  if (field.supportsAsOf && (v.asOfMode === 'today' || v.asOfDate)) {
    parts.push({ text: `as of ${v.asOfMode === 'today' ? todayLabel() : v.asOfDate}`, tone: 'grey' });
  }
  return parts;
}

export function todayLabel() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}-${d.getFullYear()}`;
}
