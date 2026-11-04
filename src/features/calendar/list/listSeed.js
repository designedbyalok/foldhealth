/**
 * Sample appointments for the calendar's List view (VBC-25651): a spread of
 * providers, each with appointments from a few days ago to two weeks out, so
 * the provider groups, the locked statuses (Checked In / Out, Cancelled) and
 * the bulk actions all have something to show. Written by `bun run seed`.
 */

const TYPES = [
  { name: 'Follow-up Appointment', calendarId: 'followup', mode: 'In-person', reason: 'Medication review' },
  { name: 'Annual Wellness Visit', calendarId: 'awv', mode: 'In-person', reason: 'Yearly check-up' },
  { name: 'Chronic Care Management Visit', calendarId: 'telehealth', mode: 'Virtual', reason: 'Blood pressure follow-up' },
  { name: 'Specialty Consultation', calendarId: 'specialty', mode: 'In-person', reason: 'Cardiology referral' },
  { name: 'Lab Review', calendarId: 'followup', mode: 'Virtual', reason: 'Lab panel review' },
];

const PATIENTS = [
  'Annette Brave', 'Marcus Reed', 'Linda Torres', 'David Walsh', 'Michael King', 'Tina Smith',
  'Catherine Taylor', 'Jason Smith', 'Alice Stone', 'Paul Thomas', 'Nora Bennett', 'Omar Haddad',
  'Grace Liu', 'Victor Alvarez', 'Hannah Cole', 'Samuel Price',
];

const LOCATIONS = ['Fold Health, New York', '7 Hills Department', '68th Street, New York', '168th Street, New York'];

const NOTES = ['', 'Fasting required', 'Bring medication list', 'Confirm transport', '', 'Interpreter needed'];

const TIMES = [['9:00 am', '9:30 am'], ['10:30 am', '11:00 am'], ['1:00 pm', '1:45 pm'], ['3:30 pm', '4:00 pm']];

const apptDate = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;

// Weekdays from 3 days ago to 14 days out.
function weekdays(now) {
  const out = [];
  for (let i = -3; i <= 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(d);
  }
  return out;
}

/**
 * @param {{ id: string, name: string }[]} providers
 * @param {Date} [now]
 * @returns {object[]} appointments rows
 */
export function sampleListAppointments(providers, now = new Date()) {
  const days = weekdays(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return providers.flatMap((p, pi) => days
    // Each provider works about two days in three, on a different rotation.
    .filter((_, di) => (di + pi) % 3 !== 0)
    .flatMap((day, di) => TIMES.slice(0, 1 + ((di + pi) % 3)).map(([start, end], ti) => {
      const n = pi * 7 + di * 3 + ti;
      const type = TYPES[n % TYPES.length];
      const past = day.getTime() < today;
      const isToday = day.getTime() === today;
      let status = 'Scheduled';
      if (past) status = n % 5 === 0 ? 'No Show' : 'Checked Out';
      else if (isToday && ti === 0) status = 'Checked In';
      else if (n % 11 === 0) status = 'Cancelled';
      return {
        patient_id: null,
        patient_name: PATIENTS[n % PATIENTS.length],
        appointment_type_id: null,
        appointment_type_name: type.name,
        mode: type.mode,
        location: LOCATIONS[(pi + ti) % LOCATIONS.length],
        primary_user: p.name,
        primary_user_id: p.id || null,
        secondary_users: [],
        date: apptDate(day),
        time_start: start,
        time_end: end,
        reason_for_visit: type.reason,
        member_instruction: '',
        staff_instruction: NOTES[n % NOTES.length],
        require_rsvp: false,
        recurring: false,
        recurring_config: null,
        status,
        calendar_id: type.calendarId,
      };
    })));
}

// Group sessions: one provider, one slot, several members (a row each).
const GROUP_SESSIONS = [
  { name: 'Group Diabetes Education', calendarId: 'specialty', mode: 'In-person', reason: 'Diabetes self-management class', time: ['10:00 am', '11:00 am'], members: 4 },
  { name: 'Group Weight Management', calendarId: 'telehealth', mode: 'Virtual', reason: 'Weekly weight management session', time: ['2:00 pm', '3:00 pm'], members: 5 },
  { name: 'Group Heart Health Workshop', calendarId: 'specialty', mode: 'In-person', reason: 'Blood pressure and heart health', time: ['11:30 am', '12:30 pm'], members: 3 },
];

/**
 * Group appointments for the current week (Monday to Friday of the week of
 * `now`): each provider runs a couple of sessions, each session one row per
 * member at the same provider, date and time. Earlier days this week are
 * already Checked Out.
 *
 * @param {{ id: string, name: string }[]} providers
 * @param {Date} [now]
 * @returns {object[]} appointments rows
 */
export function sampleGroupAppointments(providers, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 5 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  return providers.flatMap((p, pi) => [0, 1].flatMap((k) => {
    const day = weekDays[(pi * 2 + k * 2) % weekDays.length];
    const session = GROUP_SESSIONS[(pi + k) % GROUP_SESSIONS.length];
    const past = day.getTime() < today.getTime();
    return Array.from({ length: session.members }, (_, m) => ({
      patient_id: null,
      patient_name: PATIENTS[(pi * 5 + k * 3 + m) % PATIENTS.length],
      appointment_type_id: null,
      appointment_type_name: session.name,
      mode: session.mode,
      location: LOCATIONS[(pi + k) % LOCATIONS.length],
      primary_user: p.name,
      primary_user_id: p.id || null,
      secondary_users: [],
      date: apptDate(day),
      time_start: session.time[0],
      time_end: session.time[1],
      reason_for_visit: session.reason,
      member_instruction: '',
      staff_instruction: '',
      require_rsvp: false,
      recurring: false,
      recurring_config: null,
      status: past ? 'Checked Out' : 'Scheduled',
      calendar_id: session.calendarId,
    }));
  }));
}

const DEMO_LOCATION = 'AstranaCare Centennial Hills';
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Bulk Edit's location change, ready to demo: next week, one provider has
 * seven appointments at 7 Hills Department and availability at
 * AstranaCare Centennial Hills on Monday, Wednesday and Friday, 9 am to 1 pm.
 * Moving them there: five patients were seen at AstranaCare before; of
 * those, two need a new time (Mon 2 pm, Tue 10 am) and three are fine. The
 * other two (Wed 3:30 pm, Fri 12 pm) aren't linked to AstranaCare, so they
 * need a location they are linked to (7 Hills, where they're booked).
 *
 * @param {{ id, name, email? }} provider
 * @param {{ id, name }[]} patients  – at least 7
 * @param {Date} [now]
 * @returns {{ availability: object, appointments: object[], history: object[] }} rows
 */
export function sampleLocationChangeDemo(provider, patients, now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + 7);
  const day = (i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
  const row = (patient, d, start, end, extra = {}) => ({
    patient_id: patient.id ? String(patient.id) : null,
    patient_name: patient.name,
    appointment_type_id: null,
    appointment_type_name: 'Follow-up Appointment',
    mode: 'In-person',
    location: '7 Hills Department',
    primary_user: provider.name,
    primary_user_id: provider.id || null,
    secondary_users: [],
    date: apptDate(d),
    time_start: start,
    time_end: end,
    reason_for_visit: 'Medication review',
    member_instruction: '',
    staff_instruction: '',
    require_rsvp: false,
    recurring: false,
    recurring_config: null,
    status: 'Scheduled',
    calendar_id: 'followup',
    ...extra,
  });
  const p = patients;
  const appointments = [
    row(p[0], day(0), '9:30 am', '10:00 am'),
    row(p[1], day(0), '2:00 pm', '2:30 pm'),
    row(p[2], day(1), '10:00 am', '10:30 am'),
    row(p[3], day(2), '11:00 am', '11:30 am'),
    row(p[4], day(2), '3:30 pm', '4:00 pm'),
    row(p[5], day(4), '9:00 am', '9:30 am'),
    row(p[6], day(4), '12:00 pm', '12:30 pm'),
  ];
  // Seen at AstranaCare last month, so linked to it.
  const past = new Date(monday.getFullYear(), monday.getMonth() - 1, 14);
  const history = [p[0], p[1], p[2], p[3], p[5]].map((pt, i) => row(pt, new Date(past.getFullYear(), past.getMonth(), past.getDate() + i), '10:00 am', '10:30 am', {
    location: DEMO_LOCATION, status: 'Checked Out',
  }));
  const availability = {
    id: `ua-demo-location-${String(provider.id || provider.name).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
    user_id: provider.id || null,
    user_name: provider.name,
    user_email: provider.email || null,
    location: DEMO_LOCATION,
    start_date: isoOf(monday),
    end_date: isoOf(day(11)),
    repeat: 'weekly',
    repeat_interval: 1,
    days: [1, 3, 5],
    weeks: [],
    slots: [{ start: '09:00', end: '13:00', appointmentType: 'All appointment types' }],
    timezone: 'America/New_York',
    skip_holidays: false,
    advanced: false,
    allow_overlap: true,
  };
  return { availability, appointments, history };
}
