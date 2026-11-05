import { describe, expect, it } from 'vitest';
import {
  buildRuleInputs, describeCondition, evaluateRule, mapAutomationRuleRow, ruleProblem, rulesForProgram,
} from './clinicalCriteria';

const today = new Date(2026, 9, 19);
const inputs = buildRuleInputs({
  problems: [{ title: 'Type 2 diabetes mellitus', status: 'Active' }, { title: 'Asthma', status: 'Resolved' }],
  clinicalEvents: [
    { event_type: 'lab', code: '4548-4', display: 'Hemoglobin A1c', numeric_value: 8.1, unit: '%', effective_date: '2026-01-15' },
    { event_type: 'lab', code: '4548-4', display: 'Hemoglobin A1c', numeric_value: 9.4, unit: '%', effective_date: '2026-05-20' },
    { event_type: 'encounter', display: 'Inpatient admission', code: 'IMP', effective_date: '2026-10-05' },
    { event_type: 'diagnosis', display: 'Chronic kidney disease, stage 3', effective_date: '2025-02-01' },
  ],
  responses: [{ form_id: 7, answers: { food_worry: 'Often true', phq2: '4' }, status: 'completed', completed_at: '2026-10-01' }],
});

const rule = (conditions, extra = {}) => ({ id: 'r1', name: 'R', enabled: true, programCodes: [], match: 'all', conditions, templateIds: ['t1'], ...extra });

describe('evaluateRule', () => {
  it('matches Diabetes + HbA1c > 9 on the latest result, citing each input', () => {
    const r = evaluateRule(rule([{ type: 'condition', value: 'Diabetes' }, { type: 'lab', lab: 'hba1c', op: '>', value: 9, withinDays: 365 }]), inputs, today);
    expect(r.matched).toBe(true);
    expect(r.reasons[0].text).toBe('Has Diabetes (problem list: Type 2 diabetes mellitus)');
    expect(r.reasons[1].text).toBe('HbA1c 9.4 % on 05/20/2026 is above 9');
  });

  it('uses only the latest lab and respects the window', () => {
    expect(evaluateRule(rule([{ type: 'lab', lab: 'hba1c', op: '<', value: 9 }]), inputs, today).matched).toBe(false);
    const old = evaluateRule(rule([{ type: 'lab', lab: 'hba1c', op: '>', value: 9, withinDays: 30 }]), inputs, today);
    expect(old.matched).toBe(false);
    expect(old.reasons[0].text).toMatch(/older than 30 days/);
  });

  it('ignores resolved problems and reads diagnosis events', () => {
    expect(evaluateRule(rule([{ type: 'condition', value: 'asthma' }]), inputs, today).matched).toBe(false);
    expect(evaluateRule(rule([{ type: 'condition', value: 'kidney' }]), inputs, today).reasons[0].text).toMatch(/diagnosis/);
  });

  it('reads recent encounters and assessment answers', () => {
    expect(evaluateRule(rule([{ type: 'event', event: 'inpatient', withinDays: 30 }]), inputs, today).matched).toBe(true);
    expect(evaluateRule(rule([{ type: 'event', event: 'ed', withinDays: 30 }]), inputs, today).matched).toBe(false);
    expect(evaluateRule(rule([{ type: 'assessment', formId: '7', question: 'food_worry', op: 'contains', value: 'often' }]), inputs, today).matched).toBe(true);
    expect(evaluateRule(rule([{ type: 'assessment', question: 'phq2', op: '>=', value: 3 }]), inputs, today).matched).toBe(true);
  });

  it('reads urine ACR and PHQ-9 scores from clinical events', () => {
    const scored = buildRuleInputs({
      clinicalEvents: [
        { event_type: 'lab', display: 'Albumin/Creatinine ratio, urine', numeric_value: '42', unit: 'mg/g', effective_date: '2026-10-14' },
        { event_type: 'prom', display: 'PHQ-9 depression screening', numeric_value: '14', effective_date: '2025-11-12' },
        { event_type: 'prom', display: 'PHQ-9 depression screening', numeric_value: '7', effective_date: '2026-10-14' },
      ],
    });
    const acr = evaluateRule(rule([{ type: 'lab', lab: 'uacr', op: '>', value: 30, withinDays: 180 }]), scored, today);
    expect(acr.matched).toBe(true);
    expect(acr.reasons[0].text).toBe('Urine albumin-to-creatinine ratio 42 mg/g on 10/14/2026 is above 30');
    // The latest PHQ-9 counts, not the older 14.
    const phq = evaluateRule(rule([{ type: 'score', score: 'phq9', op: '>=', value: 10, withinDays: 90 }]), scored, today);
    expect(phq.matched).toBe(false);
    expect(phq.reasons[0].text).toBe('PHQ-9 7 on 10/14/2026 is not at or above 10');
    expect(evaluateRule(rule([{ type: 'score', score: 'phq9', op: '>=', value: 10 }]), inputs, today).reasons[0].text).toBe('No PHQ-9 score');
  });

  it('any vs all, and never matches with no conditions', () => {
    const conds = [{ type: 'condition', value: 'Diabetes' }, { type: 'condition', value: 'COPD' }];
    expect(evaluateRule(rule(conds), inputs, today).matched).toBe(false);
    expect(evaluateRule(rule(conds, { match: 'any' }), inputs, today).matched).toBe(true);
    expect(evaluateRule(rule([]), inputs, today).matched).toBe(false);
  });
});

describe('rule plumbing', () => {
  it('runs only enabled rules for the program (empty = any)', () => {
    const rules = [rule([], { id: 'a' }), rule([], { id: 'b', programCodes: ['SNP'] }), rule([], { id: 'c', enabled: false })];
    expect(rulesForProgram(rules, 'DM').map(r => r.id)).toEqual(['a']);
    expect(rulesForProgram(rules, 'SNP').map(r => r.id)).toEqual(['a', 'b']);
  });

  it('explains what a rule needs before it can save', () => {
    expect(ruleProblem({ name: '' })).toMatch(/Name/);
    expect(ruleProblem({ name: 'x', conditions: [{ type: 'lab', lab: 'hba1c', value: '' }] })).toMatch(/threshold/);
    expect(ruleProblem({ name: 'x', conditions: [{ type: 'condition', value: 'Diabetes' }], templateIds: [] })).toMatch(/template/);
    expect(ruleProblem(rule([{ type: 'condition', value: 'Diabetes' }]))).toBeNull();
    expect(ruleProblem({ name: 'x', conditions: [{ type: 'score', score: 'phq9', value: '' }] })).toMatch(/score/);
  });

  it('describes conditions and maps rows', () => {
    expect(describeCondition({ type: 'lab', lab: 'hba1c', op: '>', value: 9, withinDays: 365 })).toBe('HbA1c > 9 % (last 365 days)');
    expect(describeCondition({ type: 'score', score: 'phq9', op: '>=', value: 10, withinDays: 90 })).toBe('PHQ-9 >= 10 (last 90 days)');
    expect(mapAutomationRuleRow({ id: 'x', name: 'N', program_codes: ['SNP'], conditions: [{ type: 'condition', value: 'D' }], template_ids: ['t'], enabled: false }))
      .toMatchObject({ id: 'x', programCodes: ['SNP'], enabled: false, match: 'all', reviewer: null });
  });
});
