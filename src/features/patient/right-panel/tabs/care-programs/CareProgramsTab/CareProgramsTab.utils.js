import { PROGRAM_STEPS } from '../../../../data/programActivityMock';

// URL key for a program row — code slug plus the trigger ordinal past 1
// ('awv', 'toc-ip', 'snp-2'). Trigger is derived deterministically from
// created_at order in the store, so key ↔ program survives a refresh even
// though row ids never appear in the URL.
export const programUrlKey = (p) => {
  const slug = String(p.code || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (p.trigger || 1) > 1 ? `${slug}-${p.trigger}` : slug;
};

export const SUB_STATUS_OPTIONS = ['Assigned', 'Unassigned'];
export const DATE_RANGE_OPTIONS = ['Last 7 days', 'Last 30 days', 'Last 90 days'];
export const EMPTY_FILTERS = { assignee: [], program: [], status: [], subStatus: [], startDate: [], endDate: [] };

export const ROW_MENU_ITEMS = [
  { key: 'assign', icon: 'solar:user-plus-rounded-linear', label: 'Assign to' },
  { key: 'print',  icon: 'solar:printer-linear',           label: 'Print Summary' },
  { key: 'close',  icon: 'solar:close-circle-linear',      label: 'Close Program', danger: true },
];

export const matchesTab = (p, tab) => {
  if (tab === 'New') return p.status === 'New';
  if (tab === 'Enrolled') return p.status === 'Enrolled' || p.status === 'Engaged';
  if (tab === 'Completed') return p.status === 'Completed';
  if (tab === 'Closed') return p.status === 'Closed';
  return true;
};

export const stepProgress = (code) => {
  const list = PROGRAM_STEPS[code] || [];
  const flat = list.flatMap(s => (s.type === 'section' ? (s.children || []) : [s]));
  if (!flat.length) return 0;
  const done = flat.filter(s => s.status === 'completed').length;
  return Math.round((done / flat.length) * 100);
};

export const todayStr = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};
