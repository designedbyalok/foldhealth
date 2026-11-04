import { useEffect, useMemo, useState } from 'react';
import { Select } from '../../../../../../components/Select/Select';
import { searchProcedures } from '../../../../../../lib/procedureLookup';

/**
 * Procedure picker over the NLM Clinical Tables procedure list. Selecting
 * hands back the coded concept, not just its text.
 */
export function ProcedureSelect({ value, onChange, leadingIcon }) {
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
        setItems(await searchProcedures(term, { signal: controller.signal }));
      } catch (err) {
        if (err.name !== 'AbortError') setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const options = useMemo(() => items.map(i => ({ value: i.code, label: i.display })), [items]);

  const handleChange = (code) => {
    const picked = items.find(i => i.code === code);
    if (picked) onChange?.(picked);
  };

  return (
    <Select
      options={options}
      value={value}
      onValueChange={handleChange}
      placeholder="Search And Add Surgical History"
      leadingIcon={leadingIcon}
      searchable
      searchPlaceholder="Search procedures…"
      query={query}
      onQueryChange={setQuery}
      searchLoading={loading}
      emptyText={query.trim().length < 2
        ? 'Type at least 2 characters to search'
        : 'No matching procedures'}
    />
  );
}
