import { goalPayloadFromTemplateEntry } from './carePlanTemplateApply';
import { buildInterventionRecordFromConfig } from './carePlanInterventionMenu';

/* Adding a goal, intervention or barrier as a new row in its table (care
   plan redesign prototype): a name, and for an intervention or barrier the
   goal it belongs to. The records match what the drawers save. */

// The intervention types a name is enough for; the rest need their editor.
export const INLINE_INTERVENTION_TYPES = [
  { value: 'internal-task', label: 'Internal Task' },
  { value: 'patient-task', label: 'Patient Task' },
];

/**
 * The record to save for an inline add. A patient task runs on the patient,
 * so it's assigned to them; an internal task starts unassigned. Task
 * interventions get their task when the plan is signed, like template ones.
 */
export function inlineAddPayload(kind, { title, goalId = '', type = 'internal-task', patientName = '' }) {
  const name = (title || '').trim();
  if (kind === 'goal') return goalPayloadFromTemplateEntry({ title: name });
  if (kind === 'barrier') {
    return { title: name, description: '', status: 'Not Started', priority: 'medium', goalIds: goalId ? [goalId] : [] };
  }
  return buildInterventionRecordFromConfig(type, {
    title: name,
    goalId: goalId || null,
    assignedTo: type === 'patient-task' ? patientName : '',
  });
}
