import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useColumnLayout } from '../../components/WorklistColumns/useColumnLayout';

export { toPopoverColumns } from '../../components/WorklistColumns/useColumnLayout';

/**
 * Column preferences for one worklist, saved per user (Supabase via the
 * store). Returns the effective ordered column list (respecting the user's
 * drag order + hidden set) plus stable callbacks the shared
 * ColumnConfigPopover needs.
 *
 * @param worklistKey  Stable key persisted in Supabase (e.g. 'toc-queue').
 * @param defaultColumns Array of column defs in the default order.
 * @param options.hiddenByDefault  Column keys to skip on first render, e.g.
 *   optional columns a caller wants off unless the user opts in.
 */
export function useWorklistColumns(worklistKey, defaultColumns, options = {}) {
  const prefs = useAppStore(s => s.worklistColumnPrefs[worklistKey]) || null;
  const toggle = useAppStore(s => s.toggleWorklistColumn);
  const reorder = useAppStore(s => s.reorderWorklistColumn);
  const reset = useAppStore(s => s.resetWorklistColumns);
  const setDefaultKeys = useAppStore(s => s.setWorklistDefaultColumnKeys);

  // Stash the default key order once so reorder can seed itself.
  useEffect(() => {
    const keys = defaultColumns.map(c => c.key || c.k);
    setDefaultKeys(worklistKey, keys);
  }, [worklistKey, defaultColumns, setDefaultKeys]);

  const layout = useColumnLayout(defaultColumns, prefs, options.hiddenByDefault);

  return {
    ...layout,
    onToggle: (k) => toggle(worklistKey, k, options.hiddenByDefault || []),
    onReorder: (fromKey, toKey) => reorder(worklistKey, fromKey, toKey, options.hiddenByDefault || []),
    onReset: () => reset(worklistKey, options.hiddenByDefault || []),
  };
}
