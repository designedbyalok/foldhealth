/**
 * On call schedules: who covers the phone tree, by type (Holiday Hours or
 * Out of Office), between two dates on chosen weekdays. Sample rows for
 * `bun run seed` and, until the table exists, the store.
 */
export const PHONE_TREE_TYPES = ['Holiday Hours', 'Out of Office'];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const listJoin = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * The weekdays a schedule runs, as the listing reads them: "every day",
 * "Mon to Fri" for a run of three or more, else "Tue and Thu" or
 * "Sun, Tue, Wed and Fri".
 */
export function describeDays(days) {
  const ds = [...new Set(days || [])].sort((a, b) => a - b);
  if (!ds.length) return '';
  if (ds.length === 7) return 'every day';
  const run = ds.length >= 3 && ds[ds.length - 1] - ds[0] === ds.length - 1;
  return run ? `${DAY_NAMES[ds[0]]} to ${DAY_NAMES[ds[ds.length - 1]]}` : listJoin(ds.map(d => DAY_NAMES[d]));
}

const usDate = (iso) => { const [y, m, d] = String(iso || '').split('-'); return y && m && d ? `${m}/${d}/${y}` : ''; };

/** "11/10/2026 to 11/24/2026 on Mon to Fri". */
export function describeSchedule(s) {
  const days = describeDays(s.days);
  return `${usDate(s.fromDate)} to ${usDate(s.toDate)}${days ? ` on ${days}` : ''}`;
}

export function sampleOnCallSchedules(users, now = new Date()) {
  const day = (offset) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [a, b] = users || [];
  if (!a) return [];
  return [
    { id: 'oncall-sample-1', name: 'Weekday OOO cover', phoneTreeType: 'Out of Office', fromDate: day(0), toDate: day(14), days: [1, 2, 3, 4, 5], users: [{ id: a.id || null, name: a.name }] },
    { id: 'oncall-sample-2', name: 'Holiday weekend cover', phoneTreeType: 'Holiday Hours', fromDate: day(20), toDate: day(22), days: [0, 5, 6], users: [{ id: (b || a).id || null, name: (b || a).name }] },
  ].map(s => ({ ...s, userName: s.users[0].name, userId: s.users[0].id, oooRecordId: null, createdBy: a.name, createdAt: now.toISOString() }));
}

/**
 * Schedule ↔ on_call_schedules row. A schedule has one or more users
 * (`users`, [{ id, name }]); `user_name` / `user_id` keep the first, for rows
 * and code from before the `users` column.
 */
export const onCallToRow = (s) => ({
  id: s.id,
  name: s.name,
  phone_tree_type: s.phoneTreeType,
  from_date: s.fromDate,
  to_date: s.toDate,
  days: s.days || [],
  user_name: s.users?.[0]?.name || s.userName,
  user_id: s.users?.[0]?.id || s.userId || null,
  users: s.users?.length ? s.users : [{ id: s.userId || null, name: s.userName }],
  ooo_record_id: s.oooRecordId || null,
  location: s.location || null,
  created_by: s.createdBy || null,
  created_at: s.createdAt || new Date().toISOString(),
});

export const rowToOnCall = (row) => ({
  id: row.id,
  name: row.name,
  phoneTreeType: row.phone_tree_type,
  fromDate: row.from_date,
  toDate: row.to_date,
  days: row.days || [],
  userName: row.user_name,
  userId: row.user_id,
  users: Array.isArray(row.users) && row.users.length ? row.users : [{ id: row.user_id || null, name: row.user_name }],
  oooRecordId: row.ooo_record_id,
  location: row.location || null,
  createdBy: row.created_by,
  createdAt: row.created_at,
});
