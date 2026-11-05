import { confirmStatusChange, statusReasonPatch } from '../lib/confirmStatusChange';
export function restoreGbi({
  kind,
  item,
  patientId,
  program,
  savePatientCarePlanGoal,
  savePatientCarePlanBarrier,
  savePatientCarePlanIntervention,
}) {
  const { id, ...values } = item; // eslint-disable-line no-unused-vars
  if (kind === 'goal') return savePatientCarePlanGoal(patientId, program, values);
  if (kind === 'barrier') return savePatientCarePlanBarrier(patientId, program, values);
  return savePatientCarePlanIntervention(patientId, program, values);
}

export function createUndoToastAction(removed, ctx) {
  return {
    label: 'Undo',
    onClick: async () => {
      for (const r of removed) await restoreGbi({ ...r, ...ctx });
      ctx.refreshCarePlanDuplicates(ctx.patientId, ctx.program);
    },
  };
}

export function createUndoGoalCascadeAction(goal, cascade, ctx) {
  return {
    label: 'Undo',
    onClick: async () => {
      const { id: goalId, ...goalValues } = goal; // eslint-disable-line no-unused-vars
      const restored = await ctx.savePatientCarePlanGoal(ctx.patientId, ctx.program, goalValues);
      for (const intv of cascade.interventions) {
        const { id: intvId, ...values } = intv; // eslint-disable-line no-unused-vars
        await ctx.savePatientCarePlanIntervention(ctx.patientId, ctx.program, {
          ...values,
          goalId: restored?.id || null,
        });
      }
      for (const barrier of cascade.barriers) {
        const { id: barrierId, ...values } = barrier; // eslint-disable-line no-unused-vars
        await ctx.savePatientCarePlanBarrier(ctx.patientId, ctx.program, {
          ...values,
          goalId: restored?.id || null,
          goalIds: restored ? [restored.id] : [],
        });
      }
      ctx.refreshCarePlanDuplicates(ctx.patientId, ctx.program);
    },
  };
}

export function deleteGbiById(kind, id, ctx) {
  if (kind === 'goal') ctx.deletePatientCarePlanGoal(ctx.patientId, ctx.program.id, id);
  else if (kind === 'barrier') ctx.deletePatientCarePlanBarrier(ctx.patientId, ctx.program.id, id);
  else ctx.deletePatientCarePlanIntervention(ctx.patientId, ctx.program.id, id);
}

export function saveGbiPatch(kind, item, patch, ctx) {
  const merged = { ...item, ...patch };
  if (kind === 'goal') ctx.savePatientCarePlanGoal(ctx.patientId, ctx.program, merged, item.id);
  else if (kind === 'barrier') ctx.savePatientCarePlanBarrier(ctx.patientId, ctx.program, merged, item.id);
  else ctx.savePatientCarePlanIntervention(ctx.patientId, ctx.program, merged, item.id);
}

export async function saveGbiStatus({ kind, item, status, patientId, program, savePatientCarePlanGoal, savePatientCarePlanBarrier, savePatientCarePlanIntervention }) {
  const type = kind === 'intv' ? 'intervention' : kind;
  const why = await confirmStatusChange([{ type, item }], status);
  if (!why) return;
  saveGbiPatch(kind, item, { status, ...statusReasonPatch(item, why) }, {
    patientId,
    program,
    savePatientCarePlanGoal,
    savePatientCarePlanBarrier,
    savePatientCarePlanIntervention,
  });
}

export function saveGbiPriority({ kind, item, priority, patientId, program, savePatientCarePlanGoal, savePatientCarePlanBarrier, savePatientCarePlanIntervention }) {
  saveGbiPatch(kind, item, { priority }, {
    patientId,
    program,
    savePatientCarePlanGoal,
    savePatientCarePlanBarrier,
    savePatientCarePlanIntervention,
  });
}
