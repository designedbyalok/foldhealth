import { describe, expect, it } from 'vitest';
import { combinedPlanTotals, nextBestActions, programOrder, programProgress, programSummarySegments, whyPrioritized } from './careProgramsOverviewModel';

const ccm = { id: 'p1', code: 'CCM' };
const dm = { id: 'p2', code: 'DM' };
const goal = { id: 'g1', title: 'Improve A1C control', status: 'In Progress', progress: 40 };
const barrier = { id: 'b1', title: 'Cost of strips', status: 'Not Started' };

const ccmEntry = {
  program: ccm,
  steps: [
    { id: 's1', name: 'Outreach', mandatory: true, status: 'pending' },
    { id: 's2', name: 'Care Plan Details', status: 'in_progress' },
    { id: 's3', name: 'Program Related Task', status: 'in_progress' },
    { id: 's4', name: 'Letters', mandatory: true, status: 'completed' },
  ],
  ctx: { tasks: [{ status: 'pending', due_date: '01/02/2020' }] },
  carePlan: { plan: { id: 'cp1' }, goals: [goal], interventions: [], barriers: [barrier] },
  attention: [
    { kind: 'goal', item: goal, text: 'Latest reading 9 %.' },
    { kind: 'barrier', item: barrier, text: 'None of its goals has an open intervention.' },
  ],
};
const dmEntry = {
  program: dm,
  steps: [{ id: 't1', name: 'Outreach', mandatory: true, status: 'pending' }],
  ctx: {},
  carePlan: null,
  attention: [],
};

describe('nextBestActions', () => {
  it('puts urgent first, merges a step that reads the same across programs, and keeps plan items with nothing to anchor to', () => {
    const rows = nextBestActions([ccmEntry, dmEntry]);
    expect(rows.map(r => [r.kind, r.title, r.programs.map(p => p.code).join('+')])).toEqual([
      ['step', 'Program Related Task', 'CCM'],
      ['goal', 'Improve A1C control', 'CCM'],
      ['barrier', 'Cost of strips', 'CCM'],
      ['step', 'Outreach', 'CCM+DM'],
    ]);
    expect(rows[0].detail).toEqual({ text: '1 open • 1 overdue', urgent: true });
    expect(rows[3].required).toBe(true);
  });

  it('places care plan items right after their program\'s Care Plan step', () => {
    const entry = { ...ccmEntry, steps: [{ id: 's2', name: 'Care Plan', status: 'in_progress' }],
      carePlan: { plan: { id: 'cp1' }, goals: [goal], interventions: [], barriers: [barrier], measurements: [{ goalId: 'g1', value: '9', favorable: false }] } };
    const rows = nextBestActions([entry]);
    expect(rows.map(r => [r.title, r.with || ''])).toEqual([
      ['Care Plan', ''],
      ['Improve A1C control', 'Care Plan'],
      ['Cost of strips', 'Care Plan'],
    ]);
  });
});

describe('whyPrioritized', () => {
  it('names the urgent actions, goals off target and a high acuity', () => {
    const points = whyPrioritized(nextBestActions([ccmEntry, dmEntry]), { acuity: 'High-Risk' });
    expect(points.map(p => p.tone)).toEqual(['danger', 'warning', 'warning']);
    expect(points[0].text).toBe('1 urgent action. CCM Program Related Task: 1 open • 1 overdue.');
    expect(points[1].text).toBe('1 goal is off target: Improve A1C control.');
    expect(points[2].text).toBe('High-Risk acuity.');
    expect(whyPrioritized([], { acuity: 'Low' })).toEqual([]);
  });
});

describe('summary', () => {
  it('totals the plans and writes the program summary from the same numbers', () => {
    const totals = combinedPlanTotals([ccmEntry, dmEntry]);
    expect(totals).toEqual({ goals: 1, interventions: 0, barriers: 1, avgProgress: 40, issues: { goal: 1, intervention: 0, barrier: 1 } });
    const progress = [programProgress(ccmEntry), programProgress(dmEntry)];
    expect(progress.map(p => [p.done, p.total, p.next?.name])).toEqual([[1, 4, 'Program Related Task'], [0, 1, 'Outreach']]);
    const text = programSummarySegments(progress, nextBestActions([ccmEntry, dmEntry]), totals).map(s => s.text).join('');
    expect(text).toBe('2 active programs, 1 of 5 steps done. CCM is 1 of 4; next is Program Related Task. DM is 0 of 1; next is Outreach. 1 action is urgent. In the care plan: 1 goal off target, 1 barrier with nothing addressing it.');
  });
});

describe('programOrder', () => {
  const prog = (id, code, name, lastUpdated) => ({ program: { id, code, name, lastUpdated }, done: 0, total: 1, next: null });
  const act = (ids, { urgent = false, required = false } = {}) => ({ programs: ids.map(id => ({ id })), detail: { urgent }, required });

  it('orders by urgent, then required, then open actions, then most recently updated, then name', () => {
    const progress = [
      prog('a', 'A', 'Alpha', '01/01/2026'),
      prog('b', 'B', 'Bravo', '01/01/2026'),
      prog('c', 'C', 'Charlie', '03/01/2026'),
      prog('d', 'D', 'Delta', '02/01/2026'),
      prog('e', 'E', 'Echo', '02/01/2026'),
      prog('f', 'F', 'Foxtrot', '02/01/2026'),
    ];
    const actions = [
      act(['b'], { urgent: true }),
      act(['a'], { required: true }),
      act(['a', 'd']),
      act(['d'], { required: true }),
      act(['d']),
    ];
    // b has the urgent one; a and d tie on required, d has more open (3 vs 2);
    // c, e, f have none, so the most recently updated (c) leads, then by name.
    expect(programOrder(progress, actions).map(o => progress[o.index].program.id)).toEqual(['b', 'd', 'a', 'c', 'e', 'f']);
  });
});
