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

/* Scheduled retirement (care_plan_template_scheduled_retirement migration):
   Retire can take a future America/Los_Angeles day (retireOn). Until then the
   template stays in use with a warning; a nightly job retires it that day. */

const LA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' });

/** Today in Los Angeles as YYYY-MM-DD, the day the nightly job retires on. */
export const retirementToday = (now = new Date()) => LA_DAY.format(now);

/** The day a template in use is set to retire, or null. */
export const retiringOn = (template) => (!isRetired(template) && template?.retireOn) || null;

/** YYYY-MM-DD as MM/DD/YYYY. */
export const formatRetireDate = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : '');

/** Retired or retiring templates that name `template` as their replacement. */
export const templatesReplacedBy = (template, templates) => (templates || [])
  .filter(t => t.replacedByTemplateId && String(t.replacedByTemplateId) === String(template?.id) && (isRetired(t) || retiringOn(t)));

const nameOf = (id, templates) => (templates || []).find(t => String(t.id) === String(id))?.name;

/** What a retiring or retired template is replaced by, as a sentence. */
export function retirementSummary(template, templates) {
  const day = retiringOn(template);
  if (day) {
    const by = nameOf(template.replacedByTemplateId, templates);
    return by
      ? `Retiring on ${formatRetireDate(day)}. This template is being replaced by ${by}.`
      : `Retiring on ${formatRetireDate(day)}, with no replacement.`;
  }
  if (isRetired(template)) {
    const by = replacementFor(template, templates)?.name || nameOf(template.replacedByTemplateId, templates);
    return by ? `Retired. Replaced by ${by}.` : 'Retired, with no replacement.';
  }
  return '';
}
