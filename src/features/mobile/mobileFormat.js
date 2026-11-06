import { formatPhone } from '../messages/comms/commsUtils';

// Date labels for the provider mobile app lists (Figma: "12:03 PM",
// "Yesterday", "Monday", "01-21-2024").

const pad = (n) => String(n).padStart(2, '0');
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function timeOf(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function dateOf(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
}

/** Time today, "Yesterday", a weekday within the last week, else the date. */
export function listStamp(iso, now = new Date()) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return timeOf(iso);
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return dateOf(iso);
}

/** "Today, 10:03 AM" / "Yesterday, 11:03 AM" / "Monday, 12:03 PM" / "01-21-2024, 9:23 AM". */
export function longStamp(iso, now = new Date()) {
  const day = listStamp(iso, now);
  if (!day) return '';
  const time = timeOf(iso);
  return day === time ? `Today, ${time}` : `${day}, ${time}`;
}

/** Seconds (or a "12:34" / "12 min" string) as "13 sec" / "12 min". */
export function durationLabel(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && !/^\d+$/.test(value)) {
    const mmss = value.match(/^(\d+):(\d{2})$/);
    if (!mmss) return value;
    value = Number(mmss[1]) * 60 + Number(mmss[2]);
  }
  const s = Number(value);
  if (!Number.isFinite(s) || s <= 0) return '';
  return s < 60 ? `${s} sec` : `${Math.round(s / 60)} min`;
}

export const initialsOf = (name) => String(name || '').replace(/^Dr\.?\s+/i, '').split(/\s+/)
  .filter(w => /[a-z]/i.test(w[0] || '')).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '#';

/** "Female • 28 Y (03-29-1995)" from an all_patients row. */
export function patientLine(patient) {
  if (!patient) return '';
  const age = patient.age != null && patient.age !== '' ? `${patient.age} Y` : '';
  const ageDob = [age, patient.dob ? `(${patient.dob})` : ''].filter(Boolean).join(' ');
  return [patient.gender, ageDob].filter(Boolean).join(' • ');
}

export const conversationTitle = (c) => c.patient_name || formatPhone(c.patient_phone) || c.patient_email || 'Unknown';
