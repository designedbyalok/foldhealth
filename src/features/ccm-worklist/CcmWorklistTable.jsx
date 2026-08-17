import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { FilterBar } from '../../components/FilterBar/FilterBar';
import { Pagination } from '../../components/Pagination/Pagination';
import { TableSkeleton } from '../../components/TableSkeleton/TableSkeleton';
import { BulkBar } from '../../components/BulkBar/BulkBar';
import { CcmWorklistRow } from './CcmWorklistRow';
import {
  TimeFilterPopover,
} from './TimeFilterChip';
import {
  matchTimeFilter,
  summarizeTimeFilter,
  isTimeFilterActive,
  ALL_USERS,
} from './TimeFilterChip.utils';
import styles from './CcmWorklistTable.module.css';

// Threshold radio lists for the two time filters. Order matches the Figma.
const BILLABLE_THRESHOLDS = ['No Time', '> 5 mins', '>10 mins', '>15 mins', '>20 mins', '>90 mins'];
const UNLOGGED_THRESHOLDS = ['No Time', '> 5 mins', '>10 mins', '>15 mins', '>20 mins'];
const EMPTY_TIME_FILTER = { user: ALL_USERS, threshold: null };

// Every filter chip in the row is a multi-select of *string buckets*. For
// raw fields (Status, Gender, IPA, …) the bucket is the value itself; for
// numeric / date fields we derive a bucket label per row via BUCKET_FN
// below. Order here matches the Figma chip row left → right.
const FILTER_KEYS = [
  { key: 'dob',                 label: 'DOB' },
  { key: 'gender',              label: 'Gender' },
  { key: 'language',            label: 'Language' },
  { key: 'utrFlag',             label: 'UTR Flag' },
  { key: 'utrAge',              label: 'UTR Age' },
  { key: 'assignee',            label: 'Assigned to' },
  { key: 'status',              label: 'Status' },
  { key: 'programDueDate',      label: 'Program Due Date' },
  { key: 'lastOutreachDate',    label: 'Last Outreach Date' },
  { key: 'lastOutreachOutcome', label: 'Last Outreach Outcome' },
  { key: 'assignmentDate',      label: 'Assignment Date' },
  { key: 'ipa',                 label: 'IPA' },
  { key: 'hpCode',              label: 'HP Code' },
  { key: 'memberStatus',        label: 'Member Status' },
  // billableMins / unloggedMins are rendered via TimeFilterChip below (they
  // compose a user selector + threshold radio, not a multi-select bucket),
  // so they don't live in this key list.
  { key: 'unloggedUser',        label: 'Unlogged User' },
];

const LANG_LABEL = { en: 'English', ch: 'Chinese', es: 'Spanish', ko: 'Korean', vi: 'Vietnamese' };

// Parse an "MM/DD/YYYY" string; returns null when the input is missing or
// malformed so callers can bucket that as 'None' / 'Never'.
const parseUsDate = (s) => {
  if (!s) return null;
  const [mm, dd, yyyy] = String(s).split('/').map(Number);
  if (!mm || !dd || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
};

// Bucket helpers keep the filter logic declarative. Each returns a string
// so the FilterChip's multi-select value can key off it directly.
const dueBucket = (dateStr) => {
  const d = parseUsDate(dateStr);
  if (!d) return 'None';
  const now = new Date();
  if (d < now) return 'Overdue';
  const daysAway = Math.floor((d - now) / 86400000);
  if (daysAway <= 30) return 'This Month';
  if (daysAway <= 60) return 'Next Month';
  return 'Later';
};
const outreachDateBucket = (mmddyy) => {
  if (!mmddyy) return 'Never';
  const [mm, dd, yy] = String(mmddyy).split('/').map(Number);
  const d = new Date(2000 + (yy || 0), (mm || 1) - 1, dd || 1);
  const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (daysAgo <= 7)  return 'Last 7 days';
  if (daysAgo <= 30) return 'Last 30 days';
  return 'Older';
};
const assignmentBucket = (dateStr) => {
  const d = parseUsDate(dateStr);
  if (!d) return 'None';
  const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (daysAgo <= 30)  return 'Last 30 days';
  if (daysAgo <= 90)  return '1-3 months ago';
  if (daysAgo <= 180) return '3-6 months ago';
  return '6+ months ago';
};
const utrAgeBucket = (days) => {
  if (!days || days <= 0) return 'N/A';
  if (days <= 7)  return '1-7 days';
  if (days <= 30) return '8-30 days';
  return '30+ days';
};
const dobDecade = (iso) => {
  if (!iso) return 'Unknown';
  return `${iso.slice(0, 3)}0s`;
};

// A single per-row → bucket lookup used both for populating the FilterChip
// option lists AND for evaluating each row against a selected filter — keeps
// the two branches consistent by construction.
const BUCKET_FN = {
  dob:                 (m) => dobDecade(m.dob),
  gender:              (m) => m.gender || 'Unknown',
  language:            (m) => LANG_LABEL[m.language] || 'Other',
  utrFlag:             (m) => m.utrFlag || 'No',
  utrAge:              (m) => utrAgeBucket(m.utrAgeDays),
  assignee:            (m) => m.assigneeName || 'Unassigned',
  status:              (m) => m.status,
  programDueDate:      (m) => dueBucket(m.programDueDate),
  lastOutreachDate:    (m) => outreachDateBucket(m.outreachDate),
  lastOutreachOutcome: (m) => m.lastOutreachOutcome || 'None',
  assignmentDate:      (m) => assignmentBucket(m.assignmentDate),
  ipa:                 (m) => m.ipa || 'Unknown',
  hpCode:              (m) => m.hpCode || 'Unknown',
  memberStatus:        (m) => m.memberStatus || 'Active',
  unloggedUser:        (m) => m.assigneeName || 'Unassigned',
};

const EMPTY_FILTERS = Object.fromEntries(FILTER_KEYS.map(f => [f.key, []]));

// Chip definitions for the shared FilterBar. First 8 chips are `primary`
// (rendered by default, on one line — the shared FilterBar's autoFit packer
// hides overflow into More Filters); the rest are extended (hidden by
// default, opt-in via More Filters).
const CCM_PRIMARY_KEYS = new Set([
  'dob', 'gender', 'language', 'utrFlag',
  'utrAge', 'assignee', 'status', 'programDueDate',
]);
const CCM_FILTER_DEFS = (() => {
  const defs = [];
  for (const f of FILTER_KEYS) {
    if (f.key === 'unloggedUser') continue;
    defs.push({ ...f, primary: CCM_PRIMARY_KEYS.has(f.key) });
  }
  defs.push(
    { key: 'billableMins', label: 'Billable Mins', primary: false },
    { key: 'unloggedMins', label: 'Unlogged Mins', primary: false },
    { key: 'unloggedUser', label: 'Unlogged User', primary: false },
  );
  return defs;
})();
const CCM_MORE_FILTER_ITEMS = CCM_FILTER_DEFS.map(fd => ({
  k: fd.key,
  label: fd.label,
  primary: fd.primary,
}));

const thStyle = {
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--neutral-300)',
  borderBottom: '0.5px solid var(--neutral-150)',
  background: 'var(--neutral-0)',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  textAlign: 'left',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

function EmptySearch() {
  return (
    <div className={styles.emptySearch}>
      <Icon name="solar:magnifer-linear" size={40} color="var(--neutral-200)" />
      <p className={styles.emptyTitle}>No results found</p>
      <p className={styles.emptyText}>
        No CCM members match your current filters. Try adjusting them or clearing all filters.
      </p>
    </div>
  );
}

export function CcmWorklistTable() {
  const members = useAppStore(s => s.ccmWorklistMembers);
  const loading = useAppStore(s => s.ccmWorklistLoading);
  const fetchMembers = useAppStore(s => s.fetchCcmWorklistMembers);
  // Search query + filter-bar visibility are both owned by the shared TabBar
  // (via useAppStore.searchQuery / .showFilterBar) — the TOC pattern —
  // so the top-bar Filter icon toggles CCM's chip row the same way it
  // toggles TOC's <FilterBar />.
  const searchQuery = useAppStore(s => s.searchQuery);
  const showFilterBar = useAppStore(s => s.showFilterBar);
  const showToast = useAppStore(s => s.showToast);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [billableFilter, setBillableFilter] = useState(EMPTY_TIME_FILTER);
  const [unloggedFilter, setUnloggedFilter] = useState(EMPTY_TIME_FILTER);
  // `null` = default (FilterBar's autoFit packer picks visible chips); a
  // populated array = user-customized set from the More Filters popover.
  const [visibleKeys, setVisibleKeys] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Build option lists by walking the members once per filter key, running
  // each row through BUCKET_FN and deduping. Empty buckets (e.g. 'Unknown'
  // when no member has that field) drop out via the Set.
  const filterOptions = useMemo(() => {
    const sets = Object.fromEntries(FILTER_KEYS.map(({ key }) => [key, new Set()]));
    for (const m of members) {
      for (const { key } of FILTER_KEYS) {
        const val = BUCKET_FN[key](m);
        if (val) sets[key].add(val);
      }
    }
    const opts = {};
    for (const { key } of FILTER_KEYS) {
      opts[key] = [...sets[key]].toSorted();
    }
    return opts;
  }, [members]);

  const filtered = useMemo(() => {
    let rows = members;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.memberId || '').toLowerCase().includes(q),
      );
    }
    for (const { key } of FILTER_KEYS) {
      const vals = filters[key];
      if (vals && vals.length) {
        const valSet = new Set(vals);
        rows = rows.filter(m => valSet.has(BUCKET_FN[key](m)));
      }
    }
    // Billable + Unlogged filters compose user + threshold so we can't
    // fold them into the bucket-based FILTER_KEYS loop.
    rows = rows.filter(m => matchTimeFilter(m.billableSeconds, m.assigneeName, billableFilter));
    rows = rows.filter(m => matchTimeFilter(m.unloggedSeconds, m.assigneeName, unloggedFilter));
    return rows;
  }, [members, searchQuery, filters, billableFilter, unloggedFilter]);

  const userOptions = useMemo(() => {
    const names = new Set();
    for (const m of members) {
      if (m.assigneeName) names.add(m.assigneeName);
    }
    return [...names].toSorted();
  }, [members]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const allIds = paginated.map(r => r.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = paginated.some(r => selectedIds.has(r.id)) && !allSelected;

  const handleSelectAll = (checked) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (checked) allIds.forEach(id => next.add(id));
    else allIds.forEach(id => next.delete(id));
    return next;
  });
  const toggleOne = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const setFilter = (key, vals) => setFilters(f => ({ ...f, [key]: vals }));
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setBillableFilter(EMPTY_TIME_FILTER);
    setUnloggedFilter(EMPTY_TIME_FILTER);
  };
  const hasAnyActive =
    Object.values(filters).some(v => v.length > 0) ||
    isTimeFilterActive(billableFilter) ||
    isTimeFilterActive(unloggedFilter);

  const colCount = 14;

  return (
    <div className={styles.wrap}>
      {/* The shared TabBar (rendered by AppLayout for CCM) sits above this
          component and owns the title + right-side action icons — same
          chrome TOC uses. Below it we render just the filter chip row
          and the sticky-column table. */}

      {/* Filter chip row. Visible only when the TabBar's Filter icon has
          been toggled on (showFilterBar) — same pattern TOC uses for its
          FilterBar. All the bucket-based chips render from FILTER_KEYS;
          Billable Mins + Unlogged Mins slot in between memberStatus and
          unloggedUser to match the Figma order. */}
      {showFilterBar && (
        <FilterBar
          autoFit
          leading={null}
          filterDefs={CCM_FILTER_DEFS}
          moreFilterItems={CCM_MORE_FILTER_ITEMS}
          filters={{
            ...filters,
            // Mirror the two time-filter chips into FilterBar's `filters` bag
            // so autoFit treats them as active (always visible) when set.
            billableMins: isTimeFilterActive(billableFilter) ? ['active'] : [],
            unloggedMins: isTimeFilterActive(unloggedFilter) ? ['active'] : [],
          }}
          multiSelect
          onClearAll={clearFilters}
          onSaveFilter={(name) => showToast(`Saved filter "${name}"`)}
          hasActive={hasAnyActive}
          visibleKeys={visibleKeys ?? undefined}
          onToggleVisible={(k) => {
            setVisibleKeys(prev => {
              const seed = prev ?? CCM_FILTER_DEFS.reduce((keys, fd) => {
                if (fd.primary) keys.push(fd.key);
                return keys;
              }, []);
              const next = new Set(seed);
              if (next.has(k)) next.delete(k); else next.add(k);
              return [...next];
            });
          }}
          onClearVisible={() => setVisibleKeys([])}
          renderChip={(k /* , mirror */) => {
            if (k === 'billableMins') {
              return (
                <FilterChip
                  key={k}
                  label="Billable Mins"
                  active={isTimeFilterActive(billableFilter)}
                  activeSummary={summarizeTimeFilter(billableFilter)}
                  onClear={() => setBillableFilter(EMPTY_TIME_FILTER)}
                  renderPopover={({ anchorRect, onClose }) => (
                    <TimeFilterPopover
                      anchorRect={anchorRect}
                      onClose={onClose}
                      label="Billable Mins"
                      thresholds={BILLABLE_THRESHOLDS}
                      userOptions={userOptions}
                      value={billableFilter}
                      onChange={setBillableFilter}
                    />
                  )}
                />
              );
            }
            if (k === 'unloggedMins') {
              return (
                <FilterChip
                  key={k}
                  label="Unlogged Mins"
                  active={isTimeFilterActive(unloggedFilter)}
                  activeSummary={summarizeTimeFilter(unloggedFilter)}
                  onClear={() => setUnloggedFilter(EMPTY_TIME_FILTER)}
                  renderPopover={({ anchorRect, onClose }) => (
                    <TimeFilterPopover
                      anchorRect={anchorRect}
                      onClose={onClose}
                      label="Unlogged Mins"
                      thresholds={UNLOGGED_THRESHOLDS}
                      userOptions={userOptions}
                      value={unloggedFilter}
                      onChange={setUnloggedFilter}
                    />
                  )}
                />
              );
            }
            const def = CCM_FILTER_DEFS.find(d => d.key === k);
            if (!def) return null;
            return (
              <FilterChip
                key={k}
                label={def.label}
                options={filterOptions[k] || []}
                selected={filters[k] || []}
                onChange={vals => setFilter(k, vals)}
              />
            );
          }}
        />
      )}

      {/* Table body. Uses the same inline th styles + sticky columns as
          src/features/toc-worklist/WorklistTable.jsx. */}
      <div className={styles.tableScroll}>
        {loading && members.length === 0 ? (
          <TableSkeleton rows={perPage} columns={colCount} />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 36, padding: '8px 10px', position: 'sticky', top: 0, left: 0, zIndex: 4 }}>
                  <Checkbox checked={someSelected ? 'indeterminate' : allSelected} onCheckedChange={handleSelectAll} />
                </th>
                <th style={{ ...thStyle, padding: '8px 12px', position: 'sticky', top: 0, left: 36, zIndex: 4, borderRight: '0.5px solid var(--neutral-150)' }}>
                  Members
                </th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Next Action Due</th>
                <th style={thStyle}>Outreach</th>
                <th style={thStyle}>Assignee</th>
                <th style={thStyle}>Start Date</th>
                <th style={thStyle}>Last Admission</th>
                <th style={thStyle}>Billable Mins</th>
                <th style={thStyle}>Unlogged Mins</th>
                <th style={thStyle}>Risk Level</th>
                <th style={thStyle}>Task</th>
                <th style={thStyle}>Care Plan Status</th>
                <th style={{ ...thStyle, width: 140, position: 'sticky', top: 0, right: 0, zIndex: 3, textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(m => (
                <CcmWorklistRow
                  key={m.id}
                  member={m}
                  isSelected={selectedIds.has(m.id)}
                  onSelect={toggleOne}
                />
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <EmptySearch />}
      </div>

      <Pagination
        currentPage={page}
        totalItems={filtered.length}
        perPage={perPage}
        onPageChange={setPage}
        onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
      />

      {/* Feed CCM's local selection (a Set) into the shared BulkBar so
          the floating action bar surfaces the same way TOC's does. */}
      <BulkBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  );
}
