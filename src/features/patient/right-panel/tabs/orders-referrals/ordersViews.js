// Views, filters and row shapes for the Orders & Referrals tab (Figma P360
// Revamp 54:34442).

export const VIEWS = [
  { key: 'referral', label: 'Referral', noun: 'referrals' },
  { key: 'lab', label: 'Lab', noun: 'lab orders' },
  { key: 'imaging', label: 'Imaging', noun: 'imaging orders' },
  { key: 'medication', label: 'Medication', noun: 'medications' },
];
export const VIEW_TABS = VIEWS.map(({ key, label }) => ({ key, label }));
export const viewOf = key => VIEWS.find(v => v.key === key) || VIEWS[0];

const DAY = 24 * 60 * 60 * 1000;
const DATE_RANGES = [
  { label: 'Last 30 Days', test: age => age <= 30 * DAY },
  { label: 'Last 6 Months', test: age => age <= 182 * DAY },
  { label: 'Last 12 Months', test: age => age <= 365 * DAY },
  { label: 'Over a Year Ago', test: age => age > 365 * DAY },
];
export const DATE_RANGE_LABELS = DATE_RANGES.map(r => r.label);
const inRanges = (ts, labels, now) => !labels.length || (ts > 0 && DATE_RANGES.some(r => labels.includes(r.label) && r.test(now - ts)));

export const EMPTY_FILTERS = { status: [], referredTo: [], created: [] };

export function filterDefsFor(view) {
  return [
    { key: 'status', label: 'Status', primary: true },
    ...(view === 'referral' ? [{ key: 'referredTo', label: 'Referred To', primary: true }] : []),
    { key: 'created', label: view === 'medication' ? 'Start Date' : 'Created On', primary: true },
  ];
}

/** Rows a view keeps for the search text and filters. */
export function applyFilters(rows, { query, filters }, now = Date.now()) {
  const q = query.trim().toLowerCase();
  return rows.filter(r => (!q || r.search.includes(q))
    && (!filters.status.length || filters.status.includes(r.status))
    && (!filters.referredTo.length || filters.referredTo.includes(r.toName))
    && inRanges(r.dateTs, filters.created, now));
}

const STATUS_TONE = {
  'Signed & Referred': 'warning',
  Ordered: 'warning',
  Completed: 'success',
  Active: 'success',
};
export const toneOf = status => STATUS_TONE[status] || 'muted';

const pad = n => String(n).padStart(2, '0');
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDate = d => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
const fmtDateTime = d => `${fmtDate(d)}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

export function referralRow(r) {
  const d = toDate(r.createdAt);
  return {
    id: r.id,
    raw: r,
    fromName: r.referredByName,
    fromSpecialty: r.referredBySpecialty,
    toName: r.referredToName,
    toSpecialty: r.referredToSpecialty,
    status: r.status,
    attachments: r.attachments,
    dateTs: d ? d.getTime() : 0,
    dateLabel: d ? fmtDateTime(d) : '',
    search: [r.referredByName, r.referredBySpecialty, r.referredToName, r.referredToSpecialty, r.status].join(' ').toLowerCase(),
  };
}

export function medicationRow(m) {
  const d = toDate(m.start);
  return {
    id: m.id,
    raw: m,
    name: m.name,
    detail: m.sig,
    status: m.status || 'Active',
    dateTs: d ? d.getTime() : 0,
    dateLabel: d ? fmtDate(d) : '',
    search: [m.name, m.sig, m.status].join(' ').toLowerCase(),
  };
}

export function orderRow(o) {
  const d = toDate(o.createdAt);
  const due = toDate(o.dueDate);
  return {
    id: o.id,
    raw: o,
    name: o.name,
    detail: due ? `Due ${fmtDate(due)}` : '',
    by: o.orderedBy,
    priority: o.priority,
    status: o.status,
    dateTs: d ? d.getTime() : 0,
    dateLabel: d ? fmtDateTime(d) : '',
    search: [o.name, o.reason, o.orderedBy, o.priority, o.status].join(' ').toLowerCase(),
  };
}

export const optionsOf = (rows, key) => [...new Set(rows.map(r => r[key]).filter(Boolean))].sort();

/** Runs a save, keeping the drawer open (and the buttons disabled) until it settles. */
export async function runSave(setSaving, save, onClose) {
  setSaving(true);
  const ok = await save();
  setSaving(false);
  if (ok) onClose();
}
