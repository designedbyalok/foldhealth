import { describe, expect, it } from 'vitest';
import {
  buildIndividualizedPrompt, buildPatientFacts, buildTemplateChoices, draftCounts, draftLimits, normalizeIndividualizedDraft, recommendedForPrompt,
} from './individualizedPlan';

const today = new Date(2026, 9, 19);
const facts = buildPatientFacts({
  problems: [{ title: 'Type 2 diabetes mellitus', status: 'Active' }, { title: 'Asthma', status: 'Resolved' }],
  clinicalEvents: [
    { event_type: 'diagnosis', display: 'Type 2 diabetes mellitus', effective_date: '2024-03-10' },
    { event_type: 'diagnosis', display: 'Hypertension', effective_date: '2025-02-01' },
    { event_type: 'lab', code: '4548-4', display: 'HbA1c', numeric_value: 8.1, unit: '%', effective_date: '2026-01-15', reference_high: 5.6 },
    { event_type: 'lab', code: '4548-4', display: 'HbA1c', numeric_value: 9.4, unit: '%', effective_date: '2026-05-20', reference_high: 5.6 },
    { event_type: 'lab', code: '2089-1', display: 'LDL', numeric_value: 142, unit: 'mg/dL', effective_date: '2026-05-20' },
    { event_type: 'encounter', display: 'ED visit', effective_date: '2026-09-30' },
    { event_type: 'encounter', display: 'Office visit', effective_date: '2025-01-01' },
  ],
  responses: [{ form_id: 3, answers: { food_worry: 'Often true' }, status: 'completed', completed_at: '2026-10-01' }],
  formNames: new Map([['3', 'Hunger Vital Sign']]),
  barriers: [{ title: 'Transportation', program: 'SNP' }],
}, today);
const byKind = (k) => facts.filter(f => f.kind === k).map(f => f.text);

describe('buildPatientFacts', () => {
  it('numbers each input and dedupes conditions', () => {
    expect(facts[0].id).toBe('F1');
    expect(byKind('condition')).toEqual(['Type 2 diabetes mellitus (problem list)', 'Hypertension (diagnosed 02/01/2025)']);
  });

  it('turns a lab series into a trend with its direction and range', () => {
    expect(byKind('lab_trend')).toEqual(['HbA1c 8.1 → 9.4 % (01/15/2026 → 05/20/2026), rising, above range']);
    expect(byKind('lab')).toEqual(['LDL 142 mg/dL on 05/20/2026']);
  });

  it('keeps recent events, the latest assessment and open barriers', () => {
    expect(byKind('event')).toEqual(['ED visit on 09/30/2026']);
    expect(byKind('assessment')).toEqual(['Hunger Vital Sign (10/01/2026): food_worry = Often true']);
    expect(byKind('barrier')).toEqual(['Transportation (open barrier on SNP)']);
  });
});

describe('normalizeIndividualizedDraft', () => {
  const templates = buildTemplateChoices(
    [{ id: 't-dm', name: 'Diabetes Management', status: 'published', scope: 'org', conditions: ['Diabetes'], goals: [{ id: 'g1' }] },
      { id: 't-private', name: 'Mine', status: 'published', scope: 'user', goals: [] }],
    [{ id: 'g1', title: 'Improve A1C control' }],
  );
  const catalog = {
    goals: [{ id: 'g1', title: 'Improve A1C control', frequency: 'Quarterly' }],
    interventions: [{ id: 'i1', title: 'Diabetes diet education', kind: 'patient-education' }],
    barriers: [{ id: 'b1', title: 'Transportation' }],
  };
  const a1c = facts.find(f => f.kind === 'lab_trend').id;
  const food = facts.find(f => f.kind === 'assessment').id;
  const raw = {
    summary: 'Bring A1C down with medication adherence and diet support.',
    templates: [{ templateId: 't-dm', why: 'Diabetes with rising A1C', citations: [a1c] }, { templateId: 'nope', why: 'x', citations: [a1c] }],
    goals: [
      { libraryId: 'g1', title: 'Improve A1C control', priority: 'high', rationale: 'A1C is rising', citations: [a1c, 'F999'] },
      { libraryId: null, title: 'Uncited goal', priority: 'low', rationale: 'no evidence', citations: ['F999'] },
    ],
    interventions: [
      { libraryId: 'i1', title: 'Diabetes diet education', kind: 'internal-task', goalTitle: 'improve a1c control', rationale: 'Food insecurity', citations: [food] },
    ],
    barriers: [{ libraryId: null, title: 'transportation', goalTitles: ['Improve A1C control'], rationale: 'Open barrier', citations: [facts.find(f => f.kind === 'barrier').id] }],
  };
  const draft = normalizeIndividualizedDraft(raw, { facts, templates, catalog });

  it('keeps only real templates, and only org templates are offered', () => {
    expect(templates.map(t => t.id)).toEqual(['t-dm']);
    expect(draft.templates).toEqual([{ id: 't-dm', name: 'Diabetes Management', why: 'Diabetes with rising A1C', citations: [expect.objectContaining({ fact: a1c, kind: 'lab_trend' })] }]);
  });

  it('drops invented citations and any item left with none', () => {
    expect(draft.goals).toHaveLength(1);
    expect(draft.goals[0].citations.map(c => c.fact)).toEqual([a1c]);
    expect(draft.goals[0].citations[0].text).toContain('HbA1c 8.1 → 9.4');
  });

  it('resolves library items and links to drafted goals', () => {
    expect(draft.goals[0]).toMatchObject({ libraryId: 'g1', priority: 'high', frequency: 'Quarterly' });
    expect(draft.interventions[0]).toMatchObject({ libraryId: 'i1', kind: 'patient-education', goalTitle: 'Improve A1C control' });
    expect(draft.barriers[0]).toMatchObject({ libraryId: 'b1', title: 'Transportation', goalTitles: ['Improve A1C control'] });
    expect(draftCounts(draft)).toBe('1 goal, 1 intervention, 1 barrier');
  });

  it('returns null when no goal is grounded', () => {
    expect(normalizeIndividualizedDraft({ goals: [{ title: 'x', citations: [] }] }, { facts, templates, catalog })).toBeNull();
  });

  it('puts every fact in the prompt for the model to cite', () => {
    const prompt = buildIndividualizedPrompt({ facts, templates, catalog, programName: 'Disease Management' });
    for (const f of facts) expect(prompt).toContain(f.id);
    expect(prompt).toContain('Disease Management');
  });
});

describe('automation-recommended plans', () => {
  const templates = buildTemplateChoices(
    [
      { id: 't-dm', name: 'Diabetes Management', status: 'published', scope: 'org', goals: [{ id: 'g1' }] },
      { id: 't-htn', name: 'Hypertension', status: 'published', scope: 'org', goals: [] },
      { id: 't-other', name: 'COPD', status: 'published', scope: 'org', goals: [] },
    ],
    [{ id: 'g1', title: 'Improve A1C control' }],
  );
  const catalog = { goals: [{ id: 'g1', title: 'Improve A1C control' }], interventions: [], barriers: [] };
  const a1c = facts.find(f => f.kind === 'lab_trend').id;
  const recommended = [
    { templateId: 't-dm', rule: 'Diabetes with A1C over 9', criteria: ['HbA1c > 9'] },
    { templateId: 't-htn', rule: 'Hypertension', criteria: ['Has Hypertension'] },
    { templateId: 't-htn', rule: 'Duplicate', criteria: [] },
    { templateId: 'gone', rule: 'Deleted template', criteria: [] },
  ];

  it('keeps one entry per template that was sent', () => {
    expect(recommendedForPrompt(recommended, templates).map(r => r.templateId)).toEqual(['t-dm', 't-htn']);
  });

  it('grows the caps with the number of matched templates', () => {
    expect(draftLimits(0)).toEqual({ templates: 2, goals: 6, interventions: 12, barriers: 8 });
    expect(draftLimits(3)).toEqual({ templates: 3, goals: 10, interventions: 20, barriers: 12 });
    expect(draftLimits(20).goals).toBe(12);
  });

  it('asks the model to merge every match', () => {
    const prompt = buildIndividualizedPrompt({ facts, templates, catalog, programName: 'CCM', recommended });
    expect(prompt).toContain('Use ALL of them');
    expect(prompt).toContain('MATCHES (JSON)');
    expect(prompt).toContain('Diabetes with A1C over 9');
    expect(buildIndividualizedPrompt({ facts, templates, catalog })).not.toContain('MATCHES');
  });

  it('records every matched template, and only matched ones', () => {
    const draft = normalizeIndividualizedDraft({
      summary: 'Diabetes and blood pressure.',
      templates: [{ templateId: 't-dm', why: 'A1C rising', citations: [a1c] }, { templateId: 't-other', why: 'x', citations: [a1c] }],
      goals: [{ libraryId: 'g1', title: 'Improve A1C control', priority: 'high', rationale: 'A1C', citations: [a1c] }],
      interventions: [],
      barriers: [],
    }, { facts, templates, catalog, recommended });
    expect(draft.templates.map(t => [t.id, t.automation])).toEqual([
      ['t-dm', 'Diabetes with A1C over 9'],
      ['t-htn', 'Hypertension'],
    ]);
    expect(draft.templates[1]).toMatchObject({ why: 'Matched by automation: Hypertension', citations: [] });
  });
});
