import { describe, expect, it } from 'vitest';
import {
  priorProtocolIds, protocolMigrationAuditEntry, protocolMigrationPlan, runFollowsPrior, runProtocol,
} from './protocolMigration';

const protocols = [
  { id: 'v3', title: 'Hypertension', organization: 'Harbor', status: 'active', supersedesId: 'v2' },
  { id: 'v2', title: 'Hypertension', organization: 'Harbor', status: 'superseded', supersedesId: 'v1' },
  { id: 'v1', title: 'Hypertension', organization: 'Harbor', status: 'superseded', supersedesId: null },
  // Superseded before supersedes_id was recorded: matched by title and organization.
  { id: 'old', title: ' hypertension ', organization: 'HARBOR', status: 'superseded', supersedesId: null },
  { id: 'other', title: 'Hypertension', organization: 'Fold', status: 'superseded', supersedesId: null },
  { id: 'draft', title: 'Hypertension', organization: 'Harbor', status: 'draft', supersedesId: null },
];

describe('priorProtocolIds', () => {
  it('follows the supersedes chain, then same-name superseded versions', () => {
    expect(priorProtocolIds(protocols, 'v3')).toEqual(['v2', 'v1', 'old']);
  });
  it('is empty for an unknown or first version', () => {
    expect(priorProtocolIds(protocols, 'nope')).toEqual([]);
    expect(priorProtocolIds([protocols[2]], 'v1')).toEqual([]);
  });
  it('stops on a cycle', () => {
    const loop = [{ id: 'a', supersedesId: 'b', title: 'x' }, { id: 'b', supersedesId: 'a', title: 'x' }];
    expect(priorProtocolIds(loop, 'a')).toEqual(['b']);
  });
});

describe('which runs are affected', () => {
  const prior = new Set(['v2', 'v1']);
  const fromV2 = { sourceProtocol: { id: 'v2', version: '2.0' } };
  const fromV3 = { sourceProtocol: { id: 'v3', version: '3.0' } };

  it('reads the run’s own protocol first, else its template’s', () => {
    expect(runProtocol({ protocolId: 'v1', protocolVersion: '1.0' }, fromV3)).toEqual({ id: 'v1', version: '1.0' });
    expect(runProtocol({}, fromV2)).toEqual({ id: 'v2', version: '2.0' });
    expect(runProtocol({}, { sourceProtocol: null })).toBeNull();
  });
  it('counts runs on a prior version, directly or through the template', () => {
    expect(runFollowsPrior({}, fromV2, prior)).toBe(true);
    expect(runFollowsPrior({ protocolId: 'v1' }, fromV3, prior)).toBe(true);
    // Already migrated, though its template still says v2.
    expect(runFollowsPrior({ protocolId: 'v3' }, fromV2, prior)).toBe(false);
    expect(runFollowsPrior({}, fromV3, prior)).toBe(false);
    expect(runFollowsPrior({}, {}, prior)).toBe(false);
  });
});

describe('protocolMigrationPlan', () => {
  const rows = [
    { instanceId: 'a', programCode: 'CCM', ipa: 'North', groups: [] },
    { instanceId: 'b', programCode: 'CCM', ipa: 'South', groups: ['HTN'] },
    { instanceId: 'c', programCode: 'PCM', ipa: '', groups: ['HTN'] },
  ];
  const ids = list => list.map(r => r.instanceId);

  it('moves every plan now for "all"', () => {
    const p = protocolMigrationPlan(rows, 'all');
    expect([ids(p.now), ids(p.deferred), ids(p.stay)]).toEqual([['a', 'b', 'c'], [], []]);
  });
  it('defers every plan to its next review for "review"', () => {
    const p = protocolMigrationPlan(rows, 'review');
    expect([ids(p.now), ids(p.deferred), ids(p.stay)]).toEqual([[], ['a', 'b', 'c'], []]);
  });
  it('moves the chosen cohorts now and leaves the rest on the prior version', () => {
    const p = protocolMigrationPlan(rows, 'cohort', { programCode: ['CCM'] });
    expect([ids(p.now), ids(p.stay)]).toEqual([['a', 'b'], ['c']]);
    // Dimensions combine with AND; "(none)" picks rows without a value.
    expect(ids(protocolMigrationPlan(rows, 'cohort', { programCode: ['CCM'], groups: ['HTN'] }).now)).toEqual(['b']);
    expect(ids(protocolMigrationPlan(rows, 'cohort', { ipa: ['(none)'] }).now)).toEqual(['c']);
  });
  it('moves nothing for an empty cohort', () => {
    const p = protocolMigrationPlan(rows, 'cohort', {});
    expect([p.now.length, p.stay.length]).toEqual([0, 3]);
  });
});

describe('protocolMigrationAuditEntry', () => {
  it('records the from/to version and mode', () => {
    expect(protocolMigrationAuditEntry({ title: 'Hypertension', fromVersion: '2.1', toVersion: '2.2', toId: 'v3', mode: 'cohort', templateName: 'HTN plan' })).toEqual({
      entityType: 'protocol', entityId: 'v3', action: 'updated', summary: 'Hypertension',
      detail: 'Protocol v2.1 → v2.2 (Migrate by cohort) · HTN plan',
    });
  });
  it('words a missing version', () => {
    expect(protocolMigrationAuditEntry({ mode: 'review' }).detail).toBe('Protocol the prior version → the new version (Next review only)');
  });
});
