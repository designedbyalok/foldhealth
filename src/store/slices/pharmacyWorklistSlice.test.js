import { describe, expect, it, vi } from 'vitest';

const updates = [];
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ update: (patch) => ({ eq: async (_col, id) => { updates.push({ id, patch }); return { error: null }; } }) }),
  },
}));

vi.mock('../lib/worklistListFilters', () => ({ hydrateListFilters: () => ({}), detachSaved: (x) => x }));

const { createPharmacyWorklistSlice } = await import('./pharmacyWorklistSlice.js');

// A bare store holding one member, as the app's store holds the slice.
function storeWith(callHistory) {
  let state = { currentUserProfile: { name: 'Priya' }, pharmacyWorklistIsMock: false };
  const set = (fn) => { state = { ...state, ...(typeof fn === 'function' ? fn(state) : fn) }; };
  const get = () => state;
  state = { ...state, ...createPharmacyWorklistSlice(set, get) };
  state.pharmacyWorklistMembers = [{ id: '1', measures: [], callHistory, activityLog: [] }];
  return { get, member: () => state.pharmacyWorklistMembers[0] };
}

const call = (o) => ({ id: 'out-1', logIds: [11, 12], date: '10/20/2026', time: '9:00 AM', by: 'Priya', contact: 'Member', measures: ['MAD', 'MAH'], outcome: 'MAD: Left voicemail; MAH: Busy', note: 'first try', ...o });

describe('pharmacy outreach edit and delete', () => {
  it('saves an edited line back to its call, changing only that measure', () => {
    updates.length = 0;
    const s = storeWith([call()]);
    s.get().editPharmacyOutreach('1', 12, { measure: 'MAH', outcome: 'Call back later', note: 'second try', type: 'Call', date: '10/21', time: '10:00 AM' });
    const c = s.member().callHistory[0];
    expect(c).toMatchObject({ outcome: 'MAD: Left voicemail; MAH: Call back later', note: 'second try', date: '10/21/2026' });
    expect(s.member().activityLog[0]).toMatchObject({ title: 'Outreach edited (MAH)', actor: 'Priya' });
    expect(updates.at(-1)).toMatchObject({ id: '1', patch: { call_history: [expect.objectContaining({ id: 'out-1' })] } });
  });

  it('finds an older call saved without an id', () => {
    const old = { date: '09/01/2026', by: 'Marcus', outcome: 'Busy', measures: ['MAD'] };
    const s = storeWith([old]);
    s.get().editPharmacyOutreach('1', 'ph-09/01/2026--Marcus-Busy', { measure: 'MAD', outcome: 'Reached member', note: '', type: 'Call', date: '09/01', time: '' });
    expect(s.member().callHistory[0].outcome).toBe('Reached member');
  });

  it('drops a deleted measure from the call, then the call itself', () => {
    const s = storeWith([call()]);
    s.get().deletePharmacyOutreach('1', 11, ['MAD']);
    expect(s.member().callHistory[0]).toMatchObject({ measures: ['MAH'], logIds: [12] });
    s.get().deletePharmacyOutreach('1', 12, ['MAH']);
    expect(s.member().callHistory).toEqual([]);
    expect(s.member().activityLog.map(a => a.title)).toEqual(['Outreach deleted (MAH)', 'Outreach deleted (MAD)']);
  });

  it('deletes the whole call when one feed line stands for all its measures', () => {
    const s = storeWith([call()]);
    s.get().deletePharmacyOutreach('1', 'out-1', ['MAD', 'MAH']);
    expect(s.member().callHistory).toEqual([]);
  });

  it('keeps an older call findable after it is edited', () => {
    const key = 'ph-09/01/2026--Marcus-Busy';
    const s = storeWith([{ date: '09/01/2026', by: 'Marcus', outcome: 'Busy', measures: ['MAD'] }]);
    s.get().editPharmacyOutreach('1', key, { measure: 'MAD', outcome: 'Reached member', note: '', type: 'Call', date: '09/01', time: '' });
    s.get().editPharmacyOutreach('1', key, { measure: 'MAD', outcome: 'Picked up', note: '', type: 'Call', date: '09/01', time: '' });
    expect(s.member().callHistory[0]).toMatchObject({ id: key, outcome: 'Picked up' });
    s.get().deletePharmacyOutreach('1', key, ['MAD']);
    expect(s.member().callHistory).toEqual([]);
  });

  it('never changes a locked verification call', () => {
    const locked = call({ id: 'ver-1', locked: true, measures: ['MAD'], outcome: 'Med pickup confirmed' });
    const s = storeWith([locked]);
    s.get().editPharmacyOutreach('1', 'ver-1', { measure: 'MAD', outcome: 'x', note: '', type: 'Call', date: '10/20', time: '' });
    s.get().deletePharmacyOutreach('1', 'ver-1', ['MAD']);
    expect(s.member().callHistory).toEqual([locked]);
  });
});

describe('reason for non-adherence on a medication', () => {
  function storeWithMed(interventionLog = []) {
    const s = storeWith([]);
    s.get().pharmacyWorklistMembers[0] = {
      id: '1', callHistory: [], activityLog: [], interventionLog,
      measures: [{ code: 'MAD', medications: [{ id: 'd1', name: 'Metformin', status: 'Active', refills: [] }] }],
    };
    return s;
  }
  const prior = { date: '10/02/2026', by: 'Marcus', measures: { MAD: { barriers: [], interventions: ['90/100-day conversion'], result: 'Pending Refill Approval' } } };

  it('logs the reason as a barrier on its gap, keeping the latest interventions and result', () => {
    updates.length = 0;
    const s = storeWithMed([prior]);
    s.get().updatePharmacyMedication('1', 'd1', { nonAdherenceReason: 'Forgetfulness' });
    const [entry] = s.member().interventionLog;
    expect(entry).toMatchObject({
      by: 'Priya', source: 'Medication review', medication: 'Metformin',
      measures: { MAD: { barriers: ['Forgetfulness'], interventions: ['90/100-day conversion'], result: 'Pending Refill Approval' } },
    });
    expect(s.member().interventionLog).toHaveLength(2);
    expect(updates.at(-1).patch.intervention_log).toHaveLength(2);
  });

  it('logs nothing when the reason is cleared or unchanged', () => {
    const s = storeWithMed();
    s.get().updatePharmacyMedication('1', 'd1', { nonAdherenceReason: 'Cost' });
    s.get().updatePharmacyMedication('1', 'd1', { nonAdherenceReason: 'Cost' });
    s.get().updatePharmacyMedication('1', 'd1', { nonAdherenceReason: '' });
    expect(s.member().interventionLog).toHaveLength(1);
  });
});

describe('pharmacy verification lock', () => {
  it('logs the call and what was ticked for each gap in the activity entry', () => {
    const s = storeWith([]);
    s.get().pharmacyWorklistMembers[0] = { id: '1', callHistory: [], activityLog: [], measures: [] };
    s.get().lockPharmacyVerification('1', {
      kind: 'pharmacy-verification', locked: true, date: '10/27/2026', party: 'Pharmacy', contact: 'CVS', outcome: 'Interventions logged', result: 'failed',
      action: 'Telephonic', direction: 'Outbound', contactOutcome: 'Reached',
      by: 'Priya', note: 'Spoke with tech', measures: ['MAD'],
      items: [{ measure: 'MAD', drug: 'Medication Adherence for Diabetes', steps: ['New 90/100DS conversion', 'Pending: Pick up'] }],
    }, { pickedUpCodes: [], pendingCodes: [], refillsByMed: {}, status: null });
    const [a] = s.member().activityLog;
    expect(a.title).toBe('Assessment · Pharmacy: CVS');
    expect(a.note.split('\n')).toEqual([
      'Telephonic · Outbound',
      'MAD · Medication Adherence for Diabetes: New 90/100DS conversion, Pending: Pick up',
      'Spoke with tech',
    ]);
  });

  it('names a contact that was not reached on the activity entry', () => {
    const s = storeWith([]);
    s.get().pharmacyWorklistMembers[0] = { id: '1', callHistory: [], activityLog: [], measures: [] };
    s.get().lockPharmacyVerification('1', {
      kind: 'pharmacy-verification', locked: true, date: '10/27/2026', party: 'Member', contact: 'Linda', outcome: 'UTC', result: 'failed',
      action: 'Telephonic', direction: 'Outbound', contactOutcome: 'UTC', by: 'Priya', note: '', measures: ['MAD'], items: [],
    }, { pickedUpCodes: [], pendingCodes: [], refillsByMed: {}, status: null });
    expect(s.member().activityLog[0].note).toBe('Telephonic · Outbound · UTC');
  });
});

describe('barriers set per medication', () => {
  it('gives each drug its own reason, clears a cleared one, and logs a line per drug', () => {
    const s = storeWith([]);
    s.member().measures = [{ code: 'MAD', medications: [
      { id: 'a', name: 'Metformin', status: 'Active', nonAdherenceReason: null },
      { id: 'b', name: 'Glipizide', status: 'Active', nonAdherenceReason: 'Cost Issue' },
      { id: 'c', name: 'Old Rx', status: 'Discontinued', nonAdherenceReason: null },
    ] }];
    s.get().logPharmacyInterventions('1', {
      date: '10/28/2026', by: 'Priya', note: '', measures: { MAD: {
        barriers: ['Transportation'], interventions: ['Mail order'], result: null,
        medications: [
          { id: 'a', name: 'Metformin 500 MG', barriers: ['Transportation'], interventions: ['Mail order'] },
          { id: 'b', name: 'Glipizide 5 MG', barriers: [], interventions: [] },
        ],
      } },
    });
    const meds = s.member().measures[0].medications;
    expect(meds.map(d => d.nonAdherenceReason)).toEqual(['Transportation', null, null]);
    expect(s.member().activityLog[0].note.split('\n')).toEqual([
      'MAD · Metformin 500 MG: Transportation, Mail order',
      'MAD · Glipizide 5 MG: Cleared',
    ]);
  });
});

describe('resolving a barrier', () => {
  const meds = () => [
    { id: 'a', name: 'Metformin', strength: '500', unit: 'MG', status: 'Active', nonAdherenceReason: 'Transportation' },
    { id: 'b', name: 'Glipizide', strength: '5', unit: 'MG', status: 'Active', nonAdherenceReason: 'Cost Issue' },
  ];
  const withLog = (log) => {
    const s = storeWith([]);
    Object.assign(s.member(), { measures: [{ code: 'MAD', medications: meds() }], interventionLog: log, barrier: 'Transportation' });
    return s;
  };

  it('drops it from the gap, clears matching drug reasons, and records the resolution', () => {
    const s = withLog([{ date: '10/27/2026', measures: { MAD: { barriers: ['Transportation', 'Cost Issue'], interventions: ['Mail order'], result: null } } }]);
    s.get().resolvePharmacyBarrier('1', { code: 'MAD', barrier: 'Transportation' });
    const [entry] = s.member().interventionLog;
    expect(entry.resolved).toEqual([{ code: 'MAD', barrier: 'Transportation' }]);
    expect(entry.measures.MAD).toMatchObject({ barriers: ['Cost Issue'], interventions: ['Mail order'] });
    expect(s.member().measures[0].medications.map(d => d.nonAdherenceReason)).toEqual([null, 'Cost Issue']);
    expect(s.member().barrier).toBeNull();
    expect(s.member().activityLog[0]).toMatchObject({ title: 'Barrier resolved · MAD', note: 'Transportation' });
  });

  it('resolves it on one drug only when given the drug', () => {
    const s = withLog([{ date: '10/27/2026', measures: { MAD: { barriers: ['Cost Issue'], interventions: [], result: null, medications: [
      { id: 'a', name: 'Metformin 500 MG', barriers: ['Cost Issue'], interventions: [] },
      { id: 'b', name: 'Glipizide 5 MG', barriers: ['Cost Issue'], interventions: [] },
    ] } } }]);
    s.get().resolvePharmacyBarrier('1', { code: 'MAD', barrier: 'Cost Issue', medId: 'b' });
    const [entry] = s.member().interventionLog;
    expect(entry.resolved).toEqual([{ code: 'MAD', barrier: 'Cost Issue', medication: 'Glipizide 5 MG' }]);
    expect(entry.measures.MAD.medications.map(r => r.barriers)).toEqual([['Cost Issue'], []]);
    expect(entry.measures.MAD.barriers).toEqual(['Cost Issue']);
    expect(s.member().measures[0].medications.map(d => d.nonAdherenceReason)).toEqual(['Transportation', null]);
  });

  it('clears drug reasons when Update Barriers saves a gap with no barrier, but not from an outreach', () => {
    const s = withLog([]);
    const empty = { date: '10/28/2026', measures: { MAD: { barriers: [], interventions: ['Mail order'], result: null } } };
    s.get().logPharmacyInterventions('1', { ...empty, source: 'Outreach' });
    expect(s.member().measures[0].medications.map(d => d.nonAdherenceReason)).toEqual(['Transportation', 'Cost Issue']);
    s.get().logPharmacyInterventions('1', empty, { clearReasons: true });
    expect(s.member().measures[0].medications.map(d => d.nonAdherenceReason)).toEqual([null, null]);
  });
});

describe('intervention outcomes', () => {
  const setup = (rec) => {
    const s = storeWith([]);
    Object.assign(s.member(), {
      measures: [{ code: 'MAD', medications: [
        { id: 'a', name: 'Metformin', strength: '500', unit: 'MG', status: 'Active', nonAdherenceReason: 'Forgetfulness' },
        { id: 'b', name: 'Glipizide', strength: '5', unit: 'MG', status: 'Active', nonAdherenceReason: null },
      ] }],
      interventionLog: [{ date: '10/27/2026', measures: { MAD: rec } }],
      barrier: 'Forgetfulness',
    });
    return s;
  };

  it('Done takes the intervention off and resolves the barriers it was told to', () => {
    const s = setup({ barriers: ['Forgetfulness', 'Cost Issue'], interventions: ['Pill Box Sent'], result: null });
    s.get().completePharmacyIntervention('1', { code: 'MAD', intervention: 'Pill Box Sent', outcome: 'Done', resolve: ['Forgetfulness'] });
    const [entry] = s.member().interventionLog;
    expect(entry.completed).toEqual([{ code: 'MAD', intervention: 'Pill Box Sent', outcome: 'Done' }]);
    expect(entry.resolved).toEqual([{ code: 'MAD', barrier: 'Forgetfulness' }]);
    expect(entry.measures.MAD).toMatchObject({ barriers: ['Cost Issue'], interventions: [] });
    expect(s.member().measures[0].medications[0].nonAdherenceReason).toBeNull();
    expect(s.member().activityLog[0]).toMatchObject({ title: 'Intervention done · MAD', note: 'Pill Box Sent\nResolved: Forgetfulness' });
  });

  it("Didn't work takes the intervention off but leaves every barrier", () => {
    const s = setup({ barriers: ['Forgetfulness'], interventions: ['Pill Box Sent'], result: null });
    s.get().completePharmacyIntervention('1', { code: 'MAD', intervention: 'Pill Box Sent', outcome: "Didn't work", resolve: ['Forgetfulness'] });
    const [entry] = s.member().interventionLog;
    expect(entry.resolved).toBeUndefined();
    expect(entry.measures.MAD).toMatchObject({ barriers: ['Forgetfulness'], interventions: [] });
    expect(s.member().measures[0].medications[0].nonAdherenceReason).toBe('Forgetfulness');
    expect(s.member().activityLog[0].title).toBe("Intervention didn't work · MAD");
  });

  it('works on one drug of a gap set per medication', () => {
    const s = setup({ barriers: ['Forgetfulness'], interventions: ['Pill Box Sent', 'Autofill Set-Up'], result: null, medications: [
      { id: 'a', name: 'Metformin 500 MG', barriers: ['Forgetfulness'], interventions: ['Pill Box Sent'] },
      { id: 'b', name: 'Glipizide 5 MG', barriers: [], interventions: ['Autofill Set-Up'] },
    ] });
    s.get().completePharmacyIntervention('1', { code: 'MAD', intervention: 'Pill Box Sent', outcome: 'Done', medId: 'a', resolve: ['Forgetfulness'] });
    const rec = s.member().interventionLog[0].measures.MAD;
    expect(rec.medications.map(d => [d.barriers, d.interventions])).toEqual([[[], []], [[], ['Autofill Set-Up']]]);
    expect(rec).toMatchObject({ barriers: [], interventions: ['Autofill Set-Up'] });
    expect(s.member().interventionLog[0].completed[0]).toMatchObject({ medication: 'Metformin 500 MG' });
  });
});

describe('PDC set by hand', () => {
  it('logs the change with the PDC it changed from', () => {
    const s = storeWith([]);
    s.member().measures = [{ code: 'MAD', pdc: 80, medications: [] }];
    s.get().setPharmacyPdcOverride('1', 'MAD', 85, 80);
    expect(s.member().measures[0]).toMatchObject({ pdcManual: 85, pdcManualBy: 'Priya' });
    expect(s.member().activityLog[0]).toMatchObject({ title: 'MAD PDC changed from 80% to 85%', note: 'Set by hand by Priya', actor: 'Priya' });
  });

  it('logs going back to the calculated PDC', () => {
    const s = storeWith([]);
    s.member().measures = [{ code: 'MAD', pdc: 80, pdcManual: 85, medications: [] }];
    s.get().setPharmacyPdcOverride('1', 'MAD', null, 85);
    expect(s.member().measures[0].pdcManual).toBeNull();
    expect(s.member().activityLog[0].title).toBe('MAD PDC changed from 85% to calculated');
  });

  it('logs nothing when the number did not change', () => {
    const s = storeWith([]);
    s.member().measures = [{ code: 'MAD', pdc: 80, medications: [] }];
    s.get().setPharmacyPdcOverride('1', 'MAD', 80, 80);
    expect(s.member().activityLog).toEqual([]);
    expect(s.member().measures[0].pdcManual).toBeUndefined();
  });
});
