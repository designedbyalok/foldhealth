import { describe, expect, it } from 'vitest';
import {
  effectiveVersion, impactSummary, inCohort, migrationTargets, nextVersionNumber, shouldMigrateNow, versionDiff, versionState,
} from './templateVersions';

const versions = [
  { id: 'v1', versionNumber: 1, effectiveDate: '2025-01-01' },
  { id: 'v2', versionNumber: 2, effectiveDate: '2025-06-01' },
  { id: 'v3', versionNumber: 3, effectiveDate: '2026-12-01' },
];

describe('version chain', () => {
  it('picks the version in effect on a date', () => {
    expect(effectiveVersion(versions, '2024-12-31')).toBeNull();
    expect(effectiveVersion(versions, '2025-03-15').id).toBe('v1');
    expect(effectiveVersion(versions, '2025-06-01').id).toBe('v2');
    expect(effectiveVersion(versions, '2026-10-28').id).toBe('v2');
    expect(nextVersionNumber(versions)).toBe(4);
  });

  it('labels current, past and scheduled versions', () => {
    expect(versions.map(v => versionState(v, versions, '2026-10-28'))).toEqual(['past', 'current', 'scheduled']);
  });

  it('diffs content by item title', () => {
    const d = versionDiff(
      { goals: [{ title: 'A1c below 8' }, { title: 'Walk' }], interventions: [{ title: 'Call' }], barriers: [] },
      { goals: [{ title: 'a1c below 8 ' }, { title: 'Diet' }], interventions: [{ title: 'Call' }], barriers: [{ title: 'Cost' }] },
    );
    expect(d.goal.added.map(x => x.title)).toEqual(['Diet']);
    expect(d.goal.removed.map(x => x.title)).toEqual(['Walk']);
    expect(d.intervention).toEqual({ added: [], removed: [] });
    expect(d.barrier.added.map(x => x.title)).toEqual(['Cost']);
    expect(d.total).toBe(3);
  });
});

const rows = [
  { instanceId: 'i1', patientId: 'p1', programCode: 'SNP', ipa: 'Astrana', careManager: 'Alok Kumar', groups: ['High risk'], versionNumber: 1 },
  { instanceId: 'i2', patientId: 'p2', programCode: 'CCM', ipa: 'CFC', careManager: '', groups: [], versionNumber: 1 },
  { instanceId: 'i3', patientId: 'p1', programCode: 'CCM', ipa: 'Astrana', careManager: 'Sarah Kim', groups: ['High risk', 'Diabetes'], versionNumber: 2 },
];

describe('impact and migration', () => {
  it('summarizes plans by version, program, IPA, care manager and group', () => {
    const s = impactSummary(rows);
    expect(s.plans).toBe(3);
    expect(s.patients).toBe(2);
    expect(s.byVersion).toEqual([{ value: 'v1', n: 2 }, { value: 'v2', n: 1 }]);
    expect(s.ipa).toEqual([{ value: 'Astrana', n: 2 }, { value: 'CFC', n: 1 }]);
    expect(s.careManager.find(x => x.value === '(none)').n).toBe(1);
    expect(s.groups[0]).toEqual({ value: 'High risk', n: 2 });
  });

  it('cohorts combine dimensions with AND and values with OR', () => {
    expect(rows.filter(r => inCohort(r, { ipa: ['Astrana'] })).map(r => r.instanceId)).toEqual(['i1', 'i3']);
    expect(rows.filter(r => inCohort(r, { ipa: ['Astrana'], programCode: ['SNP'] })).map(r => r.instanceId)).toEqual(['i1']);
    expect(rows.filter(r => inCohort(r, { careManager: ['(none)', 'Sarah Kim'] })).map(r => r.instanceId)).toEqual(['i2', 'i3']);
    expect(rows.filter(r => inCohort(r, {}))).toEqual([]);
  });

  it('targets older runs per mode', () => {
    expect(migrationTargets(rows, 'all', {}, 3).rows.map(r => r.instanceId)).toEqual(['i1', 'i2', 'i3']);
    expect(migrationTargets(rows, 'all', {}, 2).rows.map(r => r.instanceId)).toEqual(['i1', 'i2']);
    const c = migrationTargets(rows, 'cohort', { programCode: ['CCM'] }, 3);
    expect([c.pending, c.rows.map(r => r.instanceId)]).toEqual(['auto', ['i2', 'i3']]);
    expect(migrationTargets(rows, 'review', {}, 3).pending).toBe('review');
  });

  it('runs a pending migration only once effective, and review ones only at review', () => {
    const auto = { pendingVersionId: 'v3', pendingMode: 'auto', pendingEffectiveDate: '2026-12-01' };
    expect(shouldMigrateNow(auto, 'load', '2026-10-28')).toBe(false);
    expect(shouldMigrateNow(auto, 'load', '2026-12-01')).toBe(true);
    const review = { ...auto, pendingMode: 'review', pendingEffectiveDate: '2026-10-01' };
    expect(shouldMigrateNow(review, 'load', '2026-10-28')).toBe(false);
    expect(shouldMigrateNow(review, 'review', '2026-10-28')).toBe(true);
  });
});
