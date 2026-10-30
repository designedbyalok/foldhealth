// A `template` audit row carries what it brought to the plan as JSON in
// `detail`, written at sign time by signCarePlan. Goals hold the interventions
// and barriers linked to them; anything hanging off no template goal sits in
// the top-level lists. Rows written before the linkage existed stored goals as
// plain titles, so both shapes are normalised here. Parsing is guarded so a
// hand-edited or legacy row degrades to an empty template rather than breaking
// History.
// Template rows that renew a run already on the plan rather than add or
// remove one. Their detail is a sentence, not the template's contents.
// Episode rows (lib/episodeTemplates) are the same kind of sentence.
export const TEMPLATE_RENEWAL_ACTIVITY = {
  extended: 'Extended',
  reinstated: 'Reinstated',
  episode_started: 'Episode Started',
  episode_extended: 'Episode End Date Changed',
  episode_ended: 'Episode Ended',
};
export const isTemplateRenewal = row => !!TEMPLATE_RENEWAL_ACTIVITY[row?.action];

export function templateContents(row) {
  let parsed;
  try {
    parsed = JSON.parse(row?.detail || '{}');
  } catch {
    parsed = {};
  }
  return {
    goals: (parsed.goals || []).map(g => (typeof g === 'string'
      ? { title: g, interventions: [], barriers: [] }
      : { title: g.title, interventions: g.interventions || [], barriers: g.barriers || [] })),
    interventions: parsed.interventions || [],
    barriers: parsed.barriers || [],
  };
}

// Every title a template accounts for, linked or not.
export function templateTitles(row) {
  const c = templateContents(row);
  return {
    goal: c.goals.map(g => g.title),
    intervention: [...c.interventions, ...c.goals.flatMap(g => g.interventions)],
    barrier: [...c.barriers, ...c.goals.flatMap(g => g.barriers)],
  };
}

// Titles a version's template rows account for, so the same items are not also
// counted as loose additions.
export function templateOwnedTitles(templateRows) {
  const owned = new Set();
  for (const row of templateRows) {
    const titles = templateTitles(row);
    for (const title of [...titles.goal, ...titles.intervention, ...titles.barrier]) {
      owned.add((title || '').trim().toLowerCase());
    }
  }
  return owned;
}

const norm = v => (v || '').trim().toLowerCase();

/**
 * Fill in linkage for template rows written before it was recorded.
 *
 * The library goal is the real source: a template's goal points at a library
 * goal whose own links carry the interventions and barriers that belong to it.
 * Interventions applied from a template land on the plan with no `goal_id`, so
 * the plan can only be used as a second guess. Either way this is a live read,
 * reflecting things as they stand rather than as they were signed, and it is
 * only used when the row itself carries no linkage.
 */
export function withLiveLinks(contents, { plan, libraryGoals } = {}) {
  const hasRecorded = contents.goals.some(g => g.interventions.length || g.barriers.length);
  if (hasRecorded) return contents;

  const ownIntv = new Set(contents.interventions.map(norm));
  const ownBarriers = new Set(contents.barriers.map(norm));
  const linkedIntv = new Set();
  const linkedBarriers = new Set();

  // When the row recorded a list, the links are narrowed to it. When it
  // recorded none — older rows carry no barriers at all — the library goal's
  // links stand on their own, since those links are what the template applied.
  const keep = (recorded) => (title) => recorded.size === 0 || recorded.has(norm(title));
  const keepIntv = keep(ownIntv);
  const keepBarrier = keep(ownBarriers);

  const fromLibrary = (goalTitle) => {
    const lib = (libraryGoals || []).find(g => norm(g.title) === norm(goalTitle));
    const links = lib?.interventions || [];
    return {
      interventions: links.filter(l => l.kind !== 'barrier' && keepIntv(l.title)).map(l => l.title),
      barriers: links.filter(l => l.kind === 'barrier' && keepBarrier(l.title)).map(l => l.title),
    };
  };

  const fromPlan = (goalTitle) => {
    const match = (plan?.goals || []).find(pg => norm(pg.title) === norm(goalTitle));
    if (!match) return { interventions: [], barriers: [] };
    const barrierGoals = b => (b.goalIds?.length ? b.goalIds : [b.goalId]).filter(Boolean);
    return {
      interventions: (plan?.interventions || [])
        .filter(i => i.goalId === match.id && ownIntv.has(norm(i.title)))
        .map(i => i.title),
      barriers: (plan?.barriers || [])
        .filter(b => barrierGoals(b).includes(match.id) && ownBarriers.has(norm(b.title)))
        .map(b => b.title),
    };
  };

  const goals = contents.goals.map((g) => {
    const lib = fromLibrary(g.title);
    const found = (lib.interventions.length || lib.barriers.length) ? lib : fromPlan(g.title);
    found.interventions.forEach(t => linkedIntv.add(norm(t)));
    found.barriers.forEach(t => linkedBarriers.add(norm(t)));
    return { ...g, interventions: found.interventions, barriers: found.barriers };
  });

  return {
    goals,
    interventions: contents.interventions.filter(t => !linkedIntv.has(norm(t))),
    barriers: contents.barriers.filter(t => !linkedBarriers.has(norm(t))),
  };
}
