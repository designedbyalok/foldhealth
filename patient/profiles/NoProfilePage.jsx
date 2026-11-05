import { supabase } from '@/lib/supabase';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Button } from '@/components/Button/Button';
import loginStyles from '../auth/LoginPage.module.css';

// Signed in, but no patient record is linked to this account yet (or the
// lookup failed).
export function NoProfilePage({ error, onRetry }) {
  return (
    <main className={loginStyles.page}>
      <div className={loginStyles.side} style={{ gridColumn: '1 / -1', flexDirection: 'column', alignItems: 'center' }}>
        <EmptyState
          icon="solar:user-id-linear"
          title={error ? 'Something went wrong' : 'Your account is not set up yet'}
          description={error || 'Your account is not linked to a patient record. Please contact your care team so they can finish setting it up.'}
          actionLabel={error ? 'Try again' : undefined}
          onAction={error ? onRetry : undefined}
        />
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </div>
    </main>
  );
}
