import { useEffect, useMemo, useState } from 'react';
import { Select } from '../../../../../../components/Select/Select';
import { searchAllergies } from '../../../../../../lib/allergyLookup';

/**
 * Allergen picker: single-select over RxNorm (drug) and SNOMED CT (everything
 * else). Selecting hands back the coded concept, not just its text, so the
 * allergy is stored with the terminology it came from.
 */
export function AllergySelect({ value, onChange, leadingIcon }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snomedFailed, setSnomedFailed] = useState(false);

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
        const { results, snomedFailed: failed } = await searchAllergies(term, { signal: controller.signal });
        setItems(results);
        setSnomedFailed(failed);
      } catch (err) {
        if (err.name !== 'AbortError') setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  // The value is the concept's code, so two allergens sharing a display name
  // stay distinct.
  const options = useMemo(() => items.map(i => ({
    value: `${i.system}|${i.code}`,
    label: i.display,
  })), [items]);

  const handleChange = (key) => {
    const picked = items.find(i => `${i.system}|${i.code}` === key);
    if (picked) onChange?.(picked);
  };

  return (
    <Select
      options={options}
      value={value}
      onValueChange={handleChange}
      placeholder="Search And Add Allergies"
      leadingIcon={leadingIcon}
      searchable
      searchPlaceholder="Search allergens…"
      query={query}
      onQueryChange={setQuery}
      searchLoading={loading}
      emptyText={query.trim().length < 2
        ? 'Type at least 2 characters to search'
        : (snomedFailed
          ? 'No drug matches. Non-drug lookup is unavailable right now.'
          : 'No matching allergens')}
    />
  );
}
