import { useMemo, useState } from 'react';
import { Select } from '../../../../../components/Select/Select';
import { useAppStore } from '../../../../../store/useAppStore';
import styles from './InterventionLibrarySelect.module.css';

/**
 * "From library" picker for a new care plan intervention. Lists the
 * intervention library items of one kind and hands the picked item back so
 * the drawer can fill its fields. Renders nothing when the library has no
 * items of that kind.
 */
export function InterventionLibrarySelect({ kind, onPick }) {
  const library = useAppStore(s => s.carePlanInterventionTemplates);
  const [pickedId, setPickedId] = useState('');
  const items = useMemo(
    () => (library || [])
      .filter(t => t.kind === kind && t.title)
      .sort((a, b) => a.title.localeCompare(b.title)),
    [library, kind],
  );
  const options = useMemo(() => items.map(t => ({
    value: t.id,
    label: (
      <span className={styles.option}>
        <span className={styles.title}>{t.title}</span>
        {t.description && <span className={styles.description}>{t.description}</span>}
      </span>
    ),
    triggerLabel: t.title,
    searchText: `${t.title} ${t.description || ''}`,
  })), [items]);

  if (items.length === 0) return null;
  return (
    <Select
      label="From library"
      placeholder="Pick from the library to fill in the fields"
      options={options}
      value={pickedId}
      onChange={(id) => {
        setPickedId(id);
        const item = items.find(t => t.id === id);
        if (item) onPick(item);
      }}
      searchable
      searchPlaceholder="Search the library"
    />
  );
}
