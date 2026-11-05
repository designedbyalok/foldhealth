import { describe, expect, it } from 'vitest';
import { simulateRun, resumePoint, testStep } from './simulate';
import { channelFunnel, dailySeries, nodeStats, overview, rangeFor } from './analytics';
import { SEED_AUTOMATIONS as RAW, SEED_TEMPLATES, buildSeedActivity, wireTemplateIds } from '../data/automationSeed';
import { TEMPLATE_CATEGORIES } from './catalog';
import { graphProblems } from './graph';

const patients = Array.from({ length: 60 }, (_, i) => ({
  id: `p${i}`,
  name: `Member ${i}`,
  email: i % 9 === 0 ? 'not-an-email' : `m${i}@example.com`,
  phone: i % 7 === 0 ? '' : `(415) 555-01${String(i).padStart(2, '0')}`,
  tags: i % 2 ? ['High Risk', 'Hypertensive'] : ['High Risk'],
  coverageType: 'Employee',
  age: 30 + i,
  patientAppActive: i % 3 === 0,
}));

const SEED_AUTOMATIONS = RAW.map(a => ({ ...a, graph: wireTemplateIds(a.graph, k => `email:${k}`) }));
const onboarding = SEED_AUTOMATIONS.find(a => a.templateSlug === 'patient-onboarding');

describe('simulateRun', () => {
  it('is repeatable for the same run key', () => {
    const a = simulateRun(onboarding.graph, patients, { runKey: 'r1', startAt: '2026-10-01T10:00:00Z', now: '2026-10-20T10:00:00Z' });
    const b = simulateRun(onboarding.graph, patients, { runKey: 'r1', startAt: '2026-10-01T10:00:00Z', now: '2026-10-20T10:00:00Z' });
    expect(a).toEqual(b);
  });

  it('only continues members who match the condition', () => {
    const { members } = simulateRun(onboarding.graph, patients, { runKey: 'r2', startAt: '2026-10-01T10:00:00Z', now: '2026-10-20T10:00:00Z' });
    const condId = onboarding.graph.nodes.find(n => n.type === 'matchingConditions').id;
    const passed = members.filter(m => m.path[condId]?.outcome === 'next');
    expect(passed.length).toBe(30);
  });

  it('fails members whose address is invalid, with the reason', () => {
    const { members, messages } = simulateRun(onboarding.graph, patients, { runKey: 'r3', startAt: '2026-10-01T10:00:00Z', now: '2026-10-20T10:00:00Z' });
    const bad = members.find(m => m.patientId === 'p9');
    expect(bad.status).toBe('failed');
    expect(bad.failingReason).toMatch(/Invalid email address/);
    expect(messages.filter(m => m.patientId === 'p9').every(m => m.status === 'failed')).toBe(true);
  });

  it('keeps members waiting on a delay that hasn’t elapsed in progress', () => {
    const now = '2026-10-01T12:00:00Z';
    const { members } = simulateRun(onboarding.graph, patients, { runKey: 'r4', startAt: '2026-10-01T10:00:00Z', now });
    expect(members.some(m => m.status === 'in_progress')).toBe(true);
    const waiting = members.find(m => m.status === 'in_progress');
    expect(resumePoint(onboarding.graph, waiting.path)?.type).toBe('delay');
  });

  it('resumes from the failed step and keeps earlier successes', () => {
    const first = simulateRun(onboarding.graph, [patients[9]], { runKey: 'r5', startAt: '2026-10-01T10:00:00Z', now: '2026-10-20T10:00:00Z' }).members[0];
    const fixed = { ...patients[9], email: 'fixed@example.com' };
    const again = simulateRun(onboarding.graph, [fixed], { runKey: 'r6', startAt: '2026-10-21T10:00:00Z', now: '2026-10-30T10:00:00Z', resume: { p9: first.path } }).members[0];
    expect(again.path.trigger).toEqual(first.path.trigger);
    expect(again.status).not.toBe('failed');
  });
});

describe('analytics totals add up', () => {
  const sim = simulateRun(onboarding.graph, patients, { runKey: 'r7', startAt: '2026-10-01T10:00:00Z', now: '2026-10-20T10:00:00Z' });
  it('completed + in progress + failed = executions', () => {
    const o = overview(sim.members);
    expect(o.completed + o.inProgress + o.failed).toBe(o.total);
  });
  it('delivered + failed = sent, and clicked ≤ opened ≤ delivered', () => {
    const f = channelFunnel(sim.messages, 'email');
    expect(f.delivered + f.failed).toBe(f.sent);
    expect(f.clicked).toBeLessThanOrEqual(f.opened);
    expect(f.opened).toBeLessThanOrEqual(f.delivered);
  });
  it('branch counts never exceed the node above them', () => {
    const { nodes, branches } = nodeStats(sim.members, onboarding.graph);
    for (const [k, n] of Object.entries(branches)) {
      expect(n).toBeLessThanOrEqual(nodes[k.split('::')[0]].members);
    }
  });
});

describe('testStep', () => {
  it('skips delays and names empty required fields', () => {
    expect(testStep({ type: 'delay', config: {} }).status).toBe('skipped');
    const r = testStep({ id: 'x', type: 'generalTask', config: { title: 'T', description: 'D', priority: 'High' } });
    expect(r.status).toBe('error');
    expect(r.errors[0]).toMatchObject({ field: 'assignee', message: 'This field can’t be empty' });
  });
});

describe('seed data', () => {
  it('has a category for every template and no template without steps', () => {
    const cats = new Set(TEMPLATE_CATEGORIES.map(c => c.key));
    for (const t of SEED_TEMPLATES) {
      expect(cats.has(t.category)).toBe(true);
      expect(t.graph.nodes.length).toBeGreaterThan(1);
    }
  });
  it('seeds automations whose steps are fully set up, except the email ids the seed wires in', () => {
    for (const a of SEED_AUTOMATIONS) {
      const problems = graphProblems(a.graph).flatMap(p => p.problems.map(x => x.field)).filter(f => f !== 'templateId');
      expect(problems, a.name).toEqual([]);
    }
  });
  it('builds run history whose run counts match its members', () => {
    let i = 0;
    const act = buildSeedActivity(SEED_AUTOMATIONS, patients, { now: new Date('2026-10-22T12:00:00Z'), newId: () => `id${i++}` });
    expect(act.runs.length).toBeGreaterThan(20);
    for (const r of act.runs) {
      const ms = act.members.filter(m => m.runId === r.id);
      expect(ms.length).toBe(r.memberCount);
      expect(r.completedCount + r.inProgressCount + r.failedCount).toBe(r.memberCount);
    }
  });
});

describe('dailySeries', () => {
  it('buckets by local day, including today', () => {
    const now = new Date();
    const range = rangeFor('lastWeek', now);
    const days = dailySeries([{ channel: 'email', status: 'delivered', sentAt: now.toISOString() }], 'email', range);
    expect(days.at(-1).sent).toBe(1);
    expect(days.reduce((s, d) => s + d.sent, 0)).toBe(1);
  });
});
