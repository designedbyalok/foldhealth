// Account lockout display helpers for Settings → Users. The lock itself is
// set by the database (supabase/account_lockout_migration.sql).

export const UNLOCK_REASONS = [
  { code: 'phone', label: 'Verified by phone' },
  { code: 'in_person', label: 'Verified in person' },
  { code: 'suspected_attack', label: 'Suspected attack' },
];
const REASON_LABEL = {
  ...Object.fromEntries(UNLOCK_REASONS.map(r => [r.code, r.label])),
  other: 'Other',
  password_reset: 'Password reset by the user',
};

export const reasonLabel = (code) => REASON_LABEL[code] || code || '';
export const isLocked = (lock) => !!lock?.locked_at;

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "10:42 AM" today, "Oct 14, 10:42 AM" otherwise. */
export function formatLockTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, new Date())) return time;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

/**
 * The status shown for an Active account, following its lock:
 *   'Locked'    locked after failed attempts
 *   'Unlocked'  an admin unlocked it, and the user hasn't signed in since
 *               (they still have to set a new password from the emailed link)
 *   'Active'    signed in again after the unlock
 * Other statuses (Pending, Inactive, ...) are shown as they are.
 */
export function accountStatus(user) {
  if (user.status !== 'Active' || !user.lock) return user.status;
  if (isLocked(user.lock)) return 'Locked';
  const { unlocked_at: unlockedAt, require_reset: waiting } = user.lock;
  if (!unlockedAt) return user.status;
  const signedInSince = user.lastActiveAt && new Date(user.lastActiveAt) > new Date(unlockedAt);
  return waiting || !signedInSince ? 'Unlocked' : user.status;
}
