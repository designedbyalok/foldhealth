import { describe, it, expect } from 'vitest';
import {
  evaluateEventImpact, eventsToEvaluate, eventTitle, normalizeEventDraft, describeChange,
} from './eventImpact';

const plan = {
  goals: [
    { id: 'g1', title: 'Improve A1C control', measure: 'HbA1c', status: 'In Progress', currentValue: '7.4 %', targetValue: '7' },
    { id: 'g2', title: 'Improve blood pressure control', status: 'In Progress', currentValue: '128/78' },
    { id: 'g3', title: 'Reduce weight', status: 'Met' },
    { id: 'g4', title: 'Improve medication adherence for hypertension', status: 'In Progress' },
  ],
  interventions: [{ id: 'i1', title: 'Blood pressure monitoring', status: 'Not Started', goalId: 'g2' }],
  barriers: [{ id: 'b1', title: 'Low health literacy', status: 'In Progress' }],
};
const ev = (over) => ({ id: 'e1', kind: 'lab', action: null, code: null, display: '', valueText: null, value: null, unit: '', abnormal: false, occurredAt: '2026-10-30T00:00:00Z', meta: {}, ...over });

describe('evaluateEventImpact', () => {
  it('records a lab on the goal it measures', () => {
    const r = evaluateEventImpact(ev({ code: '4548-4', display: 'Hemoglobin A1c', value: 8.1, unit: '%', abnormal: true }), plan);
    expect(r.relevant).toBe(true);
    expect(r.changes).toEqual([expect.objectContaining({ kind: 'goal_value', targetId: 'g1', from: '7.4 %', to: '8.1 %' })]);
    expect(r.reasons).toContain('Outside the reference range');
  });

  it('records blood pressure from a vital with both parts', () => {
    const r = evaluateEventImpact(ev({ kind: 'vital', code: 'bp', display: 'bp', valueText: '146/90', value: 146 }), plan);
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ targetId: 'g2', to: '146/90 mmHg', value: '146/90', unit: 'mmHg' });
  });

  it('skips closed goals', () => {
    const r = evaluateEventImpact(ev({ kind: 'vital', code: 'wt', display: 'wt', value: 180 }), plan);
    expect(r.changes).toEqual([]);
    expect(r.relevant).toBe(false);
  });

  it('flags a discharge for the AI', () => {
    const r = evaluateEventImpact(ev({ kind: 'adt', action: 'discharge', display: 'Discharge', meta: { raw: { facility: 'St. Mary' } } }), plan);
    expect(r).toMatchObject({ relevant: true, askAi: true, changes: [] });
  });

  it('ignores an unrelated normal lab', () => {
    expect(evaluateEventImpact(ev({ display: 'Vitamin D', value: 30 }), plan).relevant).toBe(false);
  });
});

describe('eventsToEvaluate', () => {
  it('drops evaluated, old and pre-plan events', () => {
    const now = new Date('2026-11-02T00:00:00Z');
    const events = [
      ev({ id: 'a', occurredAt: '2026-10-30T00:00:00Z' }),
      ev({ id: 'b', occurredAt: '2026-10-31T00:00:00Z' }),
      ev({ id: 'c', occurredAt: '2026-08-01T00:00:00Z' }),
      ev({ id: 'd', occurredAt: '2026-10-20T00:00:00Z' }),
    ];
    const out = eventsToEvaluate(events, [{ eventId: 'b' }], { planCreatedAt: '2026-10-25T00:00:00Z', now });
    expect(out.map(e => e.id)).toEqual(['a']);
  });
});

describe('normalizeEventDraft', () => {
  it('keeps valid changes and drops invented ids, repeats and no-ops', () => {
    const out = normalizeEventDraft({
      summary: 'A1c is up \u2014 tighten follow-up.',
      changes: [
        { kind: 'status', targetId: 'g1', status: 'Not Met', rationale: 'A1c rose to 8.1.' },
        { kind: 'status', targetId: 'g1', status: 'In Progress', rationale: 'No change.' },
        { kind: 'status', targetId: 'zzz', status: 'Met', rationale: 'Invented.' },
        { kind: 'add_intervention', title: 'Medication adherence review', interventionKind: 'internal-task', goalId: 'g1', rationale: 'Check adherence.' },
        { kind: 'add_goal', title: 'Improve A1C control', rationale: 'Already there.' },
      ],
    }, plan);
    expect(out.summary).toBe('A1c is up, tighten follow-up.');
    expect(out.changes.map(c => c.kind)).toEqual(['status', 'add_intervention']);
    expect(out.changes[1].item).toEqual({ title: 'Medication adherence review', kind: 'internal-task', goalId: 'g1' });
  });
});

describe('labels', () => {
  it('names events and changes plainly', () => {
    expect(eventTitle(ev({ kind: 'adt', action: 'discharge', meta: { raw: { facility: 'St. Mary' } } }))).toBe('Discharged from St. Mary');
    expect(eventTitle(ev({ kind: 'medication', action: 'started', display: 'Metformin 500 mg', valueText: '1 tab twice a day' }))).toBe('Started Metformin 500 mg (1 tab twice a day)');
    expect(describeChange({ kind: 'status', targetType: 'goal', targetTitle: 'X', from: 'In Progress', to: 'Not Met' }))
      .toEqual({ action: 'Change status of', subject: 'Goal: X', from: 'In Progress', to: 'Not Met' });
  });
});
