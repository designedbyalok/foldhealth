// Care-program status vocabulary + per-status text color. Shared by the Care
// Programs table Status cell and the program-detail header status dropdown so
// both offer the same options and colors. Outreach states (Attempted, Unable
// to Reach, Declined) and lifecycle states (Active, Paused, Completed,
// Discontinued, Re-enrolled) share one list.
export const PROGRAM_STATUS_OPTIONS = [
  'New', 'Engaged', 'Attempted', 'Unable to Reach', 'Declined', 'Enrolled',
  'Active', 'Paused', 'Completed', 'Discontinued', 'Re-enrolled',
];

// Warning (in outreach / enrollment), success (active), info (paused),
// neutral (declined / ended), error (unable to reach).
export const STATUS_COLOR = {
  New:               'var(--primary-300)',
  Engaged:           'var(--status-warning)',
  Enrolled:          'var(--status-warning)',
  Attempted:         'var(--status-warning)',
  Declined:          'var(--neutral-300)',
  'Unable to Reach': 'var(--status-error)',
  Active:            'var(--status-success)',
  Paused:            'var(--status-info)',
  Completed:         'var(--neutral-300)',
  Discontinued:      'var(--neutral-300)',
  'Re-enrolled':     'var(--primary-300)',
  Closed:            'var(--neutral-300)',
};

export const statusColorFor = (status) => STATUS_COLOR[status] || 'var(--primary-300)';

// Ended enrollments. "Closed" is the status programs ended with before
// Completed / Discontinued existed; it still counts.
const CLOSED_STATUSES = new Set(['Completed', 'Discontinued', 'Closed']);
export const isProgramClosed = (status) => CLOSED_STATUSES.has(status);

// Why an enrollment ended. Goal met ends it as Completed; the rest as
// Discontinued (unless the user picked the status themselves).
export const CLOSURE_REASONS = [
  { value: 'goal_met', label: 'Goal met', status: 'Completed' },
  { value: 'lost_to_follow_up', label: 'Lost to follow-up', status: 'Discontinued' },
  { value: 'opt_out', label: 'Patient opted out', status: 'Discontinued' },
  { value: 'transferred', label: 'Transferred', status: 'Discontinued' },
  { value: 'other', label: 'Other', status: 'Discontinued' },
];
export const closureReasonLabel = (value) => CLOSURE_REASONS.find(r => r.value === value)?.label || null;
