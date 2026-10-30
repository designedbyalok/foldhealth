/**
 * Why appointments are cancelled (VBC-25651, Figma 3023:575134), in the
 * order the Cancel Appointments dialog lists them. The table
 * appointment_cancel_reasons holds the practice's list; this is the
 * fallback until it exists, and what the seed writes.
 */
export const CANCEL_REASONS = [
  { id: 'cr-covid-fears', label: 'Covid Fears', sortOrder: 1 },
  { id: 'cr-doctor-canceled', label: 'Doctor Cancelled appointment', sortOrder: 2 },
  { id: 'cr-death-in-family', label: 'Death in the family', sortOrder: 3 },
  { id: 'cr-no-show', label: 'No show', sortOrder: 4 },
  { id: 'cr-no-show-no-call', label: 'No Show - No Call', sortOrder: 5 },
];

// Reasons from an earlier list, turned off wherever they were already seeded.
export const RETIRED_CANCEL_REASON_IDS = ['cr-cancellation-test', 'cr-new-cancellation'];

export const cancelReasonToRow = (r) => ({ id: r.id, label: r.label, sort_order: r.sortOrder, active: true });
export const rowToCancelReason = (r) => ({ id: r.id, label: r.label, sortOrder: r.sort_order });
