import { useState, useMemo } from 'react';

/**
 * useTableSort: generic hook for client-side table sorting.
 *
 * @param {Array} data: array of row objects
 * @param {string} [defaultKey]: initial sort column key
 * @param {string} [defaultDir='asc']: 'asc' | 'desc'
 * @returns {{ sorted, sortKey, sortDir, requestSort, setSort, clearSort }}
 *
 * Usage:
 *   const { sorted, sortKey, sortDir, requestSort } = useTableSort(rows, 'name');
 *   <th onClick={() => requestSort('name')}>Name {getSortIcon('name')}</th>
 */
export function useTableSort(data, defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const requestSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Explicit setters: used when the caller drives sort from a SortPopover
  // rather than cycle-click on a header.
  const setSort = (key, dir = 'asc') => {
    setSortKey(key);
    setSortDir(dir);
  };
  const clearSort = () => {
    setSortKey(null);
    setSortDir('asc');
  };

  const sorted = useMemo(() => {
    if (!sortKey || !data) return data || [];
    return data.toSorted((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      // Handle nulls
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Detect type and compare
      // ISO 8601 date strings: parseFloat would happily eat "2026-08-06"
      // and return 2026, so every row in the same year would tie. Detect
      // and use Date parsing before falling through to numbers.
      const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|$)/;
      if (typeof aVal === 'string' && typeof bVal === 'string' && ISO_DATE_RE.test(aVal) && ISO_DATE_RE.test(bVal)) {
        const at = Date.parse(aVal);
        const bt = Date.parse(bVal);
        if (!isNaN(at) && !isNaN(bt)) {
          return sortDir === 'asc' ? at - bt : bt - at;
        }
      }

      // Numbers (including strings that look like numbers, percentages, currencies)
      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/[^0-9.\-]/g, ''));
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/[^0-9.\-]/g, ''));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Booleans
      if (typeof aVal === 'boolean') {
        return sortDir === 'asc' ? (aVal === bVal ? 0 : aVal ? -1 : 1) : (aVal === bVal ? 0 : aVal ? 1 : -1);
      }

      // Strings (case-insensitive)
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, requestSort, setSort, clearSort };
}
