export const MEASURE_NAMES = {
  CBP:      'Controlling Blood Pressure',
  COL:      'Colorectal Cancer Screening',
  'COA-FS': 'Care for Older Adults: Functional Status',
  'COA-M':  'Care for Older Adults: Medication Review',
  BCS:      'Breast Cancer Screening',
  DM:       'Diabetes HbA1c Control',
  ABA:      'Adult BMI Assessment',
  FUH:      'Follow-Up After Hospitalization',
  AMR:      'Asthma Medication Ratio',
  OMW:      'Osteoporosis Management in Women',
  KED:      'Kidney Health Evaluation',
  EED:      'Eye Exam for Patients With Diabetes',
  GSD3:     'Glycemic Status Assessment',
  'DSF-A':  'Depression Screening (PHQ-2)',
  'DSF-B':  'Depression Follow-Up (PHQ-9)',
  LSC:      'Lead Screening in Children',
  'CIS-CMB10': 'Childhood Immunization Status (Combo 10)',
  WCV:      'Child and Adolescent Well-Care Visits',
};

export const STATUSES = [
  'Open',
  'Engaged',
  'Engaged Requires Follow-Up',
  'Submitted',
  'Completed',
  'Closed - Data',
  'Closed - Do not call',
  'Closed - UTR',
  'Closed - Other',
];

export const STATUS_STYLE = {
  Open:                         { color: 'var(--primary-300)',    bg: 'var(--primary-50)',           border: 'color-mix(in srgb, var(--primary-300) 24%, transparent)' },
  Engaged:                      { color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'color-mix(in srgb, var(--status-warning) 24%, transparent)' },
  'Engaged Requires Follow-Up': { color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'color-mix(in srgb, var(--status-warning) 24%, transparent)' },
  Submitted:                    { color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'color-mix(in srgb, var(--status-warning) 24%, transparent)' },
  Completed:                    { color: 'var(--status-success)', bg: 'var(--status-success-light)', border: 'color-mix(in srgb, var(--status-success) 24%, transparent)' },
  'Closed - Data':              { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)',           border: 'color-mix(in srgb, var(--neutral-300) 10%, transparent)' },
  'Closed - Do not call':       { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)',           border: 'color-mix(in srgb, var(--neutral-300) 10%, transparent)' },
  'Closed - UTR':               { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)',           border: 'color-mix(in srgb, var(--neutral-300) 10%, transparent)' },
  'Closed - Other':             { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)',           border: 'color-mix(in srgb, var(--neutral-300) 10%, transparent)' },
};

export const MORE_ACTIONS = [
  { key: 'add-gap',       label: 'Add Care Gap',        icon: 'solar:clipboard-add-linear' },
  { key: 'task',          label: 'Add Task',            icon: 'solar:clipboard-check-linear' },
  { key: 'clinical-note', label: 'Add Clinical Note',   icon: 'solar:notes-linear', openClinicalNote: true },
  { key: 'appointment',   label: 'Schedule Appointment', icon: 'solar:calendar-linear' },
  { key: 'outreach',      label: 'Add Outreach',        icon: 'solar:phone-calling-linear' },
  { key: 'document',      label: 'Add Document',        icon: 'solar:upload-minimalistic-linear' },
  { key: 'reminder',      label: 'Set Reminder',        icon: 'solar:bell-linear' },
  { key: 'referral',      label: 'Send Referral',       icon: 'solar:arrow-right-up-linear' },
  { key: 'lab',           label: 'Add Lab Order',       icon: 'solar:test-tube-linear' },
  { key: 'imaging',       label: 'Add Imaging Order',   icon: 'solar:medical-kit-linear' },
];

export const TABS = [
  { key: 'Activity Log', label: 'Activity' },
  { key: 'Clinical Notes', label: 'Clinical Notes' },
  { key: 'Outreaches', label: 'Outreaches' },
  { key: 'Tasks', label: 'Tasks' },
  { key: 'Appt/Reminders', label: 'Appt/Reminders' },
  { key: 'Documents', label: 'Documents' },
  { key: 'Referrals', label: 'Referrals' },
  { key: 'Orders', label: 'Orders' },
];

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function daysAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  return `${days}d ago`;
}

export function outreachOutcomeColor(outcome) {
  const s = String(outcome || '').toLowerCase();
  if (/completed|engaged|enrolled|attended|scheduled/.test(s)) return 'var(--status-success)';
  if (/failed|no answer|voicemail|declined/.test(s))          return 'var(--status-error)';
  return 'var(--neutral-400)';
}

export function toActivityLogEntries(rawEntries) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const out = [];
  let currentGroup = '';
  const sorted = (rawEntries || []).toSorted((a, b) =>
    new Date(b.when ?? b.at) - new Date(a.when ?? a.at)
  );
  for (const e of sorted) {
    const d = new Date(e.when ?? e.at);
    const valid = !Number.isNaN(d.getTime());
    const groupLabel = valid ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
    if (groupLabel && groupLabel !== currentGroup) {
      out.push({ t: 'group', label: groupLabel });
      currentGroup = groupLabel;
    }
    const mm = valid ? String(d.getMonth() + 1).padStart(2, '0') : '';
    const dd = valid ? String(d.getDate()).padStart(2, '0') : '';
    const yyyy = valid ? d.getFullYear() : '';
    let hh = valid ? d.getHours() : 0;
    const min = valid ? String(d.getMinutes()).padStart(2, '0') : '';
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    const actor = e.actor || e.user || 'System';
    const roleMatch = actor.match(/^(.+?)\s*\((.+?)\)\s*$/);
    const outcomeColor = (e.t === 'outreach' || e.t === 'call' || e.t === 'sms')
      ? outreachOutcomeColor(e.outcome)
      : null;
    out.push({
      ...e,
      date:  valid ? `${mm}/${dd}/${yyyy}` : '',
      time:  valid ? `${hh}:${min} ${ampm}` : '',
      by:    roleMatch ? roleMatch[1] : actor,
      role:  roleMatch ? roleMatch[2] : null,
      // A color saved on the entry (outreach status: Successful / Unsuccessful
      // / Note) wins over guessing it from the outcome text.
      outcomeColor: e.outcomeColor || outcomeColor,
    });
  }
  return out;
}
