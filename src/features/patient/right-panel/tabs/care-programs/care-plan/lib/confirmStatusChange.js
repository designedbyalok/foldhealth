import { useAppStore } from '../../../../../../../store/useAppStore';
import { formatStatusReason } from './gbiStatusReasons';

/**
 * Asks why `items` ([{ type: 'goal'|'intervention'|'barrier', item }]) move
 * to `to` (#62). Resolves to null when the care manager cancels, else to
 * { reason, note } (empty when nothing actually changes status, or when the
 * org has the reason prompt off). The store keeps the answer for the save's
 * gbi_status_history row.
 */
export async function confirmStatusChange(items, to, { source = 'manual' } = {}) {
  const moving = items.filter(({ item }) => item && item.status !== to);
  if (!moving.length || !useAppStore.getState().askStatusChangeReason) return { reason: null, note: null };
  return useAppStore.getState().requestGbiStatusReason({
    items: moving.map(({ type, item }) => ({ type, id: item.id, title: item.title, from: item.status })),
    to,
    source,
  });
}

/** The status-reason field to save with the status, where the item carries one. */
export function statusReasonPatch(item, result) {
  return item && 'statusReason' in item ? { statusReason: formatStatusReason(result || {}) } : {};
}

/** A reason the app supplies itself, for a status set as part of another action. */
export function presetStatusReason(item, reason) {
  useAppStore.getState().presetGbiStatusReason([item.id], { reason });
  return statusReasonPatch(item, { reason });
}
