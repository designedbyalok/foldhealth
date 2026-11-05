/* AI-drafted care plan templates: the plain-English description goes to
   /api/care-plan-template-draft with a compact catalog of the library, the
   model answers in TEMPLATE_DRAFT_SCHEMA, and normalizeTemplateDraft checks
   the answer against that catalog before the editor sees it. Shared by the
   API handler (prompt, schema, normalize) and the New Template screen
   (catalog). Plain JS, no app imports, so the server can load it. */

import { CARE_PLAN_NAME_MAX, CARE_PLAN_TITLE_MAX } from './carePlanLimits.js';
import { LAB_CATALOG, NUMERIC_OPS } from '../../../automations/lib/clinicalCriteria.js';

export const TEMPLATE_DESCRIPTION_MAX = 1000;

// The library's own values (care_plan_goals / intervention templates).
export const GOAL_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];
export const GOAL_DURATION_UNITS = ['Day', 'Week', 'Month'];
export const GOAL_CATEGORIES = ['Vitals', 'Labs', 'Diet', 'Exercise', 'Assessment', 'Others'];
export const INTERVENTION_KINDS = ['internal-task', 'patient-task', 'patient-education', 'measure-vital', 'send-form'];
export const REPEAT_UNITS = ['Days', 'Weeks'];
const PRIORITIES = ['high', 'medium', 'low'];

const MAX_GOALS = 8;
const MAX_INTERVENTIONS_PER_GOAL = 5;
const MAX_BARRIERS_PER_GOAL = 4;
const CATALOG_MAX = 400;
const MAX_CATEGORIES = 4;
// A protocol scope may name one more grade (e.g. hypertensive crisis).
const MAX_SCOPE_CATEGORIES = 5;
const MAX_CATEGORY_GOALS = 5;
const SCOPE_TEXT_MAX = 600;
const LAB_KEYS = LAB_CATALOG.map(l => l.key);

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (s) => String(s ?? '').trim().toLowerCase();
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

/** The slice of the library the model picks from: ids, titles and cadence. */
export function buildTemplateCatalog({ goals = [], interventions = [], barriers = [] }) {
  return {
    goals: goals.slice(0, CATALOG_MAX).map(g => ({
      id: String(g.id),
      title: clip(g.title, CARE_PLAN_TITLE_MAX),
      category: g.category || '',
      frequency: g.frequency || '',
      duration: g.duration ? `${g.duration} ${g.durationUnit || ''}`.trim() : '',
    })),
    interventions: interventions.slice(0, CATALOG_MAX).map(i => ({
      id: String(i.id), title: clip(i.title, CARE_PLAN_TITLE_MAX), kind: i.kind || 'internal-task',
    })),
    barriers: barriers.slice(0, CATALOG_MAX).map(b => ({ id: String(b.id), title: clip(b.title, CARE_PLAN_TITLE_MAX) })),
  };
}

const REFERENCE_MAX_ITEMS = 40;

/**
 * An existing template the draft starts from, as titles only: what the model
 * reads, and what the server accepts back (it runs this again on the body).
 * Entries are strings or `{ title }`.
 */
export function buildTemplateReference(template) {
  if (!template || typeof template !== 'object') return null;
  const titles = (list) => (Array.isArray(list) ? list : [])
    .map(e => clip(typeof e === 'string' ? e : e?.title, CARE_PLAN_TITLE_MAX))
    .filter(Boolean)
    .slice(0, REFERENCE_MAX_ITEMS);
  const reference = {
    name: clip(template.name, CARE_PLAN_NAME_MAX),
    goals: titles(template.goals),
    interventions: titles(template.interventions),
    barriers: titles(template.barriers),
  };
  return reference.goals.length || reference.interventions.length || reference.barriers.length ? reference : null;
}

const libraryRef = {
  libraryId: { type: 'string', nullable: true, description: 'id from the catalog, or null for a new item' },
  title: { type: 'string' },
};

const GOAL_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    ...libraryRef,
    description: { type: 'string' },
    category: { type: 'string', enum: GOAL_CATEGORIES },
    priority: { type: 'string', enum: PRIORITIES },
    frequency: { type: 'string', enum: GOAL_FREQUENCIES },
    duration: { type: 'integer' },
    durationUnit: { type: 'string', enum: GOAL_DURATION_UNITS },
    interventions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...libraryRef,
          kind: { type: 'string', enum: INTERVENTION_KINDS },
          repeatEvery: { type: 'integer', nullable: true },
          repeatEveryUnit: { type: 'string', enum: REPEAT_UNITS, nullable: true },
        },
        required: ['libraryId', 'title', 'kind'],
      },
    },
    barriers: {
      type: 'array',
      items: { type: 'object', properties: libraryRef, required: ['libraryId', 'title'] },
    },
  },
  required: ['libraryId', 'title', 'priority', 'frequency', 'interventions', 'barriers'],
};

// A category's entry criterion: a lab the criteria engine reads
// (automations/lib/clinicalCriteria.js) or a chronic condition.
const CRITERION_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['lab', 'condition'] },
    lab: { type: 'string', enum: LAB_KEYS, nullable: true },
    op: { type: 'string', enum: NUMERIC_OPS, nullable: true },
    value: { type: 'number', nullable: true },
    withinDays: { type: 'integer', nullable: true },
    condition: { type: 'string', nullable: true },
  },
  required: ['type', 'lab', 'op', 'value', 'withinDays', 'condition'],
};

/** Gemini responseSchema: the structure the model must answer in. */
export const TEMPLATE_DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    summary: { type: 'string' },
    templateType: { type: 'string', enum: ['general', 'chronic'] },
    conditions: { type: 'array', items: { type: 'string' } },
    goals: { type: 'array', items: GOAL_ITEM_SCHEMA },
    // Only asked for when drafting from a protocol with categories.
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          criteria: { type: 'array', items: CRITERION_SCHEMA },
          goals: { type: 'array', items: GOAL_ITEM_SCHEMA },
        },
        required: ['name', 'criteria', 'goals'],
      },
    },
  },
  required: ['name', 'summary', 'templateType', 'conditions', 'goals'],
};

/**
 * The same draft as a protocol's scope (options.scope): a plain-language
 * overview for care managers and nurses, and for Common and each category
 * its range and what the plan does there, goal by goal.
 */
export const TEMPLATE_SCOPE_SCHEMA = {
  ...TEMPLATE_DRAFT_SCHEMA,
  properties: {
    ...TEMPLATE_DRAFT_SCHEMA.properties,
    overview: { type: 'string' },
    commonExplanation: { type: 'string' },
    categories: {
      type: 'array',
      items: {
        ...TEMPLATE_DRAFT_SCHEMA.properties.categories.items,
        properties: {
          ...TEMPLATE_DRAFT_SCHEMA.properties.categories.items.properties,
          range: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['name', 'range', 'explanation', 'criteria', 'goals'],
      },
    },
  },
  required: [...TEMPLATE_DRAFT_SCHEMA.required, 'overview', 'commonExplanation', 'categories'],
};

/**
 * A reviewer's edits to a scope, sent back to redraft it: the categories to
 * keep (name, range, how many goals) and how many Common goals. What the
 * server accepts back too (it runs this again on the body). Null when there
 * is nothing to follow.
 */
export function buildScopeRequest(scope) {
  if (!scope || typeof scope !== 'object') return null;
  const goalCount = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 && n <= MAX_GOALS ? n : null;
  };
  const categories = (Array.isArray(scope.categories) ? scope.categories : [])
    .map(c => ({ name: clip(c?.name, 80), range: clip(c?.range, 200), goals: goalCount(c?.goals) }))
    .filter(c => c.name)
    .slice(0, MAX_SCOPE_CATEGORIES);
  const commonGoals = goalCount(scope.commonGoals);
  return categories.length || commonGoals != null ? { categories, commonGoals } : null;
}

/**
 * `protocol` (optional): { title, version, organization, guidance }, an
 * Active clinical protocol the template should follow, its content as plain
 * lines (protocolGuidanceText).
 * `options.categories`: split the template into Common goals and categories
 * by the protocol's measurable thresholds (lib/templateCategories.js).
 * `options.libraryOnly`: goals from the catalog only (a draft no one has
 * reviewed yet must not add goals to the library). Interventions and
 * barriers live in the template, so new ones are fine.
 * `options.reference`: an existing template to base the draft on
 * (buildTemplateReference).
 * `options.scope`: answer as a protocol's scope (TEMPLATE_SCOPE_SCHEMA): true,
 * or a reviewer's edits to follow (buildScopeRequest).
 */
export function buildTemplateDraftPrompt(description, catalog, protocol = null, options = {}) {
  const labs = LAB_CATALOG.map(l => `${l.key} = ${l.label} (${l.unit})`).join('; ');
  const scope = options.scope;
  const maxCategories = scope ? MAX_SCOPE_CATEGORIES : MAX_CATEGORIES;
  const categoryLines = options.categories ? [
    '',
    'Categories:',
    '- goals are the Common section: what every patient the protocol covers gets, at any severity.',
    `- When the protocol grades patients on one of the labs below (blood pressure stages, A1C bands, eGFR stages, LDL ranges) and the grades get different actions, monitoring, cadence, medication review or escalation, make one category per grade that changes care, up to ${maxCategories}: cover every such grade from the most severe (urgent escalation) down, grouping grades that get the same care.`,
    `- Each category: a short name a care manager recognizes (e.g. "SBP 140 or above", "A1C 9% or above"), its entry criteria, and 1 to ${MAX_CATEGORY_GOALS} goals with what differs for those patients. A category may repeat a Common goal to attach that grade's own interventions (more frequent readings, titration review, escalation); list only what the grade adds.`,
    `- A criterion is either { type: "lab", lab, op, value, withinDays } using only these labs: ${labs}; op one of ${NUMERIC_OPS.join(' ')}; withinDays from the protocol's recheck cadence (e.g. 180), or null; or { type: "condition", condition } naming a chronic condition. Set the fields a criterion does not use to null. Nothing else can be checked (no diastolic pressure, symptoms or risk scores), so name each category only by the criteria you give it.`,
    '- Order categories most severe first: a patient gets the first category they match, so a later one may use a broader threshold (">= 7" after ">= 9").',
    scope
      ? '- When the protocol instead grades patients by something those labs cannot check (time since onset, red flags, risk level), still make a category per grade that changes care, with an empty criteria list: the care team assigns those patients.'
      : '- Return no categories only when the protocol has no graded thresholds on those labs.',
  ] : [];
  const editedScope = scope && typeof scope === 'object' ? scope : null;
  const scopeLines = scope ? [
    '',
    'Scope (a plain-language plan care managers and nurses read before anything is created):',
    `- overview: 2 to 4 short sentences on what the protocol asks the care team to do, in everyday words, no abbreviations a nurse would not know. At most ${SCOPE_TEXT_MAX} characters.`,
    '- goals (Common) are only what every patient gets whatever their grade, 2 to 4 of them. commonExplanation: one sentence naming them in order ("Every patient: goal 1 is ..., goal 2 is ...").',
    '- In a scope each category is that grade\'s whole plan, not just what it adds: 2 to 4 goals in the order the care team works through them (for example lifestyle change, then a lab test, then medication if needed, then escalation). Use different goals per grade where the protocol\'s care differs, and attach that grade\'s own interventions (cadence, labs, titration, escalation) and barriers to them.',
    '- Every category must differ from Common and from the other categories: give it the protocol\'s steps specific to that grade (its check-in or measurement cadence, labs, medication step, referral, escalation, timing such as "after 2 weeks without improvement") as interventions, under goals Common does not have or repeated from Common with those extra interventions. A category identical to Common, or to another category, is useless; merge or drop it.',
    '- For each category, range: only the measured range or situation it covers, under 60 characters, with numbers and units exactly as the protocol states them (e.g. "Systolic BP 130–139 mmHg", "Pain for 4 to 12 weeks").',
    '- For each category, explanation: one or two sentences in the form "For <range>, goal 1 is ..., goal 2 is ..., goal 3 is ... if needed", naming exactly the goals you return for it, in the same order and no others, and saying when a step only applies sometimes. Plain words, e.g. "lifestyle change", "a lab test", "medication if needed".',
    ...(editedScope ? [
      '',
      'A reviewer edited the scope. Follow it exactly:',
      ...(editedScope.categories.length
        ? [`- Use exactly these categories, in this order, with these names and ranges; derive each one's criteria from its range. Where goals is a number, give that category exactly that many goals: ${JSON.stringify(editedScope.categories)}`]
        : ['- Return no categories.']),
      ...(editedScope.commonGoals != null ? [`- Give exactly ${editedScope.commonGoals} Common goals.`] : []),
    ] : []),
  ] : [];
  const reuseRule = options.libraryOnly
    ? '- Goals come from the library only: return a catalog goal\'s id as libraryId with its exact title, and leave out a goal the catalog has no entry for. For interventions and barriers, reuse a catalog entry with the same meaning (its id and exact title); when none fits, especially for the protocol\'s escalation and monitoring steps, return libraryId null and a short new title.'
    : '- Reuse the library. For every goal, intervention and barrier, first look for a catalog entry with the same meaning and return its id as libraryId with its exact title. Only when nothing in the catalog fits, return libraryId null and a short new title.';
  const protocolLines = protocol?.guidance ? [
    '',
    `Clinical protocol to follow: ${clip(protocol.title, 200)}${protocol.version ? ` v${clip(protocol.version, 20)}` : ''}${protocol.organization ? ` (${clip(protocol.organization, 120)})` : ''}. Approved by the organization; the template must agree with it.`,
    '- Base goals on its targets and thresholds, interventions on its monitoring, check-in cadence, escalation rules and titration steps, and barriers on what it says gets in the way.',
    '- Match goal frequency and intervention repeatEvery to its cadence where it gives one. Do not contradict it, and add nothing it does not support.',
    '- List the conditions it covers.',
    String(protocol.guidance).slice(0, 8000),
  ] : [];
  const reference = options.reference;
  const referenceLines = reference ? [
    '',
    `Reference template to base the draft on: ${reference.name || 'Untitled'}.`,
    '- Start from its goals, interventions and barriers: keep what fits the description, change or drop what does not, and add only what the description asks for.',
    JSON.stringify({ goals: reference.goals, interventions: reference.interventions, barriers: reference.barriers }),
  ] : [];
  return [
    'You draft care plan templates for Fold Health care managers. A supervisor reviews and edits every draft before it is published, so propose a sensible starting point, not a final plan.',
    '',
    'Rules:',
    reuseRule,
    `- 3 to ${MAX_GOALS} goals. Each goal: 1 to ${MAX_INTERVENTIONS_PER_GOAL} interventions that work toward it, and 0 to ${MAX_BARRIERS_PER_GOAL} barriers that commonly get in its way.`,
    '- Cadence: give every goal how often it is measured (frequency) and how long the template runs for it (duration + durationUnit). Give an intervention repeatEvery / repeatEveryUnit only when it recurs; otherwise null.',
    '- templateType is "chronic" when the description is about a specific chronic condition, then list those conditions by their common clinical names; otherwise "general" with no conditions.',
    `- name: at most ${CARE_PLAN_NAME_MAX} characters. summary: one plain sentence describing the plan's focus.`,
    `- Write titles in the style of the catalog: short, specific, sentence case. No dosing, diagnoses or clinical claims beyond the description${protocol?.guidance ? ' and the protocol' : ''}.`,
    ...protocolLines,
    ...referenceLines,
    ...categoryLines,
    ...scopeLines,
    '',
    'Library catalog (JSON):',
    JSON.stringify(catalog),
    '',
    'Template description from the user:',
    clip(description, TEMPLATE_DESCRIPTION_MAX),
  ].join('\n');
}

const indexCatalog = (entries = []) => ({
  byId: new Map(entries.map(e => [e.id, e])),
  byTitle: new Map(entries.map(e => [norm(e.title), e])),
});

// A model's library reference only counts if the id is in the catalog; a
// missing or invented id falls back to an exact title match, else it's new.
function resolveRef(ref, { byId, byTitle }) {
  const hit = byId.get(String(ref?.libraryId ?? '')) || byTitle.get(norm(ref?.title));
  return hit
    ? { libraryId: hit.id, title: hit.title }
    : { libraryId: null, title: clip(ref?.title, CARE_PLAN_TITLE_MAX) };
}

const positiveInt = (v, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
};

// Goals with their interventions and barriers, checked against the catalog.
// `seenGoals` drops a title already taken in the same section.
function normalizeGoals(list, index, { max, seenGoals, libraryOnly }) {
  const goals = [];
  for (const g of Array.isArray(list) ? list : []) {
    if (goals.length >= max) break;
    const ref = resolveRef(g, index.goals);
    if (!ref.title || seenGoals.has(norm(ref.title))) continue;
    // Only goals are held to the library: a new one would be added to it.
    if (libraryOnly && !ref.libraryId) continue;
    seenGoals.add(norm(ref.title));

    const seenItems = new Set();
    const interventions = [];
    for (const i of Array.isArray(g.interventions) ? g.interventions : []) {
      if (interventions.length >= MAX_INTERVENTIONS_PER_GOAL) break;
      const r = resolveRef(i, index.interventions);
      if (!r.title || seenItems.has(norm(r.title))) continue;
      seenItems.add(norm(r.title));
      const lib = r.libraryId ? index.interventions.byId.get(r.libraryId) : null;
      const repeatEvery = positiveInt(i.repeatEvery, 52);
      const repeatEveryUnit = oneOf(i.repeatEveryUnit, REPEAT_UNITS, null);
      interventions.push({
        ...r,
        kind: lib?.kind || oneOf(i.kind, INTERVENTION_KINDS, 'internal-task'),
        repeatEvery: repeatEvery && repeatEveryUnit ? repeatEvery : null,
        repeatEveryUnit: repeatEvery && repeatEveryUnit ? repeatEveryUnit : null,
      });
    }

    const barriers = [];
    for (const b of Array.isArray(g.barriers) ? g.barriers : []) {
      if (barriers.length >= MAX_BARRIERS_PER_GOAL) break;
      const r = resolveRef(b, index.barriers);
      if (!r.title || seenItems.has(norm(r.title))) continue;
      seenItems.add(norm(r.title));
      barriers.push(r);
    }

    const duration = positiveInt(g.duration, 36);
    goals.push({
      ...ref,
      description: clip(g.description, 300),
      category: oneOf(g.category, GOAL_CATEGORIES, 'Others'),
      priority: oneOf(norm(g.priority), PRIORITIES, 'medium'),
      frequency: oneOf(g.frequency, GOAL_FREQUENCIES, 'Monthly'),
      duration: duration ? String(duration) : '',
      durationUnit: duration ? oneOf(g.durationUnit, GOAL_DURATION_UNITS, 'Month') : '',
      interventions,
      barriers,
    });
  }
  return goals;
}

// A criterion the engine can evaluate, or null.
function normalizeCriterion(c) {
  if (c?.type === 'condition') {
    const value = clip(c.condition, 120);
    return value ? { type: 'condition', value } : null;
  }
  const value = Number(c?.value);
  if (!LAB_KEYS.includes(c?.lab) || !NUMERIC_OPS.includes(c?.op) || c?.value == null || !Number.isFinite(value)) return null;
  return { type: 'lab', lab: c.lab, op: c.op, value, withinDays: positiveInt(c.withinDays, 3650) };
}

const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * The model's answer, made safe for the editor: library ids checked against
 * the catalog, enums clamped, lengths and counts capped, empties and
 * duplicates dropped. Returns null when there are no goals.
 * `options.categories` keeps categories with valid criteria and their own
 * goals; `options.libraryOnly` drops goals not in the catalog;
 * `options.scope` keeps the scope's text and categories without criteria.
 */
export function normalizeTemplateDraft(raw, catalog, options = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const libraryOnly = !!options.libraryOnly;
  const index = {
    goals: indexCatalog(catalog.goals),
    interventions: indexCatalog(catalog.interventions),
    barriers: indexCatalog(catalog.barriers),
  };
  const scope = !!options.scope;
  const seenGoals = new Set();
  const goals = normalizeGoals(raw.goals, index, { max: MAX_GOALS, seenGoals, libraryOnly });
  // A scope may put every goal in its categories.
  if (!goals.length && !scope) return null;

  const categories = [];
  const names = new Set();
  for (const c of options.categories && Array.isArray(raw.categories) ? raw.categories : []) {
    if (categories.length >= (scope ? MAX_SCOPE_CATEGORIES : MAX_CATEGORIES)) break;
    const name = clip(c?.name, 80);
    if (!name || names.has(norm(name))) continue;
    const criteria = (Array.isArray(c.criteria) ? c.criteria : []).map(normalizeCriterion).filter(Boolean).slice(0, 4);
    // Categories may share a goal, or repeat a Common one to add its own
    // interventions; what Common already has is dropped when it's mapped.
    const catGoals = normalizeGoals(c.goals, index, { max: MAX_CATEGORY_GOALS, seenGoals: new Set(), libraryOnly });
    // In a scope a category the labs can't check stays, for the care team to assign.
    if ((!criteria.length && !scope) || !catGoals.length) continue;
    names.add(norm(name));
    categories.push({
      id: `cat-${categories.length + 1}-${slug(name)}`, name, match: 'all', criteria, goals: catGoals,
      ...(scope ? { range: clip(c.range, 200), explanation: clip(c.explanation, SCOPE_TEXT_MAX) } : {}),
    });
  }
  if (!goals.length && !categories.length) return null;

  const templateType = raw.templateType === 'chronic' ? 'chronic' : 'general';
  const conditions = templateType === 'chronic'
    ? [...new Set((Array.isArray(raw.conditions) ? raw.conditions : []).map(c => clip(c, 120)).filter(Boolean))].slice(0, 6)
    : [];
  return {
    name: clip(raw.name, CARE_PLAN_NAME_MAX),
    summary: clip(raw.summary, 400),
    templateType,
    conditions,
    goals,
    categories,
    ...(scope ? { overview: clip(raw.overview, SCOPE_TEXT_MAX), commonExplanation: clip(raw.commonExplanation, SCOPE_TEXT_MAX) } : {}),
  };
}
