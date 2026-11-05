import { describe, expect, it, vi } from 'vitest';
import { buildScopeRequest, buildTemplateCatalog, buildTemplateDraftPrompt, buildTemplateReference, normalizeTemplateDraft } from './aiTemplateDraft';
import { draftProvenance, materializeNewGoals, templateDraftToEditor, templateDraftToTemplate, withoutDraftMarks } from './templateDraftToEditor';

vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

const libraryGoals = [
  {
    id: 'g-a1c', title: 'Improve A1C control', category: 'Labs', frequency: 'Quarterly', duration: '6', durationUnit: 'Month',
    interventions: [
      { id: 'l1', kind: 'measure-vital', title: 'Check A1C' },
      { id: 'l2', kind: 'barrier', title: 'Cost of medication' },
    ],
  },
];
const interventionLibrary = [{ id: 'i-edu', kind: 'patient-education', title: 'Diabetes diet education', config: { note: 'x' } }];
const barrierLibrary = [{ id: 'b-transport', title: 'Transportation' }];
const catalog = buildTemplateCatalog({ goals: libraryGoals, interventions: interventionLibrary, barriers: barrierLibrary });

const raw = {
  name: 'New Type 2 diabetes',
  summary: 'Medication adherence and dietary counseling for newly diagnosed T2D.',
  templateType: 'chronic',
  conditions: ['Type 2 diabetes mellitus'],
  goals: [
    {
      libraryId: 'g-a1c', title: 'Improve A1C control', priority: 'high', frequency: 'Monthly',
      interventions: [{ libraryId: 'i-edu', title: 'Diabetes diet education', kind: 'internal-task' }],
      barriers: [{ libraryId: 'invented-id', title: 'transportation' }],
    },
    {
      libraryId: null, title: 'Take metformin as prescribed', category: 'Others', priority: 'URGENT', frequency: 'Hourly',
      duration: 3, durationUnit: 'Month',
      interventions: [{ libraryId: null, title: 'Pill box setup call', kind: 'nonsense', repeatEvery: 2, repeatEveryUnit: 'Weeks' }],
      barriers: [],
    },
    { libraryId: null, title: '  ', priority: 'low', frequency: 'Daily', interventions: [], barriers: [] },
  ],
};

describe('normalizeTemplateDraft', () => {
  const draft = normalizeTemplateDraft(raw, catalog);

  it('keeps real library references and resolves invented ids by title', () => {
    expect(draft.goals[0].libraryId).toBe('g-a1c');
    expect(draft.goals[0].interventions[0].libraryId).toBe('i-edu');
    // The library kind wins over the model's.
    expect(draft.goals[0].interventions[0].kind).toBe('patient-education');
    expect(draft.goals[0].barriers[0]).toEqual({ libraryId: 'b-transport', title: 'Transportation' });
  });

  it('clamps values to the library vocabulary and drops empty goals', () => {
    const fresh = draft.goals[1];
    expect(fresh.libraryId).toBeNull();
    expect(fresh.priority).toBe('medium');
    expect(fresh.frequency).toBe('Monthly');
    expect(fresh.duration).toBe('3');
    expect(fresh.interventions[0]).toMatchObject({ kind: 'internal-task', repeatEvery: 2, repeatEveryUnit: 'Weeks' });
    expect(draft.goals).toHaveLength(2);
  });

  it('returns null without goals', () => {
    expect(normalizeTemplateDraft({ goals: [] }, catalog)).toBeNull();
    expect(normalizeTemplateDraft('nope', catalog)).toBeNull();
  });
});

describe('templateDraftToEditor', () => {
  const draft = normalizeTemplateDraft(raw, catalog);
  const lists = templateDraftToEditor(draft, { libraryGoals, interventionLibrary, barrierLibrary });

  it('brings a library goal in as itself, with its own links', () => {
    expect(lists.goals[0]).toBe(libraryGoals[0]);
    expect(lists.interventions.map(i => i.title)).toContain('Check A1C');
    expect(lists.barriers.map(b => b.title)).toContain('Cost of medication');
  });

  it('holds a new goal with its links and no invented target', () => {
    const g = lists.goals[1];
    expect(g.aiNew).toBe(true);
    expect(g.setTarget).toBe(false);
    expect(g.conditions).toEqual(['Type 2 diabetes mellitus']);
    expect(g.interventions).toEqual([{ kind: 'internal-task', title: 'Pill box setup call', config: { repeat: true, repeatEvery: '2', repeatEveryUnit: 'Weeks' } }]);
  });

  it('counts what came from the library', () => {
    expect(draftProvenance(lists)).toMatchObject({ goals: 2, fresh: 2 });
  });

  it('creates new goals in the library before the template saves', async () => {
    const save = vi.fn(async (values) => ({ ...values, id: 'saved-1' }));
    const out = await materializeNewGoals(lists.goals, save);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].id).toBeUndefined();
    expect(out[0]).toBe(libraryGoals[0]);
    expect(out[1].id).toBe('saved-1');
    expect(await materializeNewGoals(lists.goals, async () => null)).toBeNull();
    expect(withoutDraftMarks(lists.interventions).some(i => 'aiNew' in i)).toBe(false);
  });
});

describe('drafting from a protocol with categories', () => {
  const lib = {
    goals: [
      ...libraryGoals,
      { id: 'g-glucose', title: 'Monitor blood glucose consistently', category: 'Vitals', frequency: 'Daily', interventions: [] },
      { id: 'g-adherence', title: 'Improve diabetes medication adherence', category: 'Others', frequency: 'Weekly', interventions: [] },
    ],
    interventions: interventionLibrary,
    barriers: barrierLibrary,
  };
  const cat = buildTemplateCatalog(lib);
  const goal = (libraryId, title) => ({ libraryId, title, priority: 'medium', frequency: 'Monthly', interventions: [], barriers: [] });
  const answer = {
    name: 'Diabetes per Harbor CPG', summary: 'Follows the Harbor protocol.', templateType: 'chronic', conditions: ['Diabetes'],
    goals: [goal('g-adherence', 'Improve diabetes medication adherence'), goal(null, 'Invented goal')],
    categories: [
      {
        name: 'A1C 9% or above',
        criteria: [{ type: 'lab', lab: 'hba1c', op: '>=', value: 9, withinDays: 180, condition: null }, { type: 'lab', lab: 'ferritin', op: '>', value: 1 }],
        goals: [goal('g-a1c', 'Improve A1C control'), goal('g-adherence', 'Improve diabetes medication adherence')],
      },
      { name: 'Prediabetes', criteria: [{ type: 'condition', condition: 'Prediabetes' }], goals: [goal('g-glucose', 'Monitor blood glucose consistently')] },
      { name: 'No criteria', criteria: [{ type: 'lab', lab: 'hba1c', op: '>=', value: null }], goals: [goal('g-glucose', 'Monitor blood glucose consistently')] },
      { name: 'a1c 9% OR ABOVE', criteria: [{ type: 'condition', condition: 'X' }], goals: [goal('g-glucose', 'Monitor blood glucose consistently')] },
    ],
  };

  it('keeps categories with valid criteria and their own library goals', () => {
    const d = normalizeTemplateDraft(answer, cat, { categories: true, libraryOnly: true });
    expect(d.goals.map(g => g.title)).toEqual(['Improve diabetes medication adherence']);
    expect(d.categories.map(c => c.name)).toEqual(['A1C 9% or above', 'Prediabetes']);
    expect(d.categories[0].criteria).toEqual([{ type: 'lab', lab: 'hba1c', op: '>=', value: 9, withinDays: 180 }]);
    // A category may repeat a Common goal (to carry its own interventions).
    expect(d.categories[0].goals.map(g => g.title)).toEqual(['Improve A1C control', 'Improve diabetes medication adherence']);
    expect(d.categories[1].criteria).toEqual([{ type: 'condition', value: 'Prediabetes' }]);
  });

  it('ignores categories unless asked, and keeps new items unless library-only', () => {
    const d = normalizeTemplateDraft(answer, cat);
    expect(d.categories).toEqual([]);
    expect(d.goals.map(g => g.title)).toContain('Invented goal');
  });

  it('becomes template content: Common lists plus each category\'s own', () => {
    const d = normalizeTemplateDraft(answer, cat, { categories: true, libraryOnly: true });
    const t = templateDraftToTemplate(d, { libraryGoals: lib.goals, interventionLibrary: lib.interventions, barrierLibrary: lib.barriers });
    expect(t.goals.map(g => g.id)).toEqual(['g-adherence']);
    expect(t.categories[0]).toMatchObject({ name: 'A1C 9% or above', match: 'all' });
    expect(t.categories[0].goals.map(g => g.id)).toEqual(['g-a1c']);
    // The library goal brings its own links into its category.
    expect(t.categories[0].interventions.map(i => i.title)).toEqual(['Check A1C']);
    expect(t.categories[0].barriers.map(b => b.title)).toEqual(['Cost of medication']);
  });

  it('keeps a category that repeats a Common goal for its own interventions', () => {
    const repeat = {
      ...answer,
      categories: [{
        name: 'A1C 9% or above',
        criteria: [{ type: 'lab', lab: 'hba1c', op: '>=', value: 9 }],
        goals: [{ ...goal('g-adherence', 'Improve diabetes medication adherence'), interventions: [{ libraryId: 'i-edu', title: 'Diabetes diet education', kind: 'patient-education' }] }],
      }],
    };
    const d = normalizeTemplateDraft(repeat, cat, { categories: true, libraryOnly: true });
    const t = templateDraftToTemplate(d, { libraryGoals: lib.goals, interventionLibrary: lib.interventions, barrierLibrary: lib.barriers });
    expect(t.categories).toHaveLength(1);
    expect(t.categories[0].goals).toEqual([]);
    expect(t.categories[0].interventions.map(i => i.title)).toEqual(['Diabetes diet education']);
  });

  it('library-only holds goals to the catalog but keeps new interventions and barriers', () => {
    const fresh = {
      ...answer,
      goals: [{ ...goal('g-adherence', 'Improve diabetes medication adherence'),
        interventions: [{ libraryId: null, title: 'Same-day clinician call', kind: 'internal-task' }],
        barriers: [{ libraryId: null, title: 'No home BP cuff' }] }],
      categories: [],
    };
    const d = normalizeTemplateDraft(fresh, cat, { categories: true, libraryOnly: true });
    expect(d.goals[0].interventions[0]).toMatchObject({ libraryId: null, title: 'Same-day clinician call' });
    expect(d.goals[0].barriers[0]).toEqual({ libraryId: null, title: 'No home BP cuff' });
  });

  it('asks for categories and library-only only when told to', () => {
    const protocol = { title: 'Harbor CPG', guidance: 'A1C >= 9: escalate.' };
    const withCats = buildTemplateDraftPrompt('A care plan following Harbor CPG.', cat, protocol, { categories: true, libraryOnly: true });
    expect(withCats).toContain('Categories:');
    expect(withCats).toContain('hba1c = HbA1c (%)');
    expect(withCats).toContain('Goals come from the library only');
    const plain = buildTemplateDraftPrompt('A care plan following Harbor CPG.', cat, protocol);
    expect(plain).not.toContain('Categories:');
    expect(plain).toContain('Reuse the library.');
  });

  it('bases the draft on a reference template when given one', () => {
    const reference = buildTemplateReference({
      name: 'Diabetes basics',
      goals: [{ title: 'Improve A1C control' }, undefined],
      interventions: ['Check A1C'],
      barriers: [],
    });
    expect(reference).toEqual({ name: 'Diabetes basics', goals: ['Improve A1C control'], interventions: ['Check A1C'], barriers: [] });
    const prompt = buildTemplateDraftPrompt('A plan for newly diagnosed diabetes.', cat, null, { reference });
    expect(prompt).toContain('Reference template to base the draft on: Diabetes basics.');
    expect(prompt).toContain('"goals":["Improve A1C control"]');
    expect(buildTemplateDraftPrompt('A plan for newly diagnosed diabetes.', cat)).not.toContain('Reference template');
    expect(buildTemplateReference({ name: 'Empty', goals: [] })).toBeNull();
  });
});

describe('drafting a protocol scope', () => {
  const goal = (title, libraryId = null) => ({ libraryId, title, priority: 'high', frequency: 'Weekly', interventions: [{ libraryId: null, title: `${title} check-in`, kind: 'internal-task' }], barriers: [{ libraryId: null, title: 'Cost' }] });
  const answer = {
    name: 'Low back pain', summary: 's', templateType: 'chronic', conditions: ['Low back pain'],
    overview: 'Conservative care first; refer when red flags appear.',
    commonExplanation: 'Every patient: goal 1 is staying active.',
    goals: [],
    categories: [
      { name: 'Acute', range: 'Pain up to 4 weeks', explanation: 'For pain up to 4 weeks, goal 1 is pain relief.', criteria: [], goals: [goal('Reduce pain')] },
      { name: 'SBP 140+', range: 'Systolic BP 140 mmHg or above', explanation: 'e', criteria: [{ type: 'lab', lab: 'sbp', op: '>=', value: 140, withinDays: 90 }], goals: [goal('Lower BP')] },
    ],
  };

  it('keeps the plain-language text and categories the labs cannot check', () => {
    const d = normalizeTemplateDraft(answer, catalog, { categories: true, scope: true });
    expect(d.overview).toBe('Conservative care first; refer when red flags appear.');
    expect(d.commonExplanation).toBe('Every patient: goal 1 is staying active.');
    expect(d.goals).toEqual([]);
    expect(d.categories.map(c => [c.name, c.range, c.criteria.length])).toEqual([['Acute', 'Pain up to 4 weeks', 0], ['SBP 140+', 'Systolic BP 140 mmHg or above', 1]]);
    expect(d.categories[0].goals[0].interventions[0].title).toBe('Reduce pain check-in');
  });

  it('drops categories without criteria outside a scope, and needs goals somewhere', () => {
    expect(normalizeTemplateDraft(answer, catalog, { categories: true })).toBeNull();
    expect(normalizeTemplateDraft({ ...answer, categories: [] }, catalog, { categories: true, scope: true })).toBeNull();
  });

  it('asks for the reviewer\'s categories and goal counts when the scope was edited', () => {
    const edited = buildScopeRequest({ categories: [{ name: 'Stage 2', range: 'SBP 140–179 mmHg', goals: 3 }, { name: ' ' }], commonGoals: 2 });
    expect(edited).toEqual({ categories: [{ name: 'Stage 2', range: 'SBP 140–179 mmHg', goals: 3 }], commonGoals: 2 });
    const prompt = buildTemplateDraftPrompt('A plan', catalog, { title: 'HTN', guidance: 'Thresholds: SBP' }, { categories: true, scope: edited });
    expect(prompt).toContain('Use exactly these categories');
    expect(prompt).toContain('"range":"SBP 140–179 mmHg"');
    expect(prompt).toContain('exactly 2 Common goals');
    expect(buildScopeRequest(null)).toBeNull();
  });

  it('turns a section edited by hand into template content exactly as edited', () => {
    const libraries = { libraryGoals: [], interventionLibrary: [], barrierLibrary: [] };
    const common = { goals: [{ id: 'g1', title: 'Monitor BP' }], interventions: [{ id: 'i1', title: 'BP check', kind: 'measure-vital' }], barriers: [] };
    const stage2 = {
      goals: [{ id: 'g1', title: 'Monitor BP' }, { id: 'g2', title: 'Start medication' }],
      interventions: [{ id: 'i2', title: 'Medication review', kind: 'internal-task' }],
      barriers: [{ id: 'b1', title: 'Cost' }],
    };
    const t = templateDraftToTemplate({ goals: [], lists: common, categories: [{ id: 'c2', name: 'Stage 2', criteria: [], goals: [], lists: stage2 }] }, libraries);
    expect(t.goals.map(g => g.title)).toEqual(['Monitor BP']);
    expect(t.interventions.map(i => i.title)).toEqual(['BP check']);
    // The category keeps only what Common lacks.
    expect(t.categories[0].goals.map(g => g.title)).toEqual(['Start medication']);
    expect(t.categories[0].interventions.map(i => i.title)).toEqual(['Medication review']);
    expect(t.categories[0].barriers.map(b => b.title)).toEqual(['Cost']);
  });
});
