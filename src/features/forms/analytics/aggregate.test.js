import { describe, it, expect } from 'vitest';
import {
  leafFields, completionStats, questionStats, scoreGroupStats, averageScoreSeries, answerAverage,
  splitByStatus, dropOffStats, perQuestionDropoff,
} from './aggregate';

const fields = [
  { linkId: 'rate', type: 'choice', control: 'radio', text: 'Rate', required: true, options: [{ value: 'Good' }, { value: 'Bad' }] },
  { linkId: 'age', type: 'integer', text: 'Age', required: true },
  { linkId: 'note', type: 'text', text: 'Notes' },
  { linkId: 'intro', type: 'display', text: 'Welcome' },
  { linkId: 'grp', type: 'group', text: 'Group', items: [{ linkId: 'g1', type: 'choice', control: 'radio', text: 'G1', options: [{ value: 'A' }, { value: 'B' }] }] },
];

const responses = [
  { id: 1, createdAt: '2023-03-10T10:00:00Z', answers: { rate: 'Good', age: 30, note: 'hi', g1: 'A' }, scores: { scores: [{ id: 's1', value: 8, band: { label: 'High', severity: 'high' } }] } },
  { id: 2, createdAt: '2023-04-10T10:00:00Z', answers: { rate: 'Bad', age: 40 }, scores: { scores: [{ id: 's1', value: 4, band: { label: 'Low', severity: 'neutral' } }] } },
  { id: 3, createdAt: '2023-04-20T10:00:00Z', answers: {}, scores: { scores: [] } },
];

describe('leafFields', () => {
  it('descends into groups and excludes display fields', () => {
    expect(leafFields(fields).map((f) => f.linkId)).toEqual(['rate', 'age', 'note', 'g1']);
  });
});

describe('completionStats', () => {
  it('classifies responded / in-progress / not-started', () => {
    const c = completionStats(fields, responses);
    expect(c.total).toBe(3);
    expect(c.questionCount).toBe(4);
    expect(c.responded).toBe(1);   // r1: all required (rate, age) answered
    expect(c.inProgress).toBe(1);  // r2: some answered, not all leaves
    expect(c.notStarted).toBe(1);  // r3: none
    expect(c.completionRate).toBeGreaterThan(0);
  });
});

describe('questionStats', () => {
  it('choice → distribution + most voted', () => {
    const s = questionStats(fields[0], responses);
    expect(s.kind).toBe('choice');
    expect(s.answeredCount).toBe(2);
    expect(s.distribution).toEqual([{ label: 'Good', count: 1 }, { label: 'Bad', count: 1 }]);
    expect(s.mostVoted.label).toBe('Good');
  });
  it('numeric → average + distribution', () => {
    const s = questionStats(fields[1], responses);
    expect(s.kind).toBe('numeric');
    expect(s.average).toBe(35);
    expect(s.distribution.map((d) => d.value)).toEqual([30, 40]);
  });
  it('text → answer list', () => {
    const s = questionStats(fields[2], responses);
    expect(s.kind).toBe('text');
    expect(s.answers).toEqual(['hi']);
  });
});

describe('NPS', () => {
  const nps = {
    linkId: 'n', type: 'choice', control: 'rating', ratingElement: 'nps',
    options: Array.from({ length: 11 }, (_, i) => ({ value: String(i), score: i })),
  };
  const rs = ['10', '9', '8', '7', '6', '0'].map((v) => ({ answers: { n: v } }));
  it('groups 0–6 / 7–8 / 9–10 and scores promoters minus detractors', () => {
    const s = questionStats(nps, rs);
    expect(s.kind).toBe('nps');
    expect(s.nps).toEqual({ detractor: 2, passive: 2, promoter: 2, total: 6, score: 0 });
    expect(s.distribution).toHaveLength(11);
  });
  it('formats the score signed', () => {
    expect(answerAverage(nps, rs.slice(0, 3))).toBe('+67');
    expect(answerAverage(nps, [{ answers: { n: '3' } }])).toBe('-100');
    expect(answerAverage(nps, [])).toBe('-');
  });
});

describe('scoreGroupStats', () => {
  it('averages a score and resolves its band', () => {
    const scoring = { scores: [{ id: 's1', label: 'Total', interpretations: [{ min: 0, max: 5, label: 'Low', severity: 'neutral' }, { min: 6, max: 10, label: 'High', severity: 'high' }] }] };
    const [g] = scoreGroupStats(scoring, responses);
    expect(g.average).toBe(6);       // (8 + 4) / 2
    expect(g.band.label).toBe('High');
    expect(g.count).toBe(2);
  });
});

describe('averageScoreSeries', () => {
  it('buckets the primary score by month in order', () => {
    const scoring = { scores: [{ id: 's1', label: 'Total', interpretations: [] }] };
    const series = averageScoreSeries(scoring, responses);
    expect(series.map((p) => p.month)).toEqual(['Mar 23', 'Apr 23']);
    expect(series[0].value).toBe(8);
    expect(series[1].value).toBe(4);
  });
  it('empty when no scores defined', () => {
    expect(averageScoreSeries({ scores: [] }, responses)).toEqual([]);
  });
});

describe('splitByStatus / dropOffStats', () => {
  const rows = [
    { id: 1, status: 'completed', answers: {}, scores: {} },
    { id: 2, status: 'in_progress', answers: {}, scores: {} },
    { id: 3, status: 'in_progress', answers: {}, scores: {} },
    { id: 4, answers: {}, scores: {} }, // pre-migration row → completed
  ];
  it('splits completed vs in-progress (missing status = completed)', () => {
    const { completed, pending } = splitByStatus(rows);
    expect(completed.map((r) => r.id)).toEqual([1, 4]);
    expect(pending.map((r) => r.id)).toEqual([2, 3]);
  });
  it('computes drop-off rate = pending / started', () => {
    const { completed, pending } = splitByStatus(rows);
    const d = dropOffStats(completed, pending);
    expect(d).toEqual({ completed: 2, pending: 2, started: 4, dropOffRate: 50 });
  });
  it('drop-off is 0 with no responses', () => {
    expect(dropOffStats([], [])).toEqual({ completed: 0, pending: 0, started: 0, dropOffRate: 0 });
  });
});

describe('perQuestionDropoff', () => {
  const f = [
    { linkId: 'q1', type: 'string', text: 'Q1' },
    { linkId: 'q2', type: 'string', text: 'Q2' },
    { linkId: 'q3', type: 'string', text: 'Q3' },
  ];
  const completed = [{ answers: { q1: 'a', q2: 'b', q3: 'c' } }];
  const pending = [
    { answers: { q1: 'a' } },          // furthest 0 → drops at q2 (index 1)
    { answers: { q1: 'a', q2: 'b' } }, // furthest 1 → drops at q3 (index 2)
    { answers: {} },                   // furthest -1 → drops at q1 (index 0)
  ];
  it('attributes each in-progress bail to its first unanswered question', () => {
    const rows = perQuestionDropoff(f, completed, pending);
    expect(rows.map((r) => r.dropped)).toEqual([1, 1, 1]); // q1, q2, q3 each lose one
  });
  it('reach counts everyone who got at least to the prior question', () => {
    const rows = perQuestionDropoff(f, completed, pending);
    // q1 reached by all 4; q2 by completed + (q1-only, q1+q2) = 3; q3 by completed + q1+q2 = 2
    expect(rows.map((r) => r.reached)).toEqual([4, 3, 2]);
    expect(rows[0].dropOff).toBe(Math.round((1 / 4) * 100));
  });
  it('no pending → zero drop-off', () => {
    expect(perQuestionDropoff(f, completed, []).every((r) => r.dropOff === 0)).toBe(true);
  });
});

describe('answerAverage', () => {
  it('numeric → ~mean, choice → most common', () => {
    expect(answerAverage(fields[1], responses)).toBe('~35');
    expect(answerAverage(fields[0], responses)).toBe('Good');
  });
});
