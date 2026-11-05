// Reference catalog of every care-program type a user can enroll a patient
// into. This is the single source of truth for the "New Program" dropdown,
// add new program types here and they show up everywhere automatically.
// `code` is the short badge/abbreviation, `name` is the full display name.
// Per-program step lists live in PROGRAM_STEPS (programActivityMock.js), keyed
// by `code`.
export const CARE_PROGRAM_CATALOG = [
  { code: 'SNP', name: 'Special Needs Plan' },
  { code: 'AWV', name: 'Annual Wellness Visit' },
  { code: 'TOC IP', name: 'Transition of Care - IP' },
  { code: 'TOC ED', name: 'Transition of Care - ED' },
  { code: 'DM', name: 'Disease Management' },
  { code: 'HICM', name: 'High Intensity Care Management' },
  { code: 'WLCP', name: 'Weight Loss Care Program' },
  { code: 'CMP', name: 'Care Management Program' },
  { code: 'APE', name: 'Annual Physical Exam' },
  { code: 'PHARM', name: 'Pharmacy Program' },
  { code: 'HH', name: 'Home Health' },
];
