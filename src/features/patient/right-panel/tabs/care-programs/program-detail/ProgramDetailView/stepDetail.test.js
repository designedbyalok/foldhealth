import { describe, expect, it } from 'vitest';
import { openStepsWithDetail, stepDetail } from './stepDetail';

const plan = (fields = {}, items = {}) => ({ plan: { id: 'p', ...fields }, goals: [], interventions: [], barriers: [], measurements: [], ...items });

describe('stepDetail', () => {
  it('reads the care plan: none, awaiting signature, needs attention, not signed', () => {
    expect(stepDetail({ name: 'Care Plan' }, { carePlan: null })).toEqual({ text: 'No care plan yet', urgent: false });
    const goal = { id: 'g1', title: 'A1C', status: 'In Progress' };
    expect(stepDetail({ name: 'Care Plan' }, { carePlan: plan({ completedAt: '2026-11-10T10:00:00Z', awaitingSigner: 'Dr. Lee' }, { goals: [goal] }) }))
      .toEqual({ text: "Awaiting Dr. Lee's signature", urgent: false });
    const offTarget = plan({}, { goals: [goal], measurements: [{ goalId: 'g1', value: '9', favorable: false }] });
    expect(stepDetail({ name: 'Care Plan' }, { carePlan: offTarget })).toEqual({ text: '1 goal off target', urgent: true });
    expect(stepDetail({ name: 'Care Plan' }, { carePlan: plan({}, { goals: [goal], interventions: [{ id: 'i1', goalId: 'g1', status: 'In Progress' }] }) }))
      .toEqual({ text: 'Not signed yet', urgent: false });
  });

  it('counts open and overdue tasks', () => {
    const ctx = { tasks: [
      { status: 'pending', due_date: '01/02/2020' },
      { status: 'missed' },
      { status: 'pending', due_date: '01/02/2999' },
      { status: 'completed', due_date: '01/02/2020' },
    ] };
    expect(stepDetail({ name: 'Program Related Task' }, ctx)).toEqual({ text: '3 open • 2 overdue', urgent: true });
    expect(stepDetail({ name: 'Program Related Task' }, { tasks: [] })).toBeNull();
  });

  it('names the next open appointment, ICT only for an ICT step', () => {
    const ctx = { appointments: [
      { status: 'scheduled', date: '2999-12-01', title: 'Follow-up' },
      { status: 'scheduled', date: '2999-12-09', appointment_type_name: 'ICT Meeting' },
      { status: 'completed', date: '2026-11-01', title: 'ICT' },
    ] };
    expect(stepDetail({ name: 'Appointment' }, ctx)).toEqual({ text: 'Scheduled 12/01/2999', urgent: false });
    expect(stepDetail({ name: 'ICT Appointment' }, ctx)).toEqual({ text: 'Scheduled 12/09/2999', urgent: false });
    expect(stepDetail({ name: 'ICT Appointment' }, { appointments: [] })).toEqual({ text: 'None scheduled', urgent: false });
    expect(stepDetail({ name: 'Appointment' }, { appointments: [{ status: 'scheduled', date: '2020-04-10' }] }))
      .toEqual({ text: '04/10/2020 not marked done', urgent: false });
  });

  it('says Required for a mandatory step with no records, and nothing for an optional one', () => {
    expect(stepDetail({ name: 'Referral Review', mandatory: true }, {})).toEqual({ text: 'Required', urgent: false });
    expect(stepDetail({ name: 'Referral Review' }, {})).toBeNull();
  });
});

describe('openStepsWithDetail', () => {
  it('keeps urgent and started steps plus only the next required one, urgent first', () => {
    const steps = [
      { id: 'd', name: 'Letters', mandatory: true, status: 'completed' },
      { id: 'a', name: 'Referral Review', mandatory: true, status: 'pending' },
      { id: 'b', name: 'Documents', status: 'pending' },
      { id: 'c', name: 'Program Related Task', status: 'in_progress' },
      { id: 'f', name: 'Post Visit Checklist', mandatory: true, status: 'pending' },
      { id: 'e', name: 'Outreach', status: 'pending' },
    ];
    const ctx = { tasks: [{ status: 'missed' }] };
    expect(openStepsWithDetail(steps, ctx).map(s => s.id)).toEqual(['c', 'a']);
  });
});
