export const TABS = [
  { key: 'all', label: 'All Tasks' },
  { key: 'assigned', label: 'Assigned to Me' },
  { key: 'pool', label: 'My Task Pool' },
  { key: 'created', label: 'Created by Me' },
  { key: 'mentions', label: 'Mentions' },
];

// Compose the single-source attribution line for row + kanban cards.
//
// A task's origin is exactly ONE of: a user, an automation, an agent, or
// a care journey — never a combination. `task.meta` sometimes carries
// that origin (e.g. "Care Journey · Hypertension Control · '24", "Pool :
// Coder", or a legacy "By : Dr. JeDee Potter" from an older schema); when
// it does, meta IS the attribution and wins outright. Otherwise we fall
// back to the mandatory `created_by` field.
//
// The prior implementation joined the two with " • " and produced
// duplicates like "By : Dr. Potter • By : Dr. Potter" on tasks whose meta
// legacy-encoded the same actor.
export function buildTaskMetaLine(task) {
  if (!task) return null;
  const meta = task.meta?.trim();
  if (meta && /^(Care Journey|Pool|By)\b/i.test(meta)) return meta;
  const actor = task.created_by?.trim() || 'Unknown';
  return `By : ${actor}`;
}

export function getInitials(name) {
  return name ? name.split(' ').map(w => w[0]).join('').slice(0, 2) : '';
}

export const AUDIT_LOG_VERB_MAP = {
  created: 'created the task.',
  status_changed: 'changed the Status',
  priority_changed: 'changed the Priority',
  due_date_changed: 'changed the Due Date',
  assignee_changed: 'changed the Assignee',
  label_added: 'added a Label',
  label_removed: 'removed a Label',
  description_changed: 'updated the Description',
  renamed: 'renamed the task',
  comment_added: 'added a Comment',
  subtask_added: 'added a Subtask',
  claimed: 'claimed the task',
  deleted: 'deleted the task.',
};

export const TASK_FILTER_DEFS = [
  // Options are populated at runtime from taskProfiles in useTasksView —
  // see filterDefs's usesProfiles branch. Empty here so the cold-load
  // dropdown never shows stale seed names.
  { key: 'assigned_to', label: 'Assigned to', primary: true, options: [] },
  { key: 'view_by', label: 'View By', primary: true, options: [
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'due_date', label: 'Due Date' },
  ]},
  { key: 'sort_by', label: 'Sort By', primary: true, options: [
    { value: 'due_date', label: 'Due Date' },
    { value: 'priority', label: 'Priority' },
    { value: 'name', label: 'Name' },
  ]},
  { key: 'created_by', label: 'Created By', primary: true, options: [] },
  { key: 'task_status', label: 'Task Status', primary: true, options: [
    { value: 'pending', label: 'Pending' },
    { value: 'missed', label: 'Missed' },
    { value: 'completed', label: 'Completed' },
  ]},
  { key: 'priority', label: 'Priority', primary: true, options: [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]},
  { key: 'labels', label: 'Labels', primary: true, options: [
    { value: 'Hypertension', label: 'Hypertension' },
    { value: 'Exercise', label: 'Exercise' },
    { value: 'Document Collection', label: 'Document Collection' },
  ]},
];

export const STATUS_ORDER = ['pending', 'missed', 'completed'];
export const STATUS_LABELS = { pending: 'Pending', missed: 'Missed', completed: 'Completed' };
export const PRIORITY_ORDER = ['high', 'medium', 'low', 'none'];
export const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low', none: 'None' };
export const STATUS_BADGE_VARIANTS = {
  pending: 'status-queued',
  missed: 'status-failed',
  completed: 'status-completed',
};
export const STATUS_COLORS = {
  pending: 'var(--status-warning)',
  missed: 'var(--status-error)',
  completed: 'var(--status-success)',
};

export const PRIORITY_COLORS = {
  high: '#FF623E',
  medium: '#FFAB00',
  low: '#0065FF',
  none: '#6F7A90',
};

// Tasks are stored as MM-DD-YYYY, but some legacy/automation rows landed as
// ISO YYYY-MM-DD. Parse both (plus MM/DD/YYYY) so overdue, sorting, and the
// calendar all stay correct regardless of the stored shape.
export function parseTaskDate(str) {
  if (!str || typeof str !== 'string') return null;
  let y, m, d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    [y, m, d] = str.split('-').map(Number);
  } else if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
    [m, d, y] = str.split(/[-/]/).map(Number);
  } else {
    return null;
  }
  if ([y, m, d].some(n => Number.isNaN(n))) return null;
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Canonical display shape for every task date: MM/DD/YYYY.
export function formatTaskDate(str) {
  const d = parseTaskDate(str);
  if (!d) return str || '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

export function todayStart() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export function todayMMDDYYYY() {
  const t = new Date();
  return `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}-${t.getFullYear()}`;
}

export function isOverdue(task) {
  if (!task || !task.due_date || task.status === 'completed') return false;
  const d = parseTaskDate(task.due_date);
  if (!d) return false;
  return d < todayStart() || task.status === 'missed';
}

export function formatDateFriendly(str) {
  if (!str) return 'Select Date';
  const d = parseTaskDate(str);
  if (!d) return str;
  const today = todayStart();
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatTaskDate(str);
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const ASSIGNEE_OPTIONS = ['Dr. JeDee Potter', 'Deborah Hintz', 'Dr. Robert Frost', 'Celia Gerhold'];
export const TASK_POOL_OPTIONS = ['Patient Outreach', 'Care Management', 'Follow-up', 'Documentation', 'HEDIS Sign-Off'];
export const MEMBER_OPTIONS = ['Celia Gerhold', 'Ralph Kessler', 'Robert Langdon', 'Cameron Haley'];
export const PRIORITY_OPTIONS = ['high', 'medium', 'low'];
export const LABEL_OPTIONS = ['Hypertension', 'Exercise', 'Document Collection', 'Medication', 'Diabetes', 'Follow-up'];
export const TITLE_MAX = 200;
export const PAGE_SIZE = 5;
export const PROG_TASKS_PER_PAGE = 5;
