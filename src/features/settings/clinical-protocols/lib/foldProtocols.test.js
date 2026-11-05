import { describe, expect, it } from 'vitest';
import { FOLD_PROTOCOL_CONTENT } from '../data/foldProtocolContent';
import { CARE_PLAN_GOAL_LIBRARY } from '../../care-plan-library/data/carePlanGoalLibrarySeed';
import { CARE_PLAN_INTERVENTION_LIBRARY } from '../../care-plan-library/data/carePlanInterventionLibrarySeed';
import { CARE_PLAN_BARRIER_STRUCTURED_LIBRARY } from '../../care-plan-library/data/carePlanBarrierStructuredSeed';
import { CADENCE_KINDS, CADENCE_UNITS, COMPARATORS, protocolCounts } from './protocolSchema';
import { foldProtocolRecord, foldStarterGbi, isFoldProtocol, unresolvedTitles } from './foldProtocols';
import { categoriesProblem } from '../../care-plan-library/lib/templateCategories';

const libraries = {
  goals: CARE_PLAN_GOAL_LIBRARY,
  interventions: CARE_PLAN_INTERVENTION_LIBRARY,
  barriers: CARE_PLAN_BARRIER_STRUCTURED_LIBRARY,
};

describe('Fold protocol content', () => {
  it('ships the six baseline conditions with unique ids', () => {
    expect(FOLD_PROTOCOL_CONTENT.map(p => p.id)).toEqual(['diabetes', 'heart-failure', 'copd', 'ckd', 'hypertension', 'dyslipidemia']);
  });

  it.each(FOLD_PROTOCOL_CONTENT.map(p => [p.id, p]))('%s names only real library items', (_id, p) => {
    expect(unresolvedTitles(p, libraries)).toEqual([]);
  });

  // A patient gets Common + one category, so links resolve within that.
  it.each(FOLD_PROTOCOL_CONTENT.map(p => [p.id, p]))('%s links interventions and barriers to its own goals', (_id, p) => {
    const sections = (p.categories || []).length ? p.categories : [{ goals: [], interventions: [], barriers: [] }];
    for (const c of sections) {
      const goals = new Set([...p.goals, ...c.goals].map(g => g.title));
      for (const i of [...p.interventions, ...c.interventions]) expect(goals.has(i.goalTitle), `${i.title} → ${i.goalTitle}`).toBe(true);
      for (const b of [...p.barriers, ...c.barriers]) for (const t of b.goalTitles) expect(goals.has(t), `${b.title} → ${t}`).toBe(true);
    }
  });

  it.each(FOLD_PROTOCOL_CONTENT.filter(p => p.categories?.length).map(p => [p.id, p]))('%s categories are complete and distinct from Common', (_id, p) => {
    expect(categoriesProblem(p.categories)).toBeNull();
    const common = new Set(p.goals.map(g => g.title));
    for (const c of p.categories) for (const g of c.goals) expect(common.has(g.title), g.title).toBe(false);
  });

  it.each(FOLD_PROTOCOL_CONTENT.map(p => [p.id, p]))('%s decision logic and cadence fit the protocol schema', (_id, p) => {
    for (const t of p.thresholds) {
      expect(COMPARATORS).toContain(t.comparator);
      expect(typeof t.value).toBe('number');
      if (t.comparator === 'between') expect(typeof t.value2).toBe('number');
    }
    for (const r of p.decisionRules) expect(r.when && r.then).toBeTruthy();
    for (const c of p.cadence) {
      expect(CADENCE_KINDS.map(k => k.value)).toContain(c.kind);
      expect(CADENCE_UNITS).toContain(c.unit);
      expect(c.times).toBeGreaterThan(0);
      expect(c.every).toBeGreaterThan(0);
    }
    for (const x of [...p.thresholds, ...p.decisionRules, ...p.cadence]) expect(x.source).toBeTruthy();
  });

  it('uses no em dashes', () => {
    expect(JSON.stringify(FOLD_PROTOCOL_CONTENT)).not.toContain('\u2014');
  });
});

describe('foldProtocolRecord', () => {
  it.each(FOLD_PROTOCOL_CONTENT.map(p => [p.id, p]))('%s keeps every item through normalization', (_id, p) => {
    const r = foldProtocolRecord(p);
    expect(r.protocol.thresholds).toHaveLength(p.thresholds.length);
    expect(r.protocol.decisionRules).toHaveLength(p.decisionRules.length);
    expect(r.protocol.cadence).toHaveLength(p.cadence.length);
  });

  it('is a Fold protocol for the condition, citing its guidelines', () => {
    const diabetes = FOLD_PROTOCOL_CONTENT[0];
    const r = foldProtocolRecord(diabetes);
    expect(r).toMatchObject({ slug: 'diabetes', title: 'Type 2 Diabetes', organization: 'Fold', conditions: ['Diabetes'], version: '2026.1' });
    expect(r.protocol.summary).toBe(diabetes.summary);
    expect(r.protocol.scope.conditions).toEqual([{ name: 'Diabetes', code: null }]);
    expect(r.protocol.crossReferences[0]).toMatchObject({ title: 'ADA Standards of Care in Diabetes (2026)', kind: 'guideline' });
    expect(r.protocol.thresholds[0]).toMatchObject({ id: 't1', source: 'ADA Standards of Care in Diabetes (2026)', page: null });
    expect(protocolCounts(r.protocol).total).toBeGreaterThan(0);
  });
});

describe('foldStarterGbi', () => {
  it('carries the diabetes categories with their criteria', () => {
    const gbi = foldStarterGbi(FOLD_PROTOCOL_CONTENT[0]);
    expect(gbi.categories.map(c => c.id)).toEqual(['diabetes-a1c-9-plus', 'diabetes-a1c-7-to-9', 'diabetes-a1c-at-goal']);
    expect(gbi.categories[0].criteria[0]).toMatchObject({ type: 'lab', lab: 'hba1c', op: '>=', value: 9 });
    expect(foldStarterGbi(FOLD_PROTOCOL_CONTENT[1]).categories).toEqual([]);
  });

  it('keeps titles, priorities and goal links only', () => {
    const gbi = foldStarterGbi({
      goals: [{ title: 'Improve A1C control', priority: 'high' }],
      interventions: [{ title: 'A1C follow-up', goalTitle: 'Improve A1C control' }],
      barriers: [{ title: 'Hypoglycemia risk', goalTitles: ['Improve A1C control'] }],
    });
    expect(gbi).toEqual({
      categories: [],
      goals: [{ title: 'Improve A1C control', priority: 'high' }],
      interventions: [{ title: 'A1C follow-up', goalTitle: 'Improve A1C control' }],
      barriers: [{ title: 'Hypoglycemia risk', goalTitles: ['Improve A1C control'] }],
    });
  });
});

describe('unresolvedTitles', () => {
  it('matches loosely and reports what the library lacks', () => {
    const p = { goals: [{ title: 'improve a1c  control' }, { title: 'Not in the library' }], interventions: [], barriers: [] };
    expect(unresolvedTitles(p, libraries)).toEqual([{ kind: 'goal', title: 'Not in the library' }]);
  });
});

it('isFoldProtocol checks the source kind', () => {
  expect(isFoldProtocol({ sourceKind: 'fold' })).toBe(true);
  expect(isFoldProtocol({ sourceKind: 'pdf' })).toBe(false);
});
