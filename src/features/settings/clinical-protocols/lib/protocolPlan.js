/* A protocol's scope: the plain-language plan built from it on upload, kept
   at protocol.plan (clinical_protocols.protocol). It is a care plan template
   draft (lib/aiTemplateDraft.js, options.scope) with an overview for care
   managers and nurses, Common goals, and categories (BP stages, A1C bands,
   pain phases) each with its range, explanation and goals; every goal
   carries its interventions and barriers. The reviewer edits categories,
   ranges and goal counts and redrafts, and can add or remove a section's
   goals, interventions and barriers by hand: that section then keeps
   `lists` ({ goals, interventions, barriers }, the template editor's
   entries) which approval takes as they are. Nothing is created until the
   protocol is approved, when the plan becomes the linked care plan template.
   Plain JS, no React. */

const norm = (s) => String(s ?? '').trim().toLowerCase();
const list = (v) => (Array.isArray(v) ? v : []);

export const planOf = (protocol) => {
  const plan = protocol?.plan;
  return plan && typeof plan === 'object' && (list(plan.goals).length || list(plan.categories).length) ? plan : null;
};

// One section's goal, intervention and barrier titles: its edited lists, else its drafted goals'.
function sectionTitles(section) {
  if (section?.lists) {
    const { goals, interventions, barriers } = section.lists;
    return { goals: list(goals), interventions: list(interventions), barriers: list(barriers) };
  }
  const goals = list(section?.goals);
  return { goals, interventions: goals.flatMap(g => list(g.interventions)), barriers: goals.flatMap(g => list(g.barriers)) };
}

/**
 * Distinct goals, interventions and barriers the plan would create (G / I / B):
 * Common (the plan itself) and every category. Pass `{ ...category, categories: [] }`
 * to count one category alone.
 */
export function planCounts(plan) {
  const sets = { goals: new Set(), interventions: new Set(), barriers: new Set() };
  for (const section of [plan, ...list(plan?.categories)]) {
    const t = sectionTitles(section);
    for (const k of Object.keys(sets)) t[k].forEach(x => sets[k].add(norm(x.title)));
  }
  return { goals: sets.goals.size, interventions: sets.interventions.size, barriers: sets.barriers.size };
}

/** How many goals the reviewer asked for in a section (Common or a category). */
export const goalTarget = (section) => (Number.isInteger(section?.goalCount) ? section.goalCount : list(section?.goals).length);

/**
 * The reviewer's edits as a redraft request (buildScopeRequest's shape):
 * every category's name, range and goal count, and the Common goal count.
 */
export function planScopeRequest(plan) {
  return {
    categories: list(plan?.categories).map(c => ({ name: c.name, range: c.range || '', goals: goalTarget(c) })),
    commonGoals: goalTarget({ goals: plan?.goals, goalCount: plan?.commonGoalCount }),
  };
}

/** The key of the Common section in the review's scope list; categories use their ids. */
export const COMMON = 'common';

/** Common (`COMMON`) or one category, as { name, range, explanation, goals, category }, or null. */
export function planSection(plan, key) {
  if (!plan || !key) return null;
  if (key === COMMON) {
    return { name: 'Every patient', range: 'Whatever their category', explanation: plan.commonExplanation, goals: list(plan.goals), lists: plan.lists || null, category: null };
  }
  const category = list(plan.categories).find(c => c.id === key);
  return category ? { name: category.name || 'Untitled category', range: category.range, explanation: category.explanation, goals: list(category.goals), lists: category.lists || null, category } : null;
}

/** The plan with one section's fields patched (COMMON patches the plan itself). */
export function patchPlanSection(plan, key, patch) {
  if (key === COMMON) return { ...plan, ...patch };
  return { ...plan, categories: list(plan.categories).map(c => (c.id === key ? { ...c, ...patch } : c)) };
}

let seq = 0;
/** A category the reviewer adds; it gets goals on the next redraft. */
export function newPlanCategory() {
  seq += 1;
  return { id: `cat-new-${Date.now().toString(36)}-${seq}`, name: '', range: '', explanation: '', match: 'all', criteria: [], goals: [], goalCount: 2 };
}
