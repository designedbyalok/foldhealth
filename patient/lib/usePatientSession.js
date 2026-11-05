import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Patient accounts are created server-side with app_metadata.role =
// 'patient' (not user-editable). Every other account is a provider-portal
// user, who views the portal as a patient they pick
// (supabase/staff_patient_portal_access_migration.sql).
export const isPatient = (session) => session?.user?.app_metadata?.role === 'patient';

// A provider-portal sign-up that an admin hasn't approved yet: the approval
// hook lets the first OAuth sign-in finish but marks the token unusable.
// Same check as src/features/auth/pendingApproval.js, which this app can't import.
export function isPendingApproval(session) {
  try {
    const payload = session?.access_token?.split('.')[1];
    if (!payload) return false;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).approval_status === 'pending';
  } catch {
    return false;
  }
}

export function usePatientSession() {
  const [state, setState] = useState({ ready: false, session: null, recovering: false });

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setState((s) => ({ ...s, ready: true, session: data.session }));
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState((s) => ({
        ready: true,
        session,
        // A reset link signs the user in with a recovery session; they must
        // choose a new password before seeing the app.
        recovering: event === 'PASSWORD_RECOVERY' || (s.recovering && event !== 'USER_UPDATED' && event !== 'SIGNED_OUT'),
      }));
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
