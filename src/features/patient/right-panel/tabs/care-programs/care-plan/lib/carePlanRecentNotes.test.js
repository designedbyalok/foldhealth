import { describe, expect, it } from 'vitest';
import { recentCarePlanNotes } from './carePlanRecentNotes';

const plan = {
  goals: [{ id: 'g1', title: 'Improve A1C control' }],
  interventions: [{ id: 'i1', title: 'A1C follow-up' }],
  barriers: [{ id: 'b1', title: 'Cost of strips' }],
};
const note = (id, entityType, entityId, at, detail = `note ${id}`) => ({ id, action: 'note', entityType, entityId, createdAt: at, detail, actor: 'Riya' });

describe('recentCarePlanNotes', () => {
  it('lists plan and item notes newest first, labelled by where they sit', () => {
    const out = recentCarePlanNotes([
      note('n1', 'plan', 'p', '2026-11-01T10:00:00Z'),
      note('n2', 'goal', 'g1', '2026-11-03T10:00:00Z'),
      note('n3', 'intervention', 'i1', '2026-11-02T10:00:00Z'),
    ], plan);
    expect(out.map(n => [n.id, n.kind, n.source])).toEqual([
      ['n2', 'goal', 'Goal: Improve A1C control'],
      ['n3', 'intervention', 'Intervention: A1C follow-up'],
      ['n1', 'plan', 'Plan note'],
    ]);
    expect(out[0].item).toBe(plan.goals[0]);
  });

  it('skips the note in the box, cleared and deleted notes, empty notes and removed items', () => {
    const out = recentCarePlanNotes([
      note('n1', 'plan', 'p', '2026-11-01T10:00:00Z'),
      { id: 'c1', action: 'note_cleared', entityType: 'plan', createdAt: '2026-11-02T00:00:00Z' },
      note('n2', null, null, '2026-11-03T10:00:00Z'),
      note('n3', 'barrier', 'b1', '2026-11-01T09:00:00Z'),
      { id: 'd1', action: 'note_deleted', entityType: 'barrier', entityId: 'b1', createdAt: '2026-11-01T12:00:00Z' },
      note('n4', 'barrier', 'b1', '2026-11-04T09:00:00Z'),
      note('n5', 'goal', 'gone', '2026-11-05T09:00:00Z'),
      note('n6', 'goal', 'g1', '2026-11-06T09:00:00Z', '   '),
      note('n7', 'plan', 'p', '2026-11-07T09:00:00Z'),
    ], plan, { excludeId: 'n7' });
    expect(out.map(n => n.id)).toEqual(['n4', 'n2']);
  });

  it('matches legacy rows typed "note" to the item they point at, and caps the list', () => {
    const out = recentCarePlanNotes([
      note('n1', 'note', 'i1', '2026-11-01T10:00:00Z'),
      note('n2', 'plan', 'p', '2026-11-02T10:00:00Z'),
      note('n3', 'plan', 'p', '2026-11-03T10:00:00Z'),
      note('n4', 'plan', 'p', '2026-11-04T10:00:00Z'),
    ], plan, { limit: 4 });
    expect(out.at(-1)).toMatchObject({ id: 'n1', kind: 'intervention', source: 'Intervention: A1C follow-up' });
  });

  it('can leave plan notes out', () => {
    const out = recentCarePlanNotes([
      note('n1', 'plan', 'p', '2026-11-03T10:00:00Z'),
      note('n2', 'goal', 'g1', '2026-11-01T10:00:00Z'),
    ], plan, { includePlan: false });
    expect(out.map(n => n.id)).toEqual(['n2']);
  });

  it('shows three by default', () => {
    const audit = ['01', '02', '03', '04'].map(d => note(`n${d}`, 'plan', 'p', `2026-11-${d}T10:00:00Z`));
    expect(recentCarePlanNotes(audit, plan).map(n => n.id)).toEqual(['n04', 'n03', 'n02']);
  });
});
