import { useMemo } from 'react';
import { useCovering } from '../ooo/useCovering';
import { filterDefsForList } from './tocFilters';

// Held in activeFilters as a string[] of covered people's names.
export const COVERING_FILTER_KEY = 'coveringFor';

/**
 * filterDefsForList plus, on TOC IP, a multi-select "Covering for" chip after
 * Assignee while the signed-in user is covering someone. A hook because the
 * options come from OOO records, which a plain def list can't follow.
 */
export function useTocFilterDefs(list) {
  const { names } = useCovering();
  return useMemo(() => {
    const defs = filterDefsForList(list);
    if (list !== 'TOC IP' || !names.length) return defs;
    const at = defs.findIndex(d => d.key === 'assignee') + 1;
    const covering = { key: COVERING_FILTER_KEY, label: 'Covering for', primary: true, multi: true, options: names };
    return [...defs.slice(0, at), covering, ...defs.slice(at)];
  }, [list, names]);
}
