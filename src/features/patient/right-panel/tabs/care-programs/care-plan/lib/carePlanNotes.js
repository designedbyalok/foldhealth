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
