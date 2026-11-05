import { saveGbiPatch } from './carePlanGbiActions';
import { confirmStatusChange, statusReasonPatch } from '../lib/confirmStatusChange';

function selectedRows(filteredGoals, filteredInterventions, filteredBarriers, selected) {
  return {
    g: filteredGoals.filter(x => selected.goal.has(x.id)),
    iv: filteredInterventions.filter(x => selected.intv.has(x.id)),
    br: filteredBarriers.filter(x => selected.barrier.has(x.id)),
  };
}

export async function bulkSetStatus(status, { selected, filteredGoals, filteredInterventions, filteredBarriers, ctx, clearSelection }) {
  const { g, iv, br } = selectedRows(filteredGoals, filteredInterventions, filteredBarriers, selected);
  const why = await confirmStatusChange([
    ...g.map(item => ({ type: 'goal', item })),
    ...iv.map(item => ({ type: 'intervention', item })),
    ...br.map(item => ({ type: 'barrier', item })),
  ], status, { source: 'bulk' });
  if (!why) return;
  for (const x of g) await saveGbiPatch('goal', x, { status, ...statusReasonPatch(x, why) }, ctx);
  for (const x of iv) await saveGbiPatch('intervention', x, { status, ...statusReasonPatch(x, why) }, ctx);
  for (const x of br) await saveGbiPatch('barrier', x, { status, ...statusReasonPatch(x, why) }, ctx);
  const n = g.length + iv.length + br.length;
  clearSelection();
  if (n) ctx.showToast(`Updated ${n} item${n === 1 ? '' : 's'} to "${status}"`);
}

export async function bulkSetPriority(priority, args) {
  const { selected, filteredGoals, filteredInterventions, filteredBarriers, ctx, clearSelection } = args;
  const { g, iv, br } = selectedRows(filteredGoals, filteredInterventions, filteredBarriers, selected);
  for (const x of g) await saveGbiPatch('goal', x, { priority }, ctx);
  for (const x of iv) await saveGbiPatch('intervention', x, { priority }, ctx);
  for (const x of br) await saveGbiPatch('barrier', x, { priority }, ctx);
  const n = g.length + iv.length + br.length;
  clearSelection();
  if (n) {
    ctx.showToast(`Set ${n} item${n === 1 ? '' : 's'} to ${priority.charAt(0).toUpperCase() + priority.slice(1)} priority`);
  }
}

export async function bulkAssign(user, { selected, filteredInterventions, ctx, clearSelection }) {
  const iv = filteredInterventions.filter(x => selected.intv.has(x.id));
  if (!iv.length) {
    ctx.showToast('Select one or more interventions to assign');
    return;
  }
  for (const x of iv) {
    await saveGbiPatch('intervention', x, {
      assignee: { name: user.name, initials: user.initials },
    }, ctx);
  }
  clearSelection();
  ctx.showToast(`Assigned ${iv.length} intervention${iv.length === 1 ? '' : 's'} to ${user.name}`);
}

export async function bulkDeleteSelected({ selected, filteredGoals, filteredInterventions, filteredBarriers, ctx, clearSelection, createUndoToastAction }) {
  const { g, iv, br } = selectedRows(filteredGoals, filteredInterventions, filteredBarriers, selected);
  for (const x of g) await ctx.deletePatientCarePlanGoal(ctx.patientId, ctx.program.id, x.id);
  for (const x of iv) await ctx.deletePatientCarePlanIntervention(ctx.patientId, ctx.program.id, x.id);
  for (const x of br) await ctx.deletePatientCarePlanBarrier(ctx.patientId, ctx.program.id, x.id);
  const n = g.length + iv.length + br.length;
  clearSelection();
  if (n) {
    const removed = [
      ...g.map(item => ({ kind: 'goal', item })),
      ...iv.map(item => ({ kind: 'intervention', item })),
      ...br.map(item => ({ kind: 'barrier', item })),
    ];
    ctx.showToast(`Removed ${n} item${n === 1 ? '' : 's'}`, {
      action: createUndoToastAction(removed, ctx),
      duration: 6000,
    });
    ctx.refreshCarePlanDuplicates(ctx.patientId, ctx.program);
  }
}
