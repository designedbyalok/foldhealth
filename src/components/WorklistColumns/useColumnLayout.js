import { useMemo } from 'react';

/**
 * Column layout for a table the user can reorder and hide columns in.
 * Applies saved preferences to the default columns: the user's drag order
 * (columns missing from it keep their default place after it) and the hidden
 * set. Column defs may use either the ColumnConfigPopover shape ({ k, lb }) or
 * the WorklistShell shape ({ key, label }).
 *
 * Pure: the caller stores the preferences (see features/worklists for the
 * worklists' Supabase-backed hook).
 *
 * @param defaultColumns Array of column defs in the default order.
 * @param prefs { order?: string[], hidden?: string[] } | null
 * @param hiddenByDefault Column keys hidden until the user has saved prefs.
 * @returns {{ orderedColumns, visibleColumns, hiddenSet }}
 */
export function useColumnLayout(defaultColumns, prefs, hiddenByDefault) {
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
    for (const k of hiddenByDefault || []) {
      if (!prefs) hidden.add(k);
    }
    return hidden;
  }, [prefs, hiddenByDefault]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter(c => !hiddenSet.has(c.key || c.k)),
    [orderedColumns, hiddenSet],
  );

  return { orderedColumns, visibleColumns, hiddenSet };
}

/**
 * Normalize a column def (either { k, lb } or { key, label }) to the
 * ColumnConfigPopover's { k, lb } shape.
 */
export function toPopoverColumns(columns) {
  // `popoverLabel` wins when set so a table header can stay compact
  // (e.g. "P", "Start") while the column-picker row reads the full name
  // ("Priority", "Start Date"). Falls back to the header label otherwise.
  return columns.map(c => ({ k: c.key || c.k, lb: c.popoverLabel || c.label || c.lb }));
}
