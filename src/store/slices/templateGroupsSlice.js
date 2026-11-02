import { supabase } from '../../lib/supabase';
import { carePlanKey } from '../lib/carePlanStoreLib';
import { groupMembersToApply, mapTemplateGroupRow, membersChanged, recordGroup } from '../../features/settings/care-plan-library/lib/templateGroups';
import { hasCategories, matchCategory } from '../../features/settings/care-plan-library/lib/templateCategories';

const isMissingTable = error => error?.code === '42P01' || error?.code === 'PGRST205';

/**
 * Template groups (care_plan_template_groups migration): supervisors keep
 * named bundles of templates in Care Plan Library > Template Groups; a care
 * manager applies one to a plan in a click. Changing a group's members is a
 * new version (care_plan_template_group_versions); the plan records the group
 * and version it used (patient_care_plans.applied_template_groups).
 */
export const createTemplateGroupsSlice = (set, get) => {
  const patchPlanGroups = (key, groups) => set((s) => {
    const c = s.patientCarePlans[key];
    return c?.plan ? { patientCarePlans: { ...s.patientCarePlans, [key]: { ...c, plan: { ...c.plan, appliedTemplateGroups: groups } } } } : {};
  });
  const writePlanGroups = async (planId, groups) => {
    const { error } = await supabase.from('patient_care_plans').update({ applied_template_groups: groups }).eq('id', planId);
    // Before the migration the plan just doesn't remember the group.
    if (error) console.warn('applied_template_groups:', error.message);
  };

  return {
    templateGroups: [],
    templateGroupsLoading: false,
    templateGroupsDidFetch: false,
    // True when the migration hasn't run (the tab says so).
    templateGroupsMissing: false,

    fetchTemplateGroups: async ({ force = false } = {}) => {
      if (get().templateGroupsLoading || (get().templateGroupsDidFetch && !force)) return;
      set({ templateGroupsLoading: true });
      const { data, error } = await supabase.from('care_plan_template_groups').select('*').order('name');
      if (error) {
        if (!isMissingTable(error)) console.warn('fetchTemplateGroups:', error.message);
        set({ templateGroups: [], templateGroupsLoading: false, templateGroupsDidFetch: true, templateGroupsMissing: isMissingTable(error) });
        return;
      }
      set({ templateGroups: (data || []).map(mapTemplateGroupRow), templateGroupsLoading: false, templateGroupsDidFetch: true, templateGroupsMissing: false });
    },

    /**
     * Create a group, or update one. A change to its members makes a new
     * version with a snapshot of them; a new name or description doesn't.
     */
    saveTemplateGroup: async ({ name, description = '', templateIds }, id = null) => {
      const actor = get().currentActorName?.() || null;
      const now = new Date().toISOString();
      const cur = id ? get().templateGroups.find(g => g.id === id) : null;
      const newVersion = !cur || membersChanged(cur.templateIds, templateIds);
      const versionNumber = cur ? cur.versionNumber + (newVersion ? 1 : 0) : 1;
      const row = {
        name: name.trim(), description: description.trim() || null, template_ids: templateIds,
        version_number: versionNumber, updated_by: actor, updated_at: now,
      };
      const { data, error } = await (id
        ? supabase.from('care_plan_template_groups').update(row).eq('id', id)
        : supabase.from('care_plan_template_groups').insert({ ...row, created_by: actor })
      ).select().single();
      if (error) {
        console.warn('saveTemplateGroup:', error.message);
        get().showToast?.('Could not save the template group');
        return null;
      }
      if (newVersion) {
        const { error: vErr } = await supabase.from('care_plan_template_group_versions').insert({
          group_id: data.id, version_number: versionNumber, template_ids: templateIds, published_by: actor,
        });
        if (vErr) console.warn('saveTemplateGroup (version):', vErr.message);
      }
      const saved = mapTemplateGroupRow(data);
      set(s => ({ templateGroups: [...s.templateGroups.filter(g => g.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)) }));
      return saved;
    },

    deleteTemplateGroup: async (id) => {
      const { error } = await supabase.from('care_plan_template_groups').delete().eq('id', id);
      if (error) {
        console.warn('deleteTemplateGroup:', error.message);
        get().showToast?.('Could not delete the template group');
        return false;
      }
      set(s => ({ templateGroups: s.templateGroups.filter(g => g.id !== id) }));
      return true;
    },

    /**
     * Apply a group to a patient's plan in one click: its members not on the
     * plan yet (retired and draft ones skipped), each with the category the
     * patient's latest results match (Common when none), at default priority.
     * Then the plan's duplicate check runs. `onlyIds` applies just those
     * members (the ones a newer version added). Returns the outcome, or null.
     */
    applyTemplateGroup: async (patientId, program, groupId, { onlyIds = null } = {}) => {
      const group = get().templateGroups.find(g => g.id === groupId);
      const key = carePlanKey(patientId, program.id);
      if (!group) return null;
      if (!get().carePlanLibraryDidFetch) await get().fetchCarePlanLibrary();
      const templates = get().carePlanTemplates || [];
      const prev = get().patientCarePlans[key]?.plan?.appliedTemplateIds || [];
      const { toAdd, skipped } = groupMembersToApply(group, templates, prev, onlyIds);

      if (toAdd.length) {
        const byId = new Map(templates.map(t => [String(t.id), t]));
        const withCategories = toAdd.map(id => byId.get(id)).filter(hasCategories);
        const inputs = withCategories.length ? await get().fetchPatientCriteriaInputs(patientId) : null;
        const categoryPicks = Object.fromEntries(withCategories
          .map(t => [String(t.id), inputs ? matchCategory(t, inputs).category?.id || null : null]));
        const ok = await get().applyPatientCarePlanTemplates(patientId, program, [...prev, ...toAdd], {}, categoryPicks, { quiet: true });
        if (!ok) return null;
      }

      const plan = get().patientCarePlans[key]?.plan;
      if (plan?.id) {
        const groups = recordGroup(plan.appliedTemplateGroups, group, { appliedBy: get().currentActorName?.() || '' });
        patchPlanGroups(key, groups);
        await writePlanGroups(plan.id, groups);
      }
      const duplicates = toAdd.length ? await get().refreshCarePlanDuplicates?.(patientId, program) : 0;
      const parts = [
        toAdd.length ? `Applied "${group.name}": ${toAdd.length} template${toAdd.length === 1 ? '' : 's'} added` : `"${group.name}" is already on this plan`,
        skipped.some(s => s.reason === 'retired') ? `${skipped.filter(s => s.reason === 'retired').length} retired skipped` : '',
        duplicates ? `${duplicates} possible duplicate${duplicates === 1 ? '' : 's'} to review` : '',
      ].filter(Boolean);
      get().showToast?.(parts.join('. '));
      return { added: toAdd, skipped, duplicates: duplicates || 0 };
    },

    // The care team declined what a newer group version added: not offered again
    // until the group changes once more.
    dismissTemplateGroupUpdate: async (patientId, program, groupId, versionNumber) => {
      const key = carePlanKey(patientId, program.id);
      const plan = get().patientCarePlans[key]?.plan;
      if (!plan?.id) return;
      const groups = (plan.appliedTemplateGroups || []).map(g => (String(g.groupId) === String(groupId) ? { ...g, dismissedVersion: versionNumber } : g));
      patchPlanGroups(key, groups);
      await writePlanGroups(plan.id, groups);
    },
  };
};
