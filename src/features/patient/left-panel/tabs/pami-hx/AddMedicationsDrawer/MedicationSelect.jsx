import { useEffect, useState } from 'react';
import { Select } from '../../../../../../components/Select/Select';
import { searchMedications } from '../../../../../../lib/openfda';

/**
 * Medication picker: single-select, backed by the OpenFDA NDC lookup that
 * Medication Reconciliation already uses, so a drug picked here is named the
 * same way it is named there.
 */
export function MedicationSelect({ value, onChange, leadingIcon }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    const controller = new AbortController();
    // Every state write sits inside the timer: setting state synchronously in
    // an effect body cascades renders.
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (term.length < 2) {
          setOptions([]);
          return;
        }
        const results = await searchMedications(term, { signal: controller.signal });
        const names = results.map(r => r.displayName).filter(Boolean);
        setOptions([...new Set(names)].map(v => ({ value: v, label: v })));
      } catch (err) {
        if (err.name !== 'AbortError') setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <Select
      options={options}
      value={value}
      onValueChange={onChange}
      placeholder="Search And Add Medications"
      leadingIcon={leadingIcon}
      searchable
      searchPlaceholder="Search medications…"
      query={query}
      onQueryChange={setQuery}
      searchLoading={loading}
      emptyText={query.trim().length < 2
        ? 'Type at least 2 characters to search'
        : 'No matching medications'}
    />
  );
}
