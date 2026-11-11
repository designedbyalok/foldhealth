import { describe, expect, it } from 'vitest';
import { carePlanMemberName, mapPatientCarePlanRow } from './carePlanStoreLib';

describe('carePlanMemberName', () => {
  it('finds the patient in any slice, by store id or member id', () => {
    const state = {
      patients: [],
      snpWorklistMembers: [{ id: 'snp-1', memberId: '11089', name: 'Annette Brave' }],
      ccmWorklistMembers: [{ id: 42, name: 'Maria Lopez' }],
    };
    expect(carePlanMemberName(state, '11089')).toBe('Annette Brave');
    expect(carePlanMemberName(state, '42')).toBe('Maria Lopez');
    expect(carePlanMemberName(state, 'nobody')).toBe('');
  });
});

describe('mapPatientCarePlanRow', () => {
  it('keeps the signature task id, and null before the column exists', () => {
    expect(mapPatientCarePlanRow({ id: 'p1', signature_task_id: '281' }).signatureTaskId).toBe('281');
    expect(mapPatientCarePlanRow({ id: 'p1' }).signatureTaskId).toBeNull();
  });
});
