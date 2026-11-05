// Shared clinical reference: Visit Type → Place of Service + specialty-
// appropriate rendering-provider pool. Kept in one place so the DiagPanel
// New-Diagnosis-Gap editor, the worklist normalizer, and any future intake
// surface all agree on POS billing rules (Telehealth ≠ Office, ER ≠ Home,
// etc.).

// POS descs mirror the short names in `data/posCodes.js` (the canonical source
// of truth). Keeping them in sync means the worklist POS cell and the DOS
// Select dropdown always render the same label for a given code.
export const POS_BY_VT = {
  'AWV - Annual Wellness Visit':               { code: '11', desc: 'Office' },
  'IPPE - Initial Preventive Physical Exam':   { code: '11', desc: 'Office' },
  'Annual Physical Exam':                      { code: '11', desc: 'Office' },
  'New Patient Office Visit':                  { code: '11', desc: 'Office' },
  'Established Patient Office Visit':          { code: '11', desc: 'Office' },
  'Telehealth Visit':                          { code: '02', desc: 'Telehealth (Other)' },
  'Specialist Visit / Consult':                { code: '22', desc: 'On-Campus OP Hospital' },
  'ER Visit':                                  { code: '23', desc: 'ER: Hospital' },
  'Inpatient Visit / Admission':               { code: '21', desc: 'Inpatient Hospital' },
  'Observation Visit':                         { code: '22', desc: 'On-Campus OP Hospital' },
  'Skilled Nursing Facility Visit':            { code: '31', desc: 'SNF' },
  'Home Visit':                                { code: '12', desc: 'Home' },
  'Hospice Visit':                             { code: '34', desc: 'Hospice' },
  'Lab/Imaging Order':                         { code: '81', desc: 'Independent Lab' },
  'Transitional Care Management (TCM) Visit':  { code: '11', desc: 'Office' },
  'Chronic Care Management (CCM)':             { code: '11', desc: 'Office' },
};

export const PROVIDER_POOL_BY_VT = {
  'AWV - Annual Wellness Visit':               ['Dr. Sarah Chen (Family Medicine)',   'Dr. Priya Ramesh (Internal Medicine)',   'Dr. James Okafor (Family Medicine)'],
  'IPPE - Initial Preventive Physical Exam':   ['Dr. Priya Ramesh (Internal Medicine)','Dr. Sarah Chen (Family Medicine)',       'Dr. Nadia Rahman (Family Medicine)'],
  'Annual Physical Exam':                      ['Dr. James Okafor (Family Medicine)', 'Dr. Nadia Rahman (Family Medicine)',     'Dr. Priya Ramesh (Internal Medicine)'],
  'New Patient Office Visit':                  ['Dr. Sarah Chen (Family Medicine)',   'Dr. Nadia Rahman (Family Medicine)'],
  'Established Patient Office Visit':          ['Dr. Priya Ramesh (Internal Medicine)','Dr. James Okafor (Family Medicine)'],
  'Telehealth Visit':                          ['Dr. Elena Vasquez (Internal Medicine)','Dr. Sarah Chen (Family Medicine)'],
  'Specialist Visit / Consult':                ['Dr. Rohit Cheng (Cardiology)',       'Dr. Anita Fielding (Endocrinology)',     'Dr. Miguel Alarcón (Nephrology)'],
  'ER Visit':                                  ['Dr. Marcus Kim (Emergency Medicine)','Dr. Elena Morris (Emergency Medicine)',   'Dr. Tomás Herrera (Emergency Medicine)'],
  'Inpatient Visit / Admission':               ['Dr. Rachel Osei (Hospitalist)',      'Dr. David Park (Hospitalist)'],
  'Observation Visit':                         ['Dr. Rachel Osei (Hospitalist)',      'Dr. David Park (Hospitalist)'],
  'Skilled Nursing Facility Visit':            ['Dr. Karen Mills (Geriatrics)',       'Dr. Robert Ng (Geriatrics)'],
  'Home Visit':                                ['Dr. Indigo Bolen (Home Health)',     'Dr. Aisha Mehta (Home Health)'],
  'Hospice Visit':                             ['Dr. Amit Gupta (Palliative Care)',   'Dr. Yasmin Sadiq (Hospice/Palliative)'],
  'Lab/Imaging Order':                         ['Dr. Priya Ramesh (Internal Medicine)','Dr. James Okafor (Family Medicine)'],
  'Transitional Care Management (TCM) Visit':  ['Dr. Sarah Chen (Family Medicine)',   'Dr. Priya Ramesh (Internal Medicine)'],
  'Chronic Care Management (CCM)':             ['Dr. Sarah Chen (Family Medicine)',   'Dr. Nadia Rahman (Family Medicine)'],
};

export const VISIT_TYPES = Object.keys(POS_BY_VT);
