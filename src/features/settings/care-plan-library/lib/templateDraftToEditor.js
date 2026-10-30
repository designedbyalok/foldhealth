import { apiFetch } from '../../../../lib/apiFetch';

const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * Ask the server for a draft (see api/_handlers/care-plan-template-draft.js).
 * `protocol` (optional): { title, version, organization, guidance } the draft must follow.
 * `options`: { categories, libraryOnly } (see buildTemplateDraftPrompt).
 */
export async function requestTemplateDraft(description, catalog, protocol = null, options = null) {
  const res = await apiFetch('/api/care-plan-template-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, catalog, ...(protocol ? { protocol } : {}), ...(options ? { options } : {}) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.draft) {
    throw new Error(json?.error?.message || 'Could not draft the template. Please try again.');
  }
  return json.draft;
}

/**
 * A normalized draft as the New Template editor's three lists. A library
 * goal comes in as itself, bringing its own links, exactly as when it's
 * picked by hand; its library cadence stands. A goal the library doesn't
 * have is held with `aiNew` and its suggested links, and is created in the
 * library on save (materializeNewGoals) so the template applies with its
 * cadence. New goals carry no target value: a reviewer adds one if wanted.
 * Interventions and barriers are template entries either way.
 */
export function templateDraftToEditor(draft, { libraryGoals = [], interventionLibrary = [], barrierLibrary = [] }) {
  let n = 0;
  const stamp = Date.now().toString(36);
  const nextId = (prefix) => `ai-${prefix}-${stamp}-${n++}`;
  const goals = [];
  const interventions = [];
  const barriers = [];
  const addUnique = (list, item) => {
    if (!list.some(e => norm(e.title) === norm(item.title))) list.push(item);
  };

  const interventionEntry = (i) => {
    const lib = i.libraryId ? interventionLibrary.find(x => String(x.id) === i.libraryId) : null;
    const repeat = i.repeatEvery
      ? { repeat: true, repeatEvery: String(i.repeatEvery), repeatEveryUnit: i.repeatEveryUnit }
      : {};
    return lib
      ? { id: lib.id, title: lib.title, kind: lib.kind, config: { ...(lib.config || {}), ...repeat } }
      : { id: nextId('intv'), title: i.title, kind: i.kind, config: repeat, aiNew: true };
  };
  const barrierEntry = (b) => {
    const lib = b.libraryId ? barrierLibrary.find(x => String(x.id) === b.libraryId) : null;
    return lib ? { id: lib.id, title: lib.title } : { id: nextId('barrier'), title: b.title, aiNew: true };
  };

  for (const g of draft.goals || []) {
    const lib = g.libraryId ? libraryGoals.find(x => String(x.id) === g.libraryId) : null;
    const ivs = g.interventions.map(interventionEntry);
    const brs = g.barriers.map(barrierEntry);
    if (lib) {
      goals.push(lib);
      for (const l of lib.interventions || []) {
        if (l.kind === 'barrier') addUnique(barriers, { id: l.id, title: l.title });
        else addUnique(interventions, { id: l.id, title: l.title, kind: l.kind });
      }
    } else {
      goals.push({
        id: nextId('goal'),
        title: g.title,
        description: g.description,
        category: g.category,
        priority: g.priority,
        frequency: g.frequency,
        duration: g.duration,
        durationUnit: g.durationUnit,
        conditions: draft.conditions || [],
        setTarget: false,
        // The library stores a goal's barriers among its links, kind 'barrier'.
        interventions: [
          ...ivs.map(i => ({ kind: i.kind, title: i.title, config: i.config || {} })),
          ...brs.map(b => ({ kind: 'barrier', title: b.title, config: {} })),
        ],
        aiNew: true,
      });
    }
    ivs.forEach(i => addUnique(interventions, i));
    brs.forEach(b => addUnique(barriers, b));
  }
  return { goals, interventions, barriers };
}

/**
 * A whole draft as template content: its goals as Common and each category's
 * own lists, without anything Common already has (a patient gets Common +
 * one category). A category has to add a goal or an intervention; one that
 * would only add barriers is left out.
 */
export function templateDraftToTemplate(draft, libraries) {
  const common = templateDraftToEditor(draft, libraries);
  const inCommon = Object.fromEntries(['goals', 'interventions', 'barriers']
    .map(k => [k, new Set(common[k].map(x => norm(x.title)))]));
  const categories = (draft.categories || []).map((c) => {
    const lists = templateDraftToEditor({ goals: c.goals, conditions: draft.conditions }, libraries);
    const own = k => lists[k].filter(x => !inCommon[k].has(norm(x.title)));
    return {
      id: c.id, name: c.name, match: c.match || 'all', criteria: c.criteria,
      goals: own('goals'), interventions: own('interventions'), barriers: own('barriers'),
    };
  }).filter(c => c.goals.length + c.interventions.length > 0);
  return { ...common, categories };
}

/** How much of a draft came from the library, for the review banner. */
export function draftProvenance({ goals, interventions, barriers }) {
  const all = [...goals, ...interventions, ...barriers];
  const fresh = all.filter(x => x.aiNew).length;
  return {
    goals: goals.length,
    interventions: interventions.length,
    barriers: barriers.length,
    fromLibrary: all.length - fresh,
    fresh,
  };
}

/**
 * Before a save: create each AI-suggested goal in the library and swap in the
 * saved goal, so the template references real library goals. Returns the
 * goal list, or null if any goal failed to save (the store has toasted).
 */
export async function materializeNewGoals(goals, saveCarePlanGoal) {
  const out = [];
  for (const g of goals) {
    if (!g.aiNew) { out.push(g); continue; }
    const { id: _tempId, aiNew: _flag, ...values } = g;
    const saved = await saveCarePlanGoal(values);
    if (!saved) return null;
    out.push(saved);
  }
  return out;
}

/** Template entries without the editor-only `aiNew` marker. */
export const withoutDraftMarks = (list) => list.map(item => Object.fromEntries(
  Object.entries(item).filter(([k]) => k !== 'aiNew'),
));
