/**
 * Who a care plan template is for (care_plan_templates.scope).
 *
 *   org      the organization library: everyone sees and edits it
 *   user     private to its creator
 *   patient  saved from one patient's care plan; offered only on that patient
 *
 * Privacy of 'user' templates is enforced by RLS; these helpers decide which
 * of the visible templates a given surface lists.
 */
export const TEMPLATE_SCOPES = {
  org: {
    label: 'Organization',
    badge: 'Org',
    icon: 'solar:buildings-2-linear',
    tone: 'grey',
    hint: 'Adds it to the library for everyone.',
  },
  user: {
    label: 'Only me',
    badge: 'Private',
    icon: 'solar:lock-keyhole-minimalistic-linear',
    tone: 'secondary',
    hint: 'Only you can see and use it.',
  },
  patient: {
    label: 'This patient',
    badge: 'Patient',
    icon: 'solar:user-linear',
    tone: 'primary',
    hint: "Offered only on this patient's care plan.",
  },
};

/** The audiences a template can be created for, by where it's created. */
export const LIBRARY_SCOPE_CHOICES = ['org', 'user'];
export const PATIENT_SCOPE_CHOICES = ['patient', 'user', 'org'];

export const templateScopeOf = (t) => (TEMPLATE_SCOPES[t?.scope] ? t.scope : 'org');

/** Settings library: the organization's templates plus the signed-in user's own. */
export function inLibrary(template, userId) {
  const scope = templateScopeOf(template);
  return scope === 'org' || (scope === 'user' && template.ownerUserId === userId);
}

/** Apply Templates on a patient: library templates plus that patient's own. */
export function availableForPatient(template, userId, patientId) {
  const scope = templateScopeOf(template);
  if (scope === 'patient') return String(template.patientId) === String(patientId);
  return inLibrary(template, userId);
}

/** Filter-chip option labels, in display order, for the scopes a list can show. */
export function scopeFilterOptions(scopes) {
  return scopes.map(s => TEMPLATE_SCOPES[s].label);
}

export function matchesScopeFilter(template, selectedLabels) {
  if (!selectedLabels?.length) return true;
  return selectedLabels.includes(TEMPLATE_SCOPES[templateScopeOf(template)].label);
}
