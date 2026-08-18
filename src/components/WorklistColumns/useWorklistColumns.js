import { useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Column preferences for one worklist. Returns the effective ordered column
 * list (respecting the user's drag order + hidden set) plus stable callbacks
 * the shared ColumnConfigPopover needs. Column defs may use either the
 * ColumnConfigPopover shape ({ k, lb }) or the WorklistShell shape
 * ({ key, label }) — this hook accepts both.
 *
 * @param worklistKey  Stable key persisted in Supabase (e.g. 'toc-queue').
 * @param defaultColumns Array of column defs in the default order.
 * @param options.hiddenByDefault  Column keys to skip on first render — e.g.
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

  const orderedColumns = useMemo(() => {
    const order = prefs?.order || [];
    if (!order.length) return defaultColumns;
    const byKey = new Map(defaultColumns.map(c => [c.key || c.k, c]));
    const seen = new Set();
    const out = [];
    for (const k of order) {
      const c = byKey.get(k);
      if (c && !seen.has(k)) { out.push(c); seen.add(k); }
    }
    for (const c of defaultColumns) {
      const k = c.key || c.k;
      if (!seen.has(k)) out.push(c);
    }
    return out;
  }, [defaultColumns, prefs?.order]);

  const hiddenSet = useMemo(() => {
    const hidden = new Set(prefs?.hidden || []);
    for (const k of options.hiddenByDefault || []) {
      if (!prefs) hidden.add(k);
    }
    return hidden;
  }, [prefs, options.hiddenByDefault]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter(c => !hiddenSet.has(c.key || c.k)),
    [orderedColumns, hiddenSet],
  );

  return {
    orderedColumns,
    visibleColumns,
    hiddenSet,
    onToggle: (k) => toggle(worklistKey, k),
    onReorder: (fromKey, toKey) => reorder(worklistKey, fromKey, toKey),
    onReset: () => reset(worklistKey),
  };
}

/**
 * Normalize a column def (either { k, lb } or { key, label }) to the
 * ColumnConfigPopover's { k, lb } shape.
 */
export function toPopoverColumns(columns) {
  return columns.map(c => ({ k: c.key || c.k, lb: c.label || c.lb }));
}
