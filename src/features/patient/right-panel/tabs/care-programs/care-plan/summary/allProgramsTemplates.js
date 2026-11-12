// The templates on the All Programs care plan: every open program's applied
// templates in one strip, and which goals, interventions and barriers each
// one put there, so picking a template narrows the combined plan to its items.

const RANK = { high: 0, medium: 1, low: 2 };
const norm = (s) => (s || '').trim().toLowerCase();
const rankOf = (p) => RANK[norm(p) || 'medium'] ?? 1;

/**
 * Templates applied across the programs' plans, highest priority first (a
 * template on two plans takes its higher priority), then in the order the
 * plans list them. Each carries the codes of the programs it is on.
 */
export function appliedTemplatesAcross(programs, patientCarePlans, patientId, templates) {
  const byId = new Map();
  let order = 0;
  for (const program of programs) {
    const plan = patientCarePlans[`${patientId}::${program.id}`]?.plan;
    if (!plan) continue;
    const priorities = plan.appliedTemplatePriorities || {};
    for (const id of plan.appliedTemplateIds || []) {
      const template = templates.find(t => String(t.id) === String(id));
      if (!template) continue;
      const priority = norm(priorities[id]) || 'medium';
      const seen = byId.get(String(id));
      if (seen) {
        if (!seen.programCodes.includes(program.code)) seen.programCodes.push(program.code);
        if (rankOf(priority) < rankOf(seen.priority)) seen.priority = priority;
      } else {
        byId.set(String(id), { template, priority, programCodes: [program.code], order: order++ });
      }
    }
  }
  return [...byId.values()].sort((a, b) => (rankOf(a.priority) - rankOf(b.priority)) || (a.order - b.order));
}

/**
 * Titles of a template's goals, interventions and barriers (a goal kept as a
 * library reference takes the library goal's title), as the per-program plan
 * matches them.
 */
export function templateItemTitles(template, libraryGoals = []) {
  const titles = (list, lookup) => new Set((list || []).map((e) => {
    const lib = lookup && e?.id ? lookup.find(g => g.id === e.id) : null;
    return norm(lib?.title || e?.title || '');
  }).filter(Boolean));
  return {
    goals: titles(template?.goals, libraryGoals),
    interventions: titles(template?.interventions),
    barriers: titles(template?.barriers),
  };
}
