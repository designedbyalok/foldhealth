/**
 * Clinical review trail. These tests assert the encoded cutoffs and critical
 * triggers for each validated instrument against its published scoring. A
 * failure here means the clinical content drifted, treat as a patient-safety
 * regression, not a flaky test.
 */
import { describe, it, expect } from 'vitest';
import { INSTRUMENTS, instantiateInstrument } from './validatedInstruments';
import { toQuestionnaire } from './engineAdapter';
import { evaluate } from '../scoring/evaluate';
import { validateForm } from '../scoring/validate';

// Build a runnable form from one instrument instance.
function formOf(inst) {
  const { field, score, criticalTriggers } = instantiateInstrument(inst);
  return { field, form: { questionnaire: toQuestionnaire([field]), scores: [score], criticalTriggers } };
}

// Answer every coded item of the instrument with the option at `pick(item)`.
function answerAll(field, pickValue) {
  const ans = {};
  for (const it of field.items) {
    if (it.code && it.options) ans[it.linkId] = pickValue(it);
  }
  return ans;
}

const byKey = Object.fromEntries(INSTRUMENTS.map((i) => [i.key, i]));

describe('validated instruments: structure', () => {
  it.each(INSTRUMENTS.map((i) => [i.key, i]))('%s passes author-time validation (bands tile range)', (_key, inst) => {
    const { form } = formOf(inst);
    const errors = validateForm(form).filter((d) => d.level === 'error');
    expect(errors).toEqual([]);
  });

  it.each(INSTRUMENTS.map((i) => [i.key, i]))('%s is fully locked', (_key, inst) => {
    const { field, form } = formOf(inst);
    expect(field.locked).toBe(true);
    expect(form.scores[0].locked).toBe(true);
    field.items.filter((x) => x.code).forEach((x) => expect(x.locked).toBe(true));
  });
});

describe('PHQ-9 cutoffs', () => {
  const inst = byKey.phq9;
  const { field, form } = formOf(inst);
  const score = (v) => evaluate(form, answerAll(field, () => v));

  it('all "Nearly every day" = 27 → Severe', () => {
    const r = score('Nearly every day');
    const s = r.scores[0];
    expect(s.value).toBe(27);
    expect(s.band.label).toBe('Severe');
  });
  it('all "Not at all" = 0 → Minimal, no critical', () => {
    const r = score('Not at all');
    expect(r.scores[0].value).toBe(0);
    expect(r.scores[0].band.label).toBe('Minimal');
    expect(r.criticalsTriggered).toHaveLength(0);
  });
  it('Q9 positive fires the self-harm trigger even at a low total', () => {
    const ans = answerAll(field, () => 'Not at all');
    const q9 = field.items.find((x) => x.code === 'q9');
    ans[q9.linkId] = 'Several days'; // score 1, total 1 → Minimal band
    const r = evaluate(form, ans);
    expect(r.scores[0].band.label).toBe('Minimal');
    expect(r.criticalsTriggered).toHaveLength(1);
    expect(r.criticalsTriggered[0].severity).toBe('critical');
  });
  it('band edges: 9→Mild, 10→Moderate, 14→Moderate, 15→Moderately severe', () => {
    // Hand-pick totals via mixed answers is overkill; assert band lookups via the engine
    // by constructing exact totals from uniform + one adjusted item is complex, so check
    // the stored band table directly.
    const bands = form.scores[0].interpretations;
    expect(bands.find((b) => 9 >= b.min && 9 <= b.max).label).toBe('Mild');
    expect(bands.find((b) => 10 >= b.min && 10 <= b.max).label).toBe('Moderate');
    expect(bands.find((b) => 14 >= b.min && 14 <= b.max).label).toBe('Moderate');
    expect(bands.find((b) => 15 >= b.min && 15 <= b.max).label).toBe('Moderately severe');
  });
});

describe('GAD-7 cutoffs', () => {
  const inst = byKey.gad7;
  const { field, form } = formOf(inst);
  it('range is 0–21 and max → Severe', () => {
    expect(form.scores[0].range).toEqual({ min: 0, max: 21 });
    const r = evaluate(form, answerAll(field, () => 'Nearly every day'));
    expect(r.scores[0].value).toBe(21);
    expect(r.scores[0].band.label).toBe('Severe');
  });
});

describe('PHQ-2 / GAD-2 screeners', () => {
  it('PHQ-2 ≥3 is a positive screen', () => {
    const { field, form } = formOf(byKey.phq2);
    const r = evaluate(form, answerAll(field, () => 'More than half the days')); // 2+2 = 4
    expect(r.scores[0].value).toBe(4);
    expect(r.scores[0].band.label).toMatch(/Positive/);
  });
  it('GAD-2 ≤2 is a negative screen', () => {
    const { field, form } = formOf(byKey.gad2);
    const r = evaluate(form, answerAll(field, () => 'Several days')); // 1+1 = 2
    expect(r.scores[0].value).toBe(2);
    expect(r.scores[0].band.label).toBe('Negative screen');
  });
});

describe('AUDIT-C', () => {
  const { field, form } = formOf(byKey.auditc);
  it('range is 0–12 and per-item options score 0–4', () => {
    expect(form.scores[0].range).toEqual({ min: 0, max: 12 });
    const r = evaluate(form, {
      [field.items.find((x) => x.code === 'c1').linkId]: '2–4 times a month', // 2
      [field.items.find((x) => x.code === 'c2').linkId]: '3 or 4',            // 1
      [field.items.find((x) => x.code === 'c3').linkId]: 'Monthly',           // 2
    });
    expect(r.scores[0].value).toBe(5);
    expect(r.scores[0].band.label).toMatch(/at-risk/);
  });
});

describe('instance uniqueness', () => {
  it('two instances of the same instrument get distinct ids', () => {
    const a = instantiateInstrument(byKey.phq9);
    const b = instantiateInstrument(byKey.phq9);
    expect(a.score.id).not.toBe(b.score.id);
    expect(a.field.linkId).not.toBe(b.field.linkId);
    expect(a.criticalTriggers[0].id).not.toBe(b.criticalTriggers[0].id);
  });
});
