import { describe, expect, it } from 'vitest';
import { clinicalSummary, combinedPlanTotals, nextBestActions, programOrder, programProgress, whyPrioritized } from './careProgramsOverviewModel';

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
  it('lists takeaways and writes the paragraph from the same records', () => {
    const actions = nextBestActions([ccmEntry, dmEntry]);
    const { takeaways, segments } = whyPrioritized(actions, {
      acuity: 'High-Risk',
      totals: combinedPlanTotals([ccmEntry, dmEntry]),
      progress: [programProgress(ccmEntry), programProgress(dmEntry)],
      firstName: 'Maria',
    });
    expect(takeaways).toEqual([
      { tone: 'danger', text: 'CCM Program Related Task: 1 open • 1 overdue' },
      { tone: 'warning', text: '1 goal off target' },
      { tone: 'warning', text: 'High-Risk acuity' },
    ]);
    expect(segments[0]).toEqual({ bold: true, text: 'Urgent: CCM Program Related Task (1 open • 1 overdue).' });
    expect(segments.slice(1).map(s => s.text).join('')).toBe(' Goal progress is 40% across 1 goal, with 1 goal off target, 1 barrier without an intervention. Maria is in 2 programs: CCM 1 of 4 steps done, DM 0 of 1 steps done.');
    expect(whyPrioritized([], { acuity: 'Low' })).toEqual({ takeaways: [], segments: [] });
  });
});

describe('summary', () => {
  it('totals the plans and finds each program\'s next step', () => {
    const totals = combinedPlanTotals([ccmEntry, dmEntry]);
    expect(totals).toEqual({ goals: 1, interventions: 0, barriers: 1, avgProgress: 40, issues: { goal: 1, intervention: 0, barrier: 1 } });
    const progress = [programProgress(ccmEntry), programProgress(dmEntry)];
    expect(progress.map(p => [p.done, p.total, p.next?.name])).toEqual([[1, 4, 'Program Related Task'], [0, 1, 'Outreach']]);
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

describe('clinicalSummary', () => {
  const bp = { id: 'g-bp', title: 'Improve blood pressure control', measure: 'Blood Pressure', status: 'In Progress', comparator: '<=', targetValue: '130', targetValue2: '80' };
  const a1c = { id: 'g-a1c', title: 'Lower A1C', measure: 'HbA1c', status: 'In Progress', comparator: '<', targetValue: '7', customUnit: '%' };
  const walk = { id: 'g-walk', title: 'Walk daily', status: 'Not Started' };
  const entry = (program, goals, measurements, attention = []) => ({ program, steps: [], ctx: {}, carePlan: { goals, interventions: [], barriers: [], measurements }, attention });

  it('reads the latest reading per goal against its target, off target first, and lists concerns', () => {
    const entries = [
      entry(ccm, [bp, a1c, walk], [
        { goalId: 'g-bp', value: '146/90', unit: 'mmHg', favorable: false, takenAt: '2026-09-15' },
        { goalId: 'g-bp', value: '128/78', unit: 'mmHg', takenAt: '2026-10-01' },
        { goalId: 'g-a1c', value: '8.1', takenAt: '2026-09-20' },
      ], [{ kind: 'intervention', item: { id: 'i1', title: 'Diabetes education' }, text: 'Due 10/01/2026.' }]),
      entry(dm, [{ ...bp, id: 'g-bp2' }], [], [{ kind: 'barrier', item: { id: 'b1', title: 'Cost of strips' }, text: '' }]),
    ];
    const evaluate = (g, v) => (g.id === 'g-bp' ? Number(String(v).split('/')[0]) <= 130 : Number(v) < 7);
    const out = clinicalSummary(entries, {
      problems: [{ title: 'Hypertension', type: 'Chronic', status: 'Active' }, { title: 'Type 2 diabetes', type: 'Chronic', status: 'Active' }, { title: 'Bronchitis', type: 'Acute', status: 'Active' }],
      acuity: 'High-Risk',
      firstName: 'Maria',
      evaluate,
    });
    expect(out.lead).toBe('Maria (High-Risk acuity) has 2 active chronic conditions: Hypertension and Type 2 diabetes. At the latest reading, 1 of 2 monitored goals is in range and 1 is off target. 1 open goal has no readings yet.');
    expect(out.readings.map(r => [r.title, r.value, r.prior, r.target, r.met, r.programs.map(p => p.code).join('+')])).toEqual([
      ['HbA1c', '8.1 %', '', '< 7 %', false, 'CCM'],
      ['Blood Pressure', '128/78 mmHg', '146/90 mmHg', '≤ 130/80 mmHg', true, 'CCM+DM'],
    ]);
    expect(out.concerns.map(c => [c.label, c.title, c.text])).toEqual([
      ['Overdue intervention', 'Diabetes education', 'Due 10/01/2026'],
      ['Unaddressed barrier', 'Cost of strips', ''],
    ]);
  });
});
