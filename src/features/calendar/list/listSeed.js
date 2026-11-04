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
