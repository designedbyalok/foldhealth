import { describe, expect, it } from 'vitest';
import {
  buildReviewSteps, draftReviewNote, firstOpenStep, isStepConfirmed, reviewChanges, skippedSteps,
} from './guidedReviewModel';

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const plan = {
  goals: [
    { id: 'g1', title: 'Control blood pressure', status: 'In Progress' },
    { id: 'g2', title: 'Improve A1c', status: 'In Progress' },
    { id: 'g3', title: 'Old goal', status: 'Met' },
  ],
  interventions: [
    { id: 'i1', title: 'Home BP log', status: 'In Progress', goalId: 'g1' },
    { id: 'i2', title: 'Mail-order refill', status: 'In Progress', goalId: 'g2', due: daysAgo(5) },
    { id: 'i3', title: 'Unlinked call', status: 'Not Started', goalId: null },
  ],
  barriers: [
    { id: 'b1', title: 'Pantry food is salty', status: 'In Progress', goalIds: ['g1'] },
    { id: 'b2', title: 'Late refills', status: 'Resolved', goalIds: ['g2'] },
    { id: 'b3', title: 'Shared barrier', status: 'In Progress', goalIds: ['g1', 'g2'] },
  ],
  measurements: [
    { goalId: 'g1', value: '128/78', takenAt: '2026-10-01', favorable: true },
  ],
  dueOf: i => (i.due ? { iso: i.due, formatted: i.due } : {}),
};

describe('buildReviewSteps', () => {
  it('puts goals needing attention first and skips closed items', () => {
    const steps = buildReviewSteps(plan);
    expect(steps.map(s => s.key)).toEqual(['goal:g2', 'goal:g1', 'other', 'actions', 'tasks', 'wrap']);
    const a1c = steps[0];
    expect(a1c.attention).toMatchObject({ label: '1 Overdue', tone: 'danger' });
    expect(a1c.interventions[0].suggestion).toEqual({ choice: 'Reschedule', why: '5 days overdue' });
    expect(a1c.facts).toContain('Mail-order refill is 5 days overdue.');
    expect(steps[1].attention.label).toBe('On Target');
    expect(steps[1].barriers[0].orphan).toBe(false);
    expect(a1c.barriers.map(r => r.item.id)).toEqual(['b3']);
    expect(steps[2].interventions.map(r => r.item.id)).toEqual(['i3']);
  });
});

describe('review picks', () => {
  const steps = buildReviewSteps(plan);
  const entries = {
    'goal:g1': { decision: 'Met', confirmed: true, tags: ['Patient reported'] },
    'barrier:b1': { decision: 'Resolved', confirmed: true },
    'intervention:i1': { decision: 'Continue', confirmed: true },
    'intervention:i2': { decision: 'Reschedule', dueDate: '2026-12-01' },
    'barrier:b3': { decision: 'Not Applicable' },
  };

  it('lists only real changes, with the status each one sets', () => {
    const changes = reviewChanges(steps, entries);
    expect(changes.map(c => [c.key, c.label, c.status || c.dueDate])).toEqual([
      ['barrier:b3', 'Not Applicable', 'Not Applicable'],
      ['intervention:i2', 'Rescheduled to 12/01/2026', '2026-12-01'],
      ['goal:g1', 'Met', 'Met'],
      ['barrier:b1', 'Resolved', 'Resolved'],
    ]);
  });

  it('tracks what was reviewed, skipped, and where to resume', () => {
    expect(isStepConfirmed(steps[1], entries)).toBe(true);
    expect(isStepConfirmed(steps[0], entries)).toBe(false);
    expect(skippedSteps(steps, entries).map(s => s.key)).toEqual(['other']);
    expect(firstOpenStep(steps, entries)).toBe(0);
  });

  it('drafts the note from the changes, skips and tags', () => {
    const changes = reviewChanges(steps, entries);
    const note = draftReviewNote({ firstName: 'Maria', changes, skipped: skippedSteps(steps, entries), entries });
    expect(note).toBe('Care plan reviewed with Maria. Barrier "Shared barrier": Not Applicable; Intervention "Mail-order refill": Rescheduled to 12/01/2026; Goal "Control blood pressure": Met; Barrier "Pantry food is salty": Resolved. Not reviewed: Not Linked to a Goal. Tags: Patient reported.');
  });
});
