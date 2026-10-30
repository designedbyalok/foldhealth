export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const EMPTY_PROFILE_USERS = [];

export const FALLBACK_APPOINTMENT_TYPES = [
  { name: 'Annual Wellness Visit', code: 'AWV', mode: 'In-person', duration: '60 min', color: '#D9A50B' },
  { name: 'SNP Care Program Visit', code: 'SNP', mode: 'In-person', duration: '45 min', color: 'var(--primary-300)' },
  { name: 'TOC Inpatient Visit', code: 'TOC IP', mode: 'In-person', duration: '45 min', color: 'var(--status-info)' },
  { name: 'TOC Emergency Dept. Visit', code: 'TOC ED', mode: 'In-person', duration: '45 min', color: 'var(--status-error)' },
  { name: 'High Utilizers Visit', code: 'HIU', mode: 'In-person/Virtual', duration: '30 min', color: 'var(--secondary-300)' },
  { name: 'Disease Management Visit', code: 'DM', mode: 'In-person/Virtual', duration: '30 min', color: 'var(--status-success)' },
  { name: 'Chronic Care Management Visit', code: 'CCM', mode: 'Virtual', duration: '20 min', color: 'var(--status-warning)' },
  { name: 'Transitional Care Visit', code: 'TCM', mode: 'In-person', duration: '30 min', color: 'var(--accent-cyan)' },
  { name: 'Follow-up Appointment', code: 'Routine', mode: 'In-person/Virtual', duration: '15-30 min', color: '#8C5AE2' },
  { name: 'Specialty Consultation', code: 'Routine', mode: 'In-person', duration: '45 min', color: '#009B53' },
  { name: 'Telehealth Consultation', code: 'Routine', mode: 'Virtual', duration: '30 min', color: '#145ECC' },
  { name: 'Lab Results Discussion', code: 'Routine', mode: 'Virtual', duration: '15 min', color: '#009B53' },
];

export const MODE_OPTIONS = [
  { label: 'At Clinic', icon: 'solar:buildings-linear' },
  { label: 'Virtual/Telehealth', icon: 'solar:monitor-linear' },
];

export const LOCATION_OPTIONS = ['Fold Health, New York', '7 Hills Department', '68th Street, New York', '168th Street, New York'];

export const PROVIDER_OPTIONS = [
  { name: 'Ralph Kessler', gender: 'Male', dob: '03-29-1992', age: 31, slots: '6 Slots Available' },
  { name: 'Robert Langdon', gender: 'Male', dob: '11-20-1986', age: 30, slots: '3 Slots Available' },
  { name: 'Cameron Haley', gender: 'Male', dob: '11-23-1986', age: 35, slots: '1 Slots Available' },
  { name: 'Mrs. Andrew Mayer IV', gender: 'Male', dob: '11-25-1986', age: 30, slots: 'Not Available' },
  { name: 'Gayle Jacobs', gender: 'Male', dob: '12-02-1986', age: 31, slots: '4 Slots Available' },
];

export const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 6; h < 20; h++) {
    for (const m of [0, 30]) {
      const ampm = h >= 12 ? 'pm' : 'am';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      slots.push(`${h12}:${String(m).padStart(2, '0')} ${ampm}`);
    }
  }
  return slots;
})();

export const APPOINTMENT_STATUSES = ['Scheduled', 'Cancelled', 'No Show', 'Checked In', 'Checked Out'];

// Stored status → the label shown everywhere. New bookings are stored as
// "Scheduled" (or empty); older rows may say "Booked", which means the same.
export function displayAppointmentStatus(raw) {
  return !raw || raw === 'Scheduled' || raw === 'Booked' ? 'Scheduled' : raw;
}

export function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
}
