import { describe, expect, it, vi } from 'vitest';

// The helper is pure; the module's hook pulls in the store, which needs a browser.
vi.mock('../../../store/useAppStore', () => ({ useAppStore: () => undefined }));

const { recordWithMedAdditions } = await import('./useBarrierForm');

const x = {
  code: 'MAD',
  medications: [
    { id: 'a', name: 'Glipizide', strength: '5', unit: 'MG' },
    { id: 'b', name: 'Metformin', strength: '500', unit: 'MG' },
    { id: 'c', name: 'Januvia', strength: '100', unit: 'MG', status: 'Discontinued' },
  ],
};

describe('recordWithMedAdditions', () => {
  it('turns a gap-wide record per medication and adds only to the one drug', () => {
    const rec = recordWithMedAdditions(x, { barriers: ['Cost Issue'], interventions: [] }, 'a', { barriers: ['Side Effects'], interventions: ['90/100-day conversion'] });
    expect(rec.medications.map(m => [m.id, m.barriers, m.interventions])).toEqual([
      ['a', ['Cost Issue', 'Side Effects'], ['90/100-day conversion']],
      ['b', ['Cost Issue'], []],
    ]);
    expect(rec.barriers).toEqual(['Cost Issue', 'Side Effects']);
    expect(rec.interventions).toEqual(['90/100-day conversion']);
  });

  it('keeps the other drugs of a per-medication record and does not repeat items', () => {
    const before = { barriers: [], interventions: [], medications: [
      { id: 'a', barriers: ['Forgetfulness'], interventions: [] },
      { id: 'b', barriers: [], interventions: ['Pill box'] },
    ] };
    const rec = recordWithMedAdditions(x, before, 'b', { barriers: ['Forgetfulness'], interventions: ['Pill box'] });
    expect(rec.medications.find(m => m.id === 'a').barriers).toEqual(['Forgetfulness']);
    expect(rec.medications.find(m => m.id === 'b')).toMatchObject({ barriers: ['Forgetfulness'], interventions: ['Pill box'] });
  });

  it('starts from nothing when the gap has no record yet', () => {
    const rec = recordWithMedAdditions(x, undefined, 'a', { barriers: ['Cost Issue'], interventions: [] });
    expect(rec.medications.map(m => m.barriers)).toEqual([['Cost Issue'], []]);
  });
});
