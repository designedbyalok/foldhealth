/* Template groups: a named bundle of care plan templates applied to a plan
   in one click (care_plan_template_groups migration). Groups are versioned
   on their own: changing the members is a new version. A plan records the
   group and version it used (patient_care_plans.applied_template_groups),
   so when the group gains members the plan can be offered them.
   Plain JS, no React. */

const RETIRED = 'archived';
const byId = (templates) => new Map((templates || []).map(t => [String(t.id), t]));

/** A group row → object. */
export function mapTemplateGroupRow(row) {
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    templateIds: (row.template_ids || []).map(String),
    versionNumber: row.version_number || 1,
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

/** Whether saving these members makes a new version (the set or order changed). */
export const membersChanged = (before, after) => (before || []).map(String).join('|') !== (after || []).map(String).join('|');

/**
 * What applying a group adds: its members not on the plan yet, in order,
 * skipping ones that are retired, drafts or no longer exist.
 * `onlyIds` limits it to some members (the ones a newer version added).
 */
export function groupMembersToApply(group, templates, appliedIds = [], onlyIds = null) {
  const index = byId(templates);
  const applied = new Set((appliedIds || []).map(String));
  const only = onlyIds ? new Set(onlyIds.map(String)) : null;
  const toAdd = [];
  const skipped = [];
  for (const id of group?.templateIds || []) {
    if (only && !only.has(id)) continue;
    const t = index.get(id);
    if (!t) skipped.push({ id, name: 'A deleted template', reason: 'missing' });
    else if (t.status === RETIRED) skipped.push({ id, name: t.name, reason: 'retired' });
    else if (t.status === 'draft') skipped.push({ id, name: t.name, reason: 'draft' });
    else if (applied.has(id)) skipped.push({ id, name: t.name, reason: 'already' });
    else toAdd.push(id);
  }
  return { toAdd, skipped };
}

/** The plan's record of a group it used: one entry per group, newest wins. */
export function recordGroup(planGroups, group, { appliedBy = '', now = new Date() } = {}) {
  const rest = (planGroups || []).filter(g => String(g.groupId) !== String(group.id));
  return [...rest, { groupId: group.id, versionNumber: group.versionNumber, appliedAt: now.toISOString(), appliedBy, dismissedVersion: null }];
}

/**
 * Groups a plan used that have gained members since: one entry per group,
 * { group, record, newIds } where newIds are members not on the plan (and
 * usable). A version the care team dismissed isn't offered again.
 */
export function groupUpdates(planGroups, groups, templates, appliedIds = []) {
  const groupsById = new Map((groups || []).map(g => [String(g.id), g]));
  const out = [];
  for (const record of planGroups || []) {
    const group = groupsById.get(String(record.groupId));
    if (!group || group.versionNumber <= (record.versionNumber || 0)) continue;
    if ((record.dismissedVersion || 0) >= group.versionNumber) continue;
    const { toAdd } = groupMembersToApply(group, templates, appliedIds);
    if (toAdd.length) out.push({ group, record, newIds: toAdd });
  }
  return out;
}
