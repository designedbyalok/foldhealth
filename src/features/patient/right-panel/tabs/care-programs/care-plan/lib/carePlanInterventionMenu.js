/** Intervention type picker — Figma SNP-Story 2632:91999, shared with CreateGoalDrawer. */
export const CARE_PLAN_INTERVENTION_MENU = [
  { key: 'send-form', label: 'Send Form', icon: 'solar:document-add-linear' },
  { key: 'patient-education', label: 'Patient Education', icon: 'solar:book-2-linear' },
  { key: 'patient-task', label: 'Patient Task', icon: 'solar:checklist-minimalistic-linear' },
  { key: 'measure-vital', label: 'Measure Vital', icon: 'solar:heart-pulse-linear' },
  { divider: true },
  { key: 'internal-task', label: 'Internal Task', icon: 'solar:clipboard-check-linear' },
];

export const CARE_PLAN_INTERVENTION_ICONS = Object.fromEntries(
  CARE_PLAN_INTERVENTION_MENU.filter(i => i.key).map(i => [i.key, i.icon]),
);

export function interventionDurationFromConfig(config) {
  if (!config?.dueOffset) return null;
  const unit = (config.dueUnit || 'day')[0];
  return `${config.dueOffset}${unit}`;
}

export function interventionPriorityFromConfig(config) {
  const p = String(config?.priority || 'medium').toLowerCase();
  return p === 'high' || p === 'low' ? p : 'medium';
}

function initialsOf(name) {
  return (name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// Shared payload builder for care-plan intervention saves. Keeps
// CarePlanView (plan-level "+ Intervention") and GoalPreviewDrawer
// (goal-scoped "+ Intervention") producing identical rows so both
// paths persist and hydrate the same way. `preLinkedGoalId` is used
// by the goal drawer to seed the link when the drawer opens with no
// user-picked goal yet.
export function buildInterventionRecordFromConfig(kind, config, { preLinkedGoalId = null, editing = false } = {}) {
  const assigneeName = (typeof config?.assignedTo === 'string' && config.assignedTo.trim())
    || (typeof config?.member === 'string' && config.member.trim())
    || 'Unassigned';
  const firstGoalId = Array.isArray(config?.goalIds) && config.goalIds.length > 0
    ? config.goalIds[0]
    : null;
  return {
    kind,
    title: config?.title || '',
    taskId: config?.taskId || null,
    goalId: config?.goalId || firstGoalId || preLinkedGoalId || null,
    icon: CARE_PLAN_INTERVENTION_ICONS[kind] || 'solar:clipboard-list-linear',
    duration: interventionDurationFromConfig(config),
    priority: interventionPriorityFromConfig(config),
    config,
    // Only a new intervention starts at Not Started. Sending it on an edit
    // reopens a completed one, and the store's merge can't rescue a key that
    // is present and wrong.
    ...(editing ? {} : { status: 'Not Started' }),
    assignee: {
      name: assigneeName,
      initials: assigneeName === 'Unassigned' ? '' : initialsOf(assigneeName),
    },
  };
}
