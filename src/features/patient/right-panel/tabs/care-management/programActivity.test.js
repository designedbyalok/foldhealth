import { describe, expect, it } from 'vitest';
import { carePlanActivityEntries, filterProgramActivity, groupProgramActivity } from './programActivity';

const programs = [{ id: 'p-snp', code: 'SNP' }];

describe('carePlanActivityEntries', () => {
  it('reads care plan audit rows and signatures as program activity', () => {
    const audit = [
      { id: 'a1', programCode: 'SNP', entityType: 'goal', action: 'status_changed', summary: 'A1c below 7%', detail: 'In Progress → Met', actor: 'Alok Kumar', createdAt: '2026-10-02T09:00:00Z' },
      { id: 'a2', programCode: 'SNP', entityType: 'plan', action: 'note', summary: '', detail: 'Called patient', actor: 'Alok Kumar', createdAt: '2026-10-02T10:00:00Z' },
      { id: 'a3', programCode: 'PATIENT', entityType: 'barrier', action: 'created', summary: 'Transportation', actor: 'Ketan', createdAt: '2026-10-03T10:00:00Z' },
      { id: 'a4', programCode: 'SNP', entityType: 'plan', action: 'shared', summary: 'EHR', actor: 'Ketan', createdAt: '2026-10-03T11:00:00Z' },
      { id: 'a5', programCode: 'SNP', entityType: 'goal', action: 'created', summary: 'Walk daily', actor: 'Ketan', createdAt: '2026-10-04T09:00:00Z' },
    ];
    const versions = [{ id: 'v1', programId: 'p-snp', versionNumber: 3, createdBy: 'Alok Kumar', createdAt: '2026-10-04T10:00:00Z' }];
    const rows = carePlanActivityEntries(audit, versions, programs);
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));
    expect(byId['cpa-a1']).toMatchObject({
      programCode: 'SNP', title: 'Status Changed for Goal: A1c below 7%',
      statusLabel: 'Met', statusType: 'success', actorInitials: 'AK',
      history: { type: 'status', from: 'In Progress', to: 'Met' },
    });
    expect(byId['cpa-a2']).toMatchObject({ title: 'Added a Care Plan Note', activityKind: 'note', history: { body: 'Called patient' } });
    expect(byId['cpa-a3']).toBeUndefined();
    expect(byId['cpa-a4']).toBeUndefined();
    // What a signature makes official reads as the signature, not row by row.
    expect(byId['cpa-a5']).toBeUndefined();
    // Activity is tagged with the version its plan was on at the time.
    expect(byId['cpa-a1']).toMatchObject({ planVersion: null });
    expect(byId['cpv-v1']).toMatchObject({ programCode: 'SNP', title: 'Care Plan Signed', statusLabel: 'Version 3', programId: 'p-snp', versionNumber: 3 });
  });
});

describe('filterProgramActivity', () => {
  const entries = [
    { id: '1', programCode: 'SNP', activityKind: 'call', actorName: 'Alok Kumar', title: 'Outreach', occurredAt: '2026-10-02T09:00:00' },
    { id: '2', programCode: 'TOC', activityKind: 'careplan', actorName: 'Ketan', title: 'Goal Added', occurredAt: '2026-10-05T09:00:00' },
  ];
  it('narrows by type, program, person and date range', () => {
    expect(filterProgramActivity(entries, { types: ['Care Plan'] }).map(e => e.id)).toEqual(['2']);
    expect(filterProgramActivity(entries, { programs: ['SNP'] }).map(e => e.id)).toEqual(['1']);
    expect(filterProgramActivity(entries, { actors: ['Ketan'] }).map(e => e.id)).toEqual(['2']);
    expect(filterProgramActivity(entries, { range: ['2026-10-01', '2026-10-03'] }).map(e => e.id)).toEqual(['1']);
  });
});

describe('groupProgramActivity', () => {
  it('stacks a program\'s same-day activities and lists who made them', () => {
    const entries = [
      { id: '1', programCode: 'SNP', programName: 'SNP Program Updates', actorName: 'Alok Kumar', actorInitials: 'AK', title: 'A', occurredAt: '2026-10-02T11:00:00' },
      { id: '2', programCode: 'SNP', programName: 'SNP Program Updates', actorName: 'Ketan Patni', actorInitials: 'KP', title: 'B', occurredAt: '2026-10-02T10:00:00' },
      { id: '3', programCode: 'TOC', programName: 'TOC Program Updates', actorName: 'Alok Kumar', actorInitials: 'AK', title: 'C', occurredAt: '2026-10-02T09:00:00' },
    ];
    const [month] = groupProgramActivity(entries);
    const [snp, toc] = month.days[0].entries;
    expect(snp).toMatchObject({ type: 'group', count: 2, userCount: 2 });
    expect(snp.users.map(u => u.initials)).toEqual(['AK', 'KP']);
    expect(toc).toMatchObject({ type: 'single', count: 1 });
  });
});
