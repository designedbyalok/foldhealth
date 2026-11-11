import { describe, expect, it } from 'vitest';
import { deriveGoalTableFields } from './goalMetrics';

describe('deriveGoalTableFields', () => {
  const goal = { id: 'g1', category: 'Vitals', measure: 'Blood Pressure', comparator: '<=', targetValue: '130', targetValue2: '80', setTarget: true, status: 'In Progress', progress: 40 };

  it('reads the latest reading, its trend and whether it meets the target', () => {
    const out = deriveGoalTableFields(goal, [
      { goalId: 'g1', value: '146/90', unit: 'mmHg', takenAt: '2026-09-15T10:00:00Z' },
      { goalId: 'g1', value: '128/78', unit: 'mmHg', takenAt: '2026-10-01T10:00:00Z' },
    ]);
    expect(out).toMatchObject({ currentValue: '128/78 mmHg', trend: '↓', readingMet: true, readingAt: '2026-10-01T10:00:00Z' });
  });

  it("prefers the clinician's call on the reading, and says nothing without readings", () => {
    expect(deriveGoalTableFields(goal, [{ goalId: 'g1', value: '128/78', favorable: false, takenAt: '2026-10-01' }]).readingMet).toBe(false);
    expect(deriveGoalTableFields(goal, [])).toMatchObject({ currentValue: 'No Data', readingMet: null, readingAt: null });
  });
});
