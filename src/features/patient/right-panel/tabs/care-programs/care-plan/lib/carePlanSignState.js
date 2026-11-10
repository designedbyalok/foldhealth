function itemTimestamp(item) {
  if (!item) return 0;
  const updated = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
  const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
  return Math.max(updated, created);
}

/** True when the plan header has a recorded signature. */
export function isCarePlanSigned(plan) {
  return !!(plan?.signedBy && plan?.signedAt);
}

/** True when GBI content or the plan row changed after the last signature. */
export function carePlanHasChangesSinceSign(carePlan) {
  if (!carePlan?.plan || !isCarePlanSigned(carePlan.plan)) return false;
  const signedMs = new Date(carePlan.plan.signedAt).getTime();
  const stamps = [
    carePlan.plan.updatedAt ? new Date(carePlan.plan.updatedAt).getTime() : 0,
    ...(carePlan.goals || []).map(itemTimestamp),
    ...(carePlan.interventions || []).map(itemTimestamp),
    ...(carePlan.barriers || []).map(itemTimestamp),
  ];
  return Math.max(...stamps, 0) > signedMs;
}

/**
 * Sign is available when unsigned, or signed with unsigned changes. Pass the
 * draft state (useCarePlanDraftState) to decide on the real diff against the
 * signed version; without it the edit timestamps are used.
 */
export function carePlanSignShareEnabled(carePlan, { usingMock = false, draft = null } = {}) {
  if (usingMock || !carePlan?.plan) return false;
  if (!isCarePlanSigned(carePlan.plan)) return true;
  if (draft?.latestVersion) return draft.hasUnsignedChanges;
  return carePlanHasChangesSinceSign(carePlan);
}

/**
 * Completed by the care manager and sent to a provider to sign, and not signed
 * since. Editing a goal, intervention or barrier after completing ends it, so
 * the plan has to be completed again. (The plan row's own updated_at is left
 * out: completing writes the row itself.)
 */
export function carePlanAwaitingSignature(carePlan) {
  const plan = carePlan?.plan;
  if (!plan?.completedAt) return false;
  const completedMs = new Date(plan.completedAt).getTime();
  if (plan.signedAt && new Date(plan.signedAt).getTime() >= completedMs) return false;
  const edited = Math.max(0,
    ...(carePlan.goals || []).map(itemTimestamp),
    ...(carePlan.interventions || []).map(itemTimestamp),
    ...(carePlan.barriers || []).map(itemTimestamp));
  return edited <= completedMs;
}
