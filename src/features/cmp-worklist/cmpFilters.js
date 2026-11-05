import { parseLocalDate } from '../../lib/localDate';
import { GENDER_FILTER_OPTIONS, LANGUAGE_FILTER_OPTIONS, memberGenderLabel, memberLanguageLabel } from '../../lib/memberFilters';
import { dobInRange } from '../../components/DateRangePopover/yearSpan';
import { outreachFromCount } from '../../components/OutreachStatus/outreachStatusModel';
import { CMP_SUB_PROGRAMS } from '../patient/data/cmpSubPrograms';
import { CMP_STATUSES } from './cmpStatuses';

// CMP worklist filters: one per column, from the member down to the program.
// The top bar keeps the member and program basics; the rest sit under More
// Filters, grouped. Filters run on enrollments (one per sub-program), so a
// program filter keeps only the sub-programs that match, and a member shows
// when any of theirs does.
//
// `type`: multi (checkbox list, the default), date (From / To range), dob
// (the shared DOB filter). `opts`: a fixed list; without one the options come
// from the members on the worklist.

const CARE_TEAM = [
  { key: 'nurseHealthCoach', label: 'Nurse/Health Coach' },
  { key: 'coordinator', label: 'Coordinator' },
  { key: 'socialWorker', label: 'Social Worker' },
  { key: 'communityHealthWorker', label: 'Community Health Worker' },
];

export const NEXT_ACTION_BUCKETS = ['Overdue', 'Due today', 'Due in 7 days', 'Due later', 'No date'];
export const OUTREACH_RESULTS = ['Attended', 'Follow-up', 'Failed', 'No outreach'];

export const CMP_FILTER_DEFS = [
  { key: 'dob', label: 'DOB', type: 'dob', primary: true, group: 'Members' },
  { key: 'gender', label: 'Gender', primary: true, group: 'Members', opts: GENDER_FILTER_OPTIONS },
  { key: 'language', label: 'Language', primary: true, group: 'Members', opts: LANGUAGE_FILTER_OPTIONS, searchable: true },
  { key: 'assignee', label: 'Assignee', primary: true, group: 'Program', searchable: true },
  { key: 'subProgram', label: 'Sub Program', primary: true, group: 'Program', opts: CMP_SUB_PROGRAMS },
  { key: 'progSubStatus', label: 'Program Sub Status', primary: true, group: 'Program', opts: CMP_STATUSES },

  { key: 'member', label: 'Member Name or ID', group: 'Members', searchable: true },

  { key: 'nextActionDue', label: 'Next Action Due', group: 'Program', opts: NEXT_ACTION_BUCKETS },
  { key: 'outreach', label: 'Outreach', group: 'Program', opts: OUTREACH_RESULTS },
  { key: 'carePlanStatus', label: 'Care Plan Status', group: 'Program' },
  { key: 'programStartDate', label: 'Start Date', type: 'date', group: 'Program' },
  { key: 'programDueDate', label: 'Due Date', type: 'date', group: 'Program' },

  ...CARE_TEAM.map(r => ({ key: r.key, label: r.label, group: 'Care Team', searchable: true })),

  { key: 'ri', label: 'Risk IQ', group: 'Clinical', opts: ['Low', 'Medium', 'High'] },
  { key: 'lastAdmission', label: 'Last Admission', type: 'date', group: 'Clinical' },
  { key: 'caseAcuity', label: 'Case Acuity', group: 'Clinical', opts: ['Low', 'Medium', 'High'] },
  { key: 'riskTier', label: 'Risk Level', group: 'Clinical' },
  { key: 'tags', label: 'Tags', group: 'Clinical', searchable: true },

  { key: 'tasks', label: 'Tasks', group: 'Tasks', opts: ['Has tasks', 'No tasks'] },
];

export const CMP_FILTER_DEF_MAP = Object.fromEntries(CMP_FILTER_DEFS.map(d => [d.key, d]));

const DAY_MS = 86400000;
function nextActionBucket(mdy) {
  const d = parseLocalDate(mdy);
  if (!d) return 'No date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / DAY_MS);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  return days <= 7 ? 'Due in 7 days' : 'Due later';
}

const OUTREACH_LABEL = { success: 'Attended', followup: 'Follow-up', failed: 'Failed' };

// The values one enrollment carries for a filter (it matches when any is picked).
const VALUES = {
  gender: (e) => [memberGenderLabel(e.g)],
  language: (e) => [memberLanguageLabel(e.language)],
  member: (e) => [`${e.name} (#${e.memberId || e.id})`],
  assignee: (e) => [e.assignee || 'Unassigned'],
  subProgram: (e) => [e.subProgram],
  progSubStatus: (e) => [e.progSubStatus],
  nextActionDue: (e) => [nextActionBucket(e.nextActionDue)],
  outreach: (e) => [OUTREACH_LABEL[outreachFromCount(e.outreach, e.progSubStatus, e.lastOutreach).result] || 'No outreach'],
  carePlanStatus: (e) => [e.carePlanStatus],
  programStartDate: (e) => [e.programStartDate],
  programDueDate: (e) => [e.programDueDate],
  ...Object.fromEntries(CARE_TEAM.map(r => [r.key, (e) => [e[r.key] || 'Unassigned']])),
  ri: (e) => [e.ri],
  lastAdmission: (e) => [e.lastAdmission],
  caseAcuity: (e) => [e.caseAcuity],
  riskTier: (e) => [e.riskTier || 'None'],
  tags: (e) => (e.tags?.length ? e.tags : ['No tags']),
  tasks: (e) => [(e.task || 0) > 0 ? 'Has tasks' : 'No tasks'],
};

export const cmpFilterValues = (k, e) => (VALUES[k]?.(e) ?? []).filter(v => v != null && v !== '');

function inDates(value, [from, to]) {
  const t = parseLocalDate(value);
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  if (!t || !start || !end) return false;
  end.setHours(23, 59, 59, 999);
  return t >= start && t <= end;
}

// True when the enrollment passes every active filter.
export function enrollmentMatches(e, filters) {
  for (const [k, vals] of Object.entries(filters || {})) {
    const def = CMP_FILTER_DEF_MAP[k];
    if (!def || !vals?.length) continue;
    if (def.type === 'dob') {
      if (!dobInRange(e.dob, e.age, vals)) return false;
      continue;
    }
    const values = cmpFilterValues(k, e);
    if (def.type === 'date') {
      if (vals.length < 2 || !values.some(v => inDates(v, vals))) return false;
      continue;
    }
    const picked = new Set(vals);
    if (!values.some(v => picked.has(v))) return false;
  }
  return true;
}

// Each multi filter's options: its fixed list, or what the worklist holds.
export function cmpFilterOptions(enrollments) {
  const opts = {};
  for (const def of CMP_FILTER_DEFS) {
    if (def.type === 'date' || def.type === 'dob') continue;
    if (def.opts) { opts[def.key] = def.opts; continue; }
    const set = new Set();
    for (const e of enrollments) for (const v of cmpFilterValues(def.key, e)) set.add(String(v));
    opts[def.key] = [...set].toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  return opts;
}
