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

/* Templates a completed assessment suggested (form builder Care Plan rules,
   recorded by the assessment_care_plan_suggestions trigger). A suggestion
   names the programs its assessment was sent for; none means any program. */

/** Pending suggestions for this program, minus templates already on the plan. */
export function assessmentSuggestionsFor(suggestions, programCode, appliedTemplateIds = []) {
  const applied = new Set(appliedTemplateIds.map(String));
  return (suggestions || []).filter(s => (
    (!s.programCodes?.length || s.programCodes.includes(programCode)) && !applied.has(String(s.templateId))
  ));
}

/**
 * Adds assessment suggestions to the automation matches the recommendation is
 * built from ([{ templateId, rule, criteria }]). A template both matched gets
 * the assessment's reason added to its criteria. Only known templates count.
 */
export function withAssessmentSuggestions(recommended, suggestions, knownTemplateIds) {
  const known = new Set([...knownTemplateIds].map(String));
  const out = recommended.map(r => ({ ...r, criteria: [...(r.criteria || [])] }));
  for (const s of suggestions || []) {
    const id = String(s.templateId);
    if (!known.has(id)) continue;
    const hit = out.find(r => String(r.templateId) === id);
    if (hit) {
      if (!hit.criteria.includes(s.reason)) hit.criteria.push(s.reason);
    } else {
      out.push({ templateId: id, rule: 'Assessment rule', criteria: [s.reason] });
    }
  }
  return out;
}
