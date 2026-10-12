/**
 * Every note logged on one care plan item, newest first.
 *
 * Notes are append-only audit rows, so "Update Note" adds a new row rather
 * than rewriting the old one. The drawers show the latest as a card and this
 * full list as the change log, matching the plan-level Care Note.
 *
 * `ids` is every id the item answers to (a barrier can carry legacy clone
 * ids); legacy rows logged with entityType 'note' still count.
 */
export function itemNoteHistory(audit, ids, entityType) {
  const idSet = new Set([...ids].filter(id => id != null).map(String));
  return (audit || [])
    .filter(a => a.action === 'note'
      && (a.entityType === entityType || a.entityType === 'note')
      && idSet.has(String(a.entityId)))
    .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
}

/**
 * The item's current note: its latest note row, unless a later
 * `note_deleted` row on the same item cleared it. Same rule for goals,
 * interventions and barriers.
 */
export function latestItemNote(audit, ids, entityType) {
  const idSet = new Set([...ids].filter(id => id != null).map(String));
  const rows = (audit || []).filter(a => (a.entityType === entityType || a.entityType === 'note')
    && idSet.has(String(a.entityId)));
  const newest = action => rows.filter(a => a.action === action)
    .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];
  const note = newest('note');
  if (!note) return null;
  const clear = newest('note_deleted');
  if (clear && new Date(clear.createdAt) >= new Date(note.createdAt)) return null;
  return note;
}
