import { useEffect, useState } from 'react';
import { Select } from '../../../../../components/Select/Select';

const CONDITIONS_API = 'https://clinicaltables.nlm.nih.gov/api/conditions/v3/search';

// Select takes { value, label } pairs, plain strings render blank rows.
const asOptions = (list) => (list || []).map(v => ({ value: v, label: v }));

/**
 * Chronic-condition picker: multi-select with checkbox rows and grey badges,
 * backed by the NLM clinical-tables lookup. Shared so the goal drawer, New
 * Care Plan and the template editor all pick conditions the same way.
 */
export function ChronicConditionSelect({ value, onChange, label = 'Chronic condition', multiple = true, leadingIcon, placeholder, defaultOpen }) {
  // Remote lookup. Debounced, and each request aborts the one before it so a
  // slow early response can't overwrite a newer one.
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    const controller = new AbortController();

    if (term.length < 2) {
      setOptions([]);
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = `${CONDITIONS_API}?terms=${encodeURIComponent(term)}&maxList=10`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          setOptions([]);
          return;
        }
        const data = await res.json();
        const names = (data?.[3] || []).map(row => row?.[0]).filter(Boolean);
        setOptions(asOptions([...new Set(names)]));
      } catch (err) {
        if (err.name !== 'AbortError') setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setLoading(false);
    };
  }, [query]);

  return (
    <Select
      label={label}
      options={options}
      value={value}
      onValueChange={onChange}
      multiple={multiple}
      checkboxes={multiple}
      badges={multiple}
      placeholder={placeholder || (multiple ? 'Select chronic conditions' : 'Search And Add Problems')}
      leadingIcon={leadingIcon}
      defaultOpen={defaultOpen}
      searchable
      searchPlaceholder="Search conditions…"
      query={query}
      onQueryChange={setQuery}
      searchLoading={loading}
      emptyText={query.trim().length < 2
        ? 'Type at least 2 characters to search'
        : 'No matching conditions'}
    />
  );
}
