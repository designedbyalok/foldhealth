// Why a goal, intervention or barrier changed status (#62). Every status
// change asks for a reason and an optional note; closing (Met / Resolved),
// Discontinued and On Hold can't be saved without one, so auditors and
// signers see the justification. Each change is a gbi_status_history row
// (gbi_status_history_migration.sql).

const REASONS = {
  'Met': ['Goal met', 'Target reached', 'Patient reports goal achieved', 'Confirmed by lab or vital result'],
  'Resolved': ['Barrier resolved', 'Resources connected', 'Patient no longer reports it', 'Resolved by intervention'],
  'Discontinued': ['Patient refused', 'Replaced by new goal', 'No longer clinically relevant', 'Duplicate', 'Patient deceased', 'Disenrolled from program'],
  'On Hold': ['Patient hospitalized', 'Patient unavailable', 'Waiting on provider', 'Waiting on patient', 'Program paused'],
  'Not Met': ['Target not reached by due date', 'Patient non-adherent', 'Clinical condition worsened', 'Barrier not resolved'],
  'Not Applicable': ['Does not apply to this patient', 'Entered in error', 'Covered by another program'],
  'UTR': ['Unable to reach after outreach attempts', 'Wrong phone number', 'No response to messages'],
  'In Progress': ['Work started', 'Patient engaged', 'Resumed after hold'],
  'Not Started': ['Reopened', 'Status set in error', 'Waiting to start'],
};

const REQUIRED = new Set(['Met', 'Resolved', 'Discontinued', 'On Hold']);

/** The standard reasons offered when an item moves to `status`. */
export function statusReasonsFor(status) {
  return REASONS[status] || [];
}

/** Whether a move to `status` can't be saved without a reason. */
export function statusReasonRequired(status) {
  return REQUIRED.has(status);
}

/** One line for History and tooltips: "Patient refused: prefers to wait". */
export function formatStatusReason({ reason, note } = {}) {
  return [reason, note].filter(Boolean).join(': ');
}
