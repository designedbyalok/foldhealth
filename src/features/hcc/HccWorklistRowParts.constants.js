export const RISK_VARIANT = { High: 'danger', Medium: 'warning', Low: 'success' };

// Short display label for the Visit Type column, keeps the underlying value
// unchanged (filters + data still match the canonical name) while the cell
// renders a compact form so more columns fit on screen. Falls back to the
// canonical name for anything not in the map.
export const VT_SHORT = {
  'AWV - Annual Wellness Visit':               'AWV',
  'IPPE - Initial Preventive Physical Exam':   'IPPE',
  'Annual Physical Exam':                       'APE',
  'New Patient Office Visit':                   'New Patient',
  'Established Patient Office Visit':           'Est. Patient',
  'Telehealth Visit':                           'Telehealth',
  'Specialist Visit / Consult':                 'Specialist',
  'ER Visit':                                   'ER',
  'Inpatient Visit / Admission':                'Inpatient',
  'Observation Visit':                          'Observation',
  'Skilled Nursing Facility Visit':             'SNF',
  'Home Visit':                                 'Home',
  'Hospice Visit':                              'Hospice',
  'Lab/Imaging Order':                          'Lab/Imaging',
  'Transitional Care Management (TCM) Visit':   'TCM',
  'Chronic Care Management (CCM)':              'CCM',
};

export const PROGRESS_TERMINAL = new Set(['Completed', 'Billing Ready']);
export const PROGRESS_ACTIVE = new Set(['In Progress', 'New', 'Records Requested', 'Record Received', 'Rebuttal', 'Insufficient', 'Returned']);

// Each role's default "not started" status: used when a cell carries a
// status outside the coding workflow (e.g. AWV rows). Support's pending state
// is "Action Needed" (Awaiting); the coding roles start at "New".
export const ROLE_DEFAULT_STATUS = { support: 'Awaiting', coder: 'New', reviewer: 'New', reviewer2: 'New' };

export const ROLE_OFFSET = { sup: 0, cdr: 7, r1: 14, r2: 21 };

// DOS-level columns (Figma 4680:138476), their value varies per visit
// within a record's dos_list. In the collapsed row only the primary
// (entry 0) shows; expanding reveals every entry stacked inside a
// bordered box spanning these columns. Every other column is a flat,
// record-level fact rendered once (top-aligned).
export const DOS_LEVEL_COLS = new Set(['dos', 'open', 'vt', 'rp', 'pos']);
