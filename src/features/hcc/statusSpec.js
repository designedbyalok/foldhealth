// Single source of truth for HCC status icons + colors. Used by:
//  - StatusLegend (worklist footer bar)
//  - HccWorklistRow's RoleStatusCell (Support / Coder / Reviewer columns)
//  - DiagPanel's DosStatusMenu (status pill next to assignee avatar)
//  - DosSelector (per-DOS status pill in the dropdown)
//
// Icon + color choices match the Figma legend at
//   https://www.figma.com/design/ZZbDQP2LSEzNXqq2dbFUir/HCC-Workflow
//   (node 12082-513650)
//
// Color tiers in the Figma:
//   New                 → primary (purple)
//   Awaiting / InProg / RecordReceived / Returned → warning (amber)
//   Insufficient / Rebuttal / RecordRequested → secondary (orange)
//   Reject              → error (red)
//   Completed           → success (green)
//
// Each entry exposes:
//   icon: Iconify name
//   color: text + icon color (CSS variable)
//   bg: soft tinted background for the pill
//   border: pill border color (matches color at ~20% alpha)
//   legendOrder: display order in the StatusLegend strip

export const STATUS_SPEC = {
  New: {
    // Sparkle inside a purple coin
    icon: 'solar:stars-bold',
    color: 'var(--primary-300)',
    bg: 'var(--primary-50)',
    border: 'rgba(140, 90, 226, 0.2)',
    legendOrder: 0,
  },
  Awaiting: {
    // Sun-burst: warning amber
    icon: 'solar:sun-bold',
    color: 'var(--status-warning)',
    bg: 'var(--status-warning-light)',
    border: 'rgba(217, 165, 11, 0.2)',
    legendOrder: 1,
  },
  'In Progress': {
    // Custom 50% pie chart (see StatusIcon: Figma-provided InProgressIcon).
    // The `icon` Solar name is kept as a fallback for any consumer that
    // hasn't been switched to StatusIcon yet.
    icon: 'solar:half-circle-bold',
    custom: 'in-progress',
    color: 'var(--status-warning)',
    bg: 'var(--status-warning-light)',
    border: 'rgba(217, 165, 11, 0.2)',
    legendOrder: 2,
  },
  'Record Received': {
    // Custom Figma icon (amber disc + white download arrow). Solar fallback
    // kept for any consumer not yet on StatusIcon.
    icon: 'solar:download-minimalistic-bold',
    custom: 'record-received',
    color: 'var(--status-warning)',
    bg: 'var(--status-warning-light)',
    border: 'rgba(217, 165, 11, 0.2)',
    legendOrder: 3,
  },
  Insufficient: {
    // Filled exclamation in an orange coin
    icon: 'solar:danger-circle-bold',
    color: 'var(--secondary-300)',
    bg: 'var(--secondary-100)',
    border: 'rgba(244, 122, 62, 0.2)',
    legendOrder: 4,
  },
  // QA / Compliance sent the record back. The role it went to is read-only
  // until the sender completes.
  Rebuttal: {
    icon: 'solar:chat-round-dots-bold',
    color: 'var(--secondary-300)',
    bg: 'var(--secondary-100)',
    border: 'rgba(244, 122, 62, 0.2)',
    legendOrder: 5,
  },
  'Record Requested': {
    // Clock inside an orange coin
    icon: 'solar:clock-circle-bold',
    color: 'var(--secondary-300)',
    bg: 'var(--secondary-100)',
    border: 'rgba(244, 122, 62, 0.2)',
    legendOrder: 6,
  },
  // Destination of a records request: records came back to this role to work.
  // Custom Figma return-arrow disc, in the warning tone.
  Returned: {
    icon: 'solar:undo-left-bold',
    custom: 'returned',
    color: 'var(--status-warning)',
    bg: 'var(--status-warning-light)',
    border: 'rgba(217, 165, 11, 0.2)',
    legendOrder: 6.5,
  },
  Reject: {
    // Filled X-circle in red
    icon: 'solar:close-circle-bold',
    color: 'var(--status-error)',
    bg: 'var(--status-error-light)',
    border: 'rgba(215, 40, 37, 0.2)',
    legendOrder: 7,
  },
  Completed: {
    // Filled check-circle in green
    icon: 'solar:check-circle-bold',
    color: 'var(--status-success)',
    bg: 'var(--status-success-light)',
    border: 'rgba(0, 155, 83, 0.2)',
    legendOrder: 8,
  },
  // Special states: referenced by code, not surfaced in the legend.
  // Unassigned uses the neutral palette since it's an absence-of-state.
  Unassigned: {
    icon: 'solar:user-plus-rounded-linear',
    color: 'var(--neutral-200)',
    bg: 'var(--neutral-50)',
    border: 'var(--neutral-150)',
    legendOrder: null,
  },
  Accepted: {
    icon: 'solar:check-circle-bold',
    color: 'var(--status-success)',
    bg: 'var(--status-success-light)',
    border: 'rgba(0, 155, 83, 0.2)',
    legendOrder: null,
  },
  Dismissed: {
    icon: 'solar:close-circle-bold',
    color: 'var(--neutral-300)',
    bg: 'var(--neutral-50)',
    border: 'var(--neutral-150)',
    legendOrder: null,
  },
  Closed: {
    icon: 'solar:lock-keyhole-minimalistic-bold',
    color: 'var(--neutral-300)',
    bg: 'var(--neutral-50)',
    border: 'var(--neutral-150)',
    legendOrder: null,
  },
  // QA / Compliance can be skipped on the way to billing. Neutral tone.
  Skipped: {
    icon: 'solar:skip-next-bold',
    color: 'var(--neutral-300)',
    bg: 'var(--neutral-50)',
    border: 'var(--neutral-150)',
    legendOrder: 9,
  },
  // Terminal: every review stage cleared → ready for ASM generation.
  'Billing Ready': {
    icon: 'solar:check-read-linear',
    color: 'var(--status-success)',
    bg: 'var(--status-success-light)',
    border: 'rgba(0, 155, 83, 0.2)',
    legendOrder: null,
  },
  // Post-billing terminal state: the ASM has been submitted / paid, so
  // the DOS is read-only across every role (same treatment as Reject,
  // but with a green success tone since nothing went wrong). Dollar-in-
  // circle stays legible next to "Completed" (check-circle) and
  // "Billing Ready" (check-read) at row size.
  Billed: {
    icon: 'solar:dollar-linear',
    color: 'var(--status-success)',
    bg: 'var(--status-success-light)',
    border: 'rgba(0, 155, 83, 0.2)',
    legendOrder: 10,
  },
};

// True when `status` has a real spec (vs. falling back to the "Unassigned"
// placeholder). Lets role cells avoid rendering the user-plus icon for
// statuses that aren't part of the coding workflow (e.g. AWV outreach states).
export const hasStatusSpec = (status) => !!STATUS_SPEC[canonicalStatus(status)];

// Some Supabase rows + the prototype use plural names, map them to the
// canonical singular keys above so the spec lookup keeps working without
// us having to migrate every row.
const ALIAS = {
  'Records Received': 'Record Received',
  'Records Requested': 'Record Requested',
  Rejected: 'Reject',
};

export const canonicalStatus = (label) => ALIAS[label] || label;

// Look up a status spec, falling back to "Unassigned" tones for unknowns.
export const getStatusSpec = (status) =>
  STATUS_SPEC[canonicalStatus(status)] || STATUS_SPEC.Unassigned;

// Display-label overrides: the value stored on the row (what the engine
// keys on) vs. what the coder sees in the UI. Support's default 'Awaiting'
// reads as "Action Needed"; 'Reject' reads as "Rejected".
const STATUS_DISPLAY = {
  Awaiting: 'Action Needed',
  Reject: 'Rejected',
};
export const statusDisplayLabel = (value) => {
  const c = canonicalStatus(value);
  return STATUS_DISPLAY[c] || c;
};

// Per-role status vocabularies (stored values). The status menu shows only
// the options valid for whichever role currently owns the DOS:
//   • Support gets Action Needed / Insufficient (not New / Skipped).
//   • Coder gets Record Received / Record Requested (the retrieval loop).
//   • QA + Compliance can also Request Records from either Coder or Support,
//     so 'Record Requested' surfaces on their menus too. Selecting it opens
//     a role picker (RecordsRequestDialog) before the transition commits.
// Cross-role transitions (Coder "Record Requested" → Support "Returned" →
// Support "Completed" → Coder "Record Received", plus the QA/Compliance
// variant) are driven by the assignment engine (assignment/lifecycle.js),
// not this list.
// NOTE: "Skipped" is NOT user-selectable: the assignment engine applies it
// automatically when a later role completes ahead of an earlier one
// (autoSkipEarlierRoles in lifecycle.js). It only appears as a rendered status,
// never as a menu option.
export const ROLE_STATUS_OPTIONS = {
  // Returned is never picked by hand: it's set on whoever a records request
  // goes to. Rebuttal is the reviewers' "send back" action.
  support:   ['Awaiting', 'In Progress', 'Insufficient', 'Completed', 'Reject'],
  coder:     ['New', 'In Progress', 'Record Received', 'Record Requested', 'Completed', 'Reject'],
  reviewer:  ['New', 'In Progress', 'Rebuttal', 'Record Requested', 'Completed', 'Reject'],
  reviewer2: ['New', 'In Progress', 'Rebuttal', 'Record Requested', 'Completed', 'Reject'],
};

// Fallback when no active role owns the DOS (e.g. billing / unassigned):
// the full set, deduped, so the menu is never empty.
export const ALL_STATUS_OPTIONS = [
  'New', 'Awaiting', 'In Progress', 'Record Received', 'Record Requested',
  'Insufficient', 'Rebuttal', 'Returned', 'Skipped', 'Completed', 'Reject', 'Billed',
];

// Status options ordered for the StatusLegend strip. `status` is the
// canonical key (drives the icon lookup); `label` is the display name
// (e.g. "Awaiting" → "Action Needed").
export const LEGEND_STATUSES = Object.entries(STATUS_SPEC)
  .filter(([, s]) => s.legendOrder != null)
  .sort(([, a], [, b]) => a.legendOrder - b.legendOrder)
  .map(([status, spec]) => ({ status, label: statusDisplayLabel(status), ...spec }));
