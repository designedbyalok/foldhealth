// HEDIS worklist filter definitions — parallel to `src/features/hcc/filters.js`
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

export const MORE_FILTER_ITEMS = [
  // Primary — shown in the chip row by default. Auto-fit trims to one row.
  { k: 'memberStatus',                label: 'Member Status',                primary: true },
  { k: 'gapStatus',                   label: 'Gap Status',                   primary: true },
  { k: 'assignee',                    label: 'Assignee',                     primary: true },
  { k: 'gender',                      label: 'Gender',                       primary: true },
  { k: 'language',                    label: 'Language',                     primary: true },
  { k: 'lastOutreachOutcome',         label: 'Last Outreach Outcome',        primary: true },
  { k: 'preferredCallTime',           label: 'Preferred Call Time',          primary: true },
  { k: 'state',                       label: 'State of Residence',           primary: true },
  // Extended — hidden until toggled on via MoreFiltersPopover.
  { k: 'phone',                       label: 'Phone Number',                 primary: false },
  { k: 'dob',                         label: 'DOB',                          primary: false },
  { k: 'lastOutreachDate',            label: 'Last Outreach Date',           primary: false },
  { k: 'ipa',                         label: 'IPA',                          primary: false },
  { k: 'isOwnedIpa',                  label: 'Is Owned IPA',                 primary: false },
  { k: 'lob',                         label: 'LOB',                          primary: false },
  { k: 'hpCode',                      label: 'HP Codes',                     primary: false },
  { k: 'hpGroup',                     label: 'HP Group',                     primary: false },
  { k: 'contractType',                label: 'Contract Type',                primary: false },
  { k: 'snpType',                     label: 'SNP Type',                     primary: false },
  { k: 'networkMarket',               label: 'Network Market',               primary: false },
  { k: 'zip',                         label: 'Zip Code',                     primary: false },
  { k: 'city',                        label: 'City',                         primary: false },
  { k: 'pcp',                         label: 'PCP',                          primary: false },
  { k: 'pcpCounty',                   label: 'PCP County',                   primary: false },
  { k: 'pcpPod',                      label: 'PCP Pod',                      primary: false },
  { k: 'pcpVendor',                   label: 'PCP Vendor',                   primary: false },
  { k: 'pcpState',                    label: 'PCP State',                    primary: false },
  { k: 'careGaps',                    label: 'Care Gaps',                    primary: false },
  { k: 'careGapAddedDate',            label: 'Care Gap Added Date',          primary: false },
  { k: 'lastCareGapAssessmentDate',   label: 'Last Care Gap Assessment Date',primary: false },
  { k: 'lastVisitDate',               label: 'Last Visit Date',              primary: false },
  { k: 'riskIQ',                      label: 'Risk IQ',                      primary: false },
  { k: 'advancedIllness',             label: 'Advanced Illness',             primary: false },
  { k: 'frailty',                     label: 'Frailty',                      primary: false },
];

export const PRIMARY_FILTER_KEYS = MORE_FILTER_ITEMS.filter(x => x.primary).map(x => x.k);

// Language display labels; the DB stores ISO 639-1 codes (en, es, …) so the
// predicate translates each member's code before comparing.
const LANGUAGE_LABEL = {
  en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese',
  ko: 'Korean',  vi: 'Vietnamese', hi: 'Hindi', bn: 'Bengali', ar: 'Arabic',
};

export const FILTER_DEFS = [
  { k: 'memberStatus',        label: 'Member Status', type: 'multi',
    opts: ['Active', 'Inactive', 'Suspended'] },
  { k: 'gapStatus',           label: 'Gap Status', type: 'multi',
    opts: ['Open', 'Engaged', 'Engaged Requires Follow-Up', 'Submitted', 'Completed',
           'Closed - Do not call', 'Closed - UTR', 'Closed - Other'] },
  { k: 'assignee',            label: 'Assignee', type: 'multi',
    dynamic: 'assignee', opts: [], searchable: true },
  { k: 'gender',              label: 'Gender', type: 'multi',
    opts: ['Male', 'Female'] },
  { k: 'language',            label: 'Language', type: 'multi',
    opts: ['English', 'Spanish', 'Chinese', 'Cantonese', 'Korean', 'Vietnamese', 'Hindi', 'Bengali', 'Arabic'] },
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
  { k: 'dob',                 label: 'DOB', type: 'date', field: 'dob' },
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
  // Same bucketing HCC uses for its `hccG` / `gaps` radio filters.
  { k: 'careGaps',            label: 'Care Gaps', type: 'radio',
    opts: ['0', '1 - 5', '6 - 10', '11 - 20', '> 20'] },
  { k: 'careGapAddedDate',    label: 'Care Gap Added Date', type: 'date', field: 'careGapAddedDate' },
  { k: 'lastCareGapAssessmentDate', label: 'Last Care Gap Assessment Date', type: 'date', field: 'lastCareGapAssessmentDate' },
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

// Predicate — returns true when a HEDIS member row passes every active filter.
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
      const long = m.gender === 'M' ? 'Male' : m.gender === 'F' ? 'Female' : m.gender;
      return vals.includes(m.gender) || vals.includes(long);
    }
    case 'language':            return vals.includes(LANGUAGE_LABEL[m.language] || m.language);
    case 'gapStatus': {
      const valSet = new Set(vals);
      for (const g of (m.gaps || [])) {
        if (valSet.has(g.status)) return true;
      }
      return false;
    }
    case 'assignee': {
      // Match a member if the row-level assignee OR any per-gap assignee
      // is in the selected set — same fields the row's Assignee column
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
      const cnt = (m.gaps || []).length;
      return vals.some(v => {
        if (v === '0')       return cnt === 0;
        if (v === '1 - 5')   return cnt >= 1 && cnt <= 5;
        if (v === '6 - 10')  return cnt >= 6 && cnt <= 10;
        if (v === '11 - 20') return cnt >= 11 && cnt <= 20;
        if (v === '> 20')    return cnt > 20;
        return false;
      });
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

function parseIsoLocal(s) {
  if (!s) return null;
  const match = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function matchDateRange(value, vals) {
  if (!Array.isArray(vals) || vals.length < 2) return true;
  const target = value ? new Date(value) : null;
  if (!target || Number.isNaN(+target)) return false;
  const start = parseIsoLocal(vals[0]);
  const end   = parseIsoLocal(vals[1]);
  if (!start || !end) return false;
  end.setHours(23, 59, 59, 999);
  return target >= start && target <= end;
}

export function countActiveFilters(filters) {
  return Object.values(filters || {}).filter(v => Array.isArray(v) && v.length > 0).length;
}
