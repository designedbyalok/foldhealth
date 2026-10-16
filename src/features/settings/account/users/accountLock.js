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

/** "Account locked since 10:42 AM, 5 failed attempts" */
export function lockLine(lock) {
  if (!isLocked(lock)) return '';
  const n = lock.failed_count || 5;
  return `Account locked since ${formatLockTime(lock.locked_at)}, ${n} failed attempt${n === 1 ? '' : 's'}`;
}
