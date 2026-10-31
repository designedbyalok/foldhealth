import { parseLocalDate } from '../../lib/localDate';
import { GENDER_FILTER_OPTIONS, LANGUAGE_FILTER_OPTIONS, MEMBER_STATUS_FILTER_OPTIONS, memberGenderLabel, memberLanguageLabel } from '../../lib/memberFilters';
// HEDIS worklist filter definitions: parallel to `src/features/hcc/filters.js`
// so the shared FilterChipBar / MoreFiltersPopover can drive both worklists
// with the same UX (chip → popover, Label|Value active state, More Filters,
// Clear All, Save Filter). Kept intentionally simpler than HCC's defs: no
// per-role assignee pools, no DOS-source classification, no date-range
// filters until the underlying data grows those fields.
//
// `type` legend:
//   - multi → CheckboxListPopover
//   - radio → RadioListPopover
//   - date  → DateRangePopover
//   - range → RangeSliderPopover

// Filter allocation per the worklist filter spec (2.1 primary, 2.3 secondary
// by domain). The order below is the chip row's order; secondary filters
// show only when picked from More Filters.
export const MORE_FILTER_ITEMS = [
  // Spec 2.1: always-primary (Member Status, DOB, Gender, Language, Zip Code,
  // Assignee), then the HEDIS workflow filters. Every primary always shows,
  // in this order (FilterBar `pinPrimary`).
  { k: 'memberStatus', label: 'Member Status', primary: true },
  { k: 'dob', label: 'DOB', primary: true },
  { k: 'gender', label: 'Gender', primary: true },
  { k: 'language', label: 'Language', primary: true },
  { k: 'zip', label: 'Zip Code', primary: true },
  { k: 'assignee', label: 'Assignee', primary: true },
  { k: 'careGaps', label: 'Gaps', primary: true },
  { k: 'gapStatus', label: 'Gap Status', primary: true },
  { k: 'gapSource', label: 'Source', primary: true },
  { k: 'gapInstance', label: 'Instance', primary: true },
  { k: 'careGapAddedDate', label: 'Gap Added Date', primary: true },
  { k: 'lastCareGapAssessmentDate', label: 'Last Gap Assessment Date', primary: true },
  { k: 'lastVisitDate', label: 'Last Visit Date', primary: true },
  { k: 'lastOutreachDate', label: 'Last Outreach Date', primary: true },
  { k: 'lastOutreachOutcome', label: 'Last Outreach Outcome', primary: true },
  { k: 'lob', label: 'LOB', primary: true },
  // Spec 2.3: secondary, by domain in More Filters. Age Range and Network
  // Market aren't in the spec; they're kept under the closest domain.
  { k: 'phone', label: 'Phone Number', primary: false, group: 'Member' },
  { k: 'preferredCallTime', label: 'Preferred Call Time', primary: false, group: 'Member' },
  { k: 'ipa', label: 'IPA', primary: false, group: 'Member' },
  { k: 'isOwnedIpa', label: 'Is Owned IPA', primary: false, group: 'Member' },
  { k: 'hpCode', label: 'HP Codes', primary: false, group: 'Member' },
  { k: 'hpGroup', label: 'HP Group', primary: false, group: 'Member' },
  { k: 'contractType', label: 'Contract Type', primary: false, group: 'Member' },
  { k: 'snpType', label: 'SNP Type', primary: false, group: 'Member' },
  { k: 'age', label: 'Age Range', primary: false, group: 'Member' },
  { k: 'pcp', label: 'PCP', primary: false, group: 'Assignment' },
  { k: 'pcpPod', label: 'PCP Pod', primary: false, group: 'Assignment' },
  { k: 'pcpVendor', label: 'PCP Vendor', primary: false, group: 'Assignment' },
  { k: 'city', label: 'City', primary: false, group: 'Geography' },
  { k: 'state', label: 'State of Residence', primary: false, group: 'Geography' },
  { k: 'pcpCounty', label: 'PCP County', primary: false, group: 'Geography' },
  { k: 'pcpState', label: 'PCP State', primary: false, group: 'Geography' },
  { k: 'networkMarket', label: 'Network Market', primary: false, group: 'Geography' },
  { k: 'riskIQ', label: 'Risk IQ', primary: false, group: 'Clinical' },
  { k: 'advancedIllness', label: 'Advanced Illness', primary: false, group: 'Clinical' },
  { k: 'frailty', label: 'Frailty', primary: false, group: 'Clinical' },
];

export const PRIMARY_FILTER_KEYS = MORE_FILTER_ITEMS.reduce((keys, x) => {
  if (x.primary) keys.push(x.k);
  return keys;
}, []);

// Age Range filter bands, in whole months: [min, max) so they don't
// overlap within a set. The month bands follow the CIS childhood schedule
// (birth, 2, 6 and 18 months); the year bands the HEDIS measure
// populations (e.g. 45–75 for COL, 66+ for COA). Under 2 spans the month
// bands for a quick CIS-wide pick.
const AGE_GROUPS = [
  { label: '0–2 months', min: 0, max: 2 },
  { label: '2–6 months', min: 2, max: 6 },
  { label: '6–18 months', min: 6, max: 18 },
  { label: '18–24 months', min: 18, max: 24 },
  { label: 'Under 2', min: 0, max: 24 },
  { label: '2–17', min: 24, max: 18 * 12 },
  { label: '18–44', min: 18 * 12, max: 45 * 12 },
  { label: '45–64', min: 45 * 12, max: 65 * 12 },
  { label: '65–74', min: 65 * 12, max: 75 * 12 },
  { label: '75+', min: 75 * 12, max: Infinity },
];

// Per-gap Source / Instance, shared with the worklist columns so the filter
// and the cell always agree. Gaps added in Fold are stamped `fold-native`;
// a gap closed then re-added stays in the row stamped `supersededAt`.
export const gapSourceLabel = (g) => (g.source === 'fold-native' ? 'Manual' : 'Claim');
export const gapInstanceLabel = (g) => (g.supersededAt ? 'Previous' : 'Current');

export const FILTER_DEFS = [
  { k: 'memberStatus',        label: 'Member Status', type: 'multi',
    opts: MEMBER_STATUS_FILTER_OPTIONS },
  { k: 'gapStatus',           label: 'Gap Status', type: 'multi',
    opts: ['Open', 'Engaged', 'Engaged Requires Follow-Up', 'Submitted', 'Completed',
           'Closed - Data', 'Closed - Do not call', 'Closed - UTR', 'Closed - Other'] },
  { k: 'gapSource',           label: 'Source', type: 'multi',
    opts: ['Claim', 'Manual'] },
  { k: 'gapInstance',         label: 'Instance', type: 'multi',
    opts: ['Current', 'Previous'] },
  { k: 'assignee',            label: 'Assignee', type: 'multi',
    dynamic: 'assignee', opts: [], searchable: true },
  { k: 'gender',              label: 'Gender', type: 'multi',
    opts: GENDER_FILTER_OPTIONS },
  { k: 'language',            label: 'Language', type: 'multi',
    opts: LANGUAGE_FILTER_OPTIONS, searchable: true },
  { k: 'lastOutreachOutcome', label: 'Last Outreach Outcome', type: 'multi',
    opts: ['Attended', 'Failed', 'Pending', 'No Answer', 'Voicemail'] },
  { k: 'preferredCallTime',   label: 'Preferred Call Time', type: 'multi',
    opts: ['Morning', 'Afternoon', 'Evening'] },
  { k: 'state',               label: 'State of Residence', type: 'multi',
    dynamic: 'state', opts: [] },
  { k: 'city',                label: 'City', type: 'multi',
    dynamic: 'city', opts: [], searchable: true },
  { k: 'ipa',                 label: 'IPA', type: 'multi',
    dynamic: 'ipa', opts: [] },
  { k: 'hpCode',              label: 'HP Codes', type: 'multi',
    dynamic: 'hpCode', opts: [] },
  { k: 'dob',                 label: 'DOB', type: 'date', field: 'dob', years: true },
  { k: 'age',                 label: 'Age Range', type: 'multi',
    opts: AGE_GROUPS.map(g => g.label) },
  { k: 'lastOutreachDate',    label: 'Last Outreach Date', type: 'date', field: 'outreachDate' },
  // ── Coverage / plan attributes ─────────────────────────────────────
  { k: 'isOwnedIpa',          label: 'Is Owned IPA', type: 'radio',
    opts: ['Yes', 'No'] },
  { k: 'lob',                 label: 'LOB', type: 'multi',
    opts: ['Medicare', 'Medicaid', 'Commercial', 'Dual-Eligible', 'Exchange'] },
  { k: 'hpGroup',             label: 'HP Group', type: 'multi',
    dynamic: 'hpGroup', opts: [] },
  { k: 'contractType',        label: 'Contract Type', type: 'multi',
    opts: ['HMO', 'PPO', 'EPO', 'POS', 'HDHP'] },
  { k: 'snpType',             label: 'SNP Type', type: 'multi',
    opts: ['D-SNP', 'C-SNP', 'I-SNP'] },
  { k: 'networkMarket',       label: 'Network Market', type: 'multi',
    dynamic: 'networkMarket', opts: [] },
  // ── PCP attribution ────────────────────────────────────────────────
  { k: 'pcp',                 label: 'PCP', type: 'multi',
    dynamic: 'pcp', opts: [], searchable: true },
  { k: 'pcpCounty',           label: 'PCP County', type: 'multi',
    dynamic: 'pcpCounty', opts: [] },
  { k: 'pcpPod',              label: 'PCP Pod', type: 'multi',
    dynamic: 'pcpPod', opts: [] },
  { k: 'pcpVendor',           label: 'PCP Vendor', type: 'multi',
    dynamic: 'pcpVendor', opts: [] },
  { k: 'pcpState',            label: 'PCP State', type: 'multi',
    dynamic: 'pcpState', opts: [] },
  // ── Care-gap volume + timing ───────────────────────────────────────
  // Care Gaps is the measure filter, pick specific gap codes (CBP,
  // COL, DSF-A, …) to keep the worklist to members carrying any of
  // those gaps. Options are computed from the loaded members at
  // render time (dynamic: 'careGaps'); labels render as "CODE,
  // Measure Name" so the popover reads without needing the codebook.
  { k: 'careGaps',            label: 'Gaps', type: 'multi',
    dynamic: 'careGaps', opts: [], searchable: true },
  { k: 'careGapAddedDate',    label: 'Gap Added Date', type: 'date', field: 'careGapAddedDate' },
  { k: 'lastCareGapAssessmentDate', label: 'Last Gap Assessment Date', type: 'date', field: 'lastCareGapAssessmentDate' },
  { k: 'lastVisitDate',       label: 'Last Visit Date', type: 'date', field: 'lastVisitDate' },
  // ── Clinical risk (range sliders) ──────────────────────────────────
  // Advanced Illness + Frailty are integer scores on the member (already
  // seeded in the mock as `advIllness` / `frailty`); Risk IQ is the same
  // 1–10 shape reserved for the CMS risk-adjusted profile score.
  { k: 'advancedIllness',     label: 'Advanced Illness', type: 'range',
    opts: ['1','2','3','4','5','6','7','8','9','10'] },
  { k: 'frailty',             label: 'Frailty', type: 'range',
    opts: ['1','2','3','4','5','6','7','8','9','10'] },
  { k: 'riskIQ',              label: 'Risk IQ', type: 'range',
    opts: ['1','2','3','4','5','6','7','8','9','10'] },
];

export const FILTER_DEF_MAP = Object.fromEntries(FILTER_DEFS.map(d => [d.k, d]));

// Predicate: returns true when a HEDIS member row passes every active filter.
// Used by HedisWorklistTable's `filtered` memo. Mirrors the HCC pattern in
// `filters.js` (memberMatchesFilters + matchOne).
export function memberMatchesFilters(member, filters) {
  for (const [k, vals] of Object.entries(filters || {})) {
    if (!vals || !vals.length) continue;
    if (!matchOne(member, k, vals)) return false;
  }
  return true;
}

function matchOne(m, k, vals) {
  switch (k) {
    case 'memberStatus':        return vals.includes(m.memberStatus);
    case 'gender': {
      return vals.includes(m.gender) || vals.includes(memberGenderLabel(m.gender));
    }
    case 'language':            return vals.includes(memberLanguageLabel(m.language));
    case 'gapStatus': {
      const valSet = new Set(vals);
      for (const g of (m.gaps || [])) {
        if (valSet.has(g.status)) return true;
      }
      return false;
    }
    case 'gapSource':           return (m.gaps || []).some(g => vals.includes(gapSourceLabel(g)));
    case 'gapInstance':         return (m.gaps || []).some(g => vals.includes(gapInstanceLabel(g)));
    case 'assignee': {
      // Match a member if the row-level assignee OR any per-gap assignee
      // is in the selected set: same fields the row's Assignee column
      // renders, so filter and cell agree on who "owns" the row.
      const valSet = new Set(vals);
      if (valSet.has(m.assignee)) return true;
      for (const g of (m.gaps || [])) {
        if (valSet.has(g.assignee)) return true;
      }
      return false;
    }
    case 'lastOutreachOutcome': return vals.includes(m.lastOutreachOutcome);
    case 'preferredCallTime':   return vals.includes(m.preferredCallTime);
    case 'state':               return vals.includes(m.state);
    case 'city':                return vals.includes(m.city);
    case 'ipa':                 return vals.includes(m.ipa);
    case 'hpCode':              return vals.includes(m.hpCode);
    case 'phone':               return matchesAnyLiteralSubstring(m.phone || '', vals);
    case 'zip':                 return matchesAnyLiteralSubstring(m.zip || '', vals);
    case 'dob':                 return matchDateRange(m.dob, vals);
    case 'age': {
      const months = ageInMonths(m);
      if (months == null) return false;
      return AGE_GROUPS.some(g => vals.includes(g.label) && months >= g.min && months < g.max);
    }
    case 'lastOutreachDate':    return matchDateRange(m.outreachDate, vals);
    // Coverage / plan
    case 'isOwnedIpa':          return vals.includes(m.isOwnedIpa ? 'Yes' : 'No');
    case 'lob':                 return vals.includes(m.lob);
    case 'hpGroup':             return vals.includes(m.hpGroup);
    case 'contractType':        return vals.includes(m.contractType);
    case 'snpType':             return vals.includes(m.snpType);
    case 'networkMarket':       return vals.includes(m.networkMarket);
    // PCP attribution
    case 'pcp':                 return vals.includes(m.pcp);
    case 'pcpCounty':           return vals.includes(m.pcpCounty);
    case 'pcpPod':              return vals.includes(m.pcpPod);
    case 'pcpVendor':           return vals.includes(m.pcpVendor);
    case 'pcpState':            return vals.includes(m.pcpState);
    // Care-gap volume + timing
    case 'careGaps': {
      // Match on the gap CODE: vals are things like 'CBP', 'DSF-A'
      // (pulled from the loaded members via the `careGaps` dynamic
      // options resolver). A member passes when any of their open
      // gaps is in the selected set.
      const valSet = new Set(vals);
      for (const g of (m.gaps || [])) {
        if (valSet.has(g.code)) return true;
      }
      return false;
    }
    case 'careGapAddedDate':          return matchDateRange(m.careGapAddedDate, vals);
    case 'lastCareGapAssessmentDate': return matchDateRange(m.lastCareGapAssessmentDate, vals);
    case 'lastVisitDate':             return matchDateRange(m.lastVisitDate, vals);
    // Range-slider clinical scores. `vals` = [min, max] as string ints.
    case 'advancedIllness':     return matchRange(m.advIllness, vals);
    case 'frailty':             return matchRange(m.frailty, vals);
    case 'riskIQ':              return matchRange(m.riskIQ, vals);
    default:                    return true;
  }
}

// Whole months from DOB (a month counts once its day is reached); falls
// back to the age text ("22m", "67y 2m", "63y").
function ageInMonths(m) {
  const dob = parseLocalDate(m.dob);
  if (dob) {
    const now = new Date();
    let months = (now.getFullYear() - dob.getFullYear()) * 12 + now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) months -= 1;
    return months;
  }
  const y = /(\d+)\s*y/i.exec(m.age || '');
  const mo = /(\d+)\s*m(?!o)/i.exec((m.age || '').replace(/\d+\s*y/i, ''));
  if (!y && !mo) return null;
  return (y ? Number(y[1]) * 12 : 0) + (mo ? Number(mo[1]) : 0);
}

function matchRange(value, vals) {
  if (!Array.isArray(vals) || vals.length < 2) return true;
  const v = Number(value);
  if (!Number.isFinite(v)) return false;
  const mn = parseInt(vals[0], 10);
  const mx = parseInt(vals[1], 10);
  return v >= mn && v <= mx;
}

function matchesAnyLiteralSubstring(haystack, needles) {
  if (!haystack || !needles.length) return false;
  const pattern = needles
    .map(n => String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return new RegExp(pattern).test(haystack);
}

function matchDateRange(value, vals) {
  if (!Array.isArray(vals) || vals.length < 2) return true;
  const target = parseLocalDate(value);
  if (!target) return false;
  const start = parseLocalDate(vals[0]);
  const end   = parseLocalDate(vals[1]);
  if (!start || !end) return false;
  end.setHours(23, 59, 59, 999);
  return target >= start && target <= end;
}

export function countActiveFilters(filters) {
  return Object.values(filters || {}).filter(v => Array.isArray(v) && v.length > 0).length;
}
