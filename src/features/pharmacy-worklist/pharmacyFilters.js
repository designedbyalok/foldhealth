import { parseLocalDate } from '../../lib/localDate';
import { fillsToStayCompliant } from './fillEvents';
import {
  GAP_STATUSES, MEASURE_ORDER, PLAN_STATUSES, MEDICATION_STATUSES, RECON_STATUSES, SAVABILITY, SUB_STATUSES, PROGRESS_LEVELS,
  daysFromToday, daysLeftBucket, isActiveGap, medicationStatus, pharmaciesUsed, planTimers, prescribersOf,
} from './pharmacyWorklist.utils';
import { escalation, inOutreachQueue } from './pharmacyRules';

// Pharmacy worklist filters, per the status model spec: every column gets a
// filter, and a filter stays even when its column is hidden. The top-bar
// filters are primary; the rest sit under More Filters, grouped by column.
// Drives the shared FilterChipBar (see hedisFilters.js for the same shape).
//
// `type`: multi (checkbox list), radio (single pick; the spec's toggles are a
// single "Yes"), range (slider; opts are the bounds), date (date range).
// `dynamic` filters take their options from the loaded members.

const YES = ['Yes'];
const PRIOR_YEAR = new Date().getFullYear() - 1;

export const MORE_FILTER_ITEMS = [
  { k: 'priority', label: 'Priority', primary: true },
  { k: 'gap', label: 'Pharmacy Gap', primary: true },
  { k: 'gapStatus', label: 'Gap Status', primary: true },
  { k: 'planStatus', label: 'Plan Status', group: 'Pharmacy Gaps' },
  { k: 'progress', label: 'Progress', primary: true },
  { k: 'daysLeft', label: 'Days Left', primary: true },
  { k: 'overdue', label: 'Overdue', primary: true },
  { k: 'claimRecon', label: 'Claim Reconciliation', primary: true },
  { k: 'assignee', label: 'Assigned to', primary: true },

  { k: 'member', label: 'Member Name or ID', group: 'Members' },
  { k: 'sex', label: 'Sex', group: 'Members' },
  { k: 'age', label: 'Age', group: 'Members' },
  { k: 'language', label: 'Language', group: 'Members' },
  { k: 'eligibilityStatus', label: 'Eligibility Status', group: 'Members' },

  { k: 'gapCount', label: 'Number of Pharmacy Gaps', group: 'Pharmacy Gaps' },
  { k: 'subStatus', label: 'Gap Sub-Status', group: 'Pharmacy Gaps' },
  { k: 'startDate', label: 'Start Date', group: 'Pharmacy Gaps' },
  { k: 'savability', label: 'Savability', group: 'Pharmacy Gaps' },
  { k: 'safeForYear', label: 'Safe for Year', group: 'Pharmacy Gaps' },
  { k: 'excluded', label: 'Excluded', group: 'Pharmacy Gaps' },
  { k: 'payerProjectedStatus', label: 'Payer Projected Status', group: 'Pharmacy Gaps' },
  { k: 'consistentlyNonCompliant', label: 'Consistently Non-Compliant', group: 'Pharmacy Gaps' },

  { k: 'drugName', label: 'Drug Name', group: 'Drugs' },
  { k: 'drugCount', label: 'Drug Count', group: 'Drugs' },
  { k: 'drugClass', label: 'Therapeutic Class', group: 'Drugs' },
  { k: 'combinationDrug', label: 'Combination Drug', group: 'Drugs' },
  { k: 'medStatus', label: 'Medication Status', group: 'Drugs' },
  { k: 'drugInteraction', label: 'Drug Interaction Flag', group: 'Drugs' },

  { k: 'pdc', label: 'PDC', group: 'PDC' },
  { k: 'pdcBelow80', label: 'PDC Below 80%', group: 'PDC' },
  { k: 'pdcAtOrBelow90', label: 'PDC At or Below 90%', group: 'PDC' },
  { k: 'pdcSource', label: 'PDC Source', group: 'PDC' },
  { k: 'pdcProjected', label: 'Includes a Projected Fill', group: 'PDC' },
  { k: 'noRefillPdc', label: 'Projected PDC (No Refill)', group: 'PDC' },
  { k: 'mpr', label: 'MPR', group: 'PDC' },
  { k: 'fillsToStay', label: 'Fills to Stay Compliant', group: 'PDC' },
  { k: 'priorYearResult', label: 'Prior-Year Result', group: 'PDC' },
  { k: 'priorYearPdc', label: 'Prior-Year PDC', group: 'PDC' },
  { k: 'nonCompliantBothYears', label: 'Non-Compliant Both Prior Years', group: 'PDC' },

  { k: 'failDate', label: 'Fail Date', group: 'Dates' },
  { k: 'failDateSource', label: 'Fail Date Source', group: 'Dates' },
  { k: 'allowableGapDays', label: 'Days to Save', group: 'Dates' },
  { k: 'daysMissed', label: 'Days Missed', group: 'Dates' },
  { k: 'nextFillDue', label: 'Next Fill Due', group: 'Dates' },
  { k: 'daysOverdue', label: 'Days Overdue', group: 'Dates' },
  { k: 'nextFillSource', label: 'Next Fill Source', group: 'Dates' },

  { k: 'reworkOpen', label: 'Rework Task Open', group: 'Claim Reconciliation' },
  { k: 'pickupNoClaim', label: 'Pickup Confirmed, No Claim Yet', group: 'Claim Reconciliation' },
  { k: 'pickupClaimDisagree', label: 'Pickup and Claim Disagree', group: 'Claim Reconciliation' },

  { k: 'gapsClosed', label: 'Gaps Closed', group: 'Progress' },
  { k: 'otherGapsCount', label: 'Open Care Gap Count', group: 'Open Care Gaps' },
  { k: 'otherGap', label: 'Open Care Gap', group: 'Open Care Gaps' },

  { k: 'lastOutreachResult', label: 'Last Outreach Result', group: 'Outreach' },
  { k: 'lastOutreachOutcome', label: 'Last Outreach Outcome', group: 'Outreach' },
  { k: 'lastOutreachDate', label: 'Last Outreach Date', group: 'Outreach' },
  { k: 'contactType', label: 'Contact Type', group: 'Outreach' },
  { k: 'attempts', label: 'Attempts on Current Gap', group: 'Outreach' },
  { k: 'noOutreach', label: 'No Outreach Yet', group: 'Outreach' },
  { k: 'inQueue', label: 'In Outreach Queue', group: 'Outreach' },
  { k: 'escalate', label: 'Escalate to Prescriber', group: 'Outreach' },
  { k: 'unableToReach', label: 'Unable to Reach', group: 'Outreach' },

  { k: 'hasNote', label: 'Has Internal Note', group: 'Notes and Follow-up' },
  { k: 'noteText', label: 'Note Text', group: 'Notes and Follow-up' },
  { k: 'followUpDue', label: 'Follow-up Due', group: 'Notes and Follow-up' },
  { k: 'followUpOverdue', label: 'Follow-up Overdue', group: 'Notes and Follow-up' },
  { k: 'assignedToMe', label: 'Assigned to Me', group: 'Notes and Follow-up' },

  { k: 'healthPlan', label: 'Health Plan', group: 'Plan and Provider' },
  { k: 'ipa', label: 'IPA', group: 'Plan and Provider' },
  { k: 'bookOfBusiness', label: 'Book of Business', group: 'Plan and Provider' },
  { k: 'pharmacy', label: 'Pharmacy (Last Used)', group: 'Plan and Provider' },
  { k: 'prescriber', label: 'Prescriber', group: 'Plan and Provider' },
  { k: 'barrier', label: 'Barrier', group: 'Plan and Provider' },
  { k: 'daysInQueue', label: 'Days in Queue', group: 'Plan and Provider' },
];

export const PRIMARY_FILTER_KEYS = MORE_FILTER_ITEMS.filter(x => x.primary).map(x => x.k);

const multi = (opts, extra) => ({ type: 'multi', opts, ...extra });
const dynamic = (k, extra) => ({ type: 'multi', dynamic: k, opts: [], ...extra });
const toggle = { type: 'radio', opts: YES };
const range = (lo, hi) => ({ type: 'range', opts: [String(lo), String(hi)] });
const date = { type: 'date' };
const SOURCE_OPTS = ['Plan-provided', 'Fold-calculated', 'Manual'];

const DEFS = {
  priority: multi(['P1', 'P2', 'P3']),
  gap: multi(MEASURE_ORDER),
  gapStatus: multi(GAP_STATUSES),
  planStatus: multi(PLAN_STATUSES),
  progress: multi(PROGRESS_LEVELS),
  daysLeft: multi(['0–7 days', '8–14 days', '15–30 days', 'Over 30 days', 'Past fail date']),
  overdue: multi(['Refill overdue', 'Claim not matched', 'Claim overdue', 'Follow-up overdue', 'Not overdue']),
  claimRecon: multi(RECON_STATUSES),
  assignee: dynamic('assignee', { searchable: true }),
  member: dynamic('member', { searchable: true }),
  sex: multi(['F', 'M']),
  age: range(0, 110),
  language: dynamic('language'),
  eligibilityStatus: multi(['Active', 'Termed']),
  gapCount: multi(['1', '2', '3']),
  subStatus: multi(SUB_STATUSES),
  startDate: date,
  savability: multi(SAVABILITY),
  safeForYear: toggle,
  excluded: dynamic('excluded'),
  payerProjectedStatus: multi(['Already adherent', 'Unlikely by year end', 'Check projected date']),
  consistentlyNonCompliant: toggle,
  drugName: dynamic('drugName', { searchable: true }),
  drugCount: range(0, 10),
  drugClass: dynamic('drugClass'),
  combinationDrug: toggle,
  medStatus: multi(MEDICATION_STATUSES),
  drugInteraction: toggle,
  pdc: range(0, 100),
  pdcBelow80: toggle,
  pdcAtOrBelow90: toggle,
  pdcSource: multi(SOURCE_OPTS),
  pdcProjected: toggle,
  noRefillPdc: range(0, 100),
  mpr: range(0, 100),
  fillsToStay: range(0, 12),
  priorYearResult: dynamic('priorYearResult'),
  priorYearPdc: range(0, 100),
  nonCompliantBothYears: toggle,
  failDate: date,
  failDateSource: multi(SOURCE_OPTS),
  allowableGapDays: range(-100, 366),
  daysMissed: range(0, 366),
  nextFillDue: date,
  daysOverdue: range(0, 366),
  nextFillSource: multi(SOURCE_OPTS),
  reworkOpen: toggle,
  pickupNoClaim: toggle,
  pickupClaimDisagree: toggle,
  gapsClosed: dynamic('gapsClosed'),
  otherGapsCount: range(0, 10),
  otherGap: dynamic('otherGap'),
  lastOutreachResult: multi(['Attended', 'Failed']),
  lastOutreachOutcome: dynamic('lastOutreachOutcome', { searchable: true }),
  lastOutreachDate: date,
  contactType: dynamic('contactType'),
  attempts: range(0, 20),
  noOutreach: toggle,
  inQueue: toggle,
  escalate: toggle,
  unableToReach: toggle,
  hasNote: toggle,
  noteText: dynamic('noteText', { searchable: true }),
  followUpDue: date,
  followUpOverdue: toggle,
  assignedToMe: toggle,
  healthPlan: dynamic('healthPlan'),
  ipa: dynamic('ipa'),
  bookOfBusiness: dynamic('bookOfBusiness'),
  pharmacy: dynamic('pharmacy', { searchable: true }),
  prescriber: dynamic('prescriber', { searchable: true }),
  barrier: dynamic('barrier'),
  daysInQueue: range(0, 366),
};

export const FILTER_DEF_MAP = Object.fromEntries(MORE_FILTER_ITEMS.map(x => [x.k, { label: x.label, ...DEFS[x.k] }]));

// Therapeutic class by generic name, for the drugs in the adherence measures.
const DRUG_CLASS = {
  metformin: 'Biguanide', glipizide: 'Sulfonylurea', glimepiride: 'Sulfonylurea', glyburide: 'Sulfonylurea',
  sitagliptin: 'DPP-4 inhibitor', linagliptin: 'DPP-4 inhibitor', pioglitazone: 'Thiazolidinedione',
  lisinopril: 'ACE inhibitor', enalapril: 'ACE inhibitor', ramipril: 'ACE inhibitor', benazepril: 'ACE inhibitor',
  losartan: 'ARB', valsartan: 'ARB', olmesartan: 'ARB', irbesartan: 'ARB', telmisartan: 'ARB',
  atorvastatin: 'Statin', rosuvastatin: 'Statin', simvastatin: 'Statin', pravastatin: 'Statin', lovastatin: 'Statin',
};
export const drugClass = (d) => d.drugClass || DRUG_CLASS[(d.generic || '').toLowerCase()] || null;

const yes = (cond) => (cond ? YES : []);
const nums = (list) => list.filter(n => n != null && !Number.isNaN(n));
const sourceLabel = (s) => (!s ? null : s === 'Plan' ? 'Plan-provided' : s === 'Manual' ? 'Manual' : 'Fold-calculated');
const activeMeds = (g) => g.medications.filter(d => d.status !== 'Discontinued');
const openGaps = (m) => m.gaps.filter(g => isActiveGap(g.status));
const isPast = (mdy) => { const d = daysFromToday(mdy); return d != null && d < 0; };
// Awaiting its claim longer than the plan's feed usually takes.
const claimOverdue = (m, g) => {
  if (g.recon?.status !== 'Awaiting claim' || g.recon.daysLeft == null) return false;
  const t = planTimers(m.healthPlan);
  return t.matchWindowDays - g.recon.daysLeft > t.feedLagDays;
};

function overdueTags(m) {
  const tags = [];
  if (openGaps(m).some(g => isPast(g.nextFillDue))) tags.push('Refill overdue');
  if (m.gaps.some(g => g.recon?.status === 'Claim not matched')) tags.push('Claim not matched');
  if (m.gaps.some(g => claimOverdue(m, g))) tags.push('Claim overdue');
  if (isPast(m.followUpDue)) tags.push('Follow-up overdue');
  return tags.length ? tags : ['Not overdue'];
}

// A prior-year result per year: the plan's % when it sends one, else its
// compliance flag (always the last year).
function priorYearResults(g) {
  if (g.priorYearPdc?.length) return g.priorYearPdc.map(y => `${y.year} · ${y.pdc >= 80 ? 'Compliant' : 'Non-compliant'}`);
  if (g.priorYearNonCompliant == null) return ['No data'];
  return [`${PRIOR_YEAR} · ${g.priorYearNonCompliant ? 'Non-compliant' : 'Compliant'}`];
}

// Filters about one gap: a member matches when one of its gaps carries all
// of them at once, and the row shows only the gaps that do (filter MAH and
// the MAC / MAD rows go). `g` is an enriched gap, `m` its member.
const GAP_VALUES = {
  gap: (g) => [g.code],
  gapStatus: (g) => [g.status.gap],
  planStatus: (g) => [g.planStatus],
  daysLeft: (g) => (isActiveGap(g.status) ? [daysLeftBucket(g.failDate)] : []),
  claimRecon: (g) => [g.recon?.status].filter(Boolean),
  subStatus: (g) => [g.status.label].filter(Boolean),
  startDate: (g) => [g.startDate],
  savability: (g) => [g.savability].filter(Boolean),
  safeForYear: (g) => yes(g.status.gap === 'Met for Year' || g.projectedStatus === 'Already adherent'),
  excluded: (g) => (g.status.gap === 'Excluded' ? [g.exclusionType || 'Excluded'] : []),
  payerProjectedStatus: (g) => [g.projectedStatus].filter(Boolean),
  consistentlyNonCompliant: (g) => yes(g.complianceFlag === 'Consistently Non-Compliant'),
  drugName: (g) => activeMeds(g).map(d => d.name),
  drugCount: (g) => [g.medications.length],
  drugClass: (g) => g.medications.map(drugClass).filter(Boolean),
  medStatus: (g, m) => g.medications.map(d => medicationStatus(d, m.healthPlan)),
  drugInteraction: (g) => yes(g.drugInteraction),
  pdc: (g) => nums([g.pdc]),
  pdcBelow80: (g) => yes(g.pdc != null && g.pdc < 80),
  pdcAtOrBelow90: (g) => yes(g.pdc != null && g.pdc <= 90),
  pdcSource: (g) => [sourceLabel(g.pdcSource)].filter(Boolean),
  pdcProjected: (g) => yes(g.pdcSource === 'Projected'),
  noRefillPdc: (g) => nums([g.noRefillPdc]),
  mpr: (g) => nums([g.mpr]),
  fillsToStay: (g) => nums([fillsToStayCompliant(g)]),
  priorYearResult: (g) => priorYearResults(g),
  priorYearPdc: (g) => nums((g.priorYearPdc || []).map(y => y.pdc)),
  nonCompliantBothYears: (g) => yes(g.priorYearPdc?.length >= 2 && g.priorYearPdc.slice(0, 2).every(y => y.pdc < 80)),
  failDate: (g) => [g.failDate],
  failDateSource: (g) => [sourceLabel(g.failDateSource)].filter(Boolean),
  allowableGapDays: (g) => nums([g.allowableGapDays]),
  daysMissed: (g) => nums([g.daysMissed]),
  nextFillDue: (g) => [g.nextFillDue],
  daysOverdue: (g) => (isActiveGap(g.status) ? nums([-daysFromToday(g.nextFillDue)]).filter(d => d > 0) : []),
  nextFillSource: (g) => [sourceLabel(g.nextFillDueSource)].filter(Boolean),
  reworkOpen: (g) => yes(g.recon?.rework && g.claimFollowUpTask?.taskId != null),
  pickupNoClaim: (g) => yes(g.pickupConfirmed && g.recon?.status === 'Awaiting claim'),
  pickupClaimDisagree: (g) => yes(g.pickupConfirmed && g.recon?.rework),
  attempts: (g) => nums([g.attempts]),
  inQueue: (g) => yes(inOutreachQueue(g)),
  escalate: (g, m) => yes(escalation(g, m)),
};
export const isGapFilter = (k) => k in GAP_VALUES;

// Filters about the member as a whole.
const VALUES = {
  priority: (m) => [m.priority],
  progress: (m) => [m.progress.label],
  overdue: overdueTags,
  assignee: (m) => [m.assigneeName || 'Unassigned'],
  member: (m) => [`${m.name} (#${m.memberId || m.id})`],
  sex: (m) => [m.gender],
  age: (m) => nums([parseInt(m.age, 10)]),
  language: (m) => [(m.language || 'en').toUpperCase()],
  eligibilityStatus: (m) => [m.eligibilityStatus || 'Active'],
  gapCount: (m) => [String(m.gaps.length)],
  // One drug counted under two gaps (a combination product).
  combinationDrug: (m) => {
    const seen = new Map();
    for (const g of m.gaps) for (const d of g.medications) seen.set(d.generic || d.name, (seen.get(d.generic || d.name) || new Set()).add(g.code));
    return yes([...seen.values()].some(codes => codes.size > 1));
  },
  gapsClosed: (m) => [`${m.progress.closed} of ${m.progress.total}`],
  otherGapsCount: (m) => [m.otherCareGapsCount],
  otherGap: (m) => m.otherCareGaps.map(g => g.code),
  lastOutreachResult: (m) => (m.outreach ? [m.outreach.status] : []),
  lastOutreachOutcome: (m) => (m.outreach?.outcome ? [m.outreach.outcome] : []),
  lastOutreachDate: (m) => (m.outreach ? [m.outreach.date] : []),
  contactType: (m) => (m.outreach?.contact ? [m.outreach.contact] : []),
  noOutreach: (m) => yes(!(m.callHistory || []).length),
  unableToReach: (m) => {
    // A note is not a contact attempt.
    const calls = (m.callHistory || []).filter(c => c.result !== 'note');
    return yes(calls.length >= 2 && calls.slice(0, 2).every(c => c.result !== 'success'));
  },
  hasNote: (m) => yes(!!m.leadNote),
  noteText: (m) => (m.leadNote ? [m.leadNote] : []),
  followUpDue: (m) => [m.followUpDue],
  followUpOverdue: (m) => yes(isPast(m.followUpDue)),
  assignedToMe: (m, ctx) => yes(!!ctx?.authUserId && m.assigneeId === ctx.authUserId),
  healthPlan: (m) => [m.healthPlan].filter(Boolean),
  ipa: (m) => [m.ipa].filter(Boolean),
  bookOfBusiness: (m) => [m.bookOfBusiness].filter(Boolean),
  pharmacy: (m) => [pharmaciesUsed(m)[0]?.name].filter(Boolean),
  prescriber: (m) => prescribersOf(m).map(p => p.name),
  // Active barriers only: a resolved one no longer matches.
  barrier: (m) => (m.activeBarriers?.length ? m.activeBarriers : ['None']),
  daysInQueue: (m) => nums([m.daysInQueue]),
};

const gapFilterValues = (k, g, m, ctx) => GAP_VALUES[k]?.(g, m, ctx) ?? [];

// Every value a member carries for a filter (a gap filter: across its gaps).
export const filterValues = (k, m, ctx) => (isGapFilter(k)
  ? m.gaps.flatMap(g => gapFilterValues(k, g, m, ctx))
  : VALUES[k]?.(m, ctx) ?? []);

function inDates(value, [from, to]) {
  const t = parseLocalDate(value);
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  if (!t || !start || !end) return false;
  end.setHours(23, 59, 59, 999);
  return t >= start && t <= end;
}

function passes(def, vals, values) {
  if (def.type === 'range') {
    const [lo, hi] = vals.map(Number);
    return values.some(v => v >= lo && v <= hi);
  }
  if (def.type === 'date') return vals.length >= 2 && values.some(v => inDates(v, vals));
  const picked = new Set(vals);
  return values.some(v => picked.has(v));
}

const activeFilters = (filters) => Object.entries(filters || {}).filter(([k, vals]) => FILTER_DEF_MAP[k] && vals?.length);

// The member's gaps that pass every active gap filter (all of them when none
// is set).
export function matchingGaps(m, filters, ctx) {
  const gapFilters = activeFilters(filters).filter(([k]) => isGapFilter(k));
  if (!gapFilters.length) return m.gaps;
  return m.gaps.filter(g => gapFilters.every(([k, vals]) => passes(FILTER_DEF_MAP[k], vals, gapFilterValues(k, g, m, ctx))));
}

// True when the member passes every member filter and, with gap filters set,
// at least one of its gaps passes them all.
export function memberMatchesFilters(m, filters, ctx) {
  const active = activeFilters(filters);
  for (const [k, vals] of active) {
    if (isGapFilter(k)) continue;
    if (!passes(FILTER_DEF_MAP[k], vals, filterValues(k, m, ctx))) return false;
  }
  return !active.some(([k]) => isGapFilter(k)) || matchingGaps(m, filters, ctx).length > 0;
}

// Options for the `dynamic` filters, from the members on the worklist.
export function dynamicFilterOptions(members, ctx) {
  const opts = {};
  for (const [k, def] of Object.entries(FILTER_DEF_MAP)) {
    if (!def.dynamic) continue;
    const set = new Set();
    for (const m of members) for (const v of filterValues(k, m, ctx)) if (v != null && v !== '') set.add(String(v));
    opts[def.dynamic] = [...set].toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  return opts;
}
