import { describe, expect, it } from 'vitest';
import { inlineAddPayload } from './carePlanInlineAdd';

describe('inlineAddPayload', () => {
  it('builds a new goal from its name', () => {
    expect(inlineAddPayload('goal', { title: '  Walk 20 minutes daily ' })).toMatchObject({
      title: 'Walk 20 minutes daily', status: 'Not Started', priority: 'medium',
    });
  });

  it('links a barrier to its goal, or to none', () => {
    expect(inlineAddPayload('barrier', { title: 'No ride', goalId: 'g1' }).goalIds).toEqual(['g1']);
    expect(inlineAddPayload('barrier', { title: 'No ride' }).goalIds).toEqual([]);
  });

  it('assigns a patient task to the patient and leaves an internal task unassigned', () => {
    const patient = inlineAddPayload('intervention', { title: 'Log BP', goalId: 'g1', type: 'patient-task', patientName: 'Annette Brave' });
    expect(patient).toMatchObject({ kind: 'patient-task', title: 'Log BP', goalId: 'g1', status: 'Not Started', taskId: null });
    expect(patient.assignee.name).toBe('Annette Brave');
    const internal = inlineAddPayload('intervention', { title: 'Call PCP' });
    expect(internal).toMatchObject({ kind: 'internal-task', goalId: null });
    expect(internal.assignee.name).toBe('Unassigned');
  });
});
