import { describe, expect, it } from 'vitest';
import { allProgramsPlanState } from './allProgramsPlan';

const dm = { id: 'p-dm', code: 'DM' };
const snp = { id: 'p-snp', code: 'SNP' };
const ccm = { id: 'p-ccm', code: 'CCM' };

describe('allProgramsPlanState', () => {
  it('totals the open plans, tags what needs attention with its program and reads each plan\'s sign state', () => {
    const plans = {
      'pt::p-dm': {
        plan: { id: 'a', signedBy: 'Fold Demo', signedAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-09T00:00:00Z' },
        goals: [{ id: 'g1', title: 'A1C', status: 'In Progress', progress: 40, createdAt: '2026-11-01T00:00:00Z' }],
        interventions: [],
        barriers: [{ id: 'b1', title: 'Cost of strips', status: 'Not Started', createdAt: '2026-11-01T00:00:00Z' }],
        measurements: [{ goalId: 'g1', value: '9', favorable: false, takenAt: '2026-11-05' }],
      },
      'pt::p-snp': {
        plan: { id: 'b', completedAt: '2026-11-10T00:00:00Z', awaitingSigner: 'Dr. Lee' },
        goals: [{ id: 'g2', title: 'BP', status: 'Discontinued', progress: 90, createdAt: '2026-11-01T00:00:00Z' }],
        interventions: [{ id: 'i1', title: 'BP check', status: 'In Progress', createdAt: '2026-11-01T00:00:00Z' }],
        barriers: [],
      },
    };
    const out = allProgramsPlanState([dm, snp, ccm], plans, 'pt', () => ({}));
    expect(out.plans.map(p => p.program.code)).toEqual(['DM', 'SNP']);
    expect(out.totals).toEqual({ goals: 2, interventions: 1, barriers: 1, avgProgress: 40 });
    expect(out.attention.map(a => [a.kind, a.program.code, a.key])).toEqual([
      ['goal', 'DM', 'p-dm:goal:g1'],
      ['barrier', 'DM', 'p-dm:barrier:b1'],
    ]);
    expect(out.signing.map(s => [s.program.code, s.state, s.label])).toEqual([
      ['DM', 'signed', 'Signed by Fold Demo'],
      ['SNP', 'awaiting', 'Awaiting Dr. Lee\'s signature'],
    ]);
  });
});
