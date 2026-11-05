// AWV (Annual Wellness Visit) worklist mock data. Mirrors the shape used
// by the HCC worklist (avatar initials + name + memberId + clinical
// vitals: decile / advillness / frailty / risk level) plus AWV-specific
// program tracking (status, due date, last AWV, NP appointment).

const C = {
  error:   'var(--status-error)',
  warning: 'var(--status-warning)',
  blue:    'var(--status-info)',
  success: 'var(--status-success)',
  grey200: 'var(--neutral-200)',
  grey300: 'var(--neutral-300)',
};

export const AWV_COLUMNS = [
  { k: 'progSubStatus', lb: 'Program Sub Status',   w: 160 },
  { k: 'progName',      lb: 'Program Name',         w: 170 },
  { k: 'due',           lb: 'Due Date',             w: 140 },
  { k: 'outreach',      lb: 'Outreach',             w: 150 },
  { k: 'assignee',      lb: 'Assignee',             w: 170 },
  { k: 'np',            lb: 'NP Appointment Date',  w: 170 },
  { k: 'lastAwv',       lb: 'Last Annual Visit Date', w: 180 },
  { k: 'ad',            lb: 'AdvIllness',           w: 100 },
  { k: 'fr',            lb: 'Frailty',              w: 90 },
  { k: 'ri',            lb: 'Risk IQ',              w: 110 },
  { k: 'dec',           lb: 'Decile',               w: 80 },
  { k: 'task',          lb: 'Tasks',                w: 90 },
];

// Program sub status: shapes the colored pill.
export const AWV_STATUS = {
  'New':                          { color: C.blue,    bg: 'rgba(20,94,204,0.08)'  },
  'Open':                         { color: C.blue,    bg: 'rgba(20,94,204,0.08)'  },
  'Unable to Reach':              { color: C.grey300, bg: 'rgba(102,112,133,0.1)' },
  'Engaged':                      { color: C.success, bg: 'rgba(0,155,83,0.08)'   },
  'Attempted':                    { color: C.warning, bg: 'rgba(217,165,11,0.10)' },
  'Engaged - Requires Follow Up': { color: C.warning, bg: 'rgba(217,165,11,0.10)' },
};

// Risk-level pill colors (Low / Medium / High).
export const RISK_COLOR = {
  Low:    { color: C.success, bg: 'rgba(0,155,83,0.08)'   },
  Medium: { color: C.warning, bg: 'rgba(217,165,11,0.10)' },
  High:   { color: C.error,   bg: 'rgba(215,40,37,0.08)'  },
};

// 25 distinct members for AWV exclusively.
export const AWV_MEMBERS = [
  { id: 'awv-1',  in: 'JS', name: 'John Smith',       memberId: '11037', g: 'M', age: '68y 2m', progSubStatus: 'Open', progName: 'AWV', due: '08/20/2026', dueLabel: 'Due in 5D',    dueCol: C.blue,    outreach: 2, lastOutreach: '07/22/2026', assignee: 'C. Adams',     assigneeIn: 'CA', npAppt: null,         lastAwv: '08/12/2025', dec: '8',  ad: '3', fr: '2', ri: 'High',   task: 2 },
  { id: 'awv-2',  in: 'MJ', name: 'Mary Johnson',     memberId: '11049', g: 'F', age: '71y 5m', progSubStatus: 'Attempted', progName: 'AWV', due: '07/25/2026', dueLabel: 'Overdue: 5D',  dueCol: C.error,   outreach: 4, lastOutreach: '07/28/2026', assignee: 'D. Baker',     assigneeIn: 'DB', npAppt: '08/22/2026', lastAwv: '06/04/2025', dec: '7',  ad: '4', fr: '3', ri: 'Medium', task: 1 },
  { id: 'awv-3',  in: 'WD', name: 'William Davis',    memberId: '10029', g: 'M', age: '65y 9m', progSubStatus: 'Engaged',         progName: 'APE', due: '09/05/2026', dueLabel: 'Due in 21D',   dueCol: C.grey200, outreach: 1, lastOutreach: '07/14/2026', assignee: 'E. Clarke',    assigneeIn: 'EC', npAppt: '09/02/2026', lastAwv: '09/18/2024', dec: '10', ad: '6', fr: '4', ri: 'High',   task: 3 },
  { id: 'awv-4',  in: 'LM', name: 'Linda Martinez',   memberId: '10988', g: 'F', age: '74y 1m', progSubStatus: 'Engaged - Requires Follow Up',       progName: 'AWV', due: '08/10/2026', dueLabel: 'Due Today',    dueCol: C.warning, outreach: 3, lastOutreach: '08/09/2026', assignee: 'F. Davies',    assigneeIn: 'FD', npAppt: '08/10/2026', lastAwv: '07/20/2025', dec: '9',  ad: '5', fr: '5', ri: 'High',   task: 2 },
  { id: 'awv-5',  in: 'JW', name: 'James Wilson',     memberId: '11065', g: 'M', age: '69y 4m', progSubStatus: 'Unable to Reach',         progName: 'APE', due: '06/30/2026', dueLabel: 'Unable to Reach',    dueCol: C.success, outreach: 5, lastOutreach: '06/25/2026', assignee: 'G. Evans',     assigneeIn: 'GE', npAppt: '06/30/2026', lastAwv: '06/30/2026', dec: '8',  ad: '3', fr: '3', ri: 'Medium', task: 0 },
  { id: 'awv-6',  in: 'PT', name: 'Patricia Taylor',  memberId: '11098', g: 'F', age: '62y 7m', progSubStatus: 'New',               progName: 'AWV', due: '09/15/2026', dueLabel: 'Due in 30D',   dueCol: C.grey200, outreach: 0, lastOutreach: null,         assignee: 'C. Adams',     assigneeIn: 'CA', npAppt: null,         lastAwv: '07/30/2025', dec: '5',  ad: '1', fr: '1', ri: 'Low',    task: 1 },
  { id: 'awv-7',  in: 'RA', name: 'Robert Anderson',  memberId: '11076', g: 'M', age: '77y 0m', progSubStatus: 'Open', progName: 'APE', due: '08/14/2026', dueLabel: 'Due in 4D',    dueCol: C.blue,    outreach: 2, lastOutreach: '08/05/2026', assignee: 'H. Foster',    assigneeIn: 'HF', npAppt: null,         lastAwv: '08/01/2025', dec: '6',  ad: '2', fr: '1', ri: 'Low',    task: 1 },
  { id: 'awv-8',  in: 'JT', name: 'Jennifer Thomas',  memberId: '11061', g: 'F', age: '61y 3m', progSubStatus: 'Attempted', progName: 'AWV', due: '08/20/2026', dueLabel: 'Due in 10D',  dueCol: C.warning, outreach: 4, lastOutreach: '07/28/2026', assignee: 'I. Garcia',    assigneeIn: 'IG', npAppt: null,         lastAwv: '01/20/2024', dec: '9',  ad: '4', fr: '2', ri: 'Medium', task: 2 },
  { id: 'awv-9',  in: 'EW', name: 'Elizabeth White',  memberId: '11110', g: 'F', age: '64y 6m', progSubStatus: 'New',               progName: 'AWV', due: '10/01/2026', dueLabel: 'Due in 45D',   dueCol: C.grey200, outreach: 0, lastOutreach: null,         assignee: null,           assigneeIn: null, npAppt: null,         lastAwv: '06/15/2025', dec: '4',  ad: '1', fr: '1', ri: 'Low',    task: 0 },
  { id: 'awv-10', in: 'BH', name: 'Barbara Harris',   memberId: '10968', g: 'F', age: '70y 8m', progSubStatus: 'Open', progName: 'AWV', due: '09/05/2026', dueLabel: 'Due in 22D',   dueCol: C.grey200, outreach: 1, lastOutreach: '07/30/2026', assignee: 'J. Hughes',    assigneeIn: 'JH', npAppt: null,         lastAwv: '09/02/2025', dec: '6',  ad: '2', fr: '2', ri: 'Medium', task: 1 },
  { id: 'awv-11', in: 'RM', name: 'Richard Martin',   memberId: '10993', g: 'M', age: '76y 2m', progSubStatus: 'Unable to Reach',          progName: 'APE', due: '07/15/2026', dueLabel: 'Unable to Reach',     dueCol: C.error,   outreach: 6, lastOutreach: '07/14/2026', assignee: 'D. Baker',     assigneeIn: 'DB', npAppt: null,         lastAwv: '12/12/2024', dec: '8',  ad: '4', fr: '4', ri: 'High',   task: 2 },
  { id: 'awv-12', in: 'SM', name: 'Susan Moore',      memberId: '11173', g: 'F', age: '63y 4m', progSubStatus: 'Engaged',         progName: 'AWV', due: '08/28/2026', dueLabel: 'Due in 18D',   dueCol: C.warning, outreach: 2, lastOutreach: '08/01/2026', assignee: 'C. Adams',     assigneeIn: 'CA', npAppt: '08/28/2026', lastAwv: '08/15/2025', dec: '7',  ad: '3', fr: '3', ri: 'Medium', task: 1 },
  { id: 'awv-13', in: 'CJ', name: 'Charles Jackson',  memberId: '11085', g: 'M', age: '72y 9m', progSubStatus: 'Open', progName: 'APE', due: '08/12/2026', dueLabel: 'Due in 2D',    dueCol: C.warning, outreach: 1, lastOutreach: '08/08/2026', assignee: 'E. Clarke',    assigneeIn: 'EC', npAppt: null,         lastAwv: '07/22/2025', dec: '8',  ad: '4', fr: '3', ri: 'Medium', task: 2 },
  { id: 'awv-14', in: 'JL', name: 'Joseph Lee',       memberId: '10955', g: 'M', age: '60y 5m', progSubStatus: 'Unable to Reach',         progName: 'APE', due: '05/05/2026', dueLabel: 'Unable to Reach',    dueCol: C.success, outreach: 3, lastOutreach: '05/04/2026', assignee: 'F. Davies',    assigneeIn: 'FD', npAppt: '05/05/2026', lastAwv: '05/05/2026', dec: '6',  ad: '2', fr: '2', ri: 'Low',    task: 0 },
  { id: 'awv-15', in: 'MP', name: 'Margaret Perez',   memberId: '11129', g: 'F', age: '67y 1m', progSubStatus: 'Attempted', progName: 'AWV', due: '09/20/2026', dueLabel: 'Due in 40D',   dueCol: C.grey200, outreach: 4, lastOutreach: '08/01/2026', assignee: 'J. Hughes',    assigneeIn: 'JH', npAppt: null,         lastAwv: '10/12/2024', dec: '9',  ad: '5', fr: '4', ri: 'High',   task: 3 },
  { id: 'awv-16', in: 'TT', name: 'Thomas Thompson',  memberId: '11175', g: 'M', age: '59y 11m',progSubStatus: 'New',               progName: 'AWV', due: '11/05/2026', dueLabel: 'Due in 80D',   dueCol: C.grey200, outreach: 0, lastOutreach: null,         assignee: null,           assigneeIn: null, npAppt: null,         lastAwv: '08/10/2025', dec: '3',  ad: '1', fr: '1', ri: 'Low',    task: 0 },
  { id: 'awv-17', in: 'SW', name: 'Sarah White',      memberId: '11092', g: 'F', age: '66y 3m', progSubStatus: 'Engaged - Requires Follow Up',       progName: 'AWV', due: '08/11/2026', dueLabel: 'Due Today',    dueCol: C.warning, outreach: 3, lastOutreach: '08/10/2026', assignee: 'E. Clarke',    assigneeIn: 'EC', npAppt: '08/11/2026', lastAwv: '09/28/2025', dec: '9',  ad: '5', fr: '4', ri: 'High',   task: 1 },
  { id: 'awv-18', in: 'CH', name: 'Christopher Hall', memberId: '11174', g: 'M', age: '79y 2m', progSubStatus: 'Open', progName: 'AWV', due: '07/25/2026', dueLabel: 'Overdue: 2w',  dueCol: C.error,   outreach: 7, lastOutreach: '07/24/2026', assignee: 'D. Baker',     assigneeIn: 'DB', npAppt: null,         lastAwv: '01/22/2025', dec: '10', ad: '7', fr: '5', ri: 'High',   task: 4 },
  { id: 'awv-19', in: 'KA', name: 'Karen Allen',      memberId: '11188', g: 'F', age: '73y 6m', progSubStatus: 'Engaged',         progName: 'AWV', due: '09/10/2026', dueLabel: 'Due in 30D',   dueCol: C.grey200, outreach: 1, lastOutreach: '08/05/2026', assignee: 'G. Evans',     assigneeIn: 'GE', npAppt: '09/10/2026', lastAwv: '02/01/2025', dec: '9',  ad: '6', fr: '4', ri: 'High',   task: 2 },
  { id: 'awv-20', in: 'DY', name: 'Daniel Young',     memberId: '10958', g: 'M', age: '68y 11m',progSubStatus: 'Open', progName: 'APE', due: '08/16/2026', dueLabel: 'Due in 6D',    dueCol: C.blue,    outreach: 2, lastOutreach: '07/29/2026', assignee: 'H. Foster',    assigneeIn: 'HF', npAppt: null,         lastAwv: '08/14/2025', dec: '7',  ad: '3', fr: '3', ri: 'Medium', task: 2 },
  { id: 'awv-21', in: 'NK', name: 'Nancy King',       memberId: '11040', g: 'F', age: '62y 9m', progSubStatus: 'New',               progName: 'AWV', due: '10/15/2026', dueLabel: 'Due in 60D',   dueCol: C.grey200, outreach: 0, lastOutreach: null,         assignee: 'C. Adams',     assigneeIn: 'CA', npAppt: null,         lastAwv: '10/25/2025', dec: '8',  ad: '4', fr: '3', ri: 'Medium', task: 1 },
  { id: 'awv-22', in: 'PL', name: 'Paul Wright',      memberId: '11024', g: 'M', age: '67y 3m', progSubStatus: 'Engaged',         progName: 'APE', due: '08/30/2026', dueLabel: 'Due in 20D',   dueCol: C.warning, outreach: 2, lastOutreach: '08/01/2026', assignee: 'J. Hughes',    assigneeIn: 'JH', npAppt: '08/30/2026', lastAwv: '09/28/2025', dec: '9',  ad: '5', fr: '4', ri: 'High',   task: 1 },
  { id: 'awv-23', in: 'LS', name: 'Lisa Scott',       memberId: '11031', g: 'F', age: '64y 8m', progSubStatus: 'Attempted', progName: 'APE', due: '09/01/2026', dueLabel: 'Due in 22D',   dueCol: C.grey200, outreach: 3, lastOutreach: '07/24/2026', assignee: 'E. Clarke',    assigneeIn: 'EC', npAppt: null,         lastAwv: '06/01/2025', dec: '6',  ad: '2', fr: '2', ri: 'Medium', task: 0 },
  { id: 'awv-24', in: 'MG', name: 'Mark Green',       memberId: '11054', g: 'M', age: '70y 4m', progSubStatus: 'Open', progName: 'APE', due: '08/13/2026', dueLabel: 'Due in 3D',    dueCol: C.warning, outreach: 4, lastOutreach: '08/03/2026', assignee: 'D. Baker',     assigneeIn: 'DB', npAppt: null,         lastAwv: '08/12/2025', dec: '7',  ad: '3', fr: '2', ri: 'Medium', task: 2 },
  { id: 'awv-25', in: 'DB', name: 'Donna Baker',      memberId: '11027', g: 'F', age: '75y 7m', progSubStatus: 'Unable to Reach',         progName: 'APE', due: '04/20/2026', dueLabel: 'Unable to Reach',    dueCol: C.success, outreach: 3, lastOutreach: '04/19/2026', assignee: 'G. Evans',     assigneeIn: 'GE', npAppt: '04/20/2026', lastAwv: '04/20/2026', dec: '8',  ad: '4', fr: '3', ri: 'Medium', task: 0 },
];
