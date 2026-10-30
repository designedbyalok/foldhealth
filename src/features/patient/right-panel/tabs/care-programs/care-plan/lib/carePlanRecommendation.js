/* A recommended care plan (automation-matched templates merged by UnityAI,
   see draftIndividualizedPlan) awaits approval while any of its items is
   still flagged as AI-suggested and not yet reviewed. The plan's review card
   and the program sidebar's Care Plan step both read it from here. */

/** The plan's items awaiting approval, as [{ kind, item }]. */
export function pendingRecommendation(plan) {
  if (!plan) return [];
  return [
    ...(plan.goals || []).map(item => ({ kind: 'goal', item })),
    ...(plan.interventions || []).map(item => ({ kind: 'intervention', item })),
    ...(plan.barriers || []).map(item => ({ kind: 'barrier', item })),
  ].filter(x => x.item.aiSuggested && !x.item.aiReviewedAt);
}

export const hasPendingRecommendation = (plan) => pendingRecommendation(plan).length > 0;
