import { describe, it, expect } from 'vitest';
import { activityEntries, isStructuralRow } from './carePlanHistory';
import { groupByVersion } from './carePlanVersions';

const linked = {
  id: 'l1', entityType: 'goal', entityId: 'g1', action: 'note_linked',
  summary: 'A1C below 7%', detail: 'Started metformin.', actor: 'Fold Demo', createdAt: '2026-11-02T10:00:00Z',
};

describe('note_linked rows', () => {
  it('show in the activity log as a note on the linked item', () => {
    const [e] = activityEntries([linked], [], [{ id: 'g1', title: 'A1C below 7%' }]);
    expect(e.type).toBe('item_note');
    expect(e.headlineSubject).toBe('Goal: A1C below 7%');
    expect(e.body).toBe('Started metformin.');
  });

  it('never count as an unsigned change to the plan', () => {
    expect(isStructuralRow(linked)).toBe(false);
    const signed = { id: 's1', action: 'signed', createdAt: '2026-11-02T11:00:00Z' };
    expect(groupByVersion([signed, linked])[0].rows).toEqual([]);
  });
});
