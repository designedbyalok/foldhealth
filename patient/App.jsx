import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isPatient, isPendingApproval, usePatientSession } from './lib/usePatientSession';
import { LoginPage } from './auth/LoginPage';
import { SetPasswordPage } from './auth/SetPasswordPage';
import { PatientShell } from './shell/PatientShell';
import { ProfileGate } from './profiles/ProfileGate';
import { StaffViewAsGate } from './profiles/StaffViewAsGate';
import { Toaster } from '@/components/Toast/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { readInviteToken } from './lib/inviteToken';
import { ErrorState } from '@/components/ErrorState/ErrorState';
import { Button } from '@/components/Button/Button';
import styles from './App.module.css';

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
      {/* Last resort: anything the page and tab boundaries don't catch. */}
      <ErrorBoundary
        fallback={() => (
          <main className={styles.crash} role="alert">
            <div className={styles.crashMessage}>
              <ErrorState
                icon="solar:danger-triangle-linear"
                title="Something went wrong"
                message="The app hit an unexpected problem. Reload to continue; your information is safe."
              />
            </div>
            <div className={styles.crashActions}>
              <Button variant="primary" size="L" onClick={() => window.location.reload()}>Reload</Button>
              <Button variant="secondary" size="L" onClick={() => supabase.auth.signOut().then(() => window.location.reload())}>Sign out</Button>
            </div>
          </main>
        )}
      >
        <Gate key={session.user.id} user={session.user}>
          <PatientShell />
        </Gate>
      </ErrorBoundary>
      <Toaster />
    </>
  );
}
