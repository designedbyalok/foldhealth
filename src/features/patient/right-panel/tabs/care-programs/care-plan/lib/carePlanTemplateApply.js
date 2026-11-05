/** Goal count shown on an applied-template badge. */
export function templateGoalCount(template) {
  return (template?.goals || []).length;
}

/** Build a patient-plan goal payload from a template goal entry. */
export function goalPayloadFromTemplateEntry(entry, libraryGoals = []) {
  const lib = libraryGoals.find(g => g.id === entry?.id);
  if (lib) {
    return {
      title: lib.title,
      subtitle: lib.description || entry.subtitle || '',
      category: lib.category || '',
      priority: lib.priority || 'medium',
      icon: 'solar:flag-linear',
      status: 'Not Started',
      measure: lib.measure || '',
      conditions: lib.conditions || [],
      comparator: lib.comparator || '=',
      targetValue: lib.targetValue || '',
      targetValue2: lib.targetValue2 || '',
      customUnit: lib.customUnit || '',
      setTarget: lib.setTarget !== false,
      duration: lib.duration || '',
      durationUnit: lib.durationUnit || '',
      frequency: lib.frequency || '',
      targetDate: lib.targetDate || '',
      // An IPA overlay's priority, cadence and wording win over the library's.
      ...(entry?.overlay || {}),
    };
  }
  return {
    title: entry?.title || '',
    subtitle: entry?.subtitle || '',
    category: entry?.category || '',
    priority: entry?.priority || 'medium',
    icon: 'solar:flag-linear',
    status: 'Not Started',
    ...(entry?.frequency ? { frequency: entry.frequency } : {}),
    ...(entry?.duration ? { duration: entry.duration, durationUnit: entry.durationUnit || '' } : {}),
    ...(entry?.overlay || {}),
  };
}

/**
 * Build a patient-plan intervention payload from a template intervention entry.
 *
 * `goalId` is the plan goal this intervention serves, resolved by the caller.
 * Without it the intervention lands on the plan unlinked, which is what the
 * table, the cascade on goal removal, and version history all read.
 */
export function interventionPayloadFromTemplateEntry(entry, goalId = null) {
  return {
    kind: entry?.kind || 'internal-task',
    goalId,
    title: entry?.title || '',
    icon: 'solar:clipboard-list-linear',
    duration: entry?.duration || null,
    priority: (() => {
      const p = String(entry?.config?.priority || entry?.priority || 'medium').toLowerCase();
      return p === 'high' || p === 'low' ? p : 'medium';
    })(),
    config: entry?.config || {},
    status: 'Not Started',
    assignee: { name: 'Unassigned', initials: '' },
    ...(entry?.overlay?.patientTitle ? { patientTitle: entry.overlay.patientTitle } : {}),
  };
}

/**
 * Build a patient-plan barrier payload from a template barrier entry.
 *
 * `goalIds` is the set of plan goals this barrier belongs to, resolved by the
 * caller; an empty set adds the barrier unlinked rather than dropping it.
 */
export function barrierPayloadFromTemplateEntry(entry, goalIds = []) {
  return {
    title: entry?.title || '',
    description: entry?.description || '',
    priority: entry?.priority || 'medium',
    status: 'Not Started',
    goalIds,
    ...(entry?.overlay?.patientTitle ? { patientTitle: entry.overlay.patientTitle } : {}),
    // An SDOH need on the template stays one on the plan.
    ...(entry?.sdohDomain ? { sdohDomain: entry.sdohDomain, sdohNeed: entry.sdohNeed || null, zCode: entry.zCode || '' } : {}),
  };
}

const normTitle = v => (v || '').trim().toLowerCase();

/**
 * Which goals of a template own each of its interventions and barriers, keyed
 * by the linked item's title.
 *
 * A template goal entry points at a library goal, and that library goal's links
 * are what carry its interventions and barriers, so the ownership lives one hop
 * away in the library rather than on the template row itself. An imported
 * template names its own links instead (intervention.goalTitle,
 * barrier.goalTitles), and those win for the items they cover.
 */
export function templateLinkOwners(template, libraryGoals = []) {
  const owners = { intervention: new Map(), barrier: new Map() };
  // Links an imported template carries on its own items come first.
  for (const entry of template?.interventions || []) {
    if (entry?.goalTitle && normTitle(entry.title)) owners.intervention.set(normTitle(entry.title), [entry.goalTitle]);
  }
  for (const entry of template?.barriers || []) {
    if (entry?.goalTitles?.length && normTitle(entry.title)) owners.barrier.set(normTitle(entry.title), [...entry.goalTitles]);
  }
  for (const entry of template?.goals || []) {
    const lib = libraryGoals.find(g => g.id === entry?.id)
      || libraryGoals.find(g => normTitle(g.title) === normTitle(entry?.title));
    const goalTitle = lib?.title || entry?.title || '';
    if (!goalTitle) continue;
    for (const link of lib?.interventions || []) {
      const key = normTitle(link.title);
      if (!key) continue;
      const map = link.kind === 'barrier' ? owners.barrier : owners.intervention;
      const own = link.kind === 'barrier' ? template?.barriers : template?.interventions;
      if ((own || []).some(x => normTitle(x?.title) === key && (x.goalTitle || x.goalTitles?.length))) continue;
      const list = map.get(key) || [];
      if (!list.includes(goalTitle)) list.push(goalTitle);
      map.set(key, list);
    }
  }
  return owners;
}
