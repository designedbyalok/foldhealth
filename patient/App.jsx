import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isPatient, isPendingApproval, usePatientSession } from './lib/usePatientSession';
import { LoginPage } from './auth/LoginPage';
import { SetPasswordPage } from './auth/SetPasswordPage';
import { PatientShell } from './shell/PatientShell';
import { ProfileGate } from './profiles/ProfileGate';
import { StaffViewAsGate } from './profiles/StaffViewAsGate';
import { Toaster } from '@/components/Toast/Toast';
import { readInviteToken } from './lib/inviteToken';

const PENDING_APPROVAL = 'Your request is with an administrator. You can sign in once it is approved.';

export function App() {
  const { ready, session, recovering } = usePatientSession();
  const [notice, setNotice] = useState('');
  const [inviteToken, setInviteToken] = useState(readInviteToken);
  const pending = isPendingApproval(session);

  useEffect(() => {
    if (pending) supabase.auth.signOut().then(() => setNotice(PENDING_APPROVAL));
  }, [pending]);

  if (!ready) return null;
  if (inviteToken) {
    return (
      <SetPasswordPage
        token={inviteToken}
        onDone={() => { window.location.hash = '/home'; setInviteToken(null); }}
      />
    );
  }
  if (recovering && session) return <SetPasswordPage />;
  if (!session || pending) return <LoginPage notice={pending ? PENDING_APPROVAL : notice} />;
  const Gate = isPatient(session) ? ProfileGate : StaffViewAsGate;
  return (
    <>
      <Gate key={session.user.id} user={session.user}>
        <PatientShell />
      </Gate>
      <Toaster />
    </>
  );
}
