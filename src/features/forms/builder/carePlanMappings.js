/**
 * Assessment-to-template mapping: rules on a form's `scoring.carePlanMappings`
 * that suggest care plan templates when a completed response matches.
 *
 *   { id, kind: 'score',  scoreId, min, max, templateIds }   score in [min, max]
 *   { id, kind: 'answer', linkId, values,    templateIds }   answer is any of values
 *
 * min / max may be null (open-ended). Matching runs in the database
 * (supabase/assessment_care_plan_suggestions_migration.sql) against the score
 * snapshot saved at submit; these helpers are the editor's side.
 */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Fields with selectable options, nested ones included: the answer rules' questions. */
export function answerFields(fields) {
  const out = [];
  const walk = (list) => (list || []).forEach((f) => {
    if (Array.isArray(f.options) && f.options.length && f.type !== 'group') out.push(f);
    if (f.items) walk(f.items);
  });
  walk(fields);
  return out;
}

export function newMapping(kind, { scores = [], fields = [] } = {}) {
  const id = `map_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  if (kind === 'answer') {
    return { id, kind, linkId: answerFields(fields)[0]?.linkId || '', values: [], templateIds: [] };
  }
  return { id, kind: 'score', scoreId: scores[0]?.id || '', min: null, max: null, templateIds: [] };
}

/** Labels of the score's bands that overlap [min, max]. */
export function bandsInRange(score, min, max) {
  const lo = num(min) ?? -Infinity;
  const hi = num(max) ?? Infinity;
  return (score?.interpretations || []).filter((b) => b.max >= lo && b.min <= hi).map((b) => b.label);
}

/** What's wrong with a rule, or null. `templates` is the library the picker offers. */
export function mappingIssue(rule, { scores = [], fields = [], templates = [] } = {}) {
  if (rule.kind === 'score') {
    if (!scores.some((s) => s.id === rule.scoreId)) return 'Pick a score.';
    const min = num(rule.min);
    const max = num(rule.max);
    if (min == null && max == null) return 'Set a minimum or maximum score.';
    if (min != null && max != null && min > max) return 'Minimum is above maximum.';
  } else if (rule.kind === 'answer') {
    const field = answerFields(fields).find((f) => f.linkId === rule.linkId);
    if (!field) return 'Pick a question.';
    if (!rule.values?.length) return 'Pick at least one answer.';
    const known = new Set(field.options.map((o) => String(o.value)));
    if (rule.values.some((v) => !known.has(String(v)))) return 'An answer no longer exists on this question.';
  } else {
    return 'Unknown rule type.';
  }
  if (!rule.templateIds?.length) return 'Pick a care plan template.';
  const ids = new Set(templates.map((t) => String(t.id)));
  if (templates.length && rule.templateIds.some((id) => !ids.has(String(id)))) return 'A template was deleted or unpublished.';
  return null;
}
