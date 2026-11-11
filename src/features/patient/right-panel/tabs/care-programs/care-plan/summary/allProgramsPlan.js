import { carePlanFocusItems } from '../lib/carePlanFocus';
import { isExcludedStatus } from '../lib/gbiStatus';
import { carePlanAwaitingSignature, carePlanSignShareEnabled, isCarePlanSigned } from '../lib/carePlanSignState';

/**
 * The Comprehensive Care Plan's All Programs view, across every open
 * program's live plan: the summary strip's totals, what needs attention
 * (carePlanFocusItems per plan, without the review, each tagged with its
 * program) and where each plan stands on completing and signing.
 *
 * `dueOf(intervention)` is the interventions table's due date, so an item
 * flagged here reads overdue there too.
 */
export function allProgramsPlanState(programs, carePlans, patientId, dueOf) {
  const plans = programs
    .map(program => ({ program, carePlan: carePlans[`${patientId}::${program.id}`] || null }))
    .filter(p => p.carePlan?.plan);

  const attention = plans.flatMap(({ program, carePlan }) => carePlanFocusItems({
    goals: carePlan.goals || [],
    interventions: carePlan.interventions || [],
    barriers: carePlan.barriers || [],
    measurements: carePlan.measurements || [],
    dueOf,
  }).map(a => ({ ...a, key: `${program.id}:${a.key}`, program })));

  const goals = plans.flatMap(p => p.carePlan.goals || []);
  const judged = goals.filter(g => !isExcludedStatus(g.status));
  const totals = {
    goals: goals.length,
    interventions: plans.reduce((n, p) => n + (p.carePlan.interventions || []).length, 0),
    barriers: plans.reduce((n, p) => n + (p.carePlan.barriers || []).length, 0),
    avgProgress: judged.length ? Math.round(judged.reduce((n, g) => n + (Number(g.progress) || 0), 0) / judged.length) : 0,
  };

  const signing = plans.map(({ program, carePlan }) => {
    const { plan } = carePlan;
    if (carePlanAwaitingSignature(carePlan)) return { program, state: 'awaiting', label: `Awaiting ${plan.awaitingSigner || 'the provider'}'s signature` };
    if (carePlanSignShareEnabled(carePlan)) return { program, state: 'open', label: isCarePlanSigned(plan) ? 'Changed since signed, complete it again' : 'Not completed yet' };
    return { program, state: 'signed', label: `Signed${plan.signedBy ? ` by ${plan.signedBy}` : ''}` };
  });

  return { plans, attention, totals, signing };
}
