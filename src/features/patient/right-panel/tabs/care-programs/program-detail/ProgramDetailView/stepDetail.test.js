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

  it('names the task to do next: an overdue one first, then the soonest due', () => {
    const ctx = { tasks: [
      { name: 'Later', status: 'pending', due_date: '01-02-2999' },
      { name: 'Missed call', status: 'missed' },
      { name: 'Potassium recheck', status: 'pending', due_date: '01-02-2020' },
      { name: 'Done', status: 'completed', due_date: '01/02/2020' },
    ] };
    expect(stepDetail({ name: 'Program Related Task' }, ctx))
      .toEqual({ title: 'Potassium recheck', label: 'Program Task', text: 'Overdue, due 01/02/2020 • 2 more', urgent: true });
    expect(stepDetail({ name: 'Program Related Task' }, { tasks: [{ name: 'Later', status: 'pending', due_date: '01-02-2999' }] }))
      .toEqual({ title: 'Later', label: 'Program Task', text: 'Due 01/02/2999', urgent: false });
    expect(stepDetail({ name: 'Program Related Task' }, { tasks: [] })).toBeNull();
  });

  it('times a transition of care from the discharge: contact, 7-day visit, medications', () => {
    const program = { code: 'TOC IP', triggerDate: '01/03/2020' }; // a Friday
    expect(stepDetail({ name: 'Outreach' }, { program }))
      .toEqual({ title: 'Interactive Contact', text: 'Overdue, due 01/07/2020 (2 business days after discharge)', urgent: true });
    expect(stepDetail({ name: 'Appointment' }, { program, appointments: [{ status: 'Scheduled', date: '12-01-2999' }] }))
      .toEqual({ title: '7-Day Follow-Up Visit', text: 'Book by 01/10/2020; the 12/01/2999 visit is after the 7-day window', urgent: true });
    expect(stepDetail({ name: 'Appointment' }, { program, appointments: [] }))
      .toEqual({ title: '7-Day Follow-Up Visit', text: 'Not booked; due by 01/10/2020', urgent: true });
    const medications = [
      { name: 'Aspirin 81 mg tablet', start: '2020-01-05', status: 'Active' },
      { name: 'Prednisone 10 mg tablet', start: '2020-01-03', status: 'Stopped' },
      { name: 'Lisinopril 20 mg tablet', start: '2019-03-01', status: 'Active' },
    ];
    expect(stepDetail({ name: 'Medication Review' }, { program, medications }))
      .toEqual({ title: 'Medication Reconciliation', text: '1 new since discharge 01/03/2020: Aspirin', urgent: true });
    // Outside a transition: new since enrollment, not urgent.
    expect(stepDetail({ name: 'Medication Review' }, { program: { code: 'CCM', startDate: '01/01/2020' }, medications }))
      .toEqual({ title: undefined, text: '1 new since enrollment 01/01/2020: Aspirin', urgent: false });
    expect(stepDetail({ name: 'Outreach', mandatory: true }, { program: { code: 'CCM' } })).toEqual({ text: 'Required', urgent: false });
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
