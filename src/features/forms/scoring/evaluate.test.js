import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluate.js';
import {
  AGGREGATION,
  MISSING_POLICY,
  SCORE_STATUS,
  SEVERITY,
  ACTION_TYPE,
  OPERATOR,
  DIAGNOSTIC_CODE,
} from './types.js';

/* ---------------- fixtures ---------------- */

const choice03 = (linkId, required = true) => ({
  linkId,
  type: 'choice',
  required,
  answerOption: [
    { value: 0, score: 0 },
    { value: 1, score: 1 },
    { value: 2, score: 2 },
    { value: 3, score: 3 },
  ],
});

const PHQ9_BANDS = [
  { min: 0, max: 4, label: 'Minimal', severity: SEVERITY.NEUTRAL },
  { min: 5, max: 9, label: 'Mild', severity: SEVERITY.INFO },
  {
    min: 10, max: 14, label: 'Moderate', severity: SEVERITY.WARNING,
    actions: [
      { type: ACTION_TYPE.FLAG, label: 'Moderate depression', severity: SEVERITY.WARNING },
      { type: ACTION_TYPE.CARE_GAP, ref: 'dep_followup' },
    ],
  },
  {
    min: 15, max: 19, label: 'Moderately severe', severity: SEVERITY.HIGH,
    actions: [{ type: ACTION_TYPE.BRANCH, reveal: ['safety'] }],
  },
  { min: 20, max: 27, label: 'Severe', severity: SEVERITY.CRITICAL },
];

function phq9Form() {
  const items = [];
  for (let i = 1; i <= 9; i++) items.push(choice03(`q${i}`));
  items.push({
    linkId: 'safety',
    type: 'group',
    defaultVisibility: 'hidden',
    item: [{ linkId: 'safety_note', type: 'text' }],
  });
  return {
    questionnaire: { item: items },
    scores: [{
      id: 'phq9',
      label: 'PHQ-9 Total',
      aggregation: AGGREGATION.SUM,
      sources: Array.from({ length: 9 }, (_, i) => ({ linkId: `q${i + 1}` })),
      range: { min: 0, max: 27 },
      interpretations: PHQ9_BANDS,
    }],
    criticalTriggers: [{
      id: 'q9_selfharm',
      linkId: 'q9',
      condition: { operator: OPERATOR.GT, value: 0 },
      alert: 'Positive self-harm response: review immediately',
      severity: SEVERITY.CRITICAL,
    }],
  };
}

const scoreOf = (res, id) => res.scores.find((s) => s.id === id);

/* ---------------- tests ---------------- */

describe('aggregation functions', () => {
  const items = ['a', 'b', 'c'].map((l) => ({
    linkId: l, type: 'choice',
    answerOption: [{ value: 0, score: 0 }, { value: 1, score: 4 }, { value: 2, score: 10 }],
  }));
  const base = (agg, extra = {}) => ({
    questionnaire: { item: items },
    scores: [{ id: 's', label: 's', aggregation: agg, sources: [{ linkId: 'a' }, { linkId: 'b' }, { linkId: 'c' }], range: { min: 0, max: 30 }, interpretations: [], ...extra }],
    criticalTriggers: [],
  });
  const ans = { a: 1, b: 2, c: 0 }; // contributions 4, 10, 0

  it('SUM', () => expect(scoreOf(evaluate(base(AGGREGATION.SUM), ans), 's').value).toBe(14));
  it('MAX', () => expect(scoreOf(evaluate(base(AGGREGATION.MAX), ans), 's').value).toBe(10));
  it('MIN', () => expect(scoreOf(evaluate(base(AGGREGATION.MIN), ans), 's').value).toBe(0));
  it('AVERAGE', () => expect(scoreOf(evaluate(base(AGGREGATION.AVERAGE), ans), 's').value).toBeCloseTo(14 / 3));
  it('COUNT (default >=1)', () => expect(scoreOf(evaluate(base(AGGREGATION.COUNT), ans), 's').value).toBe(2));
  it('WEIGHTED_SUM', () => {
    const f = base(AGGREGATION.WEIGHTED_SUM);
    f.scores[0].sources = [{ linkId: 'a', weight: 2 }, { linkId: 'b', weight: 1 }, { linkId: 'c', weight: 1 }];
    expect(scoreOf(evaluate(f, ans), 's').value).toBe(2 * 4 + 10 + 0);
  });
});

describe('AVERAGE denominator policy', () => {
  // a4 visible but unanswered; a5 hidden via gate.
  const items = [
    { linkId: 'gate', type: 'choice', answerOption: [{ value: 'yes', score: 0 }] },
    ...['a1', 'a2', 'a3', 'a4', 'a5'].map((l) => ({
      linkId: l, type: 'choice',
      answerOption: [0, 1, 2, 3, 4].map((n) => ({ value: n, score: n })),
      ...(l === 'a5' ? { enableWhen: [{ question: 'gate', operator: OPERATOR.EQ, answer: 'yes' }] } : {}),
    })),
  ];
  const form = (policy) => ({
    questionnaire: { item: items },
    scores: [{ id: 'avg', label: 'avg', aggregation: AGGREGATION.AVERAGE, missingPolicy: policy, sources: ['a1', 'a2', 'a3', 'a4', 'a5'].map((linkId) => ({ linkId })), range: { min: 0, max: 4 }, interpretations: [] }],
    criticalTriggers: [],
  });

  it('hidden item excluded from applicable; exclude denom uses answered', () => {
    const ans = { a1: 3, a2: 2, a3: 4, a4: 1 }; // a5 hidden, all 4 answered
    const r = scoreOf(evaluate(form(MISSING_POLICY.EXCLUDE), ans), 'avg');
    expect(r.applicable).toBe(4);
    expect(r.value).toBeCloseTo(2.5);
  });
  it('exclude vs as_zero differ when a visible item is unanswered', () => {
    const ans = { a1: 3, a2: 2, a3: 4 }; // a4 visible+unanswered, a5 hidden
    expect(scoreOf(evaluate(form(MISSING_POLICY.EXCLUDE), ans), 'avg').value).toBeCloseTo(9 / 3);
    expect(scoreOf(evaluate(form(MISSING_POLICY.AS_ZERO), ans), 'avg').value).toBeCloseTo(9 / 4);
  });
});

describe('reverse scoring', () => {
  it('computes min+max-raw', () => {
    const form = {
      questionnaire: { item: [{ linkId: 'r', type: 'choice', reverseScore: true, range: { min: 0, max: 3 }, answerOption: [0, 1, 2, 3].map((n) => ({ value: n, score: n })) }] },
      scores: [{ id: 's', label: 's', aggregation: AGGREGATION.SUM, sources: [{ linkId: 'r' }], range: { min: 0, max: 3 }, interpretations: [] }],
      criticalTriggers: [],
    };
    expect(scoreOf(evaluate(form, { r: 3 }), 's').value).toBe(0);
    expect(scoreOf(evaluate(form, { r: 1 }), 's').value).toBe(2);
  });
});

describe('Example A: low total, positive critical item', () => {
  it('reports Mild band AND fires the self-harm trigger', () => {
    const ans = { q1: 2, q2: 1, q3: 1, q4: 1, q5: 0, q6: 0, q7: 0, q8: 0, q9: 1 }; // total 6
    const r = evaluate(phq9Form(), ans);
    const s = scoreOf(r, 'phq9');
    expect(s.value).toBe(6);
    expect(s.status).toBe(SCORE_STATUS.COMPLETE);
    expect(s.band.label).toBe('Mild');
    expect(r.criticalsTriggered).toHaveLength(1);
    expect(r.criticalsTriggered[0].linkId).toBe('q9');
  });
});

describe('partial status', () => {
  it('suppresses band unless showPartialScore, but still computes value', () => {
    const ans = { q1: 2 }; // only one of nine required answered
    const s = scoreOf(evaluate(phq9Form(), ans), 'phq9');
    expect(s.status).toBe(SCORE_STATUS.PARTIAL);
    expect(s.value).toBe(2);
    expect(s.band).toBeNull();
  });
});

describe('critical triggers', () => {
  it('does not fire on a hidden item', () => {
    const form = {
      questionnaire: { item: [
        { linkId: 'gate', type: 'choice', answerOption: [{ value: 'yes', score: 0 }] },
        { linkId: 'h', type: 'choice', enableWhen: [{ question: 'gate', operator: OPERATOR.EQ, answer: 'yes' }], answerOption: [{ value: 1, score: 1 }] },
      ] },
      scores: [],
      criticalTriggers: [{ id: 't', linkId: 'h', condition: { operator: OPERATOR.GT, value: 0 }, alert: 'x', severity: SEVERITY.CRITICAL }],
    };
    expect(evaluate(form, { h: 1 }).criticalsTriggered).toHaveLength(0); // h hidden (gate unanswered)
  });
});

describe('composite scores', () => {
  it('evaluates child scores before the parent', () => {
    const items = ['c1a', 'c1b', 'c2a', 'c2b'].map((l) => choice03(l, false));
    const form = {
      questionnaire: { item: items },
      scores: [
        { id: 'child1', label: 'c1', aggregation: AGGREGATION.SUM, sources: [{ linkId: 'c1a' }, { linkId: 'c1b' }], range: { min: 0, max: 6 }, interpretations: [] },
        { id: 'child2', label: 'c2', aggregation: AGGREGATION.SUM, sources: [{ linkId: 'c2a' }, { linkId: 'c2b' }], range: { min: 0, max: 6 }, interpretations: [] },
        { id: 'total', label: 't', aggregation: AGGREGATION.COMPOSITE, sources: [{ scoreId: 'child1' }, { scoreId: 'child2' }], range: { min: 0, max: 12 }, interpretations: [] },
      ],
      criticalTriggers: [],
    };
    const r = evaluate(form, { c1a: 1, c1b: 2, c2a: 3, c2b: 1 });
    expect(scoreOf(r, 'child1').value).toBe(3);
    expect(scoreOf(r, 'child2').value).toBe(4);
    expect(scoreOf(r, 'total').value).toBe(7);
  });
});

describe('score-driven branch reveal', () => {
  it('reveals downstream section in a single pass without feeding back', () => {
    const ans = { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3, q7: 0, q8: 0, q9: 0 }; // total 18
    const r = evaluate(phq9Form(), ans);
    expect(scoreOf(r, 'phq9').value).toBe(18);
    expect(scoreOf(r, 'phq9').band.label).toBe('Moderately severe');
    expect(r.visibility.safety).toBe(true);
    expect(r.visibility.safety_note).toBe(true);
  });
  it('keeps the section hidden below threshold', () => {
    const ans = { q1: 1, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0 }; // total 1
    expect(evaluate(phq9Form(), ans).visibility.safety).toBe(false);
  });
});

describe('action merge', () => {
  it('dedupes shared careGap/route across two scores', () => {
    const mk = (id, items) => ({
      id, label: id, aggregation: AGGREGATION.SUM, sources: items.map((linkId) => ({ linkId })), range: { min: 0, max: 3 },
      interpretations: [{ min: 0, max: 3, label: 'all', severity: SEVERITY.WARNING, actions: [{ type: ACTION_TYPE.CARE_GAP, ref: 'g' }, { type: ACTION_TYPE.ROUTE, queue: 'triage' }] }],
    });
    const form = {
      questionnaire: { item: [choice03('x', false), choice03('y', false)] },
      scores: [mk('s1', ['x']), mk('s2', ['y'])],
      criticalTriggers: [],
    };
    const r = evaluate(form, { x: 1, y: 1 });
    expect(r.actions.filter((a) => a.type === ACTION_TYPE.CARE_GAP)).toHaveLength(1);
    expect(r.actions.filter((a) => a.type === ACTION_TYPE.ROUTE)).toHaveLength(1);
  });
});

describe('determinism', () => {
  it('is invariant to answer-key insertion order', () => {
    const keys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'];
    const vals = { q1: 2, q2: 1, q3: 3, q4: 0, q5: 1, q6: 2, q7: 0, q8: 1, q9: 1 };
    const forward = {};
    keys.forEach((k) => { forward[k] = vals[k]; });
    const reverse = {};
    [...keys].reverse().forEach((k) => { reverse[k] = vals[k]; });
    expect(JSON.stringify(evaluate(phq9Form(), forward))).toBe(JSON.stringify(evaluate(phq9Form(), reverse)));
  });
});

describe('runtime cycle guard', () => {
  it('returns a fail-safe result with CYCLE_AT_RUNTIME and never loops', () => {
    // section "sec" (hidden) contains field "f" which feeds score "sc",
    // whose band reveals "sec", a cycle.
    const form = {
      questionnaire: { item: [{ linkId: 'sec', type: 'group', defaultVisibility: 'hidden', item: [choice03('f', false)] }] },
      scores: [{ id: 'sc', label: 'sc', aggregation: AGGREGATION.SUM, sources: [{ linkId: 'f' }], range: { min: 0, max: 3 }, interpretations: [{ min: 0, max: 3, label: 'b', severity: SEVERITY.INFO, actions: [{ type: ACTION_TYPE.BRANCH, reveal: ['sec'] }] }] }],
      criticalTriggers: [],
    };
    const r = evaluate(form, { f: 2 });
    expect(r.diagnostics.some((d) => d.code === DIAGNOSTIC_CODE.CYCLE_AT_RUNTIME)).toBe(true);
    expect(r.visibility.sec).toBe(false); // reveal suppressed
  });
});
