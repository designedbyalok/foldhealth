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
