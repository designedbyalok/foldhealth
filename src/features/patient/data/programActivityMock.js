export const PROGRAM_ACTIVITY_BY_MONTH = [
  {
    month: 'January 2025',
    cards: [
      {
        id: 'SNP-Jan',
        date: '1/30',
        day: 'Mon',
        program: 'SNP Program Updates',
        status: 'Engaged',
        statusType: 'success',
        activities: '3 Activities: Previsit Details \u2022 Upload Document \u2022 Send Letter \u2022 Outreach Log',
        avatars: [
          { initials: 'DC', variant: 'assignee' },
          { initials: 'SP', variant: 'assignee' },
          { initials: '+1', variant: 'count' },
        ],
        expanded: true,
        timelineItems: [
          { time: '02:30 PM', coordinator: 'Delores Conn (Co-Ordinator)', title: 'AMTX COC UTR Letter', status: 'Send Successfully to Patient', statusType: 'success', iconType: 'document', iconBg: '#e5f8fb', iconColor: '#109cae' },
          { time: '02:30 PM', coordinator: 'Delores Conn (Co-Ordinator)', title: 'Discharge Summary Document Added', status: '', statusType: '', iconType: 'document', iconBg: '#fdf7e5', iconColor: '#eeb200' },
          { time: '02:30 PM', coordinator: 'Delores Conn (Co-Ordinator)', title: 'Pre-visit Details', status: 'Reviewed', statusType: 'success', iconType: 'clipboard', iconBg: '#eee5ff', iconColor: '#5800ff' },
          { date: '06/01', time: '12:30 PM', coordinator: 'Delores Conn (Co-Ordinator)', title: '4th Outreach - Outgoing Call', status: 'Attended / Scheduled Appointment', statusType: 'success', iconType: 'call', iconBg: '#fff', iconColor: '#6f7a90' },
        ],
      },
    ],
  },
  {
    month: 'December 2024',
    cards: [
      {
        id: 'SNP-Dec',
        date: '12/30',
        day: 'Mon',
        program: 'SNP Program Updates',
        status: 'Engaged',
        statusType: 'success',
        activities: '3 Activities: Previsit Details \u2022 Upload Document \u2022 Send Letter \u2022 Outreach Log',
        avatars: [
          { initials: 'DC', variant: 'assignee' },
          { initials: 'SP', variant: 'assignee' },
          { initials: '+1', variant: 'count' },
        ],
        expanded: false,
        timelineItems: [],
      },
      {
        id: 'TOC-Dec',
        date: '1/11',
        day: 'Mon',
        program: 'TOC Program Updates',
        status: 'UTR',
        statusType: 'error',
        activities: '3 Activities: Previsit Details \u2022 Upload Document \u2022 Send Letter \u2022 Outreach Log',
        avatars: [{ initials: 'DC', variant: 'assignee' }],
        expanded: false,
        timelineItems: [],
      },
      {
        id: 'HUI-Dec',
        date: '12/11',
        day: 'Sat',
        program: 'HUI Program Updates',
        status: 'New',
        statusType: 'primary',
        activities: '3 Activities: Previsit Details \u2022 Upload Document \u2022 Send Letter \u2022 Outreach Log',
        avatars: [
          { initials: 'AJ', variant: 'assignee' },
          { initials: 'SP', variant: 'assignee' },
          { initials: '+1', variant: 'count' },
        ],
        expanded: false,
        timelineItems: [],
      },
    ],
  },
];

// 'Profile' (was 'Demographics') is the single patient-profile surface on
// the right panel; it wraps the Demographics/Insurance Toggle inside the
// ProfileTab component. Tasks is also owned by the right panel now — the
// left panel dropped both to avoid duplicate nav on the P360 screen.
export const PROFILE_TABS = [
  'Overview', 'Timeline', 'Notes', 'Assessments', 'Care Management',
  'Care Programs', 'Tasks', 'Documents', 'Orders & Referrals', 'Profile',
];

export const CARE_PROGRAMS_MOCK = [
  {
    id: 'cp-1',
    name: 'Annual Wellness Visit (AWV)',
    acuity: 'High',
    status: 'Enrolled',
    statusColor: 'var(--status-success)',
    startDate: '09/01/2024',
    endDate: '02/19/2024',
    lastUpdated: '02/19/2024',
    assignee: 'Aldo Richman',
    pcp: 'Dr. Robert Frost',
    progress: 0.75,
  },
  {
    id: 'cp-2',
    name: 'SNP Care Program (SNP)',
    acuity: null,
    status: 'Engaged',
    statusColor: 'var(--primary-300)',
    startDate: '03/15/2024',
    endDate: '02/19/2024',
    lastUpdated: '02/19/2024',
    assignee: 'Ivy Ralph',
    pcp: 'Dr. Robert Frost',
    progress: 0.6,
  },
  {
    id: 'cp-3',
    name: 'High Utilizers (HIU)',
    acuity: null,
    status: 'New',
    statusColor: 'var(--primary-300)',
    startDate: '03/15/2024',
    endDate: '02/19/2024',
    lastUpdated: '02/19/2024',
    assignee: 'Aldo Richman',
    pcp: 'Dr. John Doe',
    progress: 0,
  },
  {
    id: 'cp-4',
    name: 'Transitional Care Management (TCM)',
    acuity: null,
    status: 'Unable to Reach',
    statusColor: 'var(--status-error)',
    startDate: '03/15/2024',
    endDate: '02/19/2024',
    lastUpdated: '02/19/2024',
    assignee: 'Aldo Richman',
    pcp: 'Dr. Robert Frost',
    progress: 0.15,
  },
];

// ─── Per-patient scenarios for APE Manual Creation demo ─────────────────────
// Keyed by patientId. Each scenario overrides the default programs list AND
// pre-populates IPA/LOB defaults on the Create APE drawer so demos can walk
// through each acceptance-criteria path by switching patient IDs.
//
// Missing patients fall back to a "clean" default: no AWV, no APE, LOB
// pre-filled to Medicaid, IPA pre-filled to CFC.
export const APCM_PATIENT_SCENARIOS = {
  // p1 — Active AWV. Triggers AC-9 / AC-14 (AWV blocks APE).
  p1: {
    label: 'has active AWV',
    defaults: { ipa: 'CFC', lob: 'medicaid' },
    programs: [
      { id: 'cp-p1-awv', name: 'Annual Wellness Visit (AWV)', acuity: 'High', status: 'Enrolled',
        statusColor: 'var(--status-success)', startDate: '09/01/2024', endDate: '02/19/2024',
        lastUpdated: '02/19/2024', assignee: 'Aldo Richman', pcp: 'Dr. Robert Frost', progress: 0.75 },
      { id: 'cp-p1-snp', name: 'SNP Care Program (SNP)', acuity: null, status: 'Engaged',
        statusColor: 'var(--primary-300)', startDate: '03/15/2024', endDate: '02/19/2024',
        lastUpdated: '02/19/2024', assignee: 'Ivy Ralph', pcp: 'Dr. Robert Frost', progress: 0.6 },
    ],
  },

  // p2 — Already has an active APE for MY 2026. Triggers AC-10 / AC-15
  // (same-year duplicate block).
  p2: {
    label: 'has existing APE for 2026',
    defaults: { ipa: 'CFC', lob: 'medicaid' },
    programs: [
      { id: 'cp-p2-ape', name: 'Annual Physical Exam (APE’26)', acuity: null, status: 'Enrolled',
        statusColor: 'var(--status-success)', startDate: '01/15/2026', endDate: '',
        lastUpdated: '01/15/2026', assignee: 'Aldo Richman', pcp: 'Dr. John Doe', progress: 0.3,
        measurementYear: '2026', lob: 'Medicaid', ipa: 'CFC', apeType: 'Subsequent APE' },
    ],
  },

  // p3 — Patient's LOB is Medicare on file. Triggers AC-6 (Medicare-guidance
  // error). No AWV → the drawer opens cleanly, error surfaces on Create.
  p3: {
    label: 'LOB = Medicare',
    defaults: { ipa: 'Astrana', lob: 'medicare' },
    programs: [
      { id: 'cp-p3-hiu', name: 'High Utilizers (HIU)', acuity: null, status: 'New',
        statusColor: 'var(--primary-300)', startDate: '03/15/2024', endDate: '',
        lastUpdated: '03/15/2024', assignee: 'Aldo Richman', pcp: 'Dr. John Doe', progress: 0 },
    ],
  },

  // p4 — Clean positive path (TC-1): no AWV, no APE, Medicaid pre-filled.
  p4: {
    label: 'clean — Medicaid',
    defaults: { ipa: 'CFC', lob: 'medicaid' },
    programs: [
      { id: 'cp-p4-tcm', name: 'Transitional Care Management (TCM)', acuity: null, status: 'Enrolled',
        statusColor: 'var(--status-success)', startDate: '02/01/2026', endDate: '',
        lastUpdated: '02/01/2026', assignee: 'Ivy Ralph', pcp: 'Dr. John Doe', progress: 0.5 },
    ],
  },

  // p5 — Clean positive path (TC-2): no AWV, Commercial LOB, different IPA.
  p5: {
    label: 'clean — Commercial',
    defaults: { ipa: 'Astrana', lob: 'commercial' },
    programs: [],
  },
};

// Default programs shown for any patient NOT in the scenario map above.
// Intentionally excludes AWV so APE creation is unblocked out of the box —
// AWV-block behavior is still demonstrable via p1. Provides realistic
// context (SNP + HIU + TCM) without gating the positive path.
const DEFAULT_PROGRAMS = CARE_PROGRAMS_MOCK.filter(
  p => !/awv|annual wellness visit/i.test(p.name)
);

// Look up the initial programs list for a patient. Scenario patients get the
// curated overlay above; every other patient falls through to DEFAULT_PROGRAMS
// (no AWV → APE create works without a scenario override).
export function programsForPatient(patientId) {
  const scenario = APCM_PATIENT_SCENARIOS[patientId];
  if (scenario) return scenario.programs;
  return DEFAULT_PROGRAMS;
}

// Look up the APE drawer defaults (IPA/LOB) for a patient. Falls back to a
// sensible baseline so untouched patients still get a demo-friendly pre-fill.
export function apcmDefaultsForPatient(patientId) {
  return APCM_PATIENT_SCENARIOS[patientId]?.defaults ?? { ipa: 'CFC', lob: 'medicaid' };
}

export const CP_SUB_TABS = ['All', 'New', 'Enrolled', 'Completed', 'Closed'];

export const CP_FILTERS = [
  { key: 'assignee', label: 'Assigned to' },
  { key: 'program', label: 'Care Program' },
  { key: 'status', label: 'Status' },
  { key: 'subStatus', label: 'Sub-Status' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
];

export const CM_FILTERS = [
  { label: 'Date' },
  { label: 'Assigned to' },
  { label: 'Status' },
  { label: 'Program', active: true, value: 'All' },
  { label: 'Action Type' },
  { label: 'Action Status' },
];

export const PROGRAM_STEPS_MOCK = [
  { id: 'step-1', name: 'Outreach', status: 'pending' },
  { id: 'step-2', name: 'Letters', status: 'completed', mandatory: true },
  {
    id: 'step-3', name: 'Program Directives', type: 'section', expanded: true,
    children: [
      { id: 'step-3a', name: 'Pre-visit', status: 'completed', mandatory: true },
      { id: 'step-3b', name: 'HRA', status: 'completed', hasAlert: true },
      { id: 'step-3c', name: 'BRCSI Assessment', status: 'completed' },
      { id: 'step-3d', name: 'SNP Assessment', status: 'completed', mandatory: true },
    ],
  },
  {
    id: 'step-4', name: 'Model of Care', type: 'section', expanded: true,
    children: [
      { id: 'step-4a', name: 'Care Plan', status: 'completed', mandatory: true },
    ],
  },
  { id: 'step-5', name: 'ICT Appointment', status: 'completed', mandatory: true },
  { id: 'step-6', name: 'Post Visit Checklist', status: 'completed', mandatory: true },
  { id: 'step-7', name: 'Open Care Gaps', status: 'pending' },
  { id: 'step-8', name: 'Medication Reconciliation', status: 'pending' },
  { id: 'step-9', name: 'Program Related Task', status: 'pending' },
  { id: 'step-10', name: 'Program Related Files', status: 'pending', mandatory: true },
  { id: 'step-11', name: 'Referral Review', status: 'pending', mandatory: true },
];

// CCM-specific step list. Distinct from PROGRAM_STEPS_MOCK because CCM's
// workflow centers on time-billed care management, not outreach + assessment
// like SNP. The Billing Review step carries `kind: 'billing'` so
// ProgramDetailView can swap in the CcmBillingReview content pane.
export const CCM_PROGRAM_STEPS = [
  { id: 'ccm-outreach', name: 'Outreach', status: 'pending' },
  {
    id: 'ccm-assess', name: 'Assess Patient', type: 'section', expanded: true,
    children: [
      { id: 'ccm-assess-overview', name: 'Overview', status: 'pending' },
      { id: 'ccm-assess-health', name: 'Health Management', status: 'pending' },
    ],
  },
  { id: 'ccm-med-review', name: 'Medication Review', status: 'pending' },
  { id: 'ccm-care-plan', name: 'Care Plan Details', status: 'pending' },
  { id: 'ccm-billing', name: 'Billing Review', kind: 'billing', status: 'pending', hasAlert: true },
];

// ─── Per-program step lists ────────────────────────────────────────────────
// Each care program (careProgramCatalog.js) has its own workflow. `mandatory`
// renders the red dot. Steps are matched to their content view by NAME in
// ProgramDetailView, so a step defined once (e.g. "Care Plan") renders the
// same view in every program that lists it. Step names not yet built render a
// neutral "coming soon" placeholder.
const AWV_STEPS = [
  { id: 'awv-docs', name: 'Program Documents' },
  { id: 'awv-letters', name: 'Letters' },
  { id: 'awv-outreach', name: 'Outreach', mandatory: true },
  {
    id: 'awv-directives', name: 'Program Directives', type: 'section', expanded: true,
    children: [
      { id: 'awv-previsit', name: 'Pre-Visit', mandatory: true },
      { id: 'awv-hra', name: 'HRA', mandatory: true },
      { id: 'awv-phq9', name: 'PHQ-9', mandatory: true },
      { id: 'awv-postvisit', name: 'Post-Visit', mandatory: true },
    ],
  },
  { id: 'awv-caregaps', name: 'Care Gaps' },
  { id: 'awv-diaggaps', name: 'Diagnosis Gaps', mandatory: true },
  { id: 'awv-appt', name: 'Appointment', mandatory: true },
  { id: 'awv-referral', name: 'Referral Review' },
  { id: 'awv-task', name: 'Program Related Task' },
];

const TOC_IP_STEPS = [
  { id: 'tocip-outreach', name: 'Outreach' },
  { id: 'tocip-docs', name: 'Program Documents' },
  { id: 'tocip-letters', name: 'Letters' },
  {
    id: 'tocip-directives', name: 'Program Directives', type: 'section', expanded: true,
    children: [
      { id: 'tocip-snapshot', name: 'Snapshot', mandatory: true },
      { id: 'tocip-postip', name: 'Post IP Assessment', mandatory: true },
      { id: 'tocip-postvisit', name: 'Post-Visit', mandatory: true },
    ],
  },
  { id: 'tocip-appt', name: 'Appointment', mandatory: true },
  { id: 'tocip-caregaps', name: 'Open Care Gaps' },
  { id: 'tocip-medreview', name: 'Medication Review' },
  { id: 'tocip-task', name: 'Program Related Task' },
  { id: 'tocip-referral', name: 'Referral Review' },
];

const TOC_ED_STEPS = [
  { id: 'toced-snapshot', name: 'Snapshot', mandatory: true },
  { id: 'toced-docs', name: 'Program Documents' },
  { id: 'toced-letters', name: 'Letters' },
  { id: 'toced-outreach', name: 'Outreach', mandatory: true },
  {
    id: 'toced-assess', name: 'Assessments', type: 'section', expanded: true,
    children: [
      { id: 'toced-posted', name: 'Post ED Assessment', mandatory: true },
      { id: 'toced-postvisit', name: 'Post-Visit', mandatory: true },
    ],
  },
  { id: 'toced-careplan', name: 'Care Plan' },
  { id: 'toced-caregaps', name: 'Open Care Gaps' },
  { id: 'toced-medreview', name: 'Medication Review' },
  { id: 'toced-task', name: 'Program Related Task' },
];

const DM_STEPS = [
  { id: 'dm-snapshot', name: 'Snapshot', mandatory: true },
  { id: 'dm-docs', name: 'Program Documents' },
  { id: 'dm-letters', name: 'Letters', mandatory: true },
  { id: 'dm-outreach', name: 'Outreach', mandatory: true },
  {
    id: 'dm-assess', name: 'Assessments', type: 'section', expanded: true,
    children: [
      { id: 'dm-chf', name: 'CHF Assessment' },
      { id: 'dm-copd', name: 'COPD Assessment' },
      { id: 'dm-kidney', name: 'Kidney Assessment' },
      { id: 'dm-postvisit', name: 'Post-Visit', mandatory: true },
    ],
  },
  { id: 'dm-careplan', name: 'Care Plan' },
  { id: 'dm-caregaps', name: 'Open Care Gaps' },
  { id: 'dm-task', name: 'Program Related Task' },
];

const HICM_STEPS = [
  { id: 'hicm-snapshot', name: 'Snapshot', mandatory: true },
  { id: 'hicm-docs', name: 'Program Documents' },
  { id: 'hicm-letters', name: 'Letters', mandatory: true },
  { id: 'hicm-outreach', name: 'Outreach', mandatory: true },
  {
    id: 'hicm-assess', name: 'Assessments', type: 'section', expanded: true,
    children: [
      { id: 'hicm-assessment', name: 'HICM Assessment', mandatory: true },
      { id: 'hicm-erutil', name: 'High ER Utilizer Assessment', mandatory: true },
      { id: 'hicm-admitter', name: 'High Admitter Assessment', mandatory: true },
      { id: 'hicm-followup', name: 'FollowUp Assessment', mandatory: true },
      { id: 'hicm-grad', name: 'Graduation Checklist', mandatory: true },
      { id: 'hicm-postvisit', name: 'Post-Visit', mandatory: true },
    ],
  },
  { id: 'hicm-careplan', name: 'Care Plan' },
  { id: 'hicm-caregaps', name: 'Open Care Gaps' },
  { id: 'hicm-medreview', name: 'Medication Review' },
  { id: 'hicm-task', name: 'Program Related Task' },
];

const WLCP_STEPS = [
  { id: 'wlcp-outreach', name: 'Outreach', mandatory: true },
  {
    id: 'wlcp-assess', name: 'Assessment', type: 'section', expanded: true,
    children: [
      { id: 'wlcp-physcert', name: 'Physician Certification' },
      { id: 'wlcp-partq', name: 'Participation Questionnaire' },
      { id: 'wlcp-wlp', name: 'WLP Checklist', mandatory: true },
    ],
  },
  { id: 'wlcp-appt', name: 'Appointment' },
  { id: 'wlcp-medreview', name: 'Medication Review' },
  { id: 'wlcp-referral', name: 'Referral Review' },
  { id: 'wlcp-careplan', name: 'Care Plan', mandatory: true },
  { id: 'wlcp-docs', name: 'Documents' },
];

const CMP_STEPS = [
  { id: 'cmp-snapshot', name: 'Snapshot' },
  { id: 'cmp-docs', name: 'Program Documents' },
  { id: 'cmp-letters', name: 'Letters' },
  { id: 'cmp-outreach', name: 'Outreach', mandatory: true },
  { id: 'cmp-assess', name: 'Assessments', type: 'section', expanded: true, children: [] },
  { id: 'cmp-careplan', name: 'Care Plan' },
  { id: 'cmp-appt', name: 'ICT Appointment' },
  { id: 'cmp-caregaps', name: 'Open Care Gaps' },
  { id: 'cmp-medreview', name: 'Medication Review' },
  { id: 'cmp-task', name: 'Program Related Task' },
];

// APE's Figma only showed the (completed) Outreach step; the rest is a
// sensible annual-exam default until its full step list is provided.
const APE_STEPS = [
  { id: 'ape-outreach', name: 'Outreach', mandatory: true },
  { id: 'ape-docs', name: 'Program Documents' },
  { id: 'ape-letters', name: 'Letters' },
  { id: 'ape-appt', name: 'Appointment', mandatory: true },
  { id: 'ape-caregaps', name: 'Open Care Gaps' },
  { id: 'ape-task', name: 'Program Related Task' },
];

// Program code → step list. SNP is the canonical PROGRAM_STEPS_MOCK.
export const PROGRAM_STEPS = {
  SNP: PROGRAM_STEPS_MOCK,
  AWV: AWV_STEPS,
  'TOC IP': TOC_IP_STEPS,
  'TOC ED': TOC_ED_STEPS,
  DM: DM_STEPS,
  HICM: HICM_STEPS,
  WLCP: WLCP_STEPS,
  CMP: CMP_STEPS,
  APE: APE_STEPS,
  CCM: CCM_PROGRAM_STEPS,
};

// ─── Pre-visit step content, keyed by program type ─────────────────────────
// The Pre-visit step renders different sections depending on the program:
//   • SNP (default) → General Info (Trigger + Payer grid) + Care Team +
//     Pre-visit Assessment
//   • TOC IP / TOC ED, HIU, DM → General Info split into icon sub-sections
//     (bordered key/value tables) + Care Team
const CARE_TEAM_SNP = [
  { role: 'Coordinator', name: 'Delores Conn', initials: 'DC' },
  { role: 'Nurse', name: 'Robert Fox', initials: 'RF' },
  { role: 'Medical Records', name: 'Leigh Reynolds', initials: 'LR' },
];
const CARE_TEAM_FULL = [
  { role: 'Coordinator', name: 'Delores Conn', initials: 'DC' },
  { role: 'Nurse', name: 'Robert Fox', initials: 'RF' },
  { role: 'Nurse Practitioner', name: 'Lila Jones', initials: 'LJ' },
  { role: 'Medical Records', name: 'Leigh Reynolds', initials: 'LR' },
];

export const PRE_VISIT_MOCK = {
  snp: {
    variant: 'snp',
    general: {
      top: [
        { label: 'Trigger Type', value: 'Transfer' },
        { label: 'Trigger Date', value: '29/04/2024' },
        { label: 'Managed By HP', value: 'Yes' },
      ],
      payerTitle: 'Payer - LA Care',
      payerCols: [
        [
          { label: 'PPG Region Code', value: 'North Central (PPG-NC-002)' },
          { label: 'SNP ID', value: 'H1234-045' },
          { label: 'Beneficiary CMC CIN', value: 'A12345678' },
          { label: 'Beneficiary MBI', value: '1EG4-TE5-MK73' },
          { label: 'LA Care Effective Date', value: '05/14/2025' },
          { label: 'PPG Effective Date', value: '05/16/2025' },
          { label: 'Case Management Assignment', value: '05/17/2025' },
          { label: 'Current CM Assignment Date', value: '05/19/2025' },
          { label: 'Initial HRA', value: '05/16/2025' },
          { label: 'Latest HRA', value: '05/20/2025' },
          { label: 'Prior Year HRA', value: '05/16/2025' },
          { label: 'SNP Assessment Date', value: '05/19/2025' },
        ],
        [
          { label: 'Initial Care Plan Date', value: '08/07/2025' },
          { label: 'Care Plan Update Post Latest HRA', value: '07/18/2025' },
          { label: 'Latest TOC Discharge Date', value: '07/13/2025' },
          { label: 'Care plan Update after TOC Discharge', value: '07/03/2025' },
          { label: 'Latest Care Plan Date', value: '07/03/2025' },
          { label: 'Care Plan Type', value: 'Chronic Care Plan' },
          { label: 'Date ICP Shared to Member', value: '06/26/2025' },
          { label: 'Date ICP Shared to Provider', value: '06/23/2025' },
          { label: 'Initial ICT', value: '06/02/2025' },
          { label: 'Latest ICT', value: '05/21/2025' },
          { label: 'Last Outreach Date', value: '05/15/2025' },
        ],
      ],
    },
    careTeam: CARE_TEAM_SNP,
    showAddRole: false,
    assessment: [
      'Did you upload the HRA document?',
      'Did you share the Intro and Consent letter with patient?',
      'Did you take the consent from patient?',
    ],
  },

  toc: {
    variant: 'sectioned',
    sections: [
      {
        icon: 'solar:buildings-2-linear', title: 'Admission & Discharge Info',
        rows: [
          ['TOC Type', 'Hospital to Home'],
          ['Admission Date & Time', '08/04/2024, 12:30pm'],
          ['Discharge Date & Time', '08/06/2024, 12:30pm'],
          ['Length of Stay (LOS)', '4 Days'],
          ['Admit Class', 'Inpatient'],
          ['Facility', 'Hospital'],
          ['Discharge To', 'Home'],
          ['Admission Diagnosis', 'Acute Abdominal Pain'],
        ],
      },
      {
        icon: 'solar:danger-circle-linear', title: 'Risk & Acuity',
        rows: [
          ['Recent LACE Score', '9'],
          ['Recent Acuity Level', 'High'],
          ['Chronic Conditions', 'COPD, Type 2 Diabetes, Hypertension'],
        ],
      },
      {
        icon: 'solar:user-rounded-linear', title: 'DM/CCM Eligibility',
        rows: [
          ['Re-admission flag - - 30 days', 'No'],
          ['Active CCM Program Start Date', '08/04/2024'],
          ['Discharge Diagnosis Codes', 'J18.9, E11.9, I10'],
        ],
      },
    ],
    careTeam: CARE_TEAM_FULL,
    showAddRole: true,
  },

  hiu: {
    variant: 'sectioned',
    sections: [
      {
        icon: 'solar:buildings-2-linear', title: 'Admission & Discharge Info',
        rows: [
          ['Program Assignment Date', '01/09/2025'],
          ['Recent Discharge Date', '01/09/2025'],
          ['Re-admission', 'Yes'],
          ['Risk Stratification Level', 'High (Source : Population Group)'],
        ],
      },
      {
        icon: 'solar:danger-circle-linear', title: 'Risk & Acuity',
        rows: [
          ['Recent LACE Score', '—'],
          ['Recent Acuity Level', 'Low-risk'],
          ['Chronic Conditions', "Hypertension, Parkinson's Disease, Kidney Disease"],
        ],
      },
      {
        icon: 'solar:clipboard-check-linear', title: 'Program Milestones',
        rows: [
          ['1st Outreach Due', '14'],
          ['Engaged On (1st Outreach Complete)', '01/13/2025'],
          ['Assessment Due', '01/17/2025'],
          ['Enrolled On (Assessment Done)', '01/17/2025'],
          ['Next Follow-Up', '05/19/2025'],
          ['No. of Follow Ups Scheduled', '2'],
        ],
      },
      {
        icon: 'solar:bed-linear', title: 'Utilizations',
        rows: [
          ['Before Enrolled Admits 6 mon-1 year prior', '2'],
          ['Before Enrolled Admits 4-6 month prior', '0'],
          ['Before Enrolled Admits 0-3 months prior', '1'],
          ['After Enrolled Admits 0-3 mon', '3'],
          ['After Enrolled Admits 4-6 months', '4'],
          ['After Enrolled Admits 7 mon-1 year', '5'],
          ['READMITS', '3'],
        ],
      },
    ],
    careTeam: CARE_TEAM_FULL,
    showAddRole: true,
  },

  dm: {
    variant: 'sectioned',
    sections: [
      {
        icon: 'solar:buildings-2-linear', title: 'Admission & Discharge Info',
        rows: [
          ['Program Assignment Date', '01/09/2025'],
          ['DM Type', 'CKD'],
          ['Recent Discharge Date', '01/09/2025'],
          ['Recent Discharge Diagnosis', 'N18.4- CKD, Stage 4 (Severe)'],
        ],
      },
      {
        icon: 'solar:danger-circle-linear', title: 'Risk & Acuity',
        rows: [
          ['Recent LACE Score', '14'],
          ['Recent Acuity Level', 'Low-risk'],
          ['Chronic Conditions', "Hypertension, Parkinson's Disease, Kidney Disease"],
        ],
      },
      {
        icon: 'solar:clipboard-check-linear', title: 'Program Milestones',
        rows: [
          ['1st Outreach Due', '14'],
          ['Engaged On (1st Outreach Complete)', '01/13/2025'],
          ['Assessment Due', '01/17/2025'],
          ['Enrolled On (Assessment Done)', '01/17/2025'],
          ['Next Follow-Up', '05/19/2025'],
          ['No. of Follow Ups Scheduled', '2'],
        ],
      },
    ],
    careTeam: CARE_TEAM_FULL,
    showAddRole: true,
  },
};

// Map a program code (SNP, TOC IP, TOC ED, HIU, DM, …) to its Pre-visit config.
export function preVisitForProgram(code) {
  const c = (code || '').toUpperCase();
  if (c === 'TOC IP' || c === 'TOC ED') return PRE_VISIT_MOCK.toc;
  if (c === 'HIU') return PRE_VISIT_MOCK.hiu;
  if (c === 'DM') return PRE_VISIT_MOCK.dm;
  return PRE_VISIT_MOCK.snp;
}

export const PROGRAM_LETTERS_MOCK = [
  { id: 'l-1', fileName: 'Intro or Welcome Letter - Patient', fileType: 'Letter', sentVia: ['Email', 'SMS'], lastSent: '07/02/2025', sentBy: 'Mark Emard' },
  { id: 'l-2', fileName: 'Consent letter - Patient', fileType: 'Letter', sentVia: ['Email'], lastSent: '07/01/2025', sentBy: 'Faye Romaguera' },
  { id: 'l-3', fileName: 'ICT Invite - Member', fileType: 'Form', sentVia: ['Email'], lastSent: '06/29/2025', sentBy: 'Melinda Effertz' },
  { id: 'l-4', fileName: 'ICT Invite - PCP', fileType: 'Letter', sentVia: ['SMS'], lastSent: '06/15/2025', sentBy: 'Rachael Jast' },
  { id: 'l-5', fileName: 'ICP Letter - Member', fileType: 'Letter', sentVia: ['Email'], lastSent: '06/14/2025', sentBy: 'Lewis Bogisich' },
  { id: 'l-6', fileName: 'ICP Letter - Provider', fileType: 'Letter', sentVia: ['Mailroom'], lastSent: '05/30/2025', sentBy: 'Domingo Toy' },
  { id: 'l-7', fileName: 'UTR Letter', fileType: 'Letter', sentVia: ['Email'], lastSent: '05/23/2025', sentBy: 'Ernestine Leffler' },
  { id: 'l-8', fileName: 'Member Flyers', fileType: 'Flyer', sentVia: ['Email'], lastSent: '05/18/2025', sentBy: 'Priscilla Romaguera' },
];
