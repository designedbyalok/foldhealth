import { describe, expect, it, vi } from 'vitest';
import { LIVE_CALL_SCRIPTS } from './data/scripts';
import { appointmentRecord, dueDateOf, findMedication, routeAcceptedItems, routeLabel, routedSummary, taskRecord } from './liveCallRouting';

const today = new Date(2026, 10, 12);
const william = LIVE_CALL_SCRIPTS[0];
const item = id => ({ ...william.items.find(i => i.id === id), originalTitle: william.items.find(i => i.id === id).title });

function fakeStore(meds = []) {
  const state = {
    currentUserProfile: { id: 'u1', name: 'Robin Bang' },
    patientMedications: { 11143: meds },
    fetchPatientMedications: vi.fn(async () => {}),
    createTask: vi.fn(async t => ({ ...t, id: 1 })),
    createAppointment: vi.fn(async a => ({ ...a, id: 2 })),
    savePatientCarePlanGoal: vi.fn(async (_p, _g, v) => ({ ...v, id: 'g' })),
    savePatientCarePlanBarrier: vi.fn(async (_p, _g, v) => ({ ...v, id: 'b' })),
    addPatientMedication: vi.fn(async (_p, m) => ({ ...m, id: 'm' })),
    updatePatientMedication: vi.fn(async () => true),
  };
  return { getState: () => state, state };
}

describe('live call routing', () => {
  it('labels where an item lands', () => {
    expect(routeLabel({ kind: 'task' })).toBe('Creates a task');
    expect(routeLabel(undefined)).toBe('Saved with the call');
  });

  it('resolves due dates', () => {
    expect(dueDateOf({ due: '11-13-2026' }, today)).toBe('11-13-2026');
    expect(dueDateOf({ due: 'today' }, today)).toBe('11-12-2026');
    expect(dueDateOf({ dueInDays: 14 }, today)).toBe('11-26-2026');
  });

  it('matches a medication on its first word, skipping stopped ones', () => {
    const list = [{ id: 1, name: 'Torsemide 20 mg', status: 'Stopped' }, { id: 2, name: 'torsemide 20mg tab', status: 'Active' }];
    expect(findMedication(list, 'Torsemide 20 mg').id).toBe(2);
    expect(findMedication(list, 'Lisinopril')).toBeNull();
  });

  it('builds task and appointment records in the app’s shapes', () => {
    const patient = { name: 'William Davis' };
    const t = taskRecord({ route: item('w8').route, patient, pid: '11143', program: { code: 'TOC IP' }, me: { id: 'u1', name: 'Robin Bang' }, today });
    expect(t).toMatchObject({ name: 'Deliver large-print pill organizer', status: 'pending', due_date: '11-12-2026', patient_id: '11143', program_code: 'TOC IP', assigned_to: 'Robin Bang' });
    const a = appointmentRecord({ route: item('w5').route, patient, pid: '11143' });
    expect(a).toMatchObject({ appointment_type_name: 'TCM Follow-up Visit', date: '11-13-2026', time_start: '10:20 am', primary_user: 'Dr. L. Chen', status: 'Scheduled' });
  });

  it('creates every accepted item’s record and the medication changes', async () => {
    const store = fakeStore([{ id: 'f', name: 'Furosemide 40 mg', status: 'Active' }, { id: 'mt', name: 'Metoprolol succinate 25 mg', status: 'Active' }]);
    const accepted = ['w1', 'w3', 'w5', 'w6', 'w7', 'w8', 'w9'].map(item);
    const done = await routeAcceptedItems({ store, patient: { name: 'William Davis' }, pid: '11143', program: { id: 'p1', code: 'TOC IP' }, accepted, script: william, today });
    expect(done).toEqual({ task: 2, appointment: 1, carePlan: 2, medication: 2, failed: 0 });
    expect(store.state.updatePatientMedication).toHaveBeenCalledWith('11143', 'f', { status: 'Stopped', stop: '2026-11-12', stopReason: 'Therapeutic Change' });
    expect(store.state.updatePatientMedication).toHaveBeenCalledWith('11143', 'mt', { name: 'Metoprolol succinate 50 mg', sig: 'Nightly' });
    expect(store.state.savePatientCarePlanGoal.mock.calls[0][2]).toMatchObject({ title: 'Walk to church on Sundays again', patientTitle: 'I’d like to get back to walking to church on Sundays.' });
    expect(routedSummary(done)).toBe('2 tasks, 1 appointment, 2 care plan items and 2 medication updates');
  });

  it('uses an edited title for a task and skips stopping a medication that isn’t on the list', async () => {
    const store = fakeStore([]);
    const edited = { ...item('w8'), title: 'Mail a large-print pill organizer' };
    const done = await routeAcceptedItems({ store, patient: { name: 'William Davis' }, pid: '11143', program: null, accepted: [edited, item('w1'), item('w7')], script: william, today });
    expect(store.state.createTask.mock.calls[0][0].name).toBe('Mail a large-print pill organizer');
    expect(store.state.addPatientMedication).not.toHaveBeenCalled();
    expect(store.state.savePatientCarePlanGoal).not.toHaveBeenCalled();
    expect(done.task).toBe(1);
  });
});
