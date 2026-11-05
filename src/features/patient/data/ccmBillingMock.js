// Mock data for the CCM Billing Review step. Seeded to Supabase via
// scripts/seed.js so the UI reads real rows; retained here as the
// local-mock fallback and as the source-of-truth the seed uses.

// Convert 'MM:SS' → total seconds (07:15 → 435).
export const timeToSeconds = (mmss) => {
  const [m, s] = String(mmss).split(':').map(Number);
  return m * 60 + (s || 0);
};

// Convert total seconds → 'MM:SS' string.
export const secondsToTime = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// One row per (patient_id, year_month). July 2026 = the Figma reference,
// current-month open period. Prior months exist so ccm_billing_reports FK
// resolves and the History drawer can link a report back to its period.
export const CCM_BILLING_PERIODS = [
  {
    id: 'p1-2026-07',
    patientId: 'p1',
    programId: null,
    yearMonth: '2026-07',
    complexity: 'high',
    requiredMinutes: 20,
    billStatus: 'ready',
    claimStatus: 'unsent',
    generatedAt: null,
    sentAt: null,
  },
  {
    id: 'p1-2026-06',
    patientId: 'p1',
    programId: null,
    yearMonth: '2026-06',
    complexity: 'high',
    requiredMinutes: 20,
    billStatus: 'sent',
    claimStatus: 'sent',
    generatedAt: '2026-07-01T09:00:00Z',
    sentAt: '2026-07-01T09:15:00Z',
  },
  {
    id: 'p1-2026-05',
    patientId: 'p1',
    programId: null,
    yearMonth: '2026-05',
    complexity: 'moderate',
    requiredMinutes: 20,
    billStatus: 'sent',
    claimStatus: 'sent',
    generatedAt: '2026-06-01T09:00:00Z',
    sentAt: '2026-06-01T09:15:00Z',
  },
  {
    id: 'p1-2026-04',
    patientId: 'p1',
    programId: null,
    yearMonth: '2026-04',
    complexity: 'moderate',
    requiredMinutes: 20,
    billStatus: 'sent',
    claimStatus: 'sent',
    generatedAt: '2026-05-01T09:00:00Z',
    sentAt: '2026-05-01T09:15:00Z',
  },
];

// Billable activities backing the Figma "July 2026" example. Times sum to
// 28:30 (1710s) to match the total-billable-time card in the design.
export const CCM_BILLABLE_ACTIVITIES = [
  {
    id: 'act-p1-2026-07-1',
    periodId: 'p1-2026-07',
    patientId: 'p1',
    activityType: 'Care Planning, Patient Assessment',
    description:
      'After the careful patient assessment a care plan was created for better recovery. The patient is advised to carefully follow the care plan carefully. Patient education materials were shared and follow-up plan confirmed.',
    durationSeconds: timeToSeconds('07:15'),
    loggedBy: 'Delores Conn',
    loggedByInitials: 'DC',
    occurredAt: '2026-07-27T15:12:00Z',
    isUnlogged: false,
  },
  {
    id: 'act-p1-2026-07-2',
    periodId: 'p1-2026-07',
    patientId: 'p1',
    activityType: 'Clinical Documentation',
    description:
      'Updated patient chart with latest vitals and lab results. HbA1c trending down at 6.8%, continue current management plan and schedule follow-up in 3 months.',
    durationSeconds: timeToSeconds('05:42'),
    loggedBy: 'Delores Conn',
    loggedByInitials: 'DC',
    occurredAt: '2026-07-22T11:30:00Z',
    isUnlogged: false,
  },
  {
    id: 'act-p1-2026-07-3',
    periodId: 'p1-2026-07',
    patientId: 'p1',
    activityType: 'Medication Review',
    description:
      'Reviewed current medication list with patient. Adjusted Lisinopril dosage from 10mg to 20mg daily due to persistent elevated readings. Monitor for side effects at next visit.',
    durationSeconds: timeToSeconds('04:18'),
    loggedBy: 'Delores Conn',
    loggedByInitials: 'DC',
    occurredAt: '2026-07-18T08:05:00Z',
    isUnlogged: false,
  },
  {
    id: 'act-p1-2026-07-4',
    periodId: 'p1-2026-07',
    patientId: 'p1',
    activityType: 'Patient/Caregiver Communication',
    description: 'Phone consultation with primary caregiver to discuss updated care plan and answer questions about medication changes.',
    durationSeconds: timeToSeconds('03:55'),
    loggedBy: 'Delores Conn',
    loggedByInitials: 'DC',
    occurredAt: '2026-07-14T14:48:00Z',
    isUnlogged: false,
  },
  {
    id: 'act-p1-2026-07-5',
    periodId: 'p1-2026-07',
    patientId: 'p1',
    activityType: 'Others',
    description: 'Coordinated referral to cardiology for further evaluation. Patient consent obtained and records forwarded. Appointment confirmation pending from specialist office.',
    durationSeconds: timeToSeconds('04:30'),
    loggedBy: 'Delores Conn',
    loggedByInitials: 'DC',
    occurredAt: '2026-07-09T10:17:00Z',
    isUnlogged: false,
  },
  {
    id: 'act-p1-2026-07-6',
    periodId: 'p1-2026-07',
    patientId: 'p1',
    activityType: 'Care Coordination',
    description: 'Coordinated with home health nurse to align on wound-care schedule and equipment delivery. Follow-up encounter noted in the shared care plan.',
    durationSeconds: timeToSeconds('02:50'),
    loggedBy: 'Delores Conn',
    loggedByInitials: 'DC',
    occurredAt: '2026-07-07T07:22:00Z',
    isUnlogged: false,
  },
];

// Static catalog of activity types the timer + add-activity forms pick from.
export const CCM_ACTIVITY_TYPES = [
  'Care Planning, Patient Assessment',
  'Clinical Documentation',
  'Medication Review',
  'Patient/Caregiver Communication',
  'Care Coordination',
  'Others',
];

// The Figma banner shows "Review 18:00 mins of Unlogged Time". In real code
// this would be computed from time-tracker sessions not yet classified into
// activities; here it's a static mock.
export const CCM_UNLOGGED_SECONDS = 18 * 60;

// Historical billing reports: one per closed month. Amounts and CPT
// breakdown mirror the Figma so the History tab and the report drawer
// match pixel-for-pixel until real data replaces this.
export const CCM_BILLING_REPORTS = [
  {
    id: 'p1-BR-48',
    reportNumber: 48,
    patientId: 'p1',
    periodId: 'p1-2026-06',
    yearMonth: '2026-06',
    generatedAt: '2026-07-01T09:00:00Z',
    estBillingAmount: 108.71,
    totalSeconds: timeToSeconds('20:24'),
    integratedEhr: 'Athena Health',
    providerName: 'Dr. Marvin Funk',
    providerInitials: 'MF',
    medicalDecisionMaking: 'high',
    cptCodes: [
      { code: '99490', minutes: 20, amount: 61.56 },
      { code: '99439', minutes: 27, amount: 47.15 },
    ],
  },
  {
    id: 'p1-BR-47',
    reportNumber: 47,
    patientId: 'p1',
    periodId: 'p1-2026-05',
    yearMonth: '2026-05',
    generatedAt: '2026-06-01T09:00:00Z',
    estBillingAmount: 64.70,
    totalSeconds: timeToSeconds('21:24'),
    integratedEhr: 'Athena Health',
    providerName: 'Dr. Marvin Funk',
    providerInitials: 'MF',
    medicalDecisionMaking: 'moderate',
    cptCodes: [
      { code: '99490', minutes: 21, amount: 64.70 },
    ],
  },
  {
    id: 'p1-BR-46',
    reportNumber: 46,
    patientId: 'p1',
    periodId: 'p1-2026-04',
    yearMonth: '2026-04',
    generatedAt: '2026-05-01T09:00:00Z',
    estBillingAmount: 71.50,
    totalSeconds: timeToSeconds('22:24'),
    integratedEhr: 'Athena Health',
    providerName: 'Dr. Marvin Funk',
    providerInitials: 'MF',
    medicalDecisionMaking: 'moderate',
    cptCodes: [
      { code: '99490', minutes: 22, amount: 71.50 },
    ],
  },
];
