import { describeCondition, evaluateRule, LAB_CATALOG, NUMERIC_OPS } from '../../../automations/lib/clinicalCriteria.js';

/* Template categories. A care plan template's own goals, interventions and
   barriers are its Common section, applied to every patient. Categories
   (care_plan_templates.categories) add more for patients who match their
   entry criteria, e.g. a diabetes template's "A1C at or above 9%":

     { id, name, match: 'all' | 'any', criteria: Condition[],
       goals: [], interventions: [], barriers: [] }

   Criteria use the clinical criteria engine (automations/lib/clinicalCriteria.js):
   chronic conditions and the latest lab results. Categories are checked in
   order and the first match wins, so the most specific goes first. A patient
   gets Common + one category; the run records which. Plain JS, no React. */

const LISTS = ['goals', 'interventions', 'barriers'];
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// The criterion types a category offers: what the template editor and apply
// time can read for any patient.
export const CATEGORY_CRITERION_TYPES = [
  { key: 'lab', label: 'Lab result' },
  { key: 'condition', label: 'Chronic condition' },
];
export const CATEGORY_DEFAULT_CRITERION = {
  lab: () => ({ type: 'lab', lab: 'hba1c', op: '>=', value: '', withinDays: 180 }),
  condition: () => ({ type: 'condition', value: '' }),
};
export { LAB_CATALOG, NUMERIC_OPS };

export const categoriesOf = (template) => (Array.isArray(template?.categories) ? template.categories : []);
export const hasCategories = (template) => categoriesOf(template).length > 0;

let seq = 0;
/** A new, empty category. */
export function newCategory(name = '') {
  seq += 1;
  return {
    id: `cat-${Date.now().toString(36)}-${seq}`,
    name,
    match: 'all',
    criteria: [CATEGORY_DEFAULT_CRITERION.lab()],
    goals: [],
    interventions: [],
    barriers: [],
  };
}

// Items of `extra` whose titles `base` doesn't already have, after `base`.
const union = (base, extra) => {
  const seen = new Set(base.map(x => norm(x.title)));
  return [...base, ...extra.filter((x) => {
    const key = norm(x.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
};

/**
 * A template's lists for one category: Common + that category, tagged with
 * `category: { id, name }`. A null or unknown id gives Common alone.
 */
export function withCategory(template, categoryId) {
  const category = categoryId ? categoriesOf(template).find(c => c.id === categoryId) : null;
  const merged = Object.fromEntries(LISTS.map(k => [k, union(template?.[k] || [], category?.[k] || [])]));
  return { ...template, ...merged, category: category ? { id: category.id, name: category.name } : null };
}

/**
 * A list for comparing versions: Common + one category when `categoryId` is
 * given (null = Common alone), otherwise Common + every category.
 */
export function itemsFor(content, listKey, categoryId) {
  const common = content?.[listKey] || [];
  if (categoryId === null) return common;
  const cats = categoriesOf(content).filter(c => categoryId === undefined || c.id === categoryId);
  return cats.reduce((acc, c) => union(acc, c[listKey] || []), common);
}

/** Plain-language entry criteria, e.g. "HbA1c ≥ 9 % (last 180 days)". */
export function describeCriteria(category) {
  const parts = (category?.criteria || []).map(describeCondition);
  return parts.join(category?.match === 'any' ? ' or ' : ' and ');
}

/**
 * Which category a patient falls in. `inputs` come from buildRuleInputs.
 * Returns { category, reasons } for the first match, or { category: null,
 * reasons: [] } when none matches (or the template has no categories).
 */
export function matchCategory(template, inputs, today = new Date()) {
  for (const category of categoriesOf(template)) {
    if (!(category.criteria || []).length) continue;
    const res = evaluateRule({ match: category.match, conditions: category.criteria }, inputs, today);
    if (res.matched) return { category, reasons: res.reasons.filter(r => r.ok).map(r => r.text) };
  }
  return { category: null, reasons: [] };
}

/** Why a template's categories can't be saved yet, or null. */
export function categoriesProblem(categories) {
  const names = new Set();
  for (const c of categories || []) {
    const name = norm(c.name);
    if (!name) return 'Name every category.';
    if (names.has(name)) return `Two categories are called "${c.name.trim()}".`;
    names.add(name);
  }
  for (const c of categories || []) {
    if (!(c.criteria || []).length) return `Give "${c.name.trim()}" at least one criterion.`;
    for (const k of c.criteria) {
      if (k.type === 'condition' && !norm(k.value)) return `Name the condition in "${c.name.trim()}".`;
      if (k.type === 'lab' && (k.value === '' || k.value == null || Number.isNaN(Number(k.value)))) {
        return `Give the lab in "${c.name.trim()}" a number.`;
      }
    }
  }
  return null;
}

/**
 * What leaves a plan when a run moves from one category to another: the old
 * category's items whose titles neither Common nor the new category has.
 * `fromId` null (a run on Common alone) leaves nothing.
 */
export function itemsLeaving(template, fromId, toId) {
  const from = fromId ? categoriesOf(template).find(c => c.id === fromId) : null;
  const staying = withCategory(template, toId);
  return Object.fromEntries(LISTS.map((k) => {
    const keep = new Set(staying[k].map(x => norm(x.title)));
    return [k, (from?.[k] || []).filter(x => !keep.has(norm(x.title)))];
  }));
}

/**
 * Runs whose patient now matches a different category than the one they
 * follow, skipping a category the care team already dismissed for that run.
 * `runs` are active template instances; returns
 * [{ run, template, to, reasons, fromName }].
 */
export function categorySuggestions(runs, templates, inputs, today = new Date()) {
  if (!inputs) return [];
  const byId = new Map((templates || []).map(t => [String(t.id), t]));
  return (runs || []).flatMap((run) => {
    const template = byId.get(String(run.templateId));
    // An episode has its own start and end (lib/episodeTemplates); it isn't switched.
    if (run.status !== 'active' || run.episodic || !hasCategories(template)) return [];
    const { category, reasons } = matchCategory(template, inputs, today);
    if (!category || category.id === run.categoryId || category.id === run.dismissedCategoryId) return [];
    const fromName = run.categoryName || categoriesOf(template).find(c => c.id === run.categoryId)?.name || '';
    return [{ run, template, to: category, reasons, fromName }];
  });
}
