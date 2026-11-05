import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiFetch';

/*
 * Patient portal access (patients.foldhealth.org) for one patient: the patient
 * accounts linked to a member, inviting a new one and removing a link.
 * Reads go through staff_patient_portal_accounts (the email lives in
 * auth.users); invites go through /api/patient-invite, which creates the
 * account with the patient role server-side.
 */
const rowToAccount = (r) => ({
  userId: r.user_id,
  email: r.email,
  relationship: r.relationship,
  isPrimary: r.is_primary,
  linkedAt: r.linked_at,
  lastSignInAt: r.last_sign_in_at,
  otherMembers: r.other_members || 0,
});

export const createPatientPortalSlice = (set, get) => ({
  patientPortalByMember: {},
  patientPortalLoading: {},

  fetchPatientPortalAccounts: async (memberId) => {
    if (!memberId) return;
    set((s) => ({ patientPortalLoading: { ...s.patientPortalLoading, [memberId]: true } }));
    const { data, error } = await supabase.rpc('staff_patient_portal_accounts', { p_member_id: String(memberId) });
    if (error) console.warn('staff_patient_portal_accounts:', error.message);
    set((s) => ({
      patientPortalByMember: { ...s.patientPortalByMember, [memberId]: (data || []).map(rowToAccount) },
      patientPortalLoading: { ...s.patientPortalLoading, [memberId]: false },
    }));
  },

  // Resolves to an error message, or null when the invite went out.
  invitePatientPortal: async (memberId, { email, relationship }) => {
    let res;
    try {
      res = await apiFetch('/api/patient-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: String(memberId), email, relationship }),
      });
    } catch {
      return 'The invite could not be sent. Check your connection and try again.';
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return body?.error?.message || 'The invite could not be sent. Try again.';
    await get().fetchPatientPortalAccounts(memberId);
    return null;
  },

  removePatientPortalAccess: async (memberId, userId) => {
    const { error } = await supabase.from('patient_accounts')
      .delete().eq('member_id', String(memberId)).eq('user_id', userId);
    if (error) {
      get().showToast?.('Access could not be removed. Try again.');
      return false;
    }
    await get().fetchPatientPortalAccounts(memberId);
    return true;
  },
});
