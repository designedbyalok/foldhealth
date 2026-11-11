/**
 * Sample Out of Office records for the first few staff users, dated around
 * `now` so every status shows: one ongoing, a few upcoming, a few past.
 * Used by `bun run seed` and, until the table exists, by the store.
 */
const REASONS = ['Out on Planned Leave', 'Personal', 'Medical Leave', 'Annual Leave', 'Professional Development', 'Family Emergency', 'Jury Duty'];

// [day offset from today, start hour, length in days]
const PLAN = [
  [0, 0, 2],     // ongoing
  [3, 9, 2],
  [6, 0, 1],
  [10, 8, 3],
  [14, 0, 5],
  [-12, 0, 2],   // past
  [-25, 9, 1],
];

export function sampleOooRecords(users, now = new Date()) {
  const at = (days, hour) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0).toISOString();
  const list = users || [];
  // The next user covers each record; the ongoing one has a second covering
  // provider for another location, so "+1" shows too. The last has none.
  const cover = (i, location) => {
    const c = list[(i + 1) % list.length];
    return c && c !== list[i] ? [{ userId: c.id || null, userName: c.name, location }] : [];
  };
  const coverageFor = i => (i === PLAN.length - 1 ? [] : [
    ...cover(i, 'Downtown Clinic'),
    ...(i === 0 ? cover(i + 1, 'Riverside Clinic') : []),
  ]);
  return list.slice(0, PLAN.length).map((u, i) => {
    const [offset, hour, len] = PLAN[i];
    return {
      id: `ooo-sample-${i + 1}`,
      userId: u.id || null,
      userName: u.name,
      userEmail: u.email || null,
      userRole: u.role || 'Physician',
      startAt: at(offset, hour),
      endAt: at(offset + len, hour),
      reason: REASONS[i % REASONS.length],
      autoReply: i === 0,
      autoReplyMessage: i === 0 ? 'Hi! Thanks for reaching out. I\'m currently unavailable but will get back to you as soon as I can.' : '',
      createdBy: u.name,
      createdAt: at(offset - 7, 10),
      updatedAt: at(offset - 7, 10),
      updatedBy: u.name,
      coverage: coverageFor(i),
    };
  });
}

/** Record ↔ ooo_records row. */
export const oooToRow = (r) => ({
  id: r.id,
  user_id: r.userId || null,
  user_name: r.userName,
  user_email: r.userEmail || null,
  user_role: r.userRole || null,
  start_at: r.startAt,
  end_at: r.endAt,
  reason: r.reason || '',
  auto_reply: !!r.autoReply,
  auto_reply_message: r.autoReplyMessage || '',
  created_by: r.createdBy || null,
  created_at: r.createdAt || new Date().toISOString(),
  updated_at: r.updatedAt || new Date().toISOString(),
  updated_by: r.updatedBy || r.createdBy || null,
  coverage: r.coverage || [],
});

export const rowToOoo = (row) => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  userEmail: row.user_email,
  userRole: row.user_role,
  startAt: row.start_at,
  endAt: row.end_at,
  reason: row.reason,
  autoReply: row.auto_reply,
  autoReplyMessage: row.auto_reply_message,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by || row.created_by,
  coverage: Array.isArray(row.coverage) ? row.coverage : [],
});

/**
 * Demo data for one provider (Abhay Chaudhary): a few more Out of Office
 * records (past, a half day, a later stretch) and appointments on those
 * days and across 1-15 Oct 2026, where he already has an OOO record, so the
 * calendar shows appointments sitting inside OOO time.
 */
const DEMO_PATIENTS = ['Sandra Nguyen', 'Marcus Bell', 'Priya Raman', 'Helen Ortiz', 'James Whitfield', 'Aisha Khan', 'Robert Diaz', 'Linda Park'];
const DEMO_TYPES = [
  { name: 'Follow-up Appointment', calendarId: 'followup', mode: 'In-person', reason: 'Medication review' },
  { name: 'Annual Wellness Visit', calendarId: 'awv', mode: 'In-person', reason: 'Yearly check-up' },
  { name: 'Chronic Care Management Visit', calendarId: 'telehealth', mode: 'Virtual', reason: 'Blood pressure follow-up' },
  { name: 'Specialty Consultation', calendarId: 'specialty', mode: 'In-person', reason: 'Cardiology referral' },
];
const DEMO_TIMES = [['9:00 am', '9:30 am'], ['11:00 am', '11:45 am'], ['2:30 pm', '3:00 pm']];

// [id, start (local), end (local), reason]
const DEMO_OOO = [
  ['ooo-demo-abhay-1', [2026, 9, 22, 0], [2026, 9, 24, 0], 'Personal'],
  ['ooo-demo-abhay-2', [2026, 10, 20, 9], [2026, 10, 20, 13], 'Professional Development'],
  ['ooo-demo-abhay-3', [2026, 10, 27, 0], [2026, 10, 29, 0], 'Annual Leave'],
];

const localIso = ([y, m, d, h]) => new Date(y, m - 1, d, h, 0).toISOString();
const apptDate = (y, m, d) => `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}-${y}`;

export function demoOooForUser(user, now = new Date()) {
  const records = DEMO_OOO.map(([id, start, end, reason]) => ({
    id,
    userId: user.id || null,
    userName: user.name,
    userEmail: user.email || null,
    userRole: user.role || 'Physician',
    startAt: localIso(start),
    endAt: localIso(end),
    reason,
    autoReply: false,
    autoReplyMessage: '',
    createdBy: user.name,
    createdAt: localIso([2026, 9, 1, 10]),
    updatedAt: localIso([2026, 9, 1, 10]),
    updatedBy: user.name,
  }));

  // Days with appointments: every weekday 1-15 Oct, plus the other OOO days.
  const days = [];
  for (let d = 1; d <= 15; d++) {
    const dow = new Date(2026, 9, d).getDay();
    if (dow !== 0 && dow !== 6) days.push([2026, 10, d]);
  }
  days.push([2026, 9, 22], [2026, 9, 23], [2026, 10, 20], [2026, 10, 27], [2026, 10, 28]);

  const appointments = days.flatMap(([y, m, d], i) => {
    // Two appointments most days, three every third day.
    const slots = DEMO_TIMES.slice(0, i % 3 === 0 ? 3 : 2);
    return slots.map(([start, end], j) => {
      const type = DEMO_TYPES[(i + j) % DEMO_TYPES.length];
      const past = new Date(y, m - 1, d, 23, 59) < now;
      return {
        patient_id: null,
        patient_name: DEMO_PATIENTS[(i * 3 + j) % DEMO_PATIENTS.length],
        appointment_type_id: null,
        appointment_type_name: type.name,
        mode: type.mode,
        location: 'Fold Health, New York',
        primary_user: user.name,
        primary_user_id: user.id || null,
        secondary_users: [],
        date: apptDate(y, m, d),
        time_start: start,
        time_end: end,
        reason_for_visit: type.reason,
        member_instruction: '',
        staff_instruction: '',
        require_rsvp: false,
        recurring: false,
        recurring_config: null,
        status: past ? 'Completed' : 'Scheduled',
        calendar_id: type.calendarId,
      };
    });
  });

  return { records, appointments };
}
