// HCC worklist filter definitions.
//
// Ported from /Users/ketanp/Downloads/HCC/hcc_worklist_v2.tsx:
//   - FILTER_DEFS         (line 3382)  → which filters have UI, with their type/opts
//   - MORE_FILTER_ITEMS   (line 3680)  → master list (primary chips + extended)
//
// `type` legend (matches Phase 1b/c popover dispatcher in FilterChipBar):
//   - multi      → CheckboxListPopover (built in Phase 1b)
//   - radio      → RadioListPopover    (Phase 1c)
//   - range      → RangeSliderPopover  (Phase 1c — decile slider)
//   - team       → TeamMemberPopover   (Phase 1c)
//   - date       → DateRangePopover    (Phase 3 — deferred; preset chips for now)
//
// Adding a new filter: append it to MORE_FILTER_ITEMS (with `primary: true` to
// show by default), and add a matching FILTER_DEFS entry only if the filter
// needs a non-default popover or filter logic.

import { SYSTEM_USER_NAMES } from './systemUsers';
import { dosSourceLetter, DOS_SOURCE_LABELS, DOS_SOURCE_LABEL_TO_LETTER } from './dosSource';
import { canonicalStatus } from './statusSpec';
import { POS_CODES } from './data/posCodes';

export const MORE_FILTER_ITEMS = [
  // Primary — shown in chip row by default. Order matches Paper 21UY.
  { k: 'my',     label: 'Measurement Year',    primary: true },
  { k: 'dos',    label: 'DOS',                 primary: true },
  { k: 'asgn',   label: 'Assignee',            primary: true },
  { k: 'cd',     label: 'Creation Date',       primary: true },
  { k: 'open',   label: 'Open ICDs',           primary: true },
  { k: 'dosSrc', label: 'DOS Source',          primary: true },
  { k: 'chart',  label: 'Documents Available', primary: true },
  { k: 'supS',   label: 'Support Team Status', primary: true },
  { k: 'cdrS',   label: 'Coder Status',        primary: true },
  { k: 'r1s',    label: 'QA Status',           primary: true },
  { k: 'r2s',    label: 'Compliance Status',   primary: true },
  { k: 'rp',     label: 'Rendering Provider',  primary: true },
  { k: 'vt',     label: 'Visit Type',          primary: true },
  { k: 'pos',    label: 'POS Code',            primary: true },
  { k: 'claims', label: 'Claims',              primary: true },
  // Extended — hidden until toggled on via MoreFiltersPopover
  { k: 'rl',     label: 'Risk Level',          primary: false },
  { k: 'coh',    label: 'Cohort',              primary: false },
  { k: 'ad',     label: 'Adv. Illness',        primary: false },
  { k: 'g',      label: 'Gender',              primary: false },
  { k: 'dec',    label: 'Decile',              primary: false },
  { k: 'dob',    label: 'DOB',                 primary: false },
  { k: 'lang',   label: 'Language',            primary: false },
  { k: 'city',   label: 'City',                primary: false },
  { k: 'state',  label: 'State of Residence',  primary: false },
  { k: 'supAD',  label: 'Support Assigned Date',primary: false },
  { k: 'supCD',  label: 'Support Completion Date', primary: false },
  { k: 'cdrAD',  label: 'Coder Assigned Date', primary: false },
  { k: 'cdrCD',  label: 'Coder Completion Date',primary: false },
  { k: 'r1AD',   label: 'QA Assigned Date',    primary: false },
  { k: 'r1CD',   label: 'QA Completion Date',  primary: false },
  { k: 'r2AD',   label: 'Compliance Assigned Date',  primary: false },
  { k: 'r2CD',   label: 'Compliance Completion Date',primary: false },
  // Per-role assignee filters — pick specific team members and only surface
  // rows where that person owns the given role. Parallel to the *Status
  // filters (supS/cdrS/r1s/r2s) but keyed on the assignee, not the state.
  { k: 'supU',   label: 'Support Team Assignee',   primary: false },
  { k: 'cdrU',   label: 'Coder Assignee',          primary: false },
  { k: 'r1u',    label: 'QA Assignee',             primary: false },
  { k: 'r2u',    label: 'Compliance Assignee',     primary: false },
  { k: 'hccG',   label: 'HCC Gaps',            primary: false },
  { k: 'lgaD',   label: 'Last Gap Assessment Date', primary: false },
  { k: 'pcp',    label: 'PCP',                 primary: false },
  { k: 'ipa',    label: 'IPA',                 primary: false },
  { k: 'hp',     label: 'HP Code',             primary: false },
  { k: 'raf',    label: 'RAF',                 primary: false },
  { k: 'gaps',   label: 'No. Of Gaps',         primary: false },
  { k: 'tin',    label: 'TIN',                 primary: false },
  { k: 'lvd',    label: 'Last Visit Date',     primary: false },
];

export const PRIMARY_FILTER_KEYS = [];
for (const x of MORE_FILTER_ITEMS) {
  if (x.primary) PRIMARY_FILTER_KEYS.push(x.k);
}

export const FILTER_DEFS = [
  // Visit Type — canonical option set used across the worklist. Records get a
  // deterministic visit type from this same list in the store (see
  // normalizeWorklistRow → VT_POOL), so the filter and the data agree.
  { k: 'vt',     label: 'Visit Type',          type: 'multi', dynamic: 'vt', opts: [
    'AWV - Annual Wellness Visit',
    'IPPE - Initial Preventive Physical Exam',
    'Annual Physical Exam',
    'New Patient Office Visit',
    'Established Patient Office Visit',
    'Telehealth Visit',
    'Specialist Visit / Consult',
    'ER Visit',
    'Inpatient Visit / Admission',
    'Observation Visit',
    'Skilled Nursing Facility Visit',
    'Home Visit',
    'Hospice Visit',
    'Lab/Imaging Order',
    'Transitional Care Management (TCM) Visit',
    'Chronic Care Management (CCM)',
  ] },
  // Measurement Year — most recent 3 years, current year first.
  { k: 'my',     label: 'Measurement Year',    type: 'multi', opts: measurementYearOpts() },
  // Assignee options come from the platformUsers store slice (profiles
  // table, populated by Settings → Users). SYSTEM_USER_NAMES is the
  // fallback when the fetch hasn't returned yet or the DB is empty.
  { k: 'asgn',   label: 'Assignee',            type: 'multi', dynamic: 'asgn', opts: SYSTEM_USER_NAMES, searchable: true },
  { k: 'dosSrc', label: 'DOS Source',          type: 'multi', opts: DOS_SOURCE_LABELS },
  { k: 'rl',     label: 'Risk Level',          type: 'multi', opts: ['Low', 'Medium', 'High'] },
  { k: 'coh',    label: 'Cohort',              type: 'multi', opts: ['PCP', 'HCC'] },
  // Advanced Illness — CMS frailty adjunct score, integer 1..10. Range
  // slider matches Decile so the picker is instantly familiar.
  { k: 'ad',     label: 'Adv. Illness',        type: 'range', opts: ['1','2','3','4','5','6','7','8','9','10'] },
  { k: 'g',      label: 'Gender',              type: 'multi', opts: ['Male', 'Female'] },
  { k: 'open',   label: 'Open ICDs',           type: 'radio', opts: ['< 5 Gaps', '5 - 10 Gaps', '10 - 15 Gaps', '> 15 Gaps'] },
  // Documents Available — filter by the NUMBER of documents attached to the
  // record instead of a binary Available/Not-Available flag (Figma 4240:110644).
  // Buckets: No Documents / 1 - 5 / 6 - 10 / >= 10.
  { k: 'chart',  label: 'Documents Available', popoverLabel: 'Select No. of Documents', type: 'multi', opts: ['No Documents', '1 - 5', '6 - 10', '>= 10'] },
  // Support / Coder / QA / Compliance statuses — role-specific vocabularies
  // (aligned with ROLE_STATUS_OPTIONS in statusSpec.js). Support has no "New"
  // (work arrives already actionable); Coder has record-request states; QA
  // and Compliance share the reviewer flow.
  { k: 'supS',   label: 'Support Team Status', type: 'multi', opts: ['Action Needed', 'In Progress', 'Insufficient', 'Rebuttal', 'Completed', 'Rejected'] },
  { k: 'cdrS',   label: 'Coder Status',        type: 'multi', opts: ['New', 'In Progress', 'Record Received', 'Record Requested', 'Rebuttal', 'Skipped', 'Completed', 'Rejected'] },
  { k: 'r1s',    label: 'QA Status',           type: 'multi', opts: ['New', 'In Progress', 'Rebuttal', 'Skipped', 'Completed', 'Rejected'] },
  { k: 'r2s',    label: 'Compliance Status',   type: 'multi', opts: ['New', 'In Progress', 'Rebuttal', 'Skipped', 'Completed', 'Rejected'] },
  // Per-role assignee pickers. Each filter reads from its OWN role-scoped
  // dynamic pool in FilterChipBar — only users whose profile carries the
  // matching clinical_roles entry are eligible. Same rule the
  // RoleAssigneePicker enforces on assignment, so filter options and pickable
  // assignees agree. `opts: []` intentionally: an empty pool means "no user
  // has that role" (fix in Settings → Users), not "still loading" — so no
  // SYSTEM_USER_NAMES fallback here.
  { k: 'supU',   label: 'Support Team Assignee', type: 'multi', dynamic: 'supU', opts: [], searchable: true },
  { k: 'cdrU',   label: 'Coder Assignee',        type: 'multi', dynamic: 'cdrU', opts: [], searchable: true },
  { k: 'r1u',    label: 'QA Assignee',           type: 'multi', dynamic: 'r1u',  opts: [], searchable: true },
  { k: 'r2u',    label: 'Compliance Assignee',   type: 'multi', dynamic: 'r2u',  opts: [], searchable: true },
  // Multi-selects backed by row-derived option pools — the list mirrors
  // exactly what values the currently-loaded worklist actually carries.
  { k: 'rp',     label: 'Rendering Provider', type: 'multi', dynamic: 'rp',  opts: [], searchable: true },
  { k: 'pcp',    label: 'PCP',                type: 'multi', dynamic: 'pcp', opts: [], searchable: true },
  { k: 'ipa',    label: 'IPA',                type: 'multi', dynamic: 'ipa', opts: [] },
  { k: 'hp',     label: 'HP Code',            type: 'multi', dynamic: 'hp',  opts: [] },
  // Language — the DB stores 2-letter codes, but the picker shows display
  // names. matchOne('lang') translates m.language back to the display label
  // via LANGUAGE_LABEL below before comparing.
  { k: 'lang',   label: 'Language',           type: 'multi', opts: ['English', 'Spanish', 'Italian', 'Japanese', 'Punjabi'] },
  // RAF — same integer-bucket range slider Decile / Adv. Illness use.
  // Real RAF is a decimal in ~[1.0, 6.5]; matchOne compares numerically
  // against the (mn, mx) integer bounds.
  { k: 'raf',    label: 'RAF',                type: 'range', opts: ['0','1','2','3','4','5','6','7'] },
  // Contact / demographics — v3 columns on hcc_members. City / State pools
  // come from the loaded rows; TIN is a searchable multi (there's one per
  // record).
  { k: 'city',   label: 'City',               type: 'multi', dynamic: 'city',  opts: [], searchable: true },
  { k: 'state',  label: 'State of Residence', type: 'multi', dynamic: 'state', opts: [] },
  { k: 'tin',    label: 'TIN',                type: 'multi', dynamic: 'tin',   opts: [], searchable: true },
  // Derived from hcc_diagnosis_gaps via the view:
  //   hccG = COUNT(*)  — total HCC gaps recorded for the member
  //   gaps = same count, exposed for the "No. Of Gaps" filter label
  //   lgaD = MAX(last_activity) — most recent gap-log write
  { k: 'hccG',   label: 'HCC Gaps',           type: 'radio', opts: ['0','1 - 5','6 - 10','11 - 20','> 20'] },
  { k: 'gaps',   label: 'No. Of Gaps',        type: 'radio', opts: ['0','1 - 5','6 - 10','11 - 20','> 20'] },
  { k: 'lgaD',   label: 'Last Gap Assessment Date', type: 'date', field: 'lgaD', kind: 'iso' },
  // Per-role assigned/completion date filters — ISO timestamps on the row,
  // stored as YYYY-MM-DD by matchDateRange after parsing. Same shape as
  // Creation Date but pointed at the role-scoped fields.
  { k: 'supAD',  label: 'Support Assigned Date',     type: 'date', field: 'supAD', kind: 'iso' },
  { k: 'supCD',  label: 'Support Completion Date',   type: 'date', field: 'supCD', kind: 'iso' },
  { k: 'cdrAD',  label: 'Coder Assigned Date',       type: 'date', field: 'cdrAD', kind: 'iso' },
  { k: 'cdrCD',  label: 'Coder Completion Date',     type: 'date', field: 'cdrCD', kind: 'iso' },
  { k: 'r1AD',   label: 'QA Assigned Date',          type: 'date', field: 'r1AD',  kind: 'iso' },
  { k: 'r1CD',   label: 'QA Completion Date',        type: 'date', field: 'r1CD',  kind: 'iso' },
  { k: 'r2AD',   label: 'Compliance Assigned Date',  type: 'date', field: 'r2AD',  kind: 'iso' },
  { k: 'r2CD',   label: 'Compliance Completion Date',type: 'date', field: 'r2CD',  kind: 'iso' },
  { k: 'dec',    label: 'Decile',              type: 'range', opts: ['1','2','3','4','5','6','7','8','9','10'] },
  // POS Code — options rendered as "23 - ER — Hospital"; filter value stores
  // the "23 - ER — Hospital" label so the popover checkbox state and the chip
  // summary use the same string. matchOne('pos') maps the label back to the
  // raw 2-digit code before comparing against `m.pos`.
  { k: 'pos',    label: 'POS Code',            type: 'multi', searchable: true,
    opts: POS_CODES.map(p => `${p.code} - ${p.name}`) },
  // Claims — single-select Available / Not Available. A member has claims
  // "Available" when any of their DOS entries classifies as source "C"
  // (same classifier the DOS-source badge uses), so this filter agrees with
  // what the row's source badges show.
  { k: 'claims', label: 'Claims',              type: 'radio', opts: ['Available', 'Not Available'] },
  // Phase 3d — date-range filters use the shared DateRangePopover.
  // Values are stored as [startISO, endISO]; the predicate parses them
  // against the row's `date` or other date field.
  { k: 'cd',    label: 'Creation Date',       type: 'date',  field: 'date' },
  { k: 'dos',   label: 'DOS',                 type: 'date',  field: 'dos' },
  { k: 'dob',   label: 'DOB',                 type: 'date',  field: 'age', kind: 'age' },
  { k: 'lvd',   label: 'Last Visit Date',     type: 'date',  field: 'dos' },
];

export const FILTER_DEF_MAP = Object.fromEntries(FILTER_DEFS.map(d => [d.k, d]));

// Role-scoped default filters for the HCC worklist. Each role lands on their
// own queue: rows they own (Assignee = logged-in user) that are still
// actionable (Status in New / In Progress for the role's own status column).
//
// Support's canonical "New" label is "Action Needed" (per SUPPORT_STATUS_MATCH
// below), so we use that + In Progress instead of the raw string "New".
// Support also defaults Documents Available to "≥ 1 document" — chart-chasing
// starts only after at least one doc has been attached to the record.
// Assignee is only added when a user name is known — dev sessions without a
// profile skip it so the list still renders something.
const CHART_HAS_DOCS = ['1 - 5', '6 - 10', '>= 10'];
const ROLE_DEFAULT_FILTERS = {
  Support:    { statusKey: 'supS', statusVals: ['Action Needed', 'In Progress'], chart: CHART_HAS_DOCS },
  Coder:      { statusKey: 'cdrS', statusVals: ['New', 'In Progress'] },
  QA:         { statusKey: 'r1s',  statusVals: ['New', 'In Progress'] },
  Compliance: { statusKey: 'r2s',  statusVals: ['New', 'In Progress'] },
};
export function hccRoleDefaultFilters(role, userName) {
  const spec = ROLE_DEFAULT_FILTERS[role];
  if (!spec) return {};
  const out = { [spec.statusKey]: spec.statusVals };
  if (spec.chart) out.chart = [...spec.chart];
  if (userName && typeof userName === 'string' && userName.trim()) {
    out.asgn = [userName.trim()];
  }
  return out;
}

// Measurement Year options — most-recent 3 years (current + prior two),
// descending. Kept as strings so the multi-select value compares straight
// against the DOS year in matchOne('my').
function measurementYearOpts() {
  const y = new Date().getFullYear();
  return [String(y), String(y - 1), String(y - 2)];
}

// Language code → display label. The DB stores ISO 639-1 codes on
// hcc_members.language; the Language filter shows the human-readable names.
// Only the codes we currently seed are listed; unknown codes pass through
// as-is so the filter still matches something you can see in the data.
const LANGUAGE_LABEL = {
  en: 'English',
  es: 'Spanish',
  it: 'Italian',
  ja: 'Japanese',
  pa: 'Punjabi',
};

// Role-status filter → engine value normalization. Coders see "Rebuttal" in the
// filter option list, but the engine still stores the canonical "Returned"
// value on the member (see STATUS_SPEC in statusSpec.js). Translate before
// matching so the filter picks up rows in that state.
const ROLE_STATUS_ALIAS = { Rebuttal: 'Returned' };
const roleStatusVals = (vals) => new Set(vals.map(v => ROLE_STATUS_ALIAS[v] || v));

// Support Team Status filter buckets → the underlying member `supS` values they
// cover. The filter uses the canonical Figma vocabulary (Action Needed /
// Rebuttal / Rejected), while the mock + assignment engine still carry
// finer-grained pipeline values — so a bucket maps to one-or-more data values.
const SUPPORT_STATUS_MATCH = {
  'Action Needed': ['Action Needed', 'Assign', 'Awaiting', 'New', 'Record Requested', 'Records Requested'],
  'In Progress':   ['In Progress'],
  'Insufficient':  ['Insufficient'],
  'Rebuttal':      ['Rebuttal', 'Returned'],
  'Completed':     ['Completed', 'Record Received', 'Records Received'],
  'Rejected':      ['Rejected', 'Reject'],
};

// All DOS dates a member's row actually renders (one per dos_list entry), so
// DOS-derived filters (Measurement Year, DOS Source) agree with the per-DOS
// badges instead of only looking at the current-visit `m.dos`.
function memberDosDates(m) {
  if (Array.isArray(m.dos_list) && m.dos_list.length) return m.dos_list.flatMap(e => e.date ? [e.date] : []);
  return m.dos ? [m.dos] : [];
}

// Same as memberDosDates but returns the entry objects — used by the DOS
// Source filter so it honors each entry's persisted `source` field (Manual
// entries must be classified from the tag, not a hash of the date).
function memberDosEntries(m) {
  if (Array.isArray(m.dos_list) && m.dos_list.length) return m.dos_list.filter(e => e && e.date);
  return m.dos ? [{ date: m.dos }] : [];
}

// ── Predicate helpers — given a member and the active filter state, decide
// whether the member passes. Used by the worklist `filtered` memo.

export function memberMatchesFilters(member, filters) {
  for (const [k, vals] of Object.entries(filters)) {
    if (!vals || !vals.length) continue;
    if (!matchOne(member, k, vals)) return false;
  }
  return true;
}

function matchOne(m, k, vals) {
  switch (k) {
    case 'vt':    return vals.includes(m.visitType) || vals.includes(m.vt);
    case 'rl':    return vals.includes(m.rl);
    case 'coh':   return vals.includes(m.coh);
    case 'g':     {
      const long = m.g === 'M' ? 'Male' : m.g === 'F' ? 'Female' : m.g;
      return vals.includes(m.g) || vals.includes(long);
    }
    case 'open': {
      const cnt = m.open || 0;
      return vals.some(v => {
        if (v === '< 5 Gaps') return cnt < 5;
        if (v === '5 - 10 Gaps') return cnt >= 5 && cnt <= 10;
        if (v === '10 - 15 Gaps') return cnt > 10 && cnt <= 15;
        if (v === '> 15 Gaps') return cnt > 15;
        return false;
      });
    }
    case 'chart': {
      // Match on the ACTUAL current document count, not the static seeded
      // `ch`. `m.ch` is the original chart_count from hcc_members and does
      // NOT reflect documents attached later via upload / added-charts — so a
      // record the user has uploaded a doc to (visible in the Documents
      // column, which renders from getChartDocs) still read ch=null and got
      // wrongly excluded from doc-count filters (e.g. the Support default's
      // ">= 1 document" rule). The worklist enriches each row with `docCount`
      // = getChartDocs(...).length; fall back to `ch` for callers that don't.
      const cnt = m.docCount ?? (m.ch || 0);
      return vals.some(v => {
        if (v === 'No Documents') return cnt === 0;
        if (v === '1 - 5') return cnt >= 1 && cnt <= 5;
        if (v === '6 - 10') return cnt >= 6 && cnt <= 10;
        if (v === '>= 10') return cnt >= 10;
        return false;
      });
    }
    case 'supS': {
      const set = new Set(vals.flatMap(v => SUPPORT_STATUS_MATCH[v] || [v]));
      return set.has(m.supS);
    }
    case 'asgn': {
      // Match against the current assignee shown in the Assignee column only —
      // HccWorklistTable enriches each row with `assigneeName` from the same
      // sequential resolver the cell renders (resolveCurrentAssignee). Matching
      // every role's historical owner would surface rows whose visible assignee
      // is someone else.
      return vals.includes(m.assigneeName);
    }
    // Per-role assignee filters — same name fields the Support / Coder / QA /
    // Compliance columns render on the row, so filter matches ↔ what the user
    // sees in that column.
    case 'supU': return vals.includes(m.sup);
    case 'cdrU': return vals.includes(m.cdr);
    case 'r1u':  return vals.includes(m.r1);
    case 'r2u':  return vals.includes(m.r2);
    // Simple field-equality filters — row-value must be in the selected set.
    case 'rp':   return vals.includes(m.rp);
    case 'pcp':  return vals.includes(m.pcp);
    case 'ipa':  return vals.includes(m.ipa);
    case 'hp':   return vals.includes(m.hp);
    case 'lang': return vals.includes(LANGUAGE_LABEL[m.language] || m.language);
    case 'raf': {
      // Range slider values are [mn, mx] as string ints; row's raf is numeric.
      if (vals.length >= 2) {
        const mn = parseFloat(vals[0]);
        const mx = parseFloat(vals[1]);
        const v = Number(m.raf);
        if (Number.isNaN(v)) return false;
        return v >= mn && v <= mx;
      }
      return true;
    }
    case 'city':  return vals.includes(m.city);
    case 'state': return vals.includes(m.state);
    case 'tin':   return vals.includes(m.tin);
    case 'hccG':
    case 'gaps': {
      const cnt = m.hccG ?? m.gaps ?? 0;
      return vals.some(v => {
        if (v === '0') return cnt === 0;
        if (v === '1 - 5') return cnt >= 1 && cnt <= 5;
        if (v === '6 - 10') return cnt >= 6 && cnt <= 10;
        if (v === '11 - 20') return cnt >= 11 && cnt <= 20;
        if (v === '> 20') return cnt > 20;
        return false;
      });
    }
    // Per-role date filters + Last Gap Assessment Date — all use ISO
    // timestamps as their source (unlike Creation Date / DOS / LVD which
    // carry MM/DD/YYYY strings) and reuse matchDateRange with 'iso' format.
    case 'lgaD':  return matchDateRange(m.lgaD, vals, 'iso');
    case 'supAD': return matchDateRange(m.supAD, vals, 'iso');
    case 'supCD': return matchDateRange(m.supCD, vals, 'iso');
    case 'cdrAD': return matchDateRange(m.cdrAD, vals, 'iso');
    case 'cdrCD': return matchDateRange(m.cdrCD, vals, 'iso');
    case 'r1AD':  return matchDateRange(m.r1AD, vals, 'iso');
    case 'r1CD':  return matchDateRange(m.r1CD, vals, 'iso');
    case 'r2AD':  return matchDateRange(m.r2AD, vals, 'iso');
    case 'r2CD':  return matchDateRange(m.r2CD, vals, 'iso');
    case 'dosSrc': {
      // Match if ANY of the member's DOS entries maps to a selected source,
      // matching the per-DOS badges shown on the row. `hasDoc` mirrors the
      // row's "Upload" state (m.ch is null when no document is on file) so
      // rows with no document can never bucket into "Document".
      const hasDoc = m?.ch != null;
      const letters = new Set(memberDosEntries(m).map(e => dosSourceLetter(e, hasDoc)));
      return vals.some(v => letters.has(DOS_SOURCE_LABEL_TO_LETTER[v]));
    }
    case 'claims': {
      // Available = at least one DOS classified as source "C" (Claims), same
      // classifier the DOS-source badge uses.
      const hasDoc = m?.ch != null;
      const hasClaims = memberDosEntries(m).some(e => dosSourceLetter(e, hasDoc) === 'C');
      return vals.includes(hasClaims ? 'Available' : 'Not Available');
    }
    case 'my': {
      // Measurement Year = the service year of any of the member's DOS entries.
      const years = new Set(
        memberDosDates(m).flatMap(d => { const p = parseMdY(d); return p ? [String(p.getFullYear())] : []; }),
      );
      return vals.some(v => years.has(v));
    }
    // Coder Status — normalize both sides (data carries plural "Records …"
    // forms; the canonical option labels are singular). "Rebuttal" is the
    // user-facing label for the engine's "Returned" state.
    case 'cdrS': {
      const set = roleStatusVals(vals);
      return [...set].some(v => canonicalStatus(v) === canonicalStatus(m.cdrS));
    }
    case 'r1s':   return roleStatusVals(vals).has(m.r1s);
    case 'r2s':   return roleStatusVals(vals).has(m.r2s);
    case 'pos': {
      // Options in the popover are "<code> - <name>" strings. Extract the
      // leading 2-digit code and match against the row's `pos`. Match if
      // ANY of the member's dos_list entries carries a selected POS, so a
      // record that visited both an ER and an Office still surfaces when
      // "23 - ER — Hospital" is checked.
      const codes = new Set(vals.map(v => (String(v).match(/^(\d{2})/)?.[1] || v)));
      const rowPositions = new Set([
        m.pos,
        ...((m.dos_list || []).flatMap(d => d?.pos ? [d.pos] : [])),
      ].filter(Boolean));
      for (const code of rowPositions) if (codes.has(code)) return true;
      return false;
    }
    case 'dec': {
      if (vals.length >= 2) {
        const mn = parseInt(vals[0], 10);
        const mx = parseInt(vals[1], 10);
        const d = parseInt(m.dec, 10) || 0;
        return d >= mn && d <= mx;
      }
      return vals.includes(String(m.dec));
    }
    case 'ad': {
      // Adv. Illness score — same [min, max] range shape as Decile.
      if (vals.length >= 2) {
        const mn = parseInt(vals[0], 10);
        const mx = parseInt(vals[1], 10);
        const v = parseInt(m.ad, 10) || 0;
        return v >= mn && v <= mx;
      }
      return vals.includes(String(m.ad));
    }
    // Date-range filters (Phase 3d). Values are [startISO, endISO].
    case 'cd':
      return matchDateRange(m.date, vals, 'mdY');
    case 'dos':
      // Match if ANY of the member's DOS entries falls in the range (the row
      // renders every dos_list date, not just the current visit).
      return memberDosDates(m).some(d => matchDateRange(d, vals, 'mdY'));
    case 'lvd':
      return matchDateRange(m.dos, vals, 'mdY');
    case 'dob': {
      // No DOB on the row — fall back to age-bucket containment (rough).
      if (vals.length < 2) return true;
      const ageNum = parseInt(String(m.age || '').match(/(\d+)/)?.[1] || '0', 10);
      const start = new Date(vals[0]);
      const end = new Date(vals[1]);
      const today = new Date();
      const inferred = new Date(today.getFullYear() - ageNum, 0, 1);
      return inferred >= start && inferred <= end;
    }
    // Filters with no current predicate pass-through
    default: return true;
  }
}

// Parse "MM/DD/YYYY" → Date (local midnight). Returns null for empties.
function parseMdY(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
}

// Parse "YYYY-MM-DD" → Date (local midnight). `new Date(iso)` would parse it as
// UTC midnight, which shifts the day in non-UTC timezones and drops rows that
// sit exactly on a range boundary — so parse it in the same frame as parseMdY.
function parseIsoLocal(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function matchDateRange(value, vals /* [startISO, endISO] */, format) {
  if (vals.length < 2) return true;
  // ISO timestamps ('2026-01-24T00:00:00.000Z') come off the wire from the
  // v3 per-role date columns; parse with the Date constructor. MM/DD/YYYY
  // strings (create_date, dos_list dates) use parseMdY. Anything unlabeled
  // falls back to the constructor.
  let target;
  if (format === 'mdY') target = parseMdY(value);
  else if (format === 'iso') target = value ? new Date(value) : null;
  else target = value ? new Date(value) : null;
  if (!target || isNaN(+target)) return false;
  const start = parseIsoLocal(vals[0]);
  const end = parseIsoLocal(vals[1]);
  if (!start || !end) return false;
  end.setHours(23, 59, 59, 999); // inclusive of the end day
  return target >= start && target <= end;
}

export function countActiveFilters(filters) {
  return Object.values(filters || {}).filter(v => Array.isArray(v) && v.length > 0).length;
}
