import { supabase } from '../../lib/supabase';
import { reportPersistFailure } from './reportPersistFailure';

// Supabase I/O for supabase/program_access_migration.sql. Membership and
// organization writes succeed for admins only (database policy).

const MISSING_RE = /program_memberships|vendor_organizations|access_override_log|does not exist|schema cache/i;
const isMissing = (error) => MISSING_RE.test(error?.message || '');

export const membershipFromRow = (r) => ({
  id: r.id,
  userId: r.user_id,
  programCode: r.program_code,
  accessLevel: r.access_level,
  careTeamRole: r.care_team_role,
  vendorOrgId: r.vendor_org_id,
  active: r.active !== false,
  updatedBy: r.updated_by,
  updatedAt: r.updated_at,
});

export const membershipToRow = (m) => ({
  id: m.id,
  user_id: m.userId,
  program_code: m.programCode,
  access_level: m.accessLevel,
  care_team_role: m.careTeamRole || null,
  vendor_org_id: m.vendorOrgId || null,
  active: m.active !== false,
  updated_by: m.updatedBy || null,
  updated_at: new Date().toISOString(),
});

/** @returns {Promise<{ memberships: object[], vendors: object[], missing: boolean }>} */
export async function fetchProgramAccessRows() {
  const [mem, ven] = await Promise.all([
    supabase.from('program_memberships').select('*').eq('active', true),
    supabase.from('vendor_organizations').select('*').order('name'),
  ]);
  const error = mem.error || ven.error;
  if (error) {
    if (!isMissing(error)) console.warn('fetchProgramAccess failed:', error.message);
    return { memberships: [], vendors: [], missing: isMissing(error) };
  }
  return {
    memberships: (mem.data || []).map(membershipFromRow),
    vendors: (ven.data || []).map(v => ({ id: v.id, name: v.name, kind: v.kind, active: v.active !== false })),
    missing: false,
  };
}

/** @returns {Promise<{ ok: boolean, missing: boolean, error: string|null }>} */
export async function persistMembership(membership) {
  const { error } = await supabase.from('program_memberships').upsert(membershipToRow(membership), { onConflict: 'user_id,program_code' });
  if (!error) return { ok: true, missing: false, error: null };
  if (isMissing(error)) return { ok: false, missing: true, error: null };
  // An RLS refusal means the caller isn't an admin; say so rather than a generic failure.
  if (/row-level security|permission denied/i.test(error.message || '')) return { ok: false, missing: false, error: 'Only an admin can change program access' };
  reportPersistFailure(`persistMembership(${membership.id})`, error);
  return { ok: false, missing: false, error: 'Could not save program access' };
}

/** @returns {Promise<{ ok: boolean, missing: boolean }>} */
export async function insertOverride(entry) {
  const { error } = await supabase.from('access_override_log').insert({
    user_name: entry.userName || null,
    patient_id: entry.patientId ? String(entry.patientId) : null,
    program_code: entry.programCode,
    action: entry.action,
    reason: entry.reason.trim(),
  });
  if (!error) return { ok: true, missing: false };
  if (isMissing(error)) return { ok: false, missing: true };
  reportPersistFailure(`insertOverride(${entry.programCode})`, error);
  return { ok: false, missing: false };
}
