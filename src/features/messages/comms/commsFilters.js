// Comms list filters (the FilterChip row under the tabs): their shape and
// whether any is set. Date uses the shared DateRangeFilter presets
// (inDatePreset from components/DateRangeFilter/dateRangePresets).

export const EMPTY_COMMS_FILTERS = { datePreset: null, dateRange: [], inbox: null, channels: [], covering: [] };

/** Whether any filter is set (for the header's Filter button). */
export const commsFiltersActive = (f) => !!f.datePreset || !!f.inbox || f.channels.length > 0 || f.covering.length > 0;

/**
 * Covering for, threads with no inbox: the staff member who last wrote to the
 * patient in each conversation (Out of Office auto-replies don't count).
 * `rows` are listStaffSends rows, newest first. Returns conversation id → name.
 */
export function lastStaffSenders(rows = []) {
  const last = new Map();
  rows.forEach((r) => {
    if (last.has(r.conversation_id) || r.auto_reply === 'true' || !r.sender_name) return;
    last.set(r.conversation_id, r.sender_name);
  });
  return last;
}
