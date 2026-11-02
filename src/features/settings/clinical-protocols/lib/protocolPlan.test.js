import { describe, expect, it } from 'vitest';
import { goalTarget, planCounts, planOf, planScopeRequest } from './protocolPlan';

const g = (title, interventions = [], barriers = []) => ({ title, interventions: interventions.map(t => ({ title: t })), barriers: barriers.map(t => ({ title: t })) });
const plan = {
  goals: [g('Lifestyle change', ['DASH diet education'], ['Cost of healthy food'])],
  categories: [
    { id: 'c1', name: 'Stage 1', range: 'SBP 130–139 mmHg', goals: [g('Lifestyle change', ['DASH diet education']), g('Lab test', ['Order BMP'])] },
    { id: 'c2', name: 'Stage 2', range: 'SBP 140 or above', goalCount: 3, goals: [g('Start medication', ['Medication review'], ['Side effects', 'cost of healthy food'])] },
  ],
};

describe('protocol plan', () => {
  it('counts distinct goals, interventions and barriers across Common and categories', () => {
    expect(planCounts(plan)).toEqual({ goals: 3, interventions: 3, barriers: 2 });
    expect(planCounts(null)).toEqual({ goals: 0, interventions: 0, barriers: 0 });
  });

  it('is only a plan when it has goals somewhere', () => {
    expect(planOf({ plan })).toBe(plan);
    expect(planOf({ plan: { goals: [], categories: [] } })).toBeNull();
    expect(planOf({})).toBeNull();
  });

  it('turns the reviewer\'s edits into a redraft request', () => {
    expect(goalTarget(plan.categories[1])).toBe(3);
    expect(planScopeRequest({ ...plan, commonGoalCount: 2 })).toEqual({
      categories: [{ name: 'Stage 1', range: 'SBP 130–139 mmHg', goals: 2 }, { name: 'Stage 2', range: 'SBP 140 or above', goals: 3 }],
      commonGoals: 2,
    });
  });
});
