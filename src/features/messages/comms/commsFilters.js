// Comms list filters (the Filters drawer): their shape, presets and the
// last-activity window they pick.

export const DATE_PRESETS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last Week' },
  { value: 'month', label: 'Last Month' },
  { value: 'custom', label: 'Custom' },
];
export const EMPTY_COMMS_FILTERS = { date: 'all', range: null, inbox: null, channels: [], covering: [] };

/** Whether any filter is set (for the header's Filter button). */
export const commsFiltersActive = (f) => (f.date === 'custom' ? !!f.range : f.date !== 'all') || !!f.inbox || f.channels.length > 0 || f.covering.length > 0;

/**
 * The last-activity window for a filter, in ms: { from, to } (to exclusive),
 * or null for All. Worked out when the filter is applied.
 */
export function dateWindow(f, now = new Date()) {
  if (f.date === 'custom') {
    if (!f.range?.start || !f.range?.end) return null;
    const from = new Date(`${f.range.start}T00:00:00`).getTime();
    const to = new Date(`${f.range.end}T00:00:00`).getTime() + 86400000;
    return { from, to };
  }
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const today = day.getTime();
  if (f.date === 'today') return { from: today, to: Infinity };
  if (f.date === 'yesterday') return { from: today - 86400000, to: today };
  if (f.date === 'week') return { from: today - 6 * 86400000, to: Infinity };
  if (f.date === 'month') return { from: today - 29 * 86400000, to: Infinity };
  return null;
}

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
