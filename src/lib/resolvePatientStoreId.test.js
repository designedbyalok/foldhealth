import { describe, expect, it } from 'vitest';
import { resolvePatientStoreId, worklistRowId } from './resolvePatientStoreId.js';

describe('worklistRowId', () => {
  it('uses the member id, without a leading #', () => {
    expect(worklistRowId({ id: 'p-123', memberId: '#11052' })).toBe('11052');
    expect(worklistRowId({ id: 'p-123', memberId: ' 11052 ' })).toBe('11052');
  });

  it('falls back to the source id only when there is no member id', () => {
    expect(worklistRowId({ id: 'p-123', memberId: null })).toBe('p-123');
    expect(worklistRowId({ id: 'p-123', memberId: '#' })).toBe('p-123');
  });

  // The 2026-10-27 bug: an `snpw-<timestamp>` row made P360 resolve the
  // patient to an id no member_id-keyed table uses.
  it('makes a new SNP row resolve to the member id P360 data is keyed by', () => {
    const src = { id: 'hcc-uuid', memberId: '#11052' };
    const state = { snpWorklistMembers: [{ id: worklistRowId(src), memberId: src.memberId }] };
    expect(resolvePatientStoreId(state, '11052')).toBe('11052');
    expect(resolvePatientStoreId(state, '#11052')).toBe('11052');
  });
});
