import { useMemo } from 'react';
import { FilterBar as BaseFilterBar } from '../../components/FilterBar/FilterBar';
import { useAppStore } from '../../store/useAppStore';
import { FILTER_DOMAINS } from '../hcc/filterDomains';
import { filterDefsForList } from '../toc/tocFilters';
import { DefaultViewByToggle } from './DefaultViewByToggle';

// A filter's options: its own list, or (optionsFromData) the distinct values
// of that field across the patients.
function resolveOptions(filterDef, patients) {
  if (filterDef.optionsFromData) {
    const unique = [...new Set((patients || []).flatMap(p => { const v = p[filterDef.key]; return v ? [v] : []; }))];
    return unique.sort().map(a => ({ value: a, label: a }));
  }
  return filterDef.options || [];
}

/**
 * FilterBar for the app's worklists. Anything the caller doesn't pass falls
 * back to the store's worklist filters: the active list's filter defs, its
 * values and setters, options read from the patients, saving under the active
 * list, the Outreach view switch on the left (pass `leading={null}` to drop
 * it), and the spec's domain order in More Filters.
 */
export function FilterBar(props) {
  const activeFilters = useAppStore(s => s.activeFilters);
  const setFilter = useAppStore(s => s.setFilter);
  const clearAllFilters = useAppStore(s => s.clearAllFilters);
  const patients = useAppStore(s => s.patients);
  const activeSubnavList = useAppStore(s => s.activeSubnavList);
  const saveSavedFilter = useAppStore(s => s.saveSavedFilter);
  const filterDefs = useMemo(
    () => props.filterDefs ?? filterDefsForList(activeSubnavList),
    [props.filterDefs, activeSubnavList],
  );
  return (
    <BaseFilterBar
      groupOrder={FILTER_DOMAINS}
      {...props}
      filterDefs={filterDefs}
      filters={props.filters ?? activeFilters}
      getOptions={props.getOptions ?? ((def) => resolveOptions(def, patients))}
      onFilterChange={props.onFilterChange ?? ((key, next) => setFilter(key, next))}
      onClearAll={props.onClearAll ?? clearAllFilters}
      onSaveFilter={props.onSaveFilter ?? ((name) => saveSavedFilter(activeSubnavList || 'TCM', name))}
      leading={props.leading === undefined ? <DefaultViewByToggle /> : props.leading}
    />
  );
}
