import { describe, expect, it } from 'vitest';
import { buildRuleInputs } from '../../../automations/lib/clinicalCriteria';
import { categoriesProblem, categorySuggestions, describeCriteria, hasCategories, itemsFor, itemsLeaving, matchCategory, newCategory, withCategory } from './templateCategories';

const a1c = (value, date) => ({ event_type: 'lab', code: '4548-4', display: 'Hemoglobin A1c', numeric_value: value, unit: '%', effective_date: date });

const template = {
  id: 't1',
  name: 'Type 2 Diabetes',
  goals: [{ id: 'g1', title: 'Improve diabetes medication adherence' }],
  interventions: [{ id: 'i1', title: 'Medication adherence education' }],
  barriers: [],
  categories: [
    {
      id: 'high', name: 'A1C 9% or above', match: 'all',
      criteria: [{ type: 'lab', lab: 'hba1c', op: '>=', value: 9, withinDays: 180 }],
      goals: [{ id: 'g2', title: 'Improve A1C control', priority: 'high' }, { id: 'g1', title: 'improve diabetes  medication adherence' }],
      interventions: [{ id: 'i2', title: 'A1C follow-up' }],
      barriers: [{ id: 'b1', title: 'Limited progress toward A1C target' }],
    },
    {
      id: 'above', name: 'A1C 7–8.9%', match: 'all',
      criteria: [{ type: 'lab', lab: 'hba1c', op: '>=', value: 7, withinDays: 180 }],
      goals: [{ id: 'g2', title: 'Improve A1C control' }],
      interventions: [], barriers: [],
    },
    {
      id: 'goal', name: 'At goal', match: 'all',
      criteria: [{ type: 'lab', lab: 'hba1c', op: '<', value: 7, withinDays: 365 }],
      goals: [{ id: 'g3', title: 'Maintain glucose within target range' }],
      interventions: [], barriers: [],
    },
  ],
};
const today = new Date(2026, 9, 30);
const inputsFor = (...events) => buildRuleInputs({ clinicalEvents: events });

describe('matchCategory', () => {
  it('takes the first category whose criteria match, with the reason', () => {
    const m = matchCategory(template, inputsFor(a1c(9.4, '2026-09-01')), today);
    expect(m.category.id).toBe('high');
    expect(m.reasons[0]).toContain('HbA1c 9.4 %');
  });

  it('falls through to a later category', () => {
    expect(matchCategory(template, inputsFor(a1c(7.8, '2026-09-01')), today).category.id).toBe('above');
    expect(matchCategory(template, inputsFor(a1c(6.4, '2026-03-01')), today).category.id).toBe('goal');
  });

  it('uses the latest reading', () => {
    const m = matchCategory(template, inputsFor(a1c(9.6, '2026-05-01'), a1c(6.8, '2026-09-20')), today);
    expect(m.category.id).toBe('goal');
  });

  it('matches nothing without a recent enough result', () => {
    expect(matchCategory(template, inputsFor(), today)).toEqual({ category: null, reasons: [] });
    expect(matchCategory(template, inputsFor(a1c(8, '2025-01-01')), today).category).toBeNull();
  });

  it('matches nothing on a template without categories', () => {
    expect(matchCategory({ goals: [] }, inputsFor(a1c(9.4, '2026-09-01')), today).category).toBeNull();
  });
});

describe('withCategory', () => {
  it('adds the category to Common without repeating a title', () => {
    const t = withCategory(template, 'high');
    expect(t.goals.map(g => g.title)).toEqual(['Improve diabetes medication adherence', 'Improve A1C control']);
    expect(t.interventions.map(i => i.id)).toEqual(['i1', 'i2']);
    expect(t.barriers).toHaveLength(1);
    expect(t.category).toEqual({ id: 'high', name: 'A1C 9% or above' });
  });

  it('is Common alone for no or an unknown category', () => {
    expect(withCategory(template, null).goals).toHaveLength(1);
    expect(withCategory(template, 'gone')).toMatchObject({ category: null, goals: template.goals });
  });
});

describe('itemsFor', () => {
  it('compares Common + one category, Common alone, or everything', () => {
    expect(itemsFor(template, 'goals', 'goal').map(g => g.id)).toEqual(['g1', 'g3']);
    expect(itemsFor(template, 'goals', null).map(g => g.id)).toEqual(['g1']);
    expect(itemsFor(template, 'goals', undefined).map(g => g.id)).toEqual(['g1', 'g2', 'g3']);
  });
});

describe('describeCriteria and categoriesProblem', () => {
  it('reads the criteria in plain language', () => {
    expect(describeCriteria(template.categories[0])).toBe('HbA1c >= 9 % (last 180 days)');
    expect(describeCriteria({ match: 'any', criteria: [{ type: 'condition', value: 'Prediabetes' }, { type: 'lab', lab: 'hba1c', op: '>=', value: 5.7 }] }))
      .toBe('Has Prediabetes or HbA1c >= 5.7 %');
  });

  it('wants named, distinct categories with complete criteria', () => {
    expect(categoriesProblem(template.categories)).toBeNull();
    expect(categoriesProblem([newCategory('')])).toBe('Name every category.');
    expect(categoriesProblem([newCategory('A'), newCategory(' a ')])).toBe('Two categories are called "a".');
    expect(categoriesProblem([{ ...newCategory('A'), criteria: [] }])).toBe('Give "A" at least one criterion.');
    expect(categoriesProblem([newCategory('A')])).toBe('Give the lab in "A" a number.');
  });

  it('knows whether a template has categories', () => {
    expect(hasCategories(template)).toBe(true);
    expect(hasCategories({})).toBe(false);
  });
});

describe('itemsLeaving', () => {
  it('is what only the old category had', () => {
    const out = itemsLeaving(template, 'high', 'above');
    // Improve A1C control stays (the new category has it); the barrier goes.
    expect(out.goals).toEqual([]);
    expect(out.interventions.map(i => i.title)).toEqual(['A1C follow-up']);
    expect(out.barriers.map(b => b.title)).toEqual(['Limited progress toward A1C target']);
    expect(itemsLeaving(template, 'above', 'goal').goals.map(g => g.title)).toEqual(['Improve A1C control']);
  });

  it('leaves nothing from Common alone', () => {
    expect(itemsLeaving(template, null, 'high')).toEqual({ goals: [], interventions: [], barriers: [] });
  });
});

describe('categorySuggestions', () => {
  const run = (over = {}) => ({ id: 'r1', templateId: 't1', status: 'active', categoryId: 'above', categoryName: 'A1C 7–8.9%', ...over });
  const inputs = inputsFor(a1c(9.4, '2026-10-01'));

  it('suggests the category the latest results match', () => {
    const [s] = categorySuggestions([run()], [template], inputs, today);
    expect(s).toMatchObject({ to: { id: 'high' }, fromName: 'A1C 7–8.9%' });
    expect(s.reasons[0]).toContain('9.4');
  });

  it('suggests nothing when the run already follows it, it was dismissed, or the run is closed', () => {
    expect(categorySuggestions([run({ categoryId: 'high' })], [template], inputs, today)).toEqual([]);
    expect(categorySuggestions([run({ dismissedCategoryId: 'high' })], [template], inputs, today)).toEqual([]);
    expect(categorySuggestions([run({ status: 'closed' })], [template], inputs, today)).toEqual([]);
    expect(categorySuggestions([run({ episodic: true })], [template], inputs, today)).toEqual([]);
    expect(categorySuggestions([run()], [template], null, today)).toEqual([]);
  });

  it('suggests a category for a run on Common alone', () => {
    const [s] = categorySuggestions([run({ categoryId: null, categoryName: '' })], [template], inputs, today);
    expect(s).toMatchObject({ to: { id: 'high' }, fromName: '' });
  });
});
