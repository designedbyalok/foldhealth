export const CARE_GAP_SECTIONS = [
  {
    title: 'Preventive Care',
    items: [
      { id: 'cg1', title: 'Annual Wellness Visit', status: 'Open', diagnosis: 'Diabetes, Hypertension', urgent: true },
      { id: 'cg2', title: 'Mammography Screening', status: 'Open', diagnosis: 'Breast Cancer Risk', urgent: false },
      { id: 'cg3', title: 'Colorectal Cancer Screening', status: 'Closed', diagnosis: '', urgent: false },
    ],
  },
  {
    title: 'Chronic Care Management',
    items: [
      { id: 'cg4', title: 'Diabetes HbA1c Testing', status: 'Open', diagnosis: 'Type 2 Diabetes', urgent: true },
      { id: 'cg5', title: 'Blood Pressure Control', status: 'Open', diagnosis: 'Hypertension', urgent: false },
    ],
  },
];

export const CARE_GAP_SECTIONS_EXTENDED = [
  {
    title: 'Compliance Measures',
    items: [
      { id: 'cm1', title: 'EED - Eye Exam for Patients With Diabetes', status: 'Open', diagnosis: '', urgent: false },
      { id: 'cm2', title: 'ABA - Adult BMI Assessment', status: 'Open', diagnosis: '', urgent: false },
      { id: 'cm3', title: 'AWV - Annual Wellness Visit', status: 'Open', diagnosis: '', urgent: false },
    ],
  },
  {
    title: 'Labs',
    items: [
      { id: 'lb1', title: 'GSD - Glycemic Screening and Control in Patients with Diabetes', status: 'Open', diagnosis: '', urgent: false },
      { id: 'lb2', title: 'SPC - Statin Therapy for Patients with Cardiovascular Disease', status: 'Open', diagnosis: '', urgent: false },
      { id: 'lb3', title: 'COL - Colorectal Cancer Screening', status: 'Open', diagnosis: '', urgent: false },
    ],
  },
  {
    title: 'Referrals',
    items: [
      { id: 'rf1', title: 'BCS - Breast Cancer Screening', status: 'Open', diagnosis: '', urgent: false },
      { id: 'rf2', title: 'Cardiology Consult', status: 'Open', diagnosis: '', urgent: false },
    ],
  },
];

export const ALERT_ITEMS = [
  { id: 'al1', title: 'Losartan 50mg PO qD Needs Refill', category: 'Med Refill', time: '4h ago', status: 'Open', severity: 'error' },
  { id: 'al2', title: 'Opioid Treatment Agreement Overdue (last 14 mos ago)', category: 'Overdue Lab Test', time: '1d ago', status: 'Open', severity: 'error' },
  { id: 'al3', title: 'Elevated BP (> 140/90)', category: 'Overdue Lab Test', time: '1d ago', status: 'Open', severity: 'warning' },
];

export const DIAGNOSIS_GAP_ITEMS = [
  { id: 'dg1', title: 'HCC 18 - Diabetes w/ Complications', status: 'Open', lastDocumented: '06/07/2025', icdCount: 3 },
  { id: 'dg2', title: 'HCC 48 - Coagulation Defects and Other Specified Hematological Disorders', status: 'Open', lastDocumented: '06/07/2025', icdCount: 1 },
];

// Tabs shown on the P360 (full page) left-panel gaps strip. Tasks and
// Profile are intentionally excluded here: they live on the right-panel
// tab bar in P360 so the same nav isn't duplicated on both sides.
export const CARE_GAP_TABS = ['Gaps(11)', 'PAMI/Hx', 'Vitals/Labs', 'Comms', 'Outreach', 'Summary', 'CRM'];

// Tabs shown inside the QuickView drawer, which is the *only* surface for
// patient info on that entry point (no right panel). Tasks and Profile stay
// here so a user can act on the patient without leaving the drawer.
export const CARE_GAP_TABS_DRAWER = ['Gaps(11)', 'PAMI/Hx', 'Vitals/Labs', 'Comms', 'Outreach', 'Summary', 'Tasks', 'CRM', 'Profile'];
