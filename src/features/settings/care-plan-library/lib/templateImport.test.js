import { describe, expect, it } from 'vitest';
import { parseCsv, parseImportFile, planTemplateImport, SAMPLE_CSV, SAMPLE_JSON } from './templateImport';

const library = {
  templates: [
    { id: 't-pub', name: 'Heart Failure Management', status: 'published', scope: 'org', conditions: ['Heart failure'],
      goals: [{ id: 'g1', title: 'Daily weights', subtitle: '', category: 'Vitals', priority: 'medium' }], interventions: [], barriers: [] },
    { id: 't-draft', name: 'COPD Plan', status: 'draft', scope: 'org', conditions: [], goals: [], interventions: [], barriers: [] },
    { id: 't-mine', name: 'My Private Plan', status: 'published', scope: 'user', conditions: [], goals: [], interventions: [], barriers: [] },
  ],
  goals: [{ id: 'lib-g', title: 'Lower HbA1c below 8%', description: 'Library wording', category: 'Labs' }],
};

describe('parseCsv', () => {
  it('handles quotes, doubled quotes and commas inside fields', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
});

describe('template import', () => {
  it('reads the CSV and JSON samples to the same plan', () => {
    const csv = planTemplateImport(parseImportFile('t.csv', SAMPLE_CSV), library);
    const json = planTemplateImport(parseImportFile('t.json', SAMPLE_JSON), library);
    for (const r of [csv, json]) {
      expect(r.plans).toHaveLength(1);
      const [p] = r.plans;
      expect(p.action).toBe('add');
      expect(p.issues.filter(i => i.level === 'error')).toEqual([]);
      expect(p.counts).toEqual({ goals: 2, interventions: 2, barriers: 1, libraryGoals: 1 });
      // A library goal is reused by id; links stay on the template's own items.
      expect(p.template.goals[0].id).toBe('lib-g');
      expect(p.template.interventions.map(i => i.goalTitle)).toEqual(['Lower HbA1c below 8%', 'Check blood glucose daily']);
      expect(p.template.barriers[0].goalTitles).toEqual(['Check blood glucose daily']);
    }
  });

  it('flags structure and reference errors and skips the template', () => {
    const csv = [
      'template,type,title,kind,goals,priority',
      'Bad,goal,Walk daily,,,urgent',
      'Bad,intervention,Call,phone-call,Walk daily,',
      'Bad,barrier,Weather,,Swim daily,',
      'Bad,widget,Thing,,,',
    ].join('\n');
    const [p] = planTemplateImport(parseImportFile('x.csv', csv), library).plans;
    expect(p.action).toBe('skip');
    const msgs = p.issues.map(i => `${i.level}: ${i.message}`);
    expect(msgs).toContain('error: Row 5: type "widget" isn\'t one of goal, intervention, barrier.');
    expect(msgs.some(m => /error: Row 3: kind "phone-call"/.test(m))).toBe(true);
    expect(msgs).toContain('error: Row 4: the barrier refers to goal "Swim daily", which isn\'t in this template.');
    expect(msgs).toContain('warning: Row 2: priority "urgent" isn\'t high, medium or low; using medium.');
  });

  it('decides add, update and skip against the library', () => {
    const json = JSON.stringify([
      // Same as the published template: skip.
      { name: 'heart failure management', conditions: ['Heart failure'], goals: [{ title: 'Daily weights', category: 'Vitals' }] },
      // Different from the published one: a draft revision.
      { name: 'Heart Failure Management', conditions: ['Heart failure'], goals: [{ title: 'Daily weights' }, { title: 'Low salt diet', category: 'Diet' }] },
      // An existing draft is updated in place.
      { name: 'COPD Plan', goals: [{ title: 'Use inhaler daily' }] },
      // A private template of the same name is not a conflict.
      { name: 'My Private Plan', goals: [{ title: 'Something' }] },
      { name: '', goals: [] },
    ]);
    const { plans, totals } = planTemplateImport(parseImportFile('x.json', json), library);
    expect(plans.map(p => [p.action, p.existing?.id || null])).toEqual([
      ['skip', 't-pub'],
      ['skip', null],
      ['update', 't-draft'],
      ['add', null],
      ['skip', null],
    ]);
    // The second Heart Failure row is a duplicate name within the file.
    expect(plans[1].issues[0].message).toMatch(/appears twice in the file/);
    expect(totals).toMatchObject({ add: 1, update: 1, skip: 3, errors: 2 });
  });

  it('treats a changed published template as an update', () => {
    const json = JSON.stringify([{ name: 'Heart Failure Management', conditions: ['Heart failure'], goals: [{ title: 'Daily weights', priority: 'high' }] }]);
    const [p] = planTemplateImport(parseImportFile('x.json', json), library).plans;
    expect([p.action, p.existing.id]).toEqual(['update', 't-pub']);
  });

  it('reports a file it cannot read', () => {
    expect(parseImportFile('x.json', '{oops').fileErrors[0]).toMatch(/isn't valid JSON/);
    expect(parseImportFile('x.csv', 'name,foo\na,b').fileErrors[0]).toMatch(/Missing columns: template, type, title/);
  });
});
