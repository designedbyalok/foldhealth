import { useEffect, useMemo, useState } from 'react';
import { Select } from '../../../../../../components/Select/Select';
import { searchImmunizations } from '../../../../../../lib/immunizationLookup';

/**
 * Vaccine picker over the CDC's CVX code set. Selecting hands back the coded
 * concept, not just its text, so the immunization is stored with the code it
 * came from.
 */
export function ImmunizationSelect({ value, onChange, leadingIcon }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    const controller = new AbortController();
    // Debounced, and each request aborts the one before it, so a slow early
    // response cannot overwrite a newer one.
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (term.length < 2) {
          setItems([]);
          return;
        }
        setItems(await searchImmunizations(term, { signal: controller.signal }));
      } catch (err) {
        if (err.name !== 'AbortError') setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  // CVX codes are the identity: two vaccines can share a short description
  // across formulations, so the code keeps them distinct.
  const options = useMemo(() => items.map(i => ({
    value: i.code,
    label: i.display,
    // Retired codes stay searchable for recording history, but say so.
    searchText: `${i.display} ${i.fullName}`,
  })), [items]);

  const handleChange = (code) => {
    const picked = items.find(i => i.code === code);
    if (picked) onChange?.(picked);
  };

  return (
    <Select
      options={options}
      value={value}
      onValueChange={handleChange}
      placeholder="Search And Add Immunizations"
      leadingIcon={leadingIcon}
      searchable
      searchPlaceholder="Search vaccines…"
      query={query}
      onQueryChange={setQuery}
      searchLoading={loading}
      emptyText={query.trim().length < 2
        ? 'Type at least 2 characters to search'
        : 'No matching vaccines'}
    />
  );
}
