import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('./reportPersistFailure', () => ({ reportPersistFailure: () => {} }));
const { membershipFromRow, membershipToRow } = await import('./programAccessPersist');

describe('program membership rows', () => {
  it('round-trips a membership', () => {
    const m = { id: 'pm-1', userId: 'u1', programCode: 'BHI', accessLevel: 'member', careTeamRole: 'Care Manager', vendorOrgId: 'internal', active: true, updatedBy: 'Dana Lee' };
    const back = membershipFromRow({ ...membershipToRow(m), updated_at: 'x' });
    expect(back).toEqual({ ...m, updatedAt: 'x' });
  });
});
