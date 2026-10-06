/**
 * Builds the goals / interventions / barriers of a library template from a
 * patient's care plan, for "Save as Template".
 *
 * Plan items don't record which template they came from, so ownership is read
 * the same way the template filter chips read it: by normalized title. When an
 * item matches a template entry, that entry is copied as-is so its library id,
 * measure and config survive; re-applying a copy built from plan rows alone
 * would lose them.
 */

const norm = v => (v || '').trim().toLowerCase();

// A template is shared across patients, so who it's for, who owns it and any
// one-off due date stay behind on the patient's plan.
const PATIENT_ONLY_CONFIG_KEYS = ['member', 'assignedTo', 'assignee', 'dueDateOverride'];

function templateSafeConfig(config) {
  const out = { ...(config || {}) };
  for (const k of PATIENT_ONLY_CONFIG_KEYS) delete out[k];
  return out;
}

function goalEntryTitle(entry, libraryGoals) {
  const lib = entry?.id ? libraryGoals.find(g => g.id === entry.id) : null;
  return lib?.title || entry?.title || '';
}

/** The chosen template, trimmed to the items still on the patient's plan. */
export function templateContentFromApplied(plan, template, libraryGoals = []) {
  const goalTitles = new Set((plan?.goals || []).map(g => norm(g.title)));
  const intvTitles = new Set((plan?.interventions || []).map(i => norm(i.title)));
  const barrierTitles = new Set((plan?.barriers || []).map(b => norm(b.title)));
  return {
    goals: (template?.goals || []).filter(e => goalTitles.has(norm(goalEntryTitle(e, libraryGoals)))),
    interventions: (template?.interventions || []).filter(e => intvTitles.has(norm(e.title))),
    barriers: (template?.barriers || []).filter(e => barrierTitles.has(norm(e.title))),
  };
}

/**
 * Every item on the plan. Items that came from an applied template reuse its
 * entry; hand-added ones are built from the plan row, linking a goal to its
 * library goal when one has the same title.
 */
export function templateContentFromWholePlan(plan, appliedTemplates = [], libraryGoals = []) {
  const goalEntries = new Map();
  const intvEntries = new Map();
  const barrierEntries = new Map();
  for (const t of appliedTemplates) {
    for (const e of t?.goals || []) {
      const k = norm(goalEntryTitle(e, libraryGoals));
      if (k && !goalEntries.has(k)) goalEntries.set(k, e);
    }
    for (const e of t?.interventions || []) if (!intvEntries.has(norm(e.title))) intvEntries.set(norm(e.title), e);
    for (const e of t?.barriers || []) if (!barrierEntries.has(norm(e.title))) barrierEntries.set(norm(e.title), e);
  }

  const seen = new Set();
  const once = (prefix, title) => {
    const k = `${prefix}:${norm(title)}`;
    if (!norm(title) || seen.has(k)) return false;
    seen.add(k);
    return true;
  };

  const goals = (plan?.goals || []).filter(g => once('g', g.title)).map((g) => {
    const fromTemplate = goalEntries.get(norm(g.title));
    if (fromTemplate) return fromTemplate;
    const lib = libraryGoals.find(l => norm(l.title) === norm(g.title));
    return {
      ...(lib ? { id: lib.id } : {}),
      title: g.title,
      subtitle: g.subtitle || '',
      category: g.category || '',
      priority: g.priority || 'medium',
    };
  });
  const interventions = (plan?.interventions || []).filter(i => once('i', i.title)).map(i => (
    intvEntries.get(norm(i.title)) || {
      title: i.title,
      kind: i.kind || 'internal-task',
      ...(i.duration ? { duration: i.duration } : {}),
      config: templateSafeConfig(i.config),
    }
  ));
  const barriers = (plan?.barriers || []).filter(b => once('b', b.title)).map(b => (
    barrierEntries.get(norm(b.title)) || {
      title: b.title,
      description: b.description || '',
      priority: b.priority || 'medium',
    }
  ));
  return { goals, interventions, barriers };
}
