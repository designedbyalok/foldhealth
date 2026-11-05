import { parsePickerValue } from '../../../../../../components/DateTimePicker/parsePickerValue';

// A user's private reminders on a patient (patient_reminders): grouping for
// the Reminders card, when-labels, and the DateTimePicker round trip.
// Reminder: { id, title, note, remindAt (ISO), doneAt (ISO|null), createdAt }

const DAY = 24 * 3600 * 1000;
const pad = n => String(n).padStart(2, '0');
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const time = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** { overdue, today, upcoming, done }: open ones soonest first, done ones newest first. */
export function groupReminders(reminders = [], now = Date.now()) {
  const today0 = startOfDay(now);
  const tomorrow0 = today0 + DAY;
  const out = { overdue: [], today: [], upcoming: [], done: [] };
  for (const r of reminders) {
    if (r.doneAt) { out.done.push(r); continue; }
    const at = new Date(r.remindAt).getTime();
    if (at < now) out.overdue.push(r);
    else if (at < tomorrow0) out.today.push(r);
    else out.upcoming.push(r);
  }
  const byAt = (a, b) => new Date(a.remindAt) - new Date(b.remindAt);
  out.overdue.sort(byAt);
  out.today.sort(byAt);
  out.upcoming.sort(byAt);
  out.done.sort((a, b) => new Date(b.doneAt) - new Date(a.doneAt));
  return out;
}

/** "Today, 3:00 PM", "Tomorrow, 9:00 AM", "Thu, Oct 30, 9:00 AM"; past ones keep their date. */
export function reminderWhen(iso, now = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day0 = startOfDay(d.getTime());
  const today0 = startOfDay(now);
  if (day0 === today0) return `Today, ${time(d)}`;
  if (day0 === today0 + DAY) return `Tomorrow, ${time(d)}`;
  if (day0 === today0 - DAY) return `Yesterday, ${time(d)}`;
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${time(d)}`;
}

/** DateTimePicker value ("MM/DD/YYYY, HH:MM") → ISO, or null if incomplete. */
export function pickerToIso(value) {
  const { date, hour, minute } = parsePickerValue(value);
  const m = String(date || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), hour, minute).toISOString();
}

/** ISO → DateTimePicker value. */
export function isoToPicker(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The default time for a new reminder: tomorrow at 9:00. */
export function defaultRemindAt(now = Date.now()) {
  const d = new Date(startOfDay(now) + DAY);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** Snooze a day: the same time tomorrow, or a day after it was due if that is later. */
export function snoozeOneDay(iso, now = Date.now()) {
  const due = new Date(iso).getTime();
  const base = Number.isNaN(due) || due < now ? now : due;
  return new Date(base + DAY).toISOString();
}
