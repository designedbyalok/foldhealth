import { describe, expect, it } from 'vitest';
import { groupMembersToApply, groupUpdates, mapTemplateGroupRow, membersChanged, recordGroup } from './templateGroups';

const templates = [
  { id: 'dm', name: 'Diabetes', status: 'published' },
  { id: 'htn', name: 'Hypertension', status: 'published' },
  { id: 'sdoh', name: 'SDOH Support Plan', status: 'published' },
  { id: 'old', name: 'Old Diabetes', status: 'archived' },
  { id: 'wip', name: 'Draft plan', status: 'draft' },
];
const group = mapTemplateGroupRow({ id: 'g1', name: 'Diabetes with HTN', template_ids: ['dm', 'htn', 'old', 'wip', 'gone'], version_number: 2 });

describe('groupMembersToApply', () => {
  it('adds members not on the plan, in order, and says why the rest are skipped', () => {
    const r = groupMembersToApply(group, templates, ['htn']);
    expect(r.toAdd).toEqual(['dm']);
    expect(r.skipped.map(s => [s.id, s.reason])).toEqual([['htn', 'already'], ['old', 'retired'], ['wip', 'draft'], ['gone', 'missing']]);
  });

  it('can be limited to some members', () => {
    expect(groupMembersToApply(group, templates, [], ['htn']).toAdd).toEqual(['htn']);
  });
});

describe('versions and plan records', () => {
  it('a member change is a new version; a reorder is too, nothing else is', () => {
    expect(membersChanged(['a', 'b'], ['a', 'b'])).toBe(false);
    expect(membersChanged(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(membersChanged(['a'], ['a', 'b'])).toBe(true);
  });

  it('records one entry per group, the latest application winning', () => {
    const now = new Date('2026-11-02T10:00:00Z');
    const first = recordGroup([], { id: 'g1', versionNumber: 1 }, { appliedBy: 'Ana', now });
    const again = recordGroup(first, { id: 'g1', versionNumber: 2 }, { now });
    expect(again).toEqual([{ groupId: 'g1', versionNumber: 2, appliedAt: now.toISOString(), appliedBy: '', dismissedVersion: null }]);
  });
});

describe('groupUpdates', () => {
  const v3 = { ...group, templateIds: ['dm', 'htn', 'sdoh'], versionNumber: 3 };

  it('offers the members a newer version added that the plan lacks', () => {
    const [u] = groupUpdates([{ groupId: 'g1', versionNumber: 2 }], [v3], templates, ['dm', 'htn']);
    expect(u.newIds).toEqual(['sdoh']);
    expect(u.group.versionNumber).toBe(3);
  });

  it('offers nothing when current, dismissed, or already on the plan', () => {
    expect(groupUpdates([{ groupId: 'g1', versionNumber: 3 }], [v3], templates, [])).toEqual([]);
    expect(groupUpdates([{ groupId: 'g1', versionNumber: 2, dismissedVersion: 3 }], [v3], templates, [])).toEqual([]);
    expect(groupUpdates([{ groupId: 'g1', versionNumber: 2 }], [v3], templates, ['dm', 'htn', 'sdoh'])).toEqual([]);
    expect(groupUpdates([{ groupId: 'deleted', versionNumber: 1 }], [v3], templates, [])).toEqual([]);
  });
});
