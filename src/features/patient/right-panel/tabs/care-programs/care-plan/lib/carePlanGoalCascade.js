// What a goal takes with it when it is removed from a patient's plan.
//
// The schema unlinks rather than deletes (`goal_id … ON DELETE SET NULL`), so
// without this the interventions and barriers of a deleted goal stay on the
// plan as loose items. Deleting them is the plan-side match for the template
// editor, where removing a goal removes its linked items too.

/** A barrier is many-to-many with goals; `goalId` is the pre-migration column. */
export function barrierGoalIdsOf(barrier) {
  if (Array.isArray(barrier?.goalIds) && barrier.goalIds.length > 0) return barrier.goalIds;
  return barrier?.goalId ? [barrier.goalId] : [];
}

/**
 * The items that go with `goalId`.
 *
 * Interventions are 1:1 with a goal, so all of them go. A barrier only goes
 * when this is its last goal, one shared with another goal stays on the plan
 * and simply loses this link.
 */
export function goalCascade(plan, goalId) {
  return {
    interventions: (plan?.interventions || []).filter(i => i.goalId === goalId),
    barriers: (plan?.barriers || []).filter((b) => {
      const ids = barrierGoalIdsOf(b);
      return ids.includes(goalId) && ids.length === 1;
    }),
  };
}

const countOf = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/**
 * One sentence saying what the removal takes with it, for a confirm dialog.
 * Counts only: the names make the dialog long without helping the decision.
 * Returns '' when the goal has nothing linked to it.
 */
export function goalCascadeDescription(cascade) {
  const { interventions = [], barriers = [] } = cascade || {};
  if (!interventions.length && !barriers.length) return '';
  const counts = [
    interventions.length && countOf(interventions.length, 'intervention'),
    barriers.length && countOf(barriers.length, 'barrier'),
  ].filter(Boolean).join(' and ');
  return `This also removes ${counts} linked to it.`;
}

/**
 * The question a goal with linked items asks before it is removed: delete the
 * linked items too, or take out only the goal. Returns '' when there is
 * nothing linked, in which case the removal is a plain yes/no.
 */
export function goalCascadeQuestion(cascade) {
  const { interventions = [], barriers = [] } = cascade || {};
  if (!interventions.length && !barriers.length) return '';
  const counts = [
    interventions.length && countOf(interventions.length, 'intervention'),
    barriers.length && countOf(barriers.length, 'barrier'),
  ].filter(Boolean).join(' and ');
  return `This goal has ${counts} linked to it. Would you like to delete all its linked items, or remove only the goal from the care plan?`;
}
