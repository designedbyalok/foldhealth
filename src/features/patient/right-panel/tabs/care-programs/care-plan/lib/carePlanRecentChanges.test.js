import { describe, expect, it } from 'vitest';
import { onlyRecentChanges } from './carePlanRecentChanges';
import { buildCarePlanSnapshot } from './carePlanDraft';
import { historySection, labSection, medicationSection } from './carePlanPrintContent';

const goal = (over = {}) => ({ id: 'g1', title: 'A1c below 7%', category: 'Labs', measure: 'HbA1c', comparator: '<', targetValue: '7', customUnit: '%', duration: '3', durationUnit: 'Month', conditions: ['Diabetes'], ...over });
const intervention = (over = {}) => ({ id: 'i1', goalId: 'g1', title: 'A1C follow-up', kind: 'internal-task', config: {}, ...over });
const barrier = (over = {}) => ({ id: 'b1', title: 'Transportation', description: '', goalIds: ['g1'], ...over });
const snap = (goals, interventions = [], barriers = []) => buildCarePlanSnapshot({ plan: { conditions: ['Diabetes'] }, goals, interventions, barriers });

describe('onlyRecentChanges', () => {
  it('keeps only added, changed and removed items, tagged', () => {
    const before = snap([goal(), goal({ id: 'g2', title: 'Steps' })], [intervention()], [barrier()]);
    const afterGoals = [goal({ targetValue: '6.5' }), goal({ id: 'g3', title: 'BP below 130/80' })];
    const after = snap(afterGoals, [intervention()], [barrier()]);
    const out = onlyRecentChanges({ goals: afterGoals, interventions: [intervention()], barriers: [barrier()] }, before, after);
    expect(out.goals.map(g => [g.id, g.changeTag])).toEqual([['g1', 'Changed: Target'], ['g3', 'New'], ['g2', 'Removed']]);
    expect(out.interventions).toEqual([]);
    expect(out.barriers).toEqual([]);
  });

  it('marks everything new when there is no earlier version', () => {
    const out = onlyRecentChanges({ goals: [goal()], interventions: [intervention()], barriers: [] }, null, snap([goal()]));
    expect(out.goals[0].changeTag).toBe('New');
    expect(out.interventions[0].changeTag).toBe('New');
  });

  it('treats an item recreated with a new id (template re-applied) as the same item', () => {
    const before = snap([goal()], [intervention()], [barrier()]);
    const g = goal({ id: 'g9' });
    const after = snap([g], [intervention({ id: 'i9', goalId: 'g9' })], [barrier({ id: 'b9', goalIds: ['g9'] })]);
    const unchanged = onlyRecentChanges({ goals: after.goals, interventions: after.interventions, barriers: after.barriers }, before, after);
    expect([unchanged.goals, unchanged.interventions, unchanged.barriers]).toEqual([[], [], []]);

    const after2 = snap([goal({ id: 'g9', targetValue: '6.5' })]);
    const changed = onlyRecentChanges({ goals: after2.goals, interventions: [], barriers: [] }, snap([goal()]), after2);
    expect(changed.goals.map(x => [x.id, x.changeTag])).toEqual([['g9', 'Changed: Target']]);
  });

  it('respects what the user left out of the print', () => {
    const before = snap([]);
    const after = snap([goal(), goal({ id: 'g2', title: 'Steps' })]);
    const out = onlyRecentChanges({ goals: [goal()], interventions: [], barriers: [] }, before, after);
    expect(out.goals.map(g => g.id)).toEqual(['g1']);
  });
});

describe('print content sections', () => {
  it('labs: latest reading per lab goal, never a made-up value', () => {
    const s = labSection([goal(), goal({ id: 'g2', title: 'Walk', category: 'Exercise' }), goal({ id: 'g3', title: 'LDL', measure: '' })], [
      { goalId: 'g1', value: '8.1', unit: '%', favorable: false, takenAt: '2026-08-01T10:00:00Z' },
      { goalId: 'g1', value: '7.4', unit: '%', favorable: false, takenAt: '2026-09-24T10:00:00Z' },
    ]);
    expect(s.rows.map(r => [r[0].title, r[1], r[4]])).toEqual([['HbA1c', '7.4 %', 'Out of target'], ['LDL', 'Not recorded', '']]);
  });

  it('medications: active only', () => {
    const s = medicationSection([{ name: 'Metformin', sig: '500 mg with dinner', status: 'Active' }, { name: 'Losartan', status: 'Stopped' }]);
    expect(s.rows.map(r => r[0].title)).toEqual(['Metformin']);
  });

  it('history: medical, surgical, family in that order', () => {
    const s = historySection([
      { kind: 'family', title: 'Diabetes', relation: 'Mother' },
      { kind: 'medical', title: 'Hypertension', recordedOn: '2019-04-01' },
      { kind: 'social', title: 'Smoker' },
    ]);
    expect(s.rows.map(r => [r[0].title, r[1], r[2]])).toEqual([['Hypertension', 'Medical', '04/01/2019'], ['Diabetes', 'Family', 'Mother']]);
  });
});
