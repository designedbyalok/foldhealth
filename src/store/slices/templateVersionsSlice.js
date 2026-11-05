import { supabase } from '../../lib/supabase';
import { applyTemplateToPlan, carePlanKey, mapCarePlanTemplateRow, mapTemplateVersionRow } from '../lib/carePlanStoreLib';
import {
  contentOf, effectiveVersion, migrationTargets, nextVersionNumber, shouldMigrateNow, todayIso, versionDiff,
} from '../../features/settings/care-plan-library/lib/templateVersions';
import { isClosedStatus } from '../../features/patient/right-panel/tabs/care-programs/care-plan/lib/gbiStatus';
import { isProgramClosed } from '../../features/patient/data/programStatus';
import { templateLinkOwners } from '../../features/patient/right-panel/tabs/care-programs/care-plan/lib/carePlanTemplateApply';
import { applyOverlay } from '../../features/settings/care-plan-library/lib/ipaOverlays';

/*
 * Care plan template versioning (care_plan_template_versioning migration).
 * Versions are immutable; the template row holds the content of the version
 * in effect (synced on load once a scheduled version's date arrives). Each
 * template run on a plan records its version; publishing a new one marks the
 * targeted runs pending, and a pending run migrates when its version is in
 * effect: 'auto' right away or when its plan is next opened, 'review' when
 * the plan's next review is completed.
 *
 * Migrating a run adds the items the new version has and the old one didn't,
 * and discontinues (with a reason) the open items the new version dropped.
 * Items in both are left as they are on the plan, with the patient's progress.
 */

const MISSING = new Set(['42P01', 'PGRST205']);
const LISTS = { goal: 'goals', intervention: 'interventions', barrier: 'barriers' };
const chunks = (list, n = 200) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

// Rows of `table` whose `col` is in `values`, in chunks so long id lists fit a request.
async function selectIn(table, columns, col, values) {
  const parts = await Promise.all(chunks([...new Set(values)].filter(v => v != null)).map(async (part) => {
    const { data, error } = await supabase.from(table).select(columns).in(col, part);
    if (error) { console.warn(`${table}:`, error.message); return []; }
    return data || [];
  }));
  return parts.flat();
}

// Runs `fn` over `items`, `limit` at a time.
async function pool(items, limit, fn) {
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next; next += 1;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Impact rows for active template runs (patient_care_plan_template_instances
 * rows): what cohorts can filter on (program, IPA, care manager, population
 * groups) and the version each run is on. Runs in closed programs are left out.
 */
export async function describeTemplateRuns(runs, get, versionNo = new Map()) {
  if (!runs?.length) return [];
  const plans = await selectIn('patient_care_plans', 'id, patient_id, program_id, program_code', 'id', runs.map(r => r.plan_id));
  const planById = new Map(plans.map(p => [p.id, p]));
  const programs = await selectIn('patient_care_programs', 'id, code, name, assignee, status', 'id', plans.map(p => p.program_id));
  const programById = new Map(programs.map(p => [p.id, p]));
  const patientIds = plans.map(p => String(p.patient_id));
  const people = await selectIn('all_patients', 'member_id, name, ipa', 'member_id', patientIds);
  const personById = new Map(people.map(p => [String(p.member_id), p]));
  const { data: groups } = await supabase.from('population_groups').select('name, member_ids').overlaps('member_ids', [...new Set(patientIds)]);
  const groupMembers = (groups || []).map(g => ({ name: g.name, members: new Set((g.member_ids || []).map(String)) }));
  return runs.map((r) => {
    const plan = planById.get(r.plan_id);
    if (!plan) return null;
    const program = programById.get(plan.program_id);
    if (program && isProgramClosed(program.status)) return null;
    const patientId = String(plan.patient_id);
    const person = personById.get(patientId);
    const careManager = program?.assignee && program.assignee !== 'Unassigned' ? program.assignee : '';
    return {
      instanceId: r.id, planId: plan.id, patientId,
      patientName: person?.name || get().patients?.find(p => String(p.id) === patientId)?.name || patientId,
      programId: plan.program_id, programCode: plan.program_code || program?.code || '', programName: program?.name || '',
      careManager, ipa: person?.ipa || '',
      groups: groupMembers.filter(g => g.members.has(patientId)).map(g => g.name),
      templateId: r.template_id, templateName: r.template_name || '',
      versionNumber: r.template_version_number ?? 1,
      templateVersionId: r.template_version_id || null,
      overlayId: r.overlay_id || null,
      pendingVersionNumber: r.pending_version_id ? (versionNo.get(r.pending_version_id) ?? null) : null,
    };
  }).filter(Boolean);
}

export function createTemplateVersionsSlice(set, get) {
  const migrating = new Set();
  const versionsOf = (templateId) => get().carePlanTemplateVersions[templateId] || [];
  const putVersion = (v) => set(s => ({
    carePlanTemplateVersions: {
      ...s.carePlanTemplateVersions,
      [v.templateId]: [...(s.carePlanTemplateVersions[v.templateId] || []).filter(x => x.id !== v.id), v]
        .sort((a, b) => a.versionNumber - b.versionNumber),
    },
  }));
  const patchTemplate = (t) => set(s => ({ carePlanTemplates: s.carePlanTemplates.map(x => (x.id === t.id ? t : x)) }));

  // The template row takes a version's content (it is now the one in effect).
  const adoptVersion = async (templateId, version) => {
    const c = version.content || {};
    const patch = {
      name: c.name, conditions: c.conditions || [], goals: c.goals || [], interventions: c.interventions || [], barriers: c.barriers || [],
      ...(c.renewal ? { renewal: c.renewal } : {}),
      categories: c.categories || [],
      current_version_number: version.versionNumber,
      updated_by: version.publishedBy || get().currentUserProfile?.name || null,
      updated_at: new Date().toISOString(),
    };
    const update = (p) => supabase.from('care_plan_templates').update(p).eq('id', templateId).select().single();
    let { data, error } = await update(patch);
    // Before the categories migration a version without categories still adopts.
    if (error && /categories/.test(error.message || '') && !(c.categories || []).length) {
      const { categories: _c, ...withoutCategories } = patch;
      ({ data, error } = await update(withoutCategories));
    }
    if (error) { console.warn('adopt template version:', error.message); return null; }
    const t = mapCarePlanTemplateRow(data);
    patchTemplate(t);
    return t;
  };

  return {
    // templateId → versions, oldest first.
    carePlanTemplateVersions: {},
    carePlanTemplateVersionsLoaded: false,
    // False until the migration has run (table missing): versioning stays out of the way.
    carePlanTemplateVersioningReady: false,

    fetchCarePlanTemplateVersions: async () => {
      const { data, error } = await supabase.from('care_plan_template_versions').select('*').order('version_number', { ascending: true });
      if (error) {
        if (!MISSING.has(error.code)) console.warn('fetchCarePlanTemplateVersions:', error.message);
        set({ carePlanTemplateVersionsLoaded: true });
        return;
      }
      const byTemplate = {};
      for (const v of (data || []).map(mapTemplateVersionRow)) (byTemplate[v.templateId] ||= []).push(v);
      set({ carePlanTemplateVersions: byTemplate, carePlanTemplateVersionsLoaded: true, carePlanTemplateVersioningReady: true });
      await get().syncEffectiveTemplateVersions();
    },

    // A scheduled version whose date has come becomes the template's content.
    syncEffectiveTemplateVersions: async () => {
      const today = todayIso();
      const due = (get().carePlanTemplates || []).map((t) => {
        const eff = effectiveVersion(versionsOf(t.id), today);
        return eff && eff.versionNumber > (t.currentVersionNumber || 0) ? [t.id, eff] : null;
      }).filter(Boolean);
      await Promise.all(due.map(([id, v]) => adoptVersion(id, v)));
    },

    // Version 1 for a template that has none yet (a new or newly approved one).
    ensureCarePlanTemplateVersion: async (template, { note = 'Initial version', effectiveDate } = {}) => {
      if (!get().carePlanTemplateVersioningReady || !template?.id || template.status === 'draft') return null;
      if (versionsOf(template.id).length) return versionsOf(template.id)[0];
      const { data, error } = await supabase.from('care_plan_template_versions').insert({
        template_id: template.id, version_number: 1,
        effective_date: effectiveDate || String(template.createdAt || '').slice(0, 10) || todayIso(),
        content: contentOf(template), note, published_by: get().currentUserProfile?.name || null,
      }).select().single();
      if (error) { console.warn('ensureCarePlanTemplateVersion:', error.message); return null; }
      const v = mapTemplateVersionRow(data);
      putVersion(v);
      await supabase.from('care_plan_templates').update({ current_version_number: 1 }).eq('id', template.id);
      patchTemplate({ ...get().carePlanTemplates.find(t => t.id === template.id), currentVersionNumber: 1 });
      return v;
    },

    /**
     * Impact analysis: every active run of the template on a plan, with what
     * cohorts can filter on (program, IPA, care manager, population groups)
     * and the version it is on. Closed programs are left out.
     */
    fetchCarePlanTemplateImpact: async (templateId) => {
      const { data: runs, error } = await supabase.from('patient_care_plan_template_instances')
        .select('*').eq('template_id', templateId).eq('status', 'active');
      if (error) { console.warn('fetchCarePlanTemplateImpact:', error.message); return []; }
      const versionNo = new Map(versionsOf(templateId).map(v => [v.id, v.versionNumber]));
      return describeTemplateRuns(runs, get, versionNo);
    },

    /**
     * Publish a new version. `impactRows` from fetchCarePlanTemplateImpact;
     * `mode` all | cohort | review; `onProgress(done, total)` while runs migrate.
     * Returns { version, targeted, migrated, failed }.
     */
    publishCarePlanTemplateVersion: async (template, content, { effectiveDate, note = '', mode = 'review', cohort = {}, impactRows = [], onProgress } = {}) => {
      const actor = get().currentUserProfile?.name || null;
      const today = todayIso();
      const effective = effectiveDate || today;
      if (!versionsOf(template.id).length) await get().ensureCarePlanTemplateVersion(template);
      const number = nextVersionNumber(versionsOf(template.id));
      const targets = migrationTargets(impactRows, mode, cohort, number);
      const { data, error } = await supabase.from('care_plan_template_versions').insert({
        template_id: template.id, version_number: number, effective_date: effective, content: { ...content, name: content.name || template.name },
        note: note.trim() || null, migration: { mode, cohort: mode === 'cohort' ? cohort : null, targeted: targets.rows.length }, published_by: actor,
      }).select().single();
      if (error) {
        console.warn('publishCarePlanTemplateVersion:', error.message);
        get().showToast('Could not publish the version');
        return null;
      }
      const version = mapTemplateVersionRow(data);
      putVersion(version);
      if (effective <= today) await adoptVersion(template.id, version);

      // Every targeted run waits on the new version; 'auto' ones move now if it is in effect.
      const ids = targets.rows.map(r => r.instanceId);
      await Promise.all(chunks(ids).map(async (part) => {
        const { error: e } = await supabase.from('patient_care_plan_template_instances')
          .update({ pending_version_id: version.id, pending_mode: targets.pending, pending_effective_date: effective }).in('id', part);
        if (e) console.warn('publishCarePlanTemplateVersion (pending):', e.message);
      }));
      let migrated = 0;
      let failed = 0;
      if (targets.pending === 'auto' && effective <= today) {
        let done = 0;
        await pool(targets.rows, 3, async (row) => {
          const ok = await get().migrateCarePlanTemplateInstance(
            { patientId: row.patientId, programId: row.programId, programCode: row.programCode, programName: row.programName },
            { id: row.instanceId, templateId: template.id, templateVersionId: row.templateVersionId, templateVersionNumber: row.versionNumber, overlayId: row.overlayId },
            version,
          );
          if (ok) migrated += 1; else failed += 1;
          done += 1;
          onProgress?.(done, targets.rows.length);
        });
      }
      return { version, targeted: targets.rows.length, pending: targets.pending, migrated, failed };
    },

    // Move one run to `toVersion` (see the header comment for what changes on the plan).
    migrateCarePlanTemplateInstance: async ({ patientId, programId, programCode, programName }, instance, toVersion) => {
      if (migrating.has(instance.id)) return false;
      migrating.add(instance.id);
      try {
        const program = { id: programId, code: programCode, name: programName };
        const key = carePlanKey(patientId, programId);
        await get().fetchPatientCarePlan(patientId, programId);
        const slice = get().patientCarePlans[key];
        const chain = versionsOf(toVersion.templateId);
        const from = chain.find(v => v.id === instance.templateVersionId)
          || chain.find(v => v.versionNumber === (instance.templateVersionNumber ?? 1)) || null;
        // A run with a category moves Common + its category; one without, Common alone.
        const categoryId = instance.categoryId !== undefined ? instance.categoryId
          : ((slice?.templateInstances || []).find(i => i.id === instance.id)?.categoryId ?? null);
        const diff = versionDiff(from?.content || {}, toVersion.content, { categoryId });
        const name = toVersion.content?.name || 'Template';

        if (slice?.plan) {
          // Only what the version added goes on; items someone took off the
          // plan stay off. Links come from the whole version, so an added
          // intervention under a goal the plan already has still links to it.
          const libraryGoals = get().carePlanGoals || [];
          const owners = templateLinkOwners({ id: toVersion.templateId, ...toVersion.content }, libraryGoals);
          const norm0 = (t) => String(t || '').trim().toLowerCase();
          const added = {
            goals: diff.goal.added,
            interventions: diff.intervention.added.map(x => ({ ...x, goalTitle: x.goalTitle || owners.intervention.get(norm0(x.title))?.[0] })),
            barriers: diff.barrier.added.map(x => ({ ...x, goalTitles: x.goalTitles?.length ? x.goalTitles : owners.barrier.get(norm0(x.title)) })),
          };
          // The run's IPA overlay still applies to what the version adds (hidden items stay off).
          if (instance.overlayId && !get().templateOverlaysLoaded) await get().fetchTemplateOverlays();
          const overlay = instance.overlayId && (get().templateOverlays || []).find(o => o.id === instance.overlayId);
          const withOverlay = overlay ? applyOverlay(added, { items: overlay.overrides?.items }) : added;
          await applyTemplateToPlan(get, patientId, program, { id: toVersion.templateId, ...withOverlay }, libraryGoals);
          const reason = `Removed in ${name} v${toVersion.versionNumber}`;
          const norm = (t) => String(t || '').trim().toLowerCase();
          const writes = [];
          for (const [kind, listKey] of Object.entries(LISTS)) {
            const gone = new Set(diff[kind].removed.map(x => norm(x.title)));
            for (const item of get().patientCarePlans[key]?.[listKey] || []) {
              if (gone.has(norm(item.title)) && !isClosedStatus(item.status)) {
                writes.push(get().saveCarePlanLiveField(patientId, program, kind, item.id, { status: 'Discontinued', statusReason: reason }));
              }
            }
          }
          await Promise.all(writes);
        }

        const { error } = await supabase.from('patient_care_plan_template_instances').update({
          template_version_id: toVersion.id, template_version_number: toVersion.versionNumber,
          pending_version_id: null, pending_mode: null, pending_effective_date: null,
        }).eq('id', instance.id);
        if (error) { console.warn('migrateCarePlanTemplateInstance:', error.message); return false; }
        get().patchCarePlanTemplateInstances?.(key, list => list.map(i => (i.id === instance.id ? {
          ...i, templateVersionId: toVersion.id, templateVersionNumber: toVersion.versionNumber, pendingVersionId: null, pendingMode: null, pendingEffectiveDate: null,
        } : i)));
        if (slice?.plan) {
          const added = diff.goal.added.length + diff.intervention.added.length + diff.barrier.added.length;
          const removed = diff.goal.removed.length + diff.intervention.removed.length + diff.barrier.removed.length;
          get().logCarePlanAudit(patientId, program, {
            entityType: 'template', entityId: toVersion.templateId, action: 'updated', summary: name,
            detail: `Template v${from?.versionNumber ?? instance.templateVersionNumber ?? 1} → v${toVersion.versionNumber}: ${added} added, ${removed} removed`,
          });
          get().touchCarePlanModified?.(patientId, programId);
        }
        return true;
      } finally {
        migrating.delete(instance.id);
      }
    },

    // Runs on this plan waiting on a version: migrate the ones due for this trigger ('load' | 'review').
    applyPendingTemplateMigrations: async (patientId, program, trigger) => {
      const slice = get().patientCarePlans[carePlanKey(patientId, program.id)];
      const due = (slice?.templateInstances || []).filter(i => i.status === 'active' && shouldMigrateNow(i, trigger));
      if (!due.length) return 0;
      if (!get().carePlanTemplateVersionsLoaded) await get().fetchCarePlanTemplateVersions();
      let n = 0;
      // One at a time: every migration rewrites items of this same plan.
      for (const inst of due) {
        const toVersion = versionsOf(inst.templateId).find(v => v.id === inst.pendingVersionId);
        if (!toVersion) continue;
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        if (await get().migrateCarePlanTemplateInstance({ patientId, programId: program.id, programCode: program.code, programName: program.name }, inst, toVersion)) n += 1;
      }
      if (n) get().showToast(`Care plan updated to the latest template version${n === 1 ? '' : 's'}`);
      return n;
    },
  };
}
