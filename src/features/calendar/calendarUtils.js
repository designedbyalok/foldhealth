// Default calendar color configs (used when DB types aren't loaded yet)
export const DEFAULT_CALENDARS = {
  awv:        { colorName: 'awv',        lightColors: { main: '#D9A50B', container: '#FEF9E7', onContainer: '#3A485F' }, darkColors: { main: '#D9A50B', container: '#4A3600', onContainer: '#FEF3CD' } },
  followup:   { colorName: 'followup',   lightColors: { main: '#8C5AE2', container: '#F5F0FF', onContainer: '#3A485F' }, darkColors: { main: '#8C5AE2', container: '#2D1B69', onContainer: '#E8D5FF' } },
  specialty:  { colorName: 'specialty',  lightColors: { main: '#009B53', container: '#F0FDF4', onContainer: '#3A485F' }, darkColors: { main: '#009B53', container: '#1B4332', onContainer: '#D1FAE5' } },
  telehealth: { colorName: 'telehealth', lightColors: { main: '#145ECC', container: '#EEF4FF', onContainer: '#3A485F' }, darkColors: { main: '#145ECC', container: '#1A2744', onContainer: '#C7DEFF' } },
  selection:  { colorName: 'selection',  lightColors: { main: '#8C5AE2', container: 'transparent', onContainer: '#8C5AE2' }, darkColors: { main: '#8C5AE2', container: 'transparent', onContainer: '#8C5AE2' } },
};
// Care Gap reminders reuse the AWV yellow (the warning family) so they read
// apart from appointments without adding new raw colors.
DEFAULT_CALENDARS.reminder = { ...DEFAULT_CALENDARS.awv, colorName: 'reminder' };


export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'IST (GMT+5:30)' },
  { value: 'America/New_York', label: 'EST (GMT-5)' },
  { value: 'America/Chicago', label: 'CST (GMT-6)' },
  { value: 'America/Denver', label: 'MST (GMT-7)' },
  { value: 'America/Los_Angeles', label: 'PST (GMT-8)' },
  { value: 'Europe/London', label: 'GMT (GMT+0)' },
  { value: 'Europe/Berlin', label: 'CET (GMT+1)' },
  { value: 'Asia/Dubai', label: 'GST (GMT+4)' },
  { value: 'Asia/Tokyo', label: 'JST (GMT+9)' },
  { value: 'Australia/Sydney', label: 'AEST (GMT+11)' },
];

export function getTimezoneOffset(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart?.value || 'GMT';
  } catch { return 'GMT'; }
}

export function getTodayInTimezone(tz) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
}

export function getNowInTimezone(tz) {
  const str = new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false });
  const [h, m] = str.split(':').map(Number);
  return { hours: h, minutes: m };
}

export const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

// Map a DB appointment row to a schedule-x event object (needs Temporal T + timezone)
export function apptToEvent(appt, T, tz) {
  function toDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [mo, dd, yyyy] = dateStr.split('-');
    const match = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
    if (!match) return null;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const p = match[3].toLowerCase();
    if (p === 'pm' && h < 12) h += 12;
    if (p === 'am' && h === 12) h = 0;
    return `${yyyy}-${mo}-${dd} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const startStr = toDateTime(appt.date, appt.time_start);
  const endStr = toDateTime(appt.date, appt.time_end);
  if (!startStr || !endStr) return null;

  const [sd, st] = startStr.split(' ');
  const [ed, et] = endStr.split(' ');
  const start = T.PlainDateTime.from(`${sd}T${st}`).toZonedDateTime(tz);
  const end = T.PlainDateTime.from(`${ed}T${et}`).toZonedDateTime(tz);

  const calId = appt.calendar_id || 'followup';

  return {
    id: appt.id,
    start,
    end,
    title: appt.patient_name || 'Appointment',
    description: `${appt.appointment_type_name || ''} • ${appt.status || 'Scheduled'}`,
    calendarId: calId,
    // schedule-x applies these to the event element in every view, on first
    // paint. This is what makes the cancelled styling declarative instead of
    // a querySelector race against the renderer.
    ...(appt.status === 'Cancelled' ? { _options: { additionalClasses: ['is-cancelled'] } } : {}),
  };
}

// Appointments are stored as 'Scheduled', but older rows (and the drawer's
// status control, before the rename) wrote 'Booked'; the two mean the same.
// The Status filter's "Scheduled" has to match both.
export const BOOKED_STATUS_ALIASES = ['Booked', 'Scheduled'];

export function appointmentMatchesStatuses(appt, selectedStatuses) {
  const status = appt.status;
  return selectedStatuses.some(s => (s === 'Scheduled'
    ? !status || BOOKED_STATUS_ALIASES.includes(status)
    : s === status));
}

export const VIEWS = ['week', 'day', 'month-grid'];
export const VIEW_LABELS = { 'week': 'Week', 'day': 'Day', 'month-grid': 'Month' };

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
