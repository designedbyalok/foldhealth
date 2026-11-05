import { describe, it, expect } from 'vitest';
import { PROGRAM_STEPS } from '../../patient/data/programActivityMock.js';
import { defaultProgramTypes, runtimeSteps, stepCounts, rowToProgramType, programTypeToRow, withLibrarySteps, stepOpens, stepScreen } from './careProgramConfigModel';

const ids = list => list.flatMap(s => (s.type === 'section' ? [s.id, ...s.children.map(c => c.id)] : [s.id]));

describe('care program configuration defaults', () => {
  const types = defaultProgramTypes();

  it('keeps every built-in step id, so saved step statuses still line up', () => {
    Object.entries(PROGRAM_STEPS).forEach(([code, steps]) => {
      const type = types.find(t => t.code === code);
      expect(type, code).toBeTruthy();
      const configured = new Set(ids(type.steps));
      ids(steps).forEach(id => expect(configured.has(id), `${code} ${id}`).toBe(true));
    });
  });

  it("shows SNP patients the same steps as before; the new ones start switched off", () => {
    const snp = types.find(t => t.code === 'SNP');
    const live = runtimeSteps(snp.steps).flatMap(s => (s.type === 'section' ? s.children : [s])).map(s => s.id).sort();
    const before = ids(PROGRAM_STEPS.SNP).filter(id => !['step-3', 'step-4'].includes(id)).sort();
    expect(live).toEqual(before);
    expect(stepCounts(snp.steps)).toMatchObject({ on: 15, mandatory: 8 });
  });
});

describe('runtimeSteps', () => {
  it('drops switched-off steps and sections left empty', () => {
    const steps = [
      { id: 'a', name: 'Outreach', enabled: true, mandatory: true },
      { id: 'b', name: 'Orders', enabled: false },
      { id: 's', name: 'Directives', type: 'section', enabled: true, children: [{ id: 'c', name: 'HRA', enabled: false }] },
      { id: 't', name: 'Model of Care', type: 'section', enabled: false, children: [{ id: 'd', name: 'Care Plan', enabled: true }] },
    ];
    expect(runtimeSteps(steps)).toEqual([{ id: 'a', name: 'Outreach', mandatory: true }]);
  });
});

describe('rows', () => {
  it('round-trips a program type', () => {
    const t = defaultProgramTypes()[0];
    const back = rowToProgramType({ ...programTypeToRow(t), created_at: null, updated_at: null });
    expect(back.steps).toEqual(t.steps);
    expect(back.worklists).toEqual(t.worklists);
    expect(back.code).toBe(t.code);
  });
});

describe('withLibrarySteps', () => {
  it('lists every library step once, switched off, and adds nothing on a second pass', () => {
    const steps = [
      { id: 'a', name: 'Outreach', enabled: true },
      { id: 's', name: 'Directives', type: 'section', enabled: true, children: [{ id: 'b', name: 'Medication Review', enabled: true }] },
    ];
    const full = withLibrarySteps(steps);
    const names = full.flatMap(s => (s.type === 'section' ? s.children : [s])).map(s => s.name);
    expect(names).not.toContain('Medication Reconciliation'); // same step as "Medication Review"
    expect(names.filter(n => n === 'Outreach')).toHaveLength(1);
    expect(full.flatMap(s => (s.type === 'section' ? s.children : [s])).filter(s => s.id.startsWith('lib-')).every(s => s.enabled === false)).toBe(true);
    expect(withLibrarySteps(full)).toEqual(full);
  });

  it('predefines no assessments; a program without an assessment section gets an empty Program Directives', () => {
    const full = withLibrarySteps([]);
    const names = full.flatMap(s => (s.type === 'section' ? s.children : [s])).map(s => s.name);
    expect(names).not.toContain('HRA');
    expect(names).not.toContain('PHQ-9');
    const directives = full.find(s => s.type === 'section');
    expect(directives).toMatchObject({ name: 'Program Directives', children: [] });
    expect(full.indexOf(directives)).toBe(full.findIndex(s => s.name === 'Letters') + 1);
    expect(withLibrarySteps(full)).toEqual(full);
    expect(runtimeSteps(full)).toEqual([]);
  });
});

describe('configured steps', () => {
  it('opens a linked form first, then a set screen, then the screen its name matches', () => {
    expect(stepOpens({ name: 'Snapshot', formId: '54', formName: 'New OB Intake' })).toBe('form');
    expect(stepOpens({ name: 'Member Outreach', screen: 'Outreach' })).toBe('screen');
    expect(stepScreen({ name: 'Member Outreach', screen: 'Outreach' })).toBe('Outreach');
    expect(stepScreen({ name: 'Program Documents' })).toBe('Program Related Files');
    expect(stepOpens({ name: 'Snapshot' })).toBe('screen');
    expect(stepOpens({ name: 'Intake Review' })).toBe('none');
  });

  it('carries the screen and linked form to the patient program', () => {
    const [snapshot, outreach] = runtimeSteps([
      { id: 's1', name: 'Snapshot', enabled: true, formId: '54', formName: 'New OB Intake' },
      { id: 's2', name: 'Member Outreach', enabled: true, screen: 'Outreach' },
    ]);
    expect(snapshot).toMatchObject({ id: 's1', formId: '54', formName: 'New OB Intake' });
    expect(outreach).toMatchObject({ id: 's2', name: 'Member Outreach', screen: 'Outreach' });
  });
});
