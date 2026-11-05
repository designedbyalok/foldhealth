// Care program billing (Settings → Billing): billable claims, monthly billing
// reports, and the billing-timer rules per program. These samples seed
// Supabase (scripts/seed.js) and stand in when the tables aren't there yet.

// Who sees the billing timer on a patient's profile, per program. A change
// only applies to timers started after it: anyone whose timer is already
// running when they lose access keeps it until they stop, and that time is
// logged as usual.
export const TIMER_ACCESS = {
  team: 'Care Program Team only',
  team_plus: 'Care Program Team + Additional Roles/Users',
  all: 'All users with patient access',
};

export const TIMER_PROGRAMS = [
  { code: 'BHI', name: 'Behavioral Health Integration' },
  { code: 'CCM', name: 'Chronic Care Management' },
];

// Programs whose care program team members can be ticked to log billable
// time (the check in Member/Leads → Care Team → Configure Care Program Team).
export const TIMER_PROGRAM_CODES = TIMER_PROGRAMS.map(p => p.code);

// A BHI care program team, so BHI's timer has a team to limit access to.
// CCM deliberately has none: its timer can only be open to all users with
// patient access. Same shape as the store's hccCareTeams.
const teamMember = (userId, name, initials, roles, capacityPct, canLogTime = true) => (
  { userId, name, initials, roles, capacityPct, assignTo: [], canLogTime }
);
export const SAMPLE_CARE_PROGRAM_TEAMS = [
  {
    id: 'seed-bhi', name: 'BHI Care Team', kind: 'care-program', teamType: 'BHI',
    allocatedTins: [], createdAt: '09/12/2026', createdBy: 'Dina Morries',
    lastModifiedAt: '10/02/2026', lastModifiedBy: 'Richard Willson',
    members: [
      teamMember('bhi-angela', 'Angela Hernal', 'AH', 'Nurse Practitioner', 30),
      teamMember('bhi-mark', 'Mark Thompson', 'MT', 'Care Manager', 50),
      teamMember('bhi-sofia', 'Sofia Lin', 'SL', 'Behavioral Health Specialist', 75),
      teamMember('bhi-carlos', 'Carlos Ramirez', 'CR', 'Care Manager', 30),
    ],
  },
  // Pharmacy coordinators, routed by IPA ownership, then health plan (the
  // pharmacy worklist's Auto-assign). Same rows as pharmacy_care_team_seed.sql.
  {
    id: 'seed-pharm', name: 'Pharmacy Adherence Team', kind: 'care-program', teamType: 'PHARM',
    allocatedTins: [], createdAt: '10/26/2026', createdBy: 'Richard Willson',
    lastModifiedAt: '10/26/2026', lastModifiedBy: 'Richard Willson',
    members: [
      {
        ...teamMember('pharm-priya', 'Priya Natarajan', 'PN', 'Care Manager', 100),
        assignTo: [{ dim: 'IPA', value: 'Astrana IPA', pct: 60 }, { dim: 'Health Plan', value: 'SCAN Classic', pct: 20 }, { dim: 'Health Plan', value: 'Humana Gold Plus', pct: 20 }],
      },
      {
        ...teamMember('pharm-marcus', 'Marcus Reyes', 'MR', 'Care Manager', 100),
        assignTo: [{ dim: 'IPA', value: 'Prospect Medical Group', pct: 60 }, { dim: 'Health Plan', value: 'Aetna Medicare Advantage', pct: 20 }, { dim: 'Health Plan', value: 'Blue Shield Medicare', pct: 20 }],
      },
    ],
  },
];

export const CARE_TEAM_ROLES = [
  'Primary Care Practitioner',
  'Nurse Practitioner',
  'Care Manager',
  'Medical Assistant',
  'Wellness Consultant',
  'Nutritionist',
  'Physical Therapist',
];

export const SAMPLE_BILLABLE = [
  { id: 'bill-1', memberName: 'Sarah Athena', gender: 'F', age: 32, ehrId: '28554', dateOfService: '2026-08-31', programType: 'SNP', cptCode: '99487', bill: 47.15, provider: 'Athena Bishnoi', chronicCondition: '', timeSpentMins: null },
  { id: 'bill-2', memberName: 'Jamie Michelle Allen', gender: 'M', age: 23, ehrId: '29691', dateOfService: '2026-08-18', programType: 'TOC IP', cptCode: '99495', bill: 1.5, provider: 'Dr. Patricia Patel', chronicCondition: '', timeSpentMins: null },
  { id: 'bill-3', memberName: 'Lori Knight', gender: 'F', age: 43, ehrId: '30828', dateOfService: '2026-08-12', programType: 'TOC IP', cptCode: '99495', bill: 1.5, provider: 'Dr. Linda Murphy', chronicCondition: '', timeSpentMins: null },
  { id: 'bill-4', memberName: 'Tara Nicole Maldonado', gender: 'F', age: 14, ehrId: '31965', dateOfService: '2026-07-24', programType: 'TOC IP', cptCode: '99496', bill: 1.5, provider: 'Dr. Richard Lee', chronicCondition: '', timeSpentMins: null },
  { id: 'bill-5', memberName: 'Lynn Howard', gender: 'F', age: 65, ehrId: '33102', dateOfService: '2026-07-01', programType: 'TOC IP', cptCode: '99495', bill: 1.5, provider: 'Dr. Maria Garcia', chronicCondition: '', timeSpentMins: null },
];

const reportMember = (id, memberName, gender, age, ehrId, dateOfService, programType, bill, provider, timeSpentMins) => (
  { id, memberName, gender, age, ehrId, dateOfService, programType, bill, provider, chronicCondition: '', timeSpentMins }
);

export const SAMPLE_BILLING_REPORTS = [
  { id: 'rep-2026-08-a', month: '2026-08-01', estAmount: 203.02, integratedEhr: 'Athena Health', members: [reportMember('rm-1', 'William Parker', 'M', 57, '34239', '2026-08-05', 'HIU', 609.06, 'Dr. Maria Garcia', 16510.6)] },
  { id: 'rep-2026-07-a', month: '2026-07-01', estAmount: 167.32, integratedEhr: 'Athena Health', members: [reportMember('rm-2', 'Henry Collins', 'M', 61, '35376', '2026-07-14', 'CCM', 167.32, 'Dr. Linda Murphy', 42)] },
  { id: 'rep-2026-07-b', month: '2026-07-01', estAmount: 57.45, integratedEhr: '', members: [reportMember('rm-3', 'Grace Turner', 'F', 48, '36513', '2026-07-09', 'BHI', 57.45, 'Dr. Richard Lee', 25)] },
  { id: 'rep-2026-06-a', month: '2026-06-01', estAmount: 108.71, integratedEhr: 'Athena Health', members: [reportMember('rm-4', 'Olivia Bennett', 'F', 70, '37650', '2026-06-22', 'CCM', 108.71, 'Dr. Patricia Patel', 31)] },
  { id: 'rep-2026-06-b', month: '2026-06-01', estAmount: 57.45, integratedEhr: '', members: [reportMember('rm-5', 'Ethan Brooks', 'M', 39, '38787', '2026-06-11', 'BHI', 57.45, 'Dr. Maria Garcia', 22)] },
  { id: 'rep-2026-05-a', month: '2026-05-01', estAmount: 61.56, integratedEhr: 'Athena Health', members: [reportMember('rm-6', 'Sophia Reed', 'F', 54, '39924', '2026-05-19', 'CCM', 61.56, 'Dr. Linda Murphy', 21)] },
  { id: 'rep-2026-04-a', month: '2026-04-01', estAmount: 203.02, integratedEhr: 'Athena Health', members: [reportMember('rm-7', 'Daniel Price', 'M', 66, '41061', '2026-04-08', 'CCM', 203.02, 'Dr. Richard Lee', 64)] },
  { id: 'rep-2026-03-a', month: '2026-03-01', estAmount: 167.32, integratedEhr: 'Athena Health', members: [reportMember('rm-8', 'Chloe Hughes', 'F', 45, '42198', '2026-03-17', 'CCM', 167.32, 'Dr. Patricia Patel', 45)] },
  { id: 'rep-2026-02-a', month: '2026-02-01', estAmount: 108.71, integratedEhr: 'Athena Health', members: [reportMember('rm-9', 'Lucas Ward', 'M', 52, '43335', '2026-02-12', 'BHI', 108.71, 'Dr. Maria Garcia', 33)] },
];

// History, newest first: one entry per save. The oldest is 'created', by
// System: the default access a program starts with, before anyone edits it.
//   { at, actor, kind: 'created' | 'updated' | 'team', from?, to?, added?, removed? }
// 'team' is a change made in the care program team (members ticked / unticked
// to log billable time, added or removed), recorded automatically.
// `from` / `to` are TIMER_ACCESS keys (only when the access option changed);
// added / removed are { users: [], roles: [] } of the names changed in that save.
export const SAMPLE_TIMER_SETTINGS = [
  {
    id: 'timer-bhi', program: 'BHI', access: 'team_plus', userNames: ['Kailey Lane', 'Jordan Hayes'], roles: ['Care Manager'], lastModifiedAt: '10/02/2026', lastModifiedBy: 'Richard Willson',
    history: [
      { at: '2026-10-02T15:42:00', actor: 'Richard Willson', kind: 'updated', added: { users: ['Jordan Hayes'], roles: ['Care Manager'] } },
      { at: '2026-09-24T11:05:00', actor: 'Dina Morries', kind: 'updated', from: 'team', to: 'team_plus', added: { users: ['Kailey Lane'], roles: [] } },
      { at: '2026-09-12T09:30:00', actor: 'System', kind: 'created', to: 'team' },
    ],
  },
  {
    id: 'timer-ccm', program: 'CCM', access: 'all', userNames: [], roles: [], lastModifiedAt: '09/12/2026', lastModifiedBy: 'System',
    history: [
      { at: '2026-09-12T09:30:00', actor: 'System', kind: 'created', to: 'all' },
    ],
  },
];

/** The history entry a save adds (null when nothing changed). */
export function timerChange(before, after, actor, at = new Date().toISOString()) {
  const diff = (a = [], b = []) => { const as = new Set(a); return b.filter(x => !as.has(x)); };
  const added = { users: diff(before.userNames, after.userNames), roles: diff(before.roles, after.roles) };
  const removed = { users: diff(after.userNames, before.userNames), roles: diff(after.roles, before.roles) };
  const any = (g) => g.users.length > 0 || g.roles.length > 0;
  const accessChanged = before.access !== after.access;
  if (!accessChanged && !any(added) && !any(removed)) return null;
  return {
    at, actor, kind: 'updated',
    ...(accessChanged ? { from: before.access, to: after.access } : {}),
    ...(any(added) ? { added } : {}),
    ...(any(removed) ? { removed } : {}),
  };
}

/**
 * History in the shape toActivityLogEntries() reads (ActivityLog). The body
 * is drawn by the history drawer (TimerHistoryBody); here each entry just
 * carries its rail icon, title and the change itself.
 */
export const timerHistoryToLog = (history = []) => history.map(h => {
  const base = { when: h.at, at: h.at, actor: h.actor, t: 'timer', change: h };
  if (h.kind === 'created') return { ...base, icon: 'solar:stopwatch-linear', title: 'Timer access set' };
  // A save that changed the access option leads with it (and may also carry
  // names); one that only changed names is about who has access.
  if (h.to) return { ...base, icon: 'solar:stopwatch-linear', title: 'Timer access changed' };
  // Members ticked / unticked (or added / removed) in the care program team.
  // Both directions in one save read as "updated".
  const verb = h.added && h.removed ? 'updated' : h.added ? 'granted' : 'revoked';
  if (h.kind === 'team') return { ...base, icon: 'solar:users-group-rounded-linear', title: `Timer access ${verb} (care program team)` };
  return { ...base, icon: 'solar:users-group-rounded-linear', title: `Timer access ${verb} (additional roles/users)` };
});

// ── Formatting ──
export const money = (n) => `$${Number(n || 0).toFixed(2)}`;
export const formatDos = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};
export const monthLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ── Supabase row mappers ──
const memberToRow = (m) => ({
  id: m.id,
  member_name: m.memberName,
  gender: m.gender,
  age: m.age,
  ehr_id: m.ehrId,
  date_of_service: m.dateOfService,
  program_type: m.programType,
  cpt_code: m.cptCode || null,
  bill: m.bill,
  provider: m.provider,
  chronic_condition: m.chronicCondition || null,
  time_spent_mins: m.timeSpentMins,
});
const rowToMember = (r) => ({
  id: r.id,
  memberName: r.member_name,
  gender: r.gender,
  age: r.age,
  ehrId: r.ehr_id,
  dateOfService: r.date_of_service,
  programType: r.program_type,
  cptCode: r.cpt_code || '',
  bill: Number(r.bill) || 0,
  provider: r.provider,
  chronicCondition: r.chronic_condition || '',
  timeSpentMins: r.time_spent_mins == null ? null : Number(r.time_spent_mins),
});

export const billableToRow = memberToRow;
export const rowToBillable = rowToMember;

export const reportToRow = (r) => ({
  id: r.id,
  month: r.month,
  est_amount: r.estAmount,
  integrated_ehr: r.integratedEhr || null,
  members: r.members.map(memberToRow),
});
export const rowToReport = (r) => ({
  id: r.id,
  month: r.month,
  estAmount: Number(r.est_amount) || 0,
  integratedEhr: r.integrated_ehr || '',
  members: (r.members || []).map(rowToMember),
});

export const timerToRow = (t) => ({
  id: t.id,
  program: t.program,
  access: t.access,
  user_names: t.userNames || [],
  roles: t.roles || [],
  modified_label: t.lastModifiedAt,
  modified_by: t.lastModifiedBy,
  history: t.history || [],
  updated_at: new Date().toISOString(),
});
export const rowToTimer = (r) => ({
  id: r.id,
  program: r.program,
  access: r.access,
  userNames: r.user_names || [],
  roles: r.roles || [],
  lastModifiedAt: r.modified_label,
  lastModifiedBy: r.modified_by,
  history: r.history || [],
});
