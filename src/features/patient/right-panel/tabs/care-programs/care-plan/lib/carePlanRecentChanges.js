/**
 * "Recent changes only" for a care plan print: the goals, interventions and
 * barriers added, changed or removed in a version compared with the version
 * before it, each tagged for the PDF ("New", "Changed: Target, Duration",
 * "Removed"). Removed items come from the older snapshot so they can print.
 */
import { diffCarePlanSnapshots } from './carePlanDraft';

const LISTS = { goal: 'goals', intervention: 'interventions', barrier: 'barriers' };
const norm = t => String(t || '').trim().toLowerCase();

function tagFor(change) {
  if (change.action === 'added') return 'New';
  if (change.action === 'removed') return 'Removed';
  const labels = (change.fields || []).map(f => f.label).filter(Boolean);
  return labels.length ? `Changed: ${labels.join(', ')}` : 'Changed';
}

/**
 * @param {{goals, interventions, barriers, conditions}} selection  what would print
 * @param {object|null} before  the previous version's snapshot; null when this is the first
 * @param {object} after        this version's snapshot (or the live draft's)
 * @returns the selection narrowed to changed items, each with `changeTag`
 */
export function onlyRecentChanges(selection, before, after) {
  if (!before) {
    // Nothing earlier to compare with: everything on the plan is new.
    const tag = list => (list || []).map(x => ({ ...x, changeTag: 'New' }));
    return { ...selection, goals: tag(selection.goals), interventions: tag(selection.interventions), barriers: tag(selection.barriers) };
  }
  const { changes } = diffCarePlanSnapshots(before, after);
  const byKey = new Map(changes.filter(c => LISTS[c.entityType]).map(c => [`${c.entityType}:${c.entityId}`, c]));

  // A template removed and applied again recreates its items with new ids,
  // which the diff sees as removed + added. Items of one type with the same
  // title are the same item: unchanged ones drop out, the rest read Changed.
  const goalIdMap = new Map(); // old goal id → new goal id, for links
  const compare = (type, oldItem, newItem) => {
    const remapped = { ...oldItem, id: newItem.id };
    if (type === 'intervention') remapped.goalId = goalIdMap.get(String(oldItem.goalId)) || oldItem.goalId;
    if (type === 'barrier') remapped.goalIds = (oldItem.goalIds || []).map(id => goalIdMap.get(String(id)) || id);
    const mini = list => ({ ...before, conditions: [], appliedTemplateIds: [], appliedTemplatePriorities: {}, goals: [], interventions: [], barriers: [], [LISTS[type]]: list });
    return diffCarePlanSnapshots(mini([remapped]), mini([newItem])).changes[0] || null;
  };
  for (const type of ['goal', 'intervention', 'barrier']) {
    const removedByTitle = new Map((before[LISTS[type]] || [])
      .filter(x => byKey.get(`${type}:${x.id}`)?.action === 'removed')
      .map(x => [norm(x.title), x]));
    for (const added of after[LISTS[type]] || []) {
      if (byKey.get(`${type}:${added.id}`)?.action !== 'added') continue;
      const old = removedByTitle.get(norm(added.title));
      if (!old) continue;
      if (type === 'goal') goalIdMap.set(String(old.id), added.id);
      const diff = compare(type, old, added);
      byKey.delete(`${type}:${old.id}`);
      if (diff) byKey.set(`${type}:${added.id}`, diff);
      else byKey.delete(`${type}:${added.id}`);
    }
  }

  const pick = (type) => {
    const kept = (selection[LISTS[type]] || [])
      .filter(x => byKey.has(`${type}:${x.id}`))
      .map(x => ({ ...x, changeTag: tagFor(byKey.get(`${type}:${x.id}`)) }));
    const removed = (before[LISTS[type]] || [])
      .filter(x => byKey.get(`${type}:${x.id}`)?.action === 'removed')
      .map(x => ({ ...x, changeTag: 'Removed' }));
    return [...kept, ...removed];
  };
  return { ...selection, goals: pick('goal'), interventions: pick('intervention'), barriers: pick('barrier') };
}
