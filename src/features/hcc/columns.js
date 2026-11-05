// HCC worklist column metadata: single source of truth for header labels,
// sort keys, and the keys exposed in the column-config popover.
//
// `k`, internal column key (also drives `data-col` attributes on cells)
// `lb`, display label
// `sortable`, true if the column should open a SortPopover on header click
//
// Sticky Member (always-visible identity column) and Actions are intentionally
// excluded: they're rendered separately and can't be hidden.

// `sortField` is the property on the member row that drives the sort comparison.
// If omitted, defaults to `k` (works when the column key matches the data field).
// Column order + labels mirror Figma ICD-Import node 4680:138476.
// `dos`, `open`, `vt`, `rp`, `pos` are DOS-level (stack per visit inside a
// record); the rest are record-level (render once). `progress` is a
// synthetic stepper column derived from the four role statuses.
export const HCC_COLUMNS = [
  // `sortType` drives the sort-tooltip copy on the header chip
  // ("A to Z" / "oldest to newest" / "lowest to highest" / "ascending
  // order"). Falls back to `alpha` when omitted.
  { k: 'dos',      lb: 'DOS',           sortable: true,  sortField: 'dos',   sortType: 'date' },
  { k: 'open',     lb: 'Open ICDs',     sortable: true,  sortField: 'open',  sortType: 'number' },
  { k: 'vt',       lb: 'Visit Type',    sortable: false },
  { k: 'rp',       lb: 'Rendering Provider', sortable: true,  sortField: 'rp' },
  { k: 'pos',      lb: 'POS',           sortable: true,  sortField: 'pos',   sortType: 'number' },
  { k: 'date',     lb: 'Created Date',  sortable: true,  sortField: 'date',  sortType: 'date' },
  { k: 'evidence', lb: 'Documents',     sortable: true,  sortField: 'ch',    sortType: 'number' },
  { k: 'sup',      lb: 'Support Team',  sortable: true,  sortField: 'supS',  sortType: 'generic' },
  { k: 'cdr',      lb: 'Coder',         sortable: true,  sortField: 'cdrS',  sortType: 'generic' },
  { k: 'r1',       lb: 'QA',            sortable: true,  sortField: 'r1s',   sortType: 'generic' },
  { k: 'r2',       lb: 'Compliance',    sortable: true,  sortField: 'r2s',   sortType: 'generic' },
  { k: 'progress', lb: 'Progress',      sortable: false },
  // Current assignee: derived from the assignment engine (whoever is
  // actively working the record right now). Sorted by display name.
  { k: 'assignee', lb: 'Assignee',      sortable: true,  sortField: 'assigneeName' },
  { k: 'pcp',      lb: 'PCP',           sortable: true,  sortField: 'pcp' },
  { k: 'raf',      lb: 'RAF Score',     sortable: true,  sortField: 'raf',   sortType: 'number' },
  { k: 'ri',       lb: 'RAF Impact',    sortable: true,  sortField: 'ri',    sortType: 'number' },
  { k: 'ipa',      lb: 'IPA',           sortable: false },
  { k: 'hp',       lb: 'HP Code',       sortable: false },
  { k: 'dec',      lb: 'Decile',        sortable: true,  sortField: 'dec',   sortType: 'number' },
  { k: 'coh',      lb: 'Cohort',        sortable: false },
  { k: 'rl',       lb: 'Risk Level',    sortable: true,  sortField: 'rl',    sortType: 'priority' },
  { k: 'ad',       lb: 'Adv. Illness',  sortable: true,  sortField: 'ad',    sortType: 'generic' },
  { k: 'fr',       lb: 'Frailty',       sortable: true,  sortField: 'fr',    sortType: 'generic' },
];

export const HCC_COL_MAP = Object.fromEntries(HCC_COLUMNS.map(c => [c.k, c]));

// Apply a user-defined key order to a column descriptor list. Unknown keys in
// `order` are ignored; columns missing from `order` are appended in their
// original position. Returns a new array, never mutates inputs.
export function orderColumns(columns, order) {
  if (!order || !order.length) return columns;
  const byKey = Object.fromEntries(columns.map(c => [c.k, c]));
  const seen = new Set();
  const ordered = [];
  for (const k of order) {
    if (byKey[k] && !seen.has(k)) { ordered.push(byKey[k]); seen.add(k); }
  }
  for (const c of columns) {
    if (!seen.has(c.k)) ordered.push(c);
  }
  return ordered;
}

// Member-column sort axes: drives the MemberSortPopover trigger on the Member header.
export const MEMBER_SORT_ITEMS = [
  { key: 'name_first', label: 'First Name' },
  { key: 'name_last',  label: 'Last Name' },
  { key: 'g',          label: 'Gender' },
  { key: 'dob',        label: 'DOB Year' },
];
