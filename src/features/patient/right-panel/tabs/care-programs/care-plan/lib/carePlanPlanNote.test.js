import { describe, it, expect } from 'vitest';
import { latestPlanNote } from './carePlanNotes';

const row = (action, at, extra = {}) => ({ id: `${action}-${at}`, action, entityType: 'plan', createdAt: at, detail: `${action} ${at}`, ...extra });

describe('latestPlanNote', () => {
  it('is the newest plan note', () => {
    const audit = [row('note', '2026-10-01'), row('note', '2026-10-05'), row('note', '2026-10-09', { entityType: 'goal', entityId: 'g1' })];
    expect(latestPlanNote(audit).createdAt).toBe('2026-10-05');
  });

  it('is gone after a later clear, back after a newer note', () => {
    expect(latestPlanNote([row('note', '2026-10-01'), row('note_cleared', '2026-10-02')])).toBeNull();
    expect(latestPlanNote([row('note', '2026-10-01'), row('note_cleared', '2026-10-02'), row('note', '2026-10-03')]).createdAt).toBe('2026-10-03');
  });

  it('reads legacy rows with no entity type', () => {
    expect(latestPlanNote([row('note', '2026-10-01', { entityType: '' })])).not.toBeNull();
    expect(latestPlanNote([])).toBeNull();
  });
});
