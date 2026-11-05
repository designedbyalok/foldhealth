// InterventionDrawer edits its fields flat; care_plan_intervention_templates
// keeps everything but kind, title and description in a `config` jsonb column.
// These two functions are the only place that shape difference is handled, so
// a field added to the drawer survives a save without touching either call
// site.

/** Fields that are columns of their own, everything else is config. */
const COLUMN_FIELDS = new Set(['kind', 'title', 'description']);

/** Drawer values → the row shape `saveCarePlanInterventionTemplate` expects. */
export function interventionTemplateFromValues(values, { kind } = {}) {
  const config = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (COLUMN_FIELDS.has(key) || value === undefined) continue;
    config[key] = value;
  }
  return {
    kind: kind || values?.kind || 'internal-task',
    title: (values?.title || '').trim(),
    description: values?.description || '',
    config,
  };
}

/** A saved template → the flat shape the drawer reads its initial state from. */
export function interventionDrawerValues(template) {
  if (!template) return undefined;
  return { ...(template.config || {}), ...template, config: undefined };
}
