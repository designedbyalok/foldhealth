// The approval hook lets a Pending account finish signing up (email
// confirmation, first OAuth sign-in) but marks the resulting token
// (role anon, approval_status pending) so it can't be used.
export function isPendingApprovalSession(session) {
  try {
    const payload = session?.access_token?.split('.')[1];
    if (!payload) return false;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).approval_status === 'pending';
  } catch {
    return false;
  }
}

export const PENDING_APPROVAL_NOTICE =
  'Your request is with an administrator. You can sign in once it is approved.';

export const EMAIL_CONFIRMED_PENDING_NOTICE =
  'Email confirmed. An administrator will review your request, and you can sign in once it is approved.';
