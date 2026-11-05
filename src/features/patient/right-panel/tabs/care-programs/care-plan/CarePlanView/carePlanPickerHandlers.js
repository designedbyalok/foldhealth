import {
  barrierPayloadFromTemplateEntry,
  goalPayloadFromTemplateEntry,
  interventionPayloadFromTemplateEntry,
} from '../lib/carePlanTemplateApply';
import { norm } from './carePlanViewNorm';

export async function addGoalsFromPicker({
  picked,
  removed = [],
  data,
  patientId,
  program,
  savePatientCarePlanGoal,
  deletePatientCarePlanGoal,
  savePatientCarePlanBarrier,
  savePatientCarePlanIntervention,
  refreshCarePlanDuplicates,
  showToast,
}) {
  if (!picked?.length && !removed?.length) return { added: 0, removedCount: 0, linked: 0 };

  let removedCount = 0;
  if (removed?.length) {
    const planGoalByTitle = new Map(data.goals.map(g => [norm(g.title), g]));
    for (const g of removed) {
      const planGoal = planGoalByTitle.get(norm(g.title));
      if (planGoal) {
        await deletePatientCarePlanGoal(patientId, program.id, planGoal.id, { cascade: true });
        removedCount += 1;
      }
    }
  }

  const existingTitles = new Set(data.goals.map(g => norm(g.title)));
  const existingIntvTitles = new Set((data.interventions || []).map(i => norm(i.title)));
  const existingBarrierTitles = new Set((data.barriers || []).map(b => norm(b.title)));
  let added = 0;
  let linked = 0;
  for (const g of picked) {
    const titleKey = norm(g.title);
    if (existingTitles.has(titleKey)) continue;
    const goal = await savePatientCarePlanGoal(
      patientId,
      program,
      goalPayloadFromTemplateEntry({ id: g.id, title: g.title, subtitle: g.detail }, [g]),
    );
    if (!goal) continue;
    added += 1;
    existingTitles.add(titleKey);
    for (const link of g.interventions || []) {
      const linkKey = norm(link.title);
      if (!linkKey) continue;
      if (link.kind === 'barrier') {
        if (existingBarrierTitles.has(linkKey)) continue;
        const saved = await savePatientCarePlanBarrier(
          patientId,
          program,
          barrierPayloadFromTemplateEntry(link, [goal.id]),
        );
        if (saved) {
          existingBarrierTitles.add(linkKey);
          linked += 1;
        }
      } else {
        if (existingIntvTitles.has(linkKey)) continue;
        const saved = await savePatientCarePlanIntervention(
          patientId,
          program,
          interventionPayloadFromTemplateEntry(link, goal.id),
        );
        if (saved) {
          existingIntvTitles.add(linkKey);
          linked += 1;
        }
      }
    }
  }

  if (added || removedCount) {
    const parts = [];
    if (added) {
      parts.push(
        `Added ${added} goal${added === 1 ? '' : 's'}${linked ? ` with ${linked} linked item${linked === 1 ? '' : 's'}` : ''}`,
      );
    }
    if (removedCount) parts.push(`removed ${removedCount} goal${removedCount === 1 ? '' : 's'}`);
    showToast(parts.join(', '));
    refreshCarePlanDuplicates(patientId, program);
  } else {
    showToast('No changes to the plan goals');
  }

  return { added, removedCount, linked };
}

export async function addBarriersFromPicker({
  picked,
  opts = {},
  linkGoalId,
  data,
  patientId,
  program,
  savePatientCarePlanBarrier,
  refreshCarePlanDuplicates,
  showToast,
}) {
  if (!picked?.length) return 0;

  const target = opts.target || 'thisPlan';
  const existingTitles = new Set((data.barriers || []).map(b => norm(b.title)));
  let added = 0;
  for (const b of picked) {
    const titleKey = norm(b.title);
    if (existingTitles.has(titleKey)) continue;
    const goalIdsForBarrier = linkGoalId
      ? [linkGoalId]
      : target === 'thisPlanAllGoals'
        ? (data.goals || []).map(g => g.id)
        : [];
    const saved = await savePatientCarePlanBarrier(patientId, program, {
      title: b.title,
      description: b.description || '',
      status: 'Not Started',
      priority: 'medium',
      goalIds: goalIdsForBarrier,
    });
    if (saved) {
      added += 1;
      existingTitles.add(titleKey);
    }
  }

  if (added) {
    const scopeCopy = {
      thisPlan: `Added ${added} barrier${added === 1 ? '' : 's'} to this plan`,
      thisPlanAllGoals: `Added ${added} barrier${added === 1 ? '' : 's'} to every goal on this plan`,
      allPlans: `Added ${added} barrier${added === 1 ? '' : 's'}: cross-plan fan-out is pending, saved to this plan for now`,
      allPlansAllGoals: `Added ${added} barrier${added === 1 ? '' : 's'}: cross-plan fan-out is pending, saved to every goal on this plan`,
    };
    showToast(scopeCopy[target] || scopeCopy.thisPlan);
    refreshCarePlanDuplicates(patientId, program);
  } else {
    showToast('Selected barriers are already on this plan');
  }
  return added;
}
