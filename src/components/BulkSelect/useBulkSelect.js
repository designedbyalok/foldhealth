import { useState, useCallback } from 'react';

/**
 * Bulk-select mode for a table: a toggle plus a Set of selected row ids.
 *
 * The Set keeps add/remove O(1) and clears cheaply when leaving bulk mode.
 * Mirrors the pattern the Forms/Emails content tables use, extracted so every
 * settings table shares one implementation.
 *
 * @param {*} resetKey  When this value changes the mode + selection reset —
 *   pass the active tab / list id so selections never bleed across lists.
 */
export function useBulkSelect(resetKey) {
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Reset mode + selection when the surface changes (tab switch, list change),
  // so selections never bleed across lists. This is React's "adjust state
  // while rendering" pattern for resetting on a prop change — cheaper and more
  // correct than an effect (no extra render, no flash of stale selection).
  const [prevKey, setPrevKey] = useState(resetKey);
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setBulkMode(false);
    setSelectedIds(new Set());
  }

  const toggleId = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Select-all / deselect-all across the given rows (typically the current
  // page). If every row is already selected, clear them; otherwise add them.
  const toggleAll = useCallback((rows) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = rows.length > 0 && rows.every((r) => next.has(r.id));
      if (allSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }, []);

  // Explicit add/remove of a batch — for a header select-all checkbox that
  // passes the desired boolean state rather than a toggle.
  const setMany = useCallback((ids, on) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const enterBulk = useCallback(() => setBulkMode(true), []);
  const exitBulk = useCallback(() => { setBulkMode(false); setSelectedIds(new Set()); }, []);
  const toggleBulk = useCallback(() => {
    setBulkMode((on) => {
      if (on) setSelectedIds(new Set());
      return !on;
    });
  }, []);

  return {
    bulkMode,
    selectedIds,                 // Set
    selectedIdList: [...selectedIds], // Array — for WorklistShell / BulkBar
    count: selectedIds.size,
    isSelected: (id) => selectedIds.has(id),
    toggleId,
    toggleAll,
    setMany,
    clearSelection,
    enterBulk,
    exitBulk,
    toggleBulk,
  };
}
