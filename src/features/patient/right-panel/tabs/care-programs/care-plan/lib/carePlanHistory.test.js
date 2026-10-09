import { describe, expect, it } from 'vitest';
import { buildCarePlanSnapshot } from './carePlanDraft';
import { buildCarePlanHistory, filterHistoryEntries, liveActivityType } from './carePlanHistory';

const goal = (over = {}) => ({ id: 'g1', title: 'A1c below 7%', status: 'In Progress', priority: 'medium', comparator: '<', targetValue: '7', ...over });
const plan = { id: 'p1', conditions: [], appliedTemplateIds: ['t1'], appliedTemplatePriorities: {}, signedAt: '2026-10-05T10:00:00Z', signedBy: 'Alok Kumar' };
const slice = (over = {}) => ({ plan, goals: [goal()], interventions: [], barriers: [], measurements: [], ...over });
const templates = [{ id: 't1', name: 'Diabetes', goals: [{ title: 'A1c below 7%' }] }];
const version = (n, at, s, by = 'Alok Kumar') => ({ versionNumber: n, createdAt: at, createdBy: by, note: '', snapshot: buildCarePlanSnapshot(s) });

const v1 = version(1, '2026-10-01T10:00:00Z', slice());
const v2 = version(2, '2026-10-05T10:00:00Z', slice({ goals: [goal({ targetValue: '6.5' }), goal({ id: 'g2', title: 'Walk daily' })] }));

describe('buildCarePlanHistory', () => {
  it('gives each signature its structural changes as audit-shaped rows', () => {
    const entries = buildCarePlanHistory({ versions: [v2, v1], audit: [], slice: slice({ goals: v2.snapshot.goals }), templates });
    const v2Entry = entries.find(e => e.id === 'v2');
    expect(v2Entry).toMatchObject({ kind: 'version', current: true, actor: 'Alok Kumar' });
    expect(v2Entry.rows.map(r => `${r.entityType}:${r.action}:${r.summary}:${r.detail}`)).toEqual([
      'goal:target_changed:A1c below 7%:Target: < 7 → < 6.5',
      'goal:created:Walk daily:',
    ]);
    expect(entries.find(e => e.id === 'v1')).toMatchObject({ current: false });
  });

  it('lists live progress as activity tagged with the version current at the time', () => {
    const audit = [
      { id: 'a2', action: 'status_changed', entityType: 'goal', entityId: 'g1', summary: 'A1c below 7%', detail: 'In Progress → Met', actor: 'Suresh', createdAt: '2026-10-06T09:00:00Z' },
      { id: 'a1', action: 'updated', entityType: 'goal', entityId: 'g1', summary: 'A1c below 7%', detail: 'Renamed from "A1c under 7"', actor: 'Suresh', createdAt: '2026-10-02T09:00:00Z' },
    ];
    const entries = buildCarePlanHistory({ versions: [v2, v1], audit, slice: slice({ goals: v2.snapshot.goals }), templates });
    const status = entries.find(e => e.id === 'a-a2');
    expect(status).toMatchObject({ kind: 'activity', type: 'status', headline: 'Status Changed for Goal: A1c below 7%', from: 'In Progress', to: 'Met', version: 2 });
    expect(entries.find(e => e.id === 'a-a1')).toMatchObject({ type: 'title', from: 'A1c under 7', to: 'A1c below 7%', version: 1 });
  });

  it('does not count live progress as unsigned changes', () => {
    const live = slice({ goals: [goal({ targetValue: '6.5', status: 'Met', priority: 'high' }), goal({ id: 'g2', title: 'Walk daily' })] });
    expect(buildCarePlanHistory({ versions: [v2, v1], audit: [], slice: live, templates }).some(e => e.kind === 'unsigned')).toBe(false);
  });

  it('opens with the draft when details changed through Edit', () => {
    const live = slice({ goals: [goal({ targetValue: '6' }), goal({ id: 'g2', title: 'Walk daily' })] });
    const [first] = buildCarePlanHistory({ versions: [v2, v1], audit: [], slice: live, templates });
    expect(first).toMatchObject({ kind: 'unsigned', nextVersion: 3 });
    expect(first.rows[0].detail).toBe('Target: < 6.5 → < 6');
  });

  it('places readings with their previous value', () => {
    const entries = buildCarePlanHistory({
      versions: [v1], audit: [], templates,
      slice: slice({ measurements: [
        { id: 'm1', goalId: 'g1', value: '7.8', unit: '%', favorable: false, takenAt: '2026-10-02T08:00:00Z' },
        { id: 'm2', goalId: 'g1', value: '6.9', unit: '%', favorable: true, takenAt: '2026-10-06T08:00:00Z' },
      ] }),
    });
    expect(entries.find(e => e.id === 'm-m2')).toMatchObject({ value: '6.9 %', previous: '7.8 %', inTarget: true, version: 1 });
  });
});

describe('changes inside a kept template', () => {
  it('tags each edit with the template that was already on the plan', () => {
    const templateDetail = () => JSON.stringify({ goals: [{ title: 'A1c below 7%' }] });
    const entries = buildCarePlanHistory({ versions: [v2, v1], audit: [], slice: slice({ goals: v2.snapshot.goals }), templates, templateDetail });
    const rows = entries.find(e => e.id === 'v2').rows;
    expect(rows.find(r => r.action === 'target_changed').template).toEqual({ id: 't1', name: 'Diabetes' });
    expect(rows.find(r => r.action === 'created').template).toBe(null);
  });
});

describe('liveActivityType', () => {
  it('recognises progress written by the save actions', () => {
    expect(liveActivityType({ action: 'updated', detail: 'Due Date: 2026-10-01 → 2026-11-01' })).toBe('assignment');
    expect(liveActivityType({ action: 'updated', detail: 'Form: A → B' })).toBe(null);
    expect(liveActivityType({ action: 'target_changed' })).toBe(null);
  });
});

describe('filterHistoryEntries', () => {
  it('keeps everything until a type is picked', () => {
    const entries = [{ kind: 'version' }, { kind: 'activity', type: 'status' }];
    expect(filterHistoryEntries(entries, new Set())).toHaveLength(2);
    expect(filterHistoryEntries(entries, new Set(['status']))).toEqual([{ kind: 'activity', type: 'status' }]);
  });
});

describe('note entries', () => {
  it('reads one running note: added, then updated, then removed', () => {
    const audit = [
      { id: 'n3', action: 'note_cleared', entityType: 'plan', actor: 'A', createdAt: '2026-10-03T09:00:00Z' },
      { id: 'n2', action: 'note', entityType: 'plan', detail: 'Second', actor: 'A', createdAt: '2026-10-02T09:00:00Z' },
      { id: 'n1', action: 'note', entityType: 'plan', detail: 'First', actor: 'A', createdAt: '2026-10-01T09:00:00Z' },
    ];
    const entries = buildCarePlanHistory({ versions: [], audit, slice: slice({ plan: { ...plan, signedAt: null } }), templates });
    const byId = id => entries.find(e => e.id === `a-${id}`);
    expect(byId('n1')).toMatchObject({ headline: 'Added a Care Plan Note', body: 'First', previous: '' });
    expect(byId('n2')).toMatchObject({ headline: 'Updated the Care Plan Note', body: 'Second', previous: 'First' });
    expect(byId('n3')).toMatchObject({ headline: 'Removed the Care Plan Note', body: '', previous: 'Second' });
  });
});

describe('change values', () => {
  it('reads dates as MM/DD/YYYY and blanks as None', () => {
    const audit = [{ id: 'd1', action: 'updated', entityType: 'intervention', entityId: 'i1', summary: 'BP review', detail: 'Due Date: — → 2026-10-11', actor: 'A', createdAt: '2026-10-02T09:00:00Z' }];
    const [entry] = buildCarePlanHistory({ versions: [], audit, slice: slice({ plan: { ...plan, signedAt: null } }), templates }).filter(e => e.id === 'a-d1');
    expect(entry).toMatchObject({ from: 'None', to: '10/11/2026', headline: 'Due Date Changed for Intervention: BP review' });
  });
});
