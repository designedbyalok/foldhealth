/* Template retirement. A supervisor retires a template (status 'archived',
   shown as Retired) with an optional replacement ("Use Diabetes v2
   instead", care_plan_templates.replaced_by_template_id). Retired templates
   can't be picked for new plans; plans already using one keep it, with a
   note pointing at the replacement. Automations and UnityAI recommendations
   use the replacement in its place. Plain JS, no React. */

export const RETIRED_STATUS = 'archived';

export const isRetired = (template) => template?.status === RETIRED_STATUS;

/**
 * The template to use instead of a retired one: its replacement, following a
 * chain of retirements (v1 → v2 → v3) to the first one still in use. Null
 * when there is no replacement, it's a draft, or the chain loops.
 */
export function replacementFor(template, templates) {
  const byId = new Map((templates || []).map(t => [String(t.id), t]));
  const seen = new Set([String(template?.id)]);
  let next = template?.replacedByTemplateId ? byId.get(String(template.replacedByTemplateId)) : null;
  while (next) {
    if (seen.has(String(next.id))) return null;
    seen.add(String(next.id));
    if (!isRetired(next)) return next.status === 'draft' ? null : next;
    next = next.replacedByTemplateId ? byId.get(String(next.replacedByTemplateId)) : null;
  }
  return null;
}

/**
 * A template id as automations should use it: itself when it's in use, its
 * replacement when it's retired, null when it's retired with none or unknown.
 * Returns { id, replaced } where `replaced` is the retired template it stands in for.
 */
export function activeTemplateFor(id, templates) {
  const t = (templates || []).find(x => String(x.id) === String(id));
  if (!t) return { id: null, replaced: null };
  if (!isRetired(t)) return { id: String(t.id), replaced: null };
  const r = replacementFor(t, templates);
  return { id: r ? String(r.id) : null, replaced: t };
}

/** Templates a retired one can be replaced with: published, in use, not itself. */
export const replacementOptions = (template, templates) => (templates || [])
  .filter(t => String(t.id) !== String(template?.id) && !isRetired(t) && t.status !== 'draft');
