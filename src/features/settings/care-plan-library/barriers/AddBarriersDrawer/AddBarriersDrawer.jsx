import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { Input } from '../../../../../components/Input/Input';
import { Badge } from '../../../../../components/Badge/Badge';
import { Icon } from '../../../../../components/Icon/Icon';
import { Checkbox } from '../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { useAppStore } from '../../../../../store/useAppStore';
import styles from './AddBarriersDrawer.module.css';

function normTitle(value) {
  return (value || '').trim().toLowerCase();
}

/**
 * Add Barriers — barrier picker for the Care Plan GBI table.
 * Figma SNP-Story 7550:489275.
 */
export function AddBarriersDrawer({ onClose, onAdd, existingBarriers = [] }) {
  const libraryBarriers = useAppStore(s => s.carePlanBarriers);
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);

  useEffect(() => {
    if (!libraryDidFetch) fetchCarePlanLibrary();
  }, [libraryDidFetch, fetchCarePlanLibrary]);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const addedTitles = useMemo(
    () => new Set(existingBarriers.map(b => normTitle(b.title))),
    [existingBarriers],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return libraryBarriers
      .map(b => ({
        ...b,
        added: addedTitles.has(normTitle(b.title)),
      }))
      .filter(b => {
        if (!q) return true;
        return b.title.toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q);
      });
  }, [libraryBarriers, addedTitles, query]);

  const addedRows = useMemo(() => rows.filter(b => b.added), [rows]);
  const availableRows = useMemo(() => rows.filter(b => !b.added), [rows]);

  // "Search or Enter Barrier": when the typed text matches no library or
  // already-added barrier, offer to create it as a custom (free-text) barrier.
  const trimmed = query.trim();
  const knownTitles = useMemo(
    () => new Set([...libraryBarriers.map(b => normTitle(b.title)), ...addedTitles]),
    [libraryBarriers, addedTitles],
  );
  const canCreate = !!trimmed && !knownTitles.has(normTitle(trimmed));

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // Add any checked library barriers plus the typed custom one. The parent
  // saver keys off title/description, so a custom object with no library id
  // persists exactly like a picked one.
  const handleCreate = () => {
    if (!canCreate) return;
    const picks = libraryBarriers.filter(b => selected.has(b.id));
    onAdd?.([...picks, { id: `custom-${normTitle(trimmed).replace(/\s+/g, '-')}`, title: trimmed, description: '' }]);
  };

  const headerRight = (
    <>
      <Button
        variant="primary"
        size="L"
        disabled={selected.size === 0}
        onClick={() => onAdd?.(libraryBarriers.filter(b => selected.has(b.id)))}
      >
        Add
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  const renderRow = (barrier, { disabled = false } = {}) => (
    <div key={barrier.id} className={styles.rowWrap}>
      <label className={`${styles.row} ${disabled ? styles.rowDisabled : ''}`}>
        <Checkbox
          checked={disabled || selected.has(barrier.id)}
          disabled={disabled}
          onCheckedChange={() => !disabled && toggle(barrier.id)}
          aria-label={`Select ${barrier.title}`}
        />
        <span className={styles.rowText}>{barrier.title}</span>
        {disabled ? <Badge tone="grey" size="M" label="Added" /> : null}
      </label>
    </div>
  );

  return (
    <Drawer title="Add Barriers" onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <Input
          type="search"
          aria-label="Search or Enter Barrier"
          placeholder="Search or Enter Barrier"
          leadingIcon="solar:magnifer-linear"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); handleCreate(); } }}
        />

        <div className={styles.list}>
          {canCreate && (
            <button type="button" className={styles.createRow} onClick={handleCreate}>
              <Icon name="solar:add-circle-linear" size={18} color="var(--primary-300)" />
              <span className={styles.createText}>Create “{trimmed}”</span>
            </button>
          )}
          {rows.length === 0 ? (
            canCreate ? null : (
              <p className={styles.empty}>
                {libraryBarriers.length === 0
                  ? 'No barriers in the library yet.'
                  : `No barriers match “${query.trim()}”.`}
              </p>
            )
          ) : (
            <>
              {addedRows.length > 0 && (
                <>
                  <span className={styles.groupLabel}>Already Added</span>
                  {addedRows.map(b => renderRow(b, { disabled: true }))}
                </>
              )}
              {addedRows.length > 0 && availableRows.length > 0 && (
                <span className={styles.groupDivider} />
              )}
              {availableRows.map(b => renderRow(b))}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
