/**
 * CRM Activity: every communication with a patient, one record each (chats,
 * calls, emails, SMS, eFax, plus visits, assessments and tasks sent to them).
 * Shown in the patient's CRM tab (Figma P360 Revamp 727:261699).
 *
 * `channel` keys CRM_CHANNELS; `status` is free text ("Completed",
 * "Pending", "In Progress") and may be empty.
 */

// What each channel looks like. `filter: true` channels get a quick-filter
// tab (Figma: All · Chat · Call · Email · SMS · eFax); the rest show under
// All only. Colours are the accent tokens, the dot and the rail tile share one.
export const CRM_CHANNELS = {
  chat:       { label: 'Chat', icon: 'solar:chat-round-line-linear', color: 'var(--accent-purple)', tint: 'var(--accent-light-purple)', filter: true },
  call:       { label: 'Call', icon: 'solar:phone-calling-linear', color: 'var(--accent-blue)', tint: 'var(--accent-light-blue)', filter: true },
  // --accent-light-green is the lime accent itself (Figma's email green);
  // its pale tint is --accent-light-light-green.
  email:      { label: 'Email', icon: 'solar:letter-linear', color: 'var(--accent-light-green)', tint: 'var(--accent-light-light-green)', filter: true },
  sms:        { label: 'SMS', icon: 'solar:smartphone-linear', color: 'var(--accent-brown)', tint: 'var(--accent-light-brown)', filter: true },
  efax:       { label: 'eFax', icon: 'solar:printer-linear', color: 'var(--accent-blue-grey)', tint: 'var(--accent-light-blue-grey)', filter: true },
  visit:      { label: 'Visit', icon: 'solar:videocamera-record-linear', color: 'var(--accent-cyan)', tint: 'var(--accent-light-cyan)' },
  assessment: { label: 'Assessment', icon: 'solar:clipboard-list-linear', color: 'var(--accent-pink)', tint: 'var(--accent-light-pink)' },
  task:       { label: 'Task', icon: 'solar:checklist-minimalistic-linear', color: 'var(--accent-magenta)', tint: 'var(--accent-light-magenta)' },
  // P360 timeline actions (Figma 727:245147).
  in_person:  { label: 'In-Person Visit', icon: 'solar:walking-linear', color: 'var(--accent-cyan)', tint: 'var(--accent-light-cyan)' },
  education:  { label: 'Patient Education', icon: 'solar:book-2-linear', color: 'var(--accent-pink)', tint: 'var(--accent-light-pink)' },
  review:     { label: 'Clinical Review', icon: 'solar:stethoscope-linear', color: 'var(--accent-pink)', tint: 'var(--accent-light-pink)' },
  ip_visit:   { label: 'IP Visit', icon: 'solar:bed-linear', color: 'var(--accent-cyan)', tint: 'var(--accent-light-cyan)' },
  er_visit:   { label: 'ER Visit', icon: 'solar:bed-linear', color: 'var(--accent-cyan)', tint: 'var(--accent-light-cyan)' },
  lab:        { label: 'Lab', icon: 'solar:test-tube-linear', color: 'var(--accent-blue)', tint: 'var(--accent-light-blue)' },
};

// Status → text colour, as in Figma: done is green, anything waiting amber.
export const CRM_STATUS_COLOR = {
  Completed: 'var(--status-success)',
  Pending: 'var(--status-warning)',
  'In Progress': 'var(--status-warning)',
  Failed: 'var(--status-error)',
};

// [days ago, hour, minute, channel, title, status, by, role]
const SAMPLE = [
  [2, 12, 30, 'chat', 'Patient Chat', 'Completed', 'Dr. Aldo Richman', 'Physician'],
  [5, 12, 30, 'call', 'Outgoing Call with Patient', 'Completed', 'Dr. Aldo Richman', 'Physician'],
  [9, 10, 15, 'email', 'Sent Welcome Email', '', 'Dr. Jenny Wilson', 'Care Coordinator'],
  [12, 16, 5, 'sms', 'Sent Form Through SMS', '', "Dr. Robert D'Souza", 'Nurse'],
  [15, 11, 40, 'efax', 'Sent Referral Through eFax', '', 'Nathan Williams', 'Care Coordinator'],
  [34, 12, 30, 'visit', 'Follow-up (Remote Visit)', 'Completed', 'Dr. Aldo Richman', 'Physician'],
  [38, 9, 0, 'assessment', 'HRA Assessment', 'Pending', 'Dr. Jenny Wilson', 'Care Coordinator'],
  [41, 14, 20, 'task', 'Record daily blood pressure readings', 'Pending', 'Nathan Williams', 'Care Coordinator'],
  [66, 12, 30, 'in_person', 'Regular Checkup (In-Person Visit)', 'Completed', 'Dr. Aldo Richman', 'Physician'],
  [70, 15, 45, 'assessment', 'HIU Assessment Sent', 'In Progress', 'Nathan Williams', 'Care Coordinator'],
  // Appended so the rows above keep their seeded ids.
  [20, 12, 30, 'education', 'Patient Education', 'Completed', 'Dr. Jenny Wilson', 'Care Coordinator'],
  [25, 12, 30, 'review', 'Reviewing Diabetic Conditions', 'In Progress', 'Nathan Williams', 'Care Coordinator'],
  [45, 12, 30, 'ip_visit', 'IP Visit', 'Completed', 'Dr. Jenny Wilson', 'Care Coordinator'],
  [48, 12, 30, 'er_visit', 'ER Visit', 'Pending', "Dr. Robert D'Souza", 'Nurse'],
  [52, 12, 30, 'lab', 'Complete Blood Count (CBC)', '', 'Nathan Williams', 'Care Coordinator'],
];

/** Sample activity for one patient, dated back from `now` so months fill. */
export function sampleCrmActivities(patientId, now = new Date()) {
  return SAMPLE.map(([days, h, m, channel, title, status, by, role], i) => ({
    id: `crm-${patientId}-${i + 1}`,
    patientId: String(patientId),
    channel,
    title,
    status,
    performedBy: by,
    performedByRole: role,
    occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, h, m).toISOString(),
    note: '',
  }));
}

/** Activity ↔ patient_crm_activities row. */
export const crmToRow = (a) => ({
  id: a.id,
  patient_id: a.patientId,
  channel: a.channel,
  title: a.title,
  status: a.status || '',
  performed_by: a.performedBy || null,
  performed_by_role: a.performedByRole || null,
  occurred_at: a.occurredAt,
  note: a.note || '',
});

export const rowToCrm = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  channel: r.channel,
  title: r.title,
  status: r.status || '',
  performedBy: r.performed_by,
  performedByRole: r.performed_by_role,
  occurredAt: r.occurred_at,
  note: r.note || '',
  // patient_event_stream_migration.sql
  programCode: r.program_code || null,
  billingProgram: r.billing_program || null,
  durationSeconds: r.duration_seconds || null,
  vendorName: r.vendor_name || null,
});
