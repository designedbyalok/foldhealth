import { describe, it, expect } from 'vitest';
import { buildProgramReport, inRange, resolveRange, stepKind, toDate, OVERVIEW_KEY } from './programReportModel';

const today = new Date(2026, 9, 13);

describe('program report dates', () => {
  it('reads the date shapes the app stores', () => {
    expect(toDate('2026-09-01').getDate()).toBe(1);
    expect(toDate('09/08/2025').getMonth()).toBe(8);
    expect(toDate('10-13-2026').getFullYear()).toBe(2026);
    expect(toDate('11/11/2024, 11:45 AM').getDate()).toBe(11);
    expect(toDate('-')).toBeNull();
  });

  it('resolves presets, starting "Since enrollment" on the program start date', () => {
    const r = resolveRange('enrollment', { enrolledOn: '09/09/2026', today });
    expect(r.label).toBe('09/09/2026 - 10/13/2026');
    expect(resolveRange('30', { today }).label).toBe('09/13/2026 - 10/13/2026');
    expect(resolveRange('custom', { custom: ['2026-01-01', '2026-01-31'], today }).label).toBe('01/01/2026 - 01/31/2026');
  });

  it('keeps undated items and drops ones outside the range', () => {
    const r = resolveRange('30', { today });
    expect(inRange(null, r)).toBe(true);
    expect(inRange('2026-10-01', r)).toBe(true);
    expect(inRange('2026-08-01', r)).toBe(false);
  });
});

describe('buildProgramReport', () => {
  const steps = [
    { id: 's1', name: 'Outreach', status: 'in_progress' },
    { id: 's2', name: 'HRA', status: 'completed', section: 'Program Directives' },
    { id: 's3', name: 'Program Related Task', status: 'pending' },
  ];
  const base = {
    program: { code: 'SNP', name: 'SNP Care Program', status: 'Enrolled' },
    patient: { name: 'Annette Brave', age: '61' },
    steps,
    manual: { s2: { status: 'completed', updatedBy: 'Robert Fox', updatedAt: '2026-10-01T10:00:00Z' } },
    range: resolveRange('30', { today }),
    progress: 33,
    data: {
      activity: [
        { programCode: 'SNP', activityKind: 'call', title: 'Outreach - Follow up', statusLabel: 'Successful', occurredAt: '2026-10-02T10:00:00Z', actorName: 'Amar' },
        { programCode: 'SNP', activityKind: 'call', title: 'Outreach - Old call', occurredAt: '2026-06-02T10:00:00Z' },
        { programCode: 'AWV', activityKind: 'call', title: 'Outreach - Other program', occurredAt: '2026-10-02T10:00:00Z' },
      ],
      tasks: [{ name: 'Call PCP', status: 'pending', created_at: '2026-10-03T00:00:00Z', due_date: '10-20-2026' }],
    },
  };

  it('prints only the steps switched on, in step order', () => {
    const { sections } = buildProgramReport({ ...base, enabled: new Set([OVERVIEW_KEY, 's2', 's3']) });
    expect(sections.map(s => s.key)).toEqual([OVERVIEW_KEY, 's2', 's3']);
    expect(sections[1].title).toBe('Program Directives: HRA');
  });

  it("filters a step's records to the range and to this program", () => {
    const { sections } = buildProgramReport({ ...base, enabled: new Set(['s1']) });
    const tableBlock = sections[0].blocks.find(b => b.type === 'table');
    expect(tableBlock.rows).toHaveLength(1);
    expect(tableBlock.rows[0][1]).toBe('Follow up');
  });

  it('says who reviewed a step', () => {
    const { sections } = buildProgramReport({ ...base, enabled: new Set(['s2']) });
    const meta = sections[0].blocks[0];
    expect(meta.rows[1].label).toBe('Reviewed by');
    expect(meta.rows[1].value).toMatch(/^Robert Fox on /);
  });

  it('formats a numeric age and leaves a formatted one alone', () => {
    expect(buildProgramReport({ ...base, enabled: new Set() }).patientRows[1].value).toBe('(61Y)');
    expect(buildProgramReport({ ...base, patient: { name: 'A', dob: '05/18/1965', age: '61y 4m' }, enabled: new Set() }).patientRows[1].value).toBe('05/18/1965 (61y 4m)');
  });

  it('knows which steps print records of their own', () => {
    expect(stepKind({ name: 'ICT Appointment' })).toBe('appointment');
    expect(stepKind({ name: 'Care Plan Details' })).toBe('carePlan');
    expect(stepKind({ name: 'Snapshot' })).toBe('step');
  });
});
