import { describe, expect, it } from 'vitest';
import { appliedTemplatesAcross, templateItemTitles } from './allProgramsTemplates';
import { filterCarePlanSnapshot } from './carePlanSnapshot';

const templates = [
  { id: 't-dm', name: 'Diabetes Management', goals: [{ id: 'lg-a1c' }], interventions: [{ title: 'A1C follow-up' }], barriers: [] },
  { id: 't-htn', name: 'Hypertension', goals: [{ title: 'Lower blood pressure' }], interventions: [], barriers: [] },
  { id: 't-empty', name: 'Blank', goals: [], interventions: [], barriers: [] },
];
const programs = [{ id: 'p1', code: 'CCM' }, { id: 'p2', code: 'DM' }];
const plans = {
  'pt::p1': { plan: { appliedTemplateIds: ['t-htn', 't-dm'], appliedTemplatePriorities: { 't-dm': 'low', 't-htn': 'medium' } } },
  'pt::p2': { plan: { appliedTemplateIds: ['t-dm', 'gone'], appliedTemplatePriorities: { 't-dm': 'high' } } },
};

describe('appliedTemplatesAcross', () => {
  it('merges the programs’ templates, highest priority first, with the programs each is on', () => {
    const out = appliedTemplatesAcross(programs, plans, 'pt', templates);
    expect(out.map(a => [a.template.id, a.priority, a.programCodes])).toEqual([
      ['t-dm', 'high', ['CCM', 'DM']],
      ['t-htn', 'medium', ['CCM']],
    ]);
  });
});

describe('template filter on the All Programs plan', () => {
  const row = (id, title, programCode, templateIds, extra = {}) => ({ id, title, programCode, templateIds, ...extra });
  const snapshot = {
    conditions: [],
    goals: [row('g1', 'Improve A1C control', 'CCM', ['t-htn', 't-dm']), row('g2', 'Lower blood pressure', 'CCM', ['t-htn', 't-dm'])],
    interventions: [row('i1', 'A1C follow-up', 'CCM', ['t-htn', 't-dm']), row('i2', 'Home BP log', 'CCM', ['t-htn', 't-dm'])],
    barriers: [row('b1', 'Cost of strips', 'CCM', ['t-htn', 't-dm'], { goalId: 'g1' }), row('b2', 'Busy schedule', 'CCM', ['t-htn', 't-dm'], { goalId: 'g2' })],
  };
  const scopes = { 't-dm': templateItemTitles(templates[0], [{ id: 'lg-a1c', title: 'Improve A1C control' }]) };

  it('keeps only the items the template put on the plan, and the barriers on its goals', () => {
    const out = filterCarePlanSnapshot(snapshot, { templateFilter: ['t-dm'], templateScopes: scopes });
    expect(out.goals.map(g => g.id)).toEqual(['g1']);
    expect(out.interventions.map(i => i.id)).toEqual(['i1']);
    expect(out.barriers.map(b => b.id)).toEqual(['b1']);
  });

  it('keeps every row of the plan when the template lists no items', () => {
    const out = filterCarePlanSnapshot(snapshot, { templateFilter: ['t-htn'] });
    expect(out.goals).toHaveLength(2);
  });
});
