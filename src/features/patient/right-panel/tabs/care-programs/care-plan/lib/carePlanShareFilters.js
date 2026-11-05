import { localDateMs } from '../../../../../../../lib/localDate';
export { ALL_GBI_STATUSES as SHARE_GBI_STATUSES } from './gbiStatus';
export const SHARE_PRIORITY_LABELS = ['High', 'Medium', 'Low'];

export const SHARE_DATE_OPTIONS = [
  { key: 'all', label: 'All time' },
  { key: 'sinceVisit', label: 'Since last visit' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
];

export const SHARE_FILTERS_DEFAULT = {
  datePreset: 'all',
  status: [],
  priority: [],
  assignee: [],
  conditions: [],
  // { start, end } ISO dates (YYYY-MM-DD), matched against the item's start date.
  dateRange: null,
  // SHARE_DATE_RANGE_PRESETS key the range came from ('custom' = picked dates).
  rangePreset: null,
};

// Select Date Range presets (Figma Mar-Present-2026, 4143:19492).
export const SHARE_DATE_RANGE_PRESETS = [
  { key: 'today', label: 'Today’s Summary' },
  { key: 'week', label: 'Current Week Summary' },
  { key: 'month', label: 'Current Month Summary' },
  { key: 'lastMonth', label: 'Last Month Summary' },
  { key: '3m', label: 'Last 3 Months Summary' },
  { key: '6m', label: 'Last 6 Months Summary' },
  { key: 'custom', label: 'Custom Date Summary' },
];

const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** { start, end } for a preset, ending today (weeks start on Sunday); null for custom. */
export function shareDateRangeFor(key, today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const range = (from, to = t) => ({ start: isoDay(from), end: isoDay(to) });
  switch (key) {
    case 'today': return range(t);
    case 'week': return range(new Date(t.getFullYear(), t.getMonth(), t.getDate() - t.getDay()));
    case 'month': return range(new Date(t.getFullYear(), t.getMonth(), 1));
    case 'lastMonth': return range(new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0));
    case '3m': return range(new Date(t.getFullYear(), t.getMonth() - 3, t.getDate()));
    case '6m': return range(new Date(t.getFullYear(), t.getMonth() - 6, t.getDate()));
    default: return null;
  }
}

/** Item's start date (the PDF's "Start Date") falls inside { start, end }. */
export function matchesShareDateRange(item, range) {
  if (!range?.start || !range?.end) return true;
  const raw = item?.createdAt || item?.startDate;
  if (!raw) return true;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return true;
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return day >= range.start && day <= range.end;
}

/** ISO timestamp on the row: prefers last update, then create. */
export function shareItemTimestamp(item) {
  const raw = item?.updatedAt || item?.createdAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

export function matchesShareDatePreset(item, datePreset, lastVisitIso) {
  if (!datePreset || datePreset === 'all') return true;
  const t = shareItemTimestamp(item);
  if (t == null) return true;
  if (datePreset === 'sinceVisit') {
    let cutoff = Date.now() - 30 * 86400000;
    if (lastVisitIso) {
      const lv = localDateMs(lastVisitIso);
      if (Number.isFinite(lv)) cutoff = lv;
    }
    return t >= cutoff;
  }
  if (datePreset === '30d') return t >= Date.now() - 30 * 86400000;
  if (datePreset === '90d') return t >= Date.now() - 90 * 86400000;
  return true;
}

/** When plan condition labels are selected, keep rows whose text/tags mention one. */
export function matchesShareConditionFilter(item, selectedLabels) {
  if (!selectedLabels?.length) return true;
  const hay = [
    ...(Array.isArray(item?.conditions) ? item.conditions : []),
    item?.title || '',
    item?.subtitle || '',
    item?.category || '',
  ].join(' ').toLowerCase();
  return selectedLabels.some((label) => {
    const l = String(label || '').trim().toLowerCase();
    if (!l) return false;
    if (hay.includes(l)) return true;
    const stem = l.split(/\s+/).find(w => w.length > 3);
    return stem ? hay.includes(stem) : false;
  });
}

export function matchesShareFilters(item, filters, { lastVisitIso, kind } = {}) {
  const status = item?.status || 'Not Started';
  if (filters.status?.length && !filters.status.includes(status)) return false;

  if (!matchesShareConditionFilter(item, filters.conditions)) return false;

  if (filters.priority?.length) {
    const p = (item?.priority || 'medium').toLowerCase();
    const allowed = filters.priority.map(x => String(x).toLowerCase());
    if (!allowed.includes(p)) return false;
  }

  if (kind === 'intervention' && filters.assignee?.length) {
    const name = item?.assignee?.name;
    if (!name || !filters.assignee.includes(name)) return false;
  }

  if (!matchesShareDatePreset(item, filters.datePreset, lastVisitIso)) return false;
  if (!matchesShareDateRange(item, filters.dateRange)) return false;
  return true;
}

export function isShareFiltersActive(filters) {
  return (
    (filters.datePreset && filters.datePreset !== 'all')
    || (filters.status?.length > 0)
    || (filters.priority?.length > 0)
    || (filters.assignee?.length > 0)
    || (filters.conditions?.length > 0)
    || !!(filters.dateRange?.start && filters.dateRange?.end)
    || !!filters.rangePreset
  );
}
