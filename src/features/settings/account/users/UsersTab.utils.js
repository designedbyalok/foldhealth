export function statusBadge(status) {
  if (status === 'Locked') return { variant: 'danger', icon: 'solar:lock-keyhole-minimalistic-linear' };
  if (status === 'Unlocked') return { variant: 'info', icon: 'solar:lock-keyhole-unlocked-linear' };
  if (status === 'Pending') return { variant: 'info', icon: 'solar:clock-circle-linear' };
  const isActive = status === 'Active';
  const isInvited = status === 'Invited';
  return {
    variant: isActive ? 'success' : (isInvited ? 'warning' : 'danger'),
    icon: isActive
      ? 'solar:check-circle-linear'
      : (isInvited ? 'solar:hourglass-linear' : 'solar:close-circle-linear'),
  };
}

export function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

export function formatRelative(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return { label: 'just now', tone: 'fresh' };
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const tone = day < 30 ? 'fresh' : 'stale';
  if (sec < 60)   return { label: 'just now', tone };
  if (min < 60)   return { label: `${min} min${min === 1 ? '' : 's'} ago`, tone };
  if (hr  < 24)   return { label: `${hr} hour${hr === 1 ? '' : 's'} ago`, tone };
  if (day < 7)    return { label: `${day} day${day === 1 ? '' : 's'} ago`, tone };
  if (day < 30)   return { label: `${Math.floor(day / 7)} week${Math.floor(day / 7) === 1 ? '' : 's'} ago`, tone };
  if (day < 365)  return { label: `${Math.floor(day / 30)} month${Math.floor(day / 30) === 1 ? '' : 's'} ago`, tone };
  const yr = Math.floor(day / 365);
  return { label: `${yr} year${yr === 1 ? '' : 's'} ago`, tone };
}

export const USERS_FILTER_DEFS = [
  { key: 'status',   label: 'Status',            primary: true },
  { key: 'roles',    label: 'Roles',             primary: true },
  { key: 'location', label: 'Practice Location', primary: true },
];

export const USERS_COLUMNS = [
  { key: 'name',       label: 'User Name',         sortKey: 'name',        sticky: 'left', left: 0,   width: 300 },
  { key: 'status',     label: 'Status',            sortKey: 'status',      width: 140 },
  { key: 'role',       label: 'Roles',             sortKey: 'role',        width: 220 },
  { key: 'location',   label: 'Practice Location', sortKey: 'location',    width: 240 },
  { key: 'createdAt',  label: 'Created At',        sortKey: 'createdAt',   width: 140 },
  { key: 'lastSignIn', label: 'Last Sign-in At',   sortKey: 'lastActiveAt', width: 160 },
  { key: 'actions',    label: 'Action',            sticky: 'right', width: 140 },
];

export const ROLE_FIELDS = ['admin_role', 'role', 'clinical_roles'];
