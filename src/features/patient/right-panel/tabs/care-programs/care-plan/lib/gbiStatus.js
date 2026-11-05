/* The care plan GBI (goal / barrier / intervention) status vocabulary: what
   each status looks like, which pickers offer it, and how reporting counts
   it. Every badge, picker, filter and rollup reads from here so a status
   means the same thing on every surface. Statuses are stored as these
   labels (plain text columns, no constraint). */

/** Badge tone and icon per status (In Progress uses the design system's
 *  Pending glyph). `hint` explains the newer ones in pickers. */
export const GBI_STATUS_META = {
  'Not Started': { tone: 'grey', icon: 'solar:minus-circle-linear' },
  'In Progress': { tone: 'warning', icon: 'custom:pending' },
  'On Hold': { tone: 'info', icon: 'solar:pause-circle-linear', hint: 'Temporary pause' },
  UTR: { tone: 'error', icon: 'solar:phone-calling-rounded-linear', hint: 'Patient unable to reach' },
  Met: { tone: 'success', icon: 'solar:check-circle-linear' },
  Resolved: { tone: 'success', icon: 'solar:shield-check-linear' },
  'Not Met': { tone: 'error', icon: 'solar:close-circle-linear' },
  Discontinued: { tone: 'secondary', icon: 'solar:stop-circle-linear', hint: 'Patient refusal' },
  'Not Applicable': { tone: 'disabled', icon: 'solar:forbidden-circle-linear', hint: 'Never relevant for this patient' },
  // Derived from a missed date, never picked.
  Overdue: { tone: 'error', icon: 'solar:danger-circle-linear' },
};

const FALLBACK_META = GBI_STATUS_META['Not Started'];
export const gbiStatusMeta = (status) => GBI_STATUS_META[status] || FALLBACK_META;

/** What goals and interventions can be set to. */
export const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'UTR', 'Met', 'Not Met', 'Discontinued', 'Not Applicable'];

/** Barriers add Resolved (and keep Met for barriers already recorded that way). */
export const BARRIER_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'UTR', 'Resolved', 'Met', 'Not Met', 'Discontinued', 'Not Applicable'];

/** Every status an item can hold, in display order: filters and status mixes. */
export const ALL_GBI_STATUSES = BARRIER_STATUSES;

/** The picker list for a kind: 'barrier' gets Resolved; goals and interventions don't. */
export const gbiStatusesFor = (kind) => (kind === 'barrier' ? BARRIER_STATUSES : GBI_STATUSES);

/** The CSS color each badge tone paints its text and icon in. */
const TONE_COLOR = {
  grey: 'var(--neutral-400)',
  warning: 'var(--status-warning)',
  info: 'var(--status-info)',
  success: 'var(--status-success)',
  error: 'var(--status-error)',
  secondary: 'var(--secondary-300)',
  disabled: 'var(--neutral-200)',
};
export const gbiStatusColor = (status) => TONE_COLOR[gbiStatusMeta(status).tone];

// ── Reporting ──
// Achieved counts as success, Not Met as the only failure. Discontinued and
// Not Applicable close an item without judging it: they leave the active
// list and drop out of completion-rate denominators, and never count as a
// failure. Everything else (Not Started, In Progress, On Hold, UTR) is open.
const ACHIEVED = new Set(['Met', 'Resolved']);
const FAILED = new Set(['Not Met']);
const EXCLUDED = new Set(['Discontinued', 'Not Applicable']);

export const isAchievedStatus = (status) => ACHIEVED.has(status);
export const isFailedStatus = (status) => FAILED.has(status);
/** Closed without an outcome: out of completion rates, not a failure. */
export const isExcludedStatus = (status) => EXCLUDED.has(status);
/** Any final status; open items are the rest. */
export const isClosedStatus = (status) => ACHIEVED.has(status) || FAILED.has(status) || EXCLUDED.has(status);

/**
 * Completion over a set of GBI items: achieved / counted, where counted
 * leaves out Discontinued and Not Applicable. `rate` is 0–100 (0 when
 * nothing counts).
 */
export function gbiCompletion(items) {
  let achieved = 0;
  let failed = 0;
  let excluded = 0;
  for (const x of items) {
    if (ACHIEVED.has(x?.status)) achieved += 1;
    else if (FAILED.has(x?.status)) failed += 1;
    else if (EXCLUDED.has(x?.status)) excluded += 1;
  }
  const counted = items.length - excluded;
  return { achieved, failed, excluded, counted, rate: counted ? Math.round((achieved / counted) * 100) : 0 };
}
