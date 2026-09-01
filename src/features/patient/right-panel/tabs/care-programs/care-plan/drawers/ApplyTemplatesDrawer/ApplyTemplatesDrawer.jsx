import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../../components/Input/Input';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { BadgeRow } from '../../../../../../../../components/BadgeRow/BadgeRow';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { templateGoalCount } from '../../lib/carePlanTemplateApply';
import styles from './ApplyTemplatesDrawer.module.css';

/**
 * Pick Care Plan Library templates to apply to a patient plan.
 * Figma SNP-Story — templates picker from the problems bar.
 * The user's favourite templates (starred in Settings → Care Plan Library)
 * are grouped into a "Favourite" section at the top so they're one glance away.
 */
export function ApplyTemplatesDrawer({ onClose, appliedTemplateIds = [], onApply }) {
  const templates = useAppStore(s => s.carePlanTemplates);
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const libraryLoading = useAppStore(s => s.carePlanLibraryLoading);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const favorites = useAppStore(s => s.carePlanFavorites);
  const carePlanFavoritesLoaded = useAppStore(s => s.carePlanFavoritesLoaded);
  const fetchCarePlanFavorites = useAppStore(s => s.fetchCarePlanFavorites);

  useEffect(() => {
    if (!libraryDidFetch) fetchCarePlanLibrary();
    if (!carePlanFavoritesLoaded) fetchCarePlanFavorites();
  }, [libraryDidFetch, carePlanFavoritesLoaded, fetchCarePlanLibrary, fetchCarePlanFavorites]);

  // The favourite grouping is snapshotted when the drawer opens, so it reflects
  // the current favourites each time it's re-opened (a fresh mount).
  const favSet = useMemo(() => new Set(favorites), [carePlanFavoritesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps -- snapshot per open

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set(appliedTemplateIds));

  const { favRows, restRows } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = templates
      .map(t => ({ ...t, goalCount: templateGoalCount(t) }))
      .filter(t => {
        if (!q) return true;
        return t.name.toLowerCase().includes(q)
          || (t.conditions || []).some(c => c.toLowerCase().includes(q));
      });
    return {
      favRows: filtered.filter(t => favSet.has(t.id)),
      restRows: filtered.filter(t => !favSet.has(t.id)),
    };
  }, [templates, query, favSet]);

  const total = favRows.length + restRows.length;

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const renderRow = (t) => (
    <div key={t.id} className={styles.rowWrap}>
      <label className={styles.row}>
        <Checkbox
          checked={selected.has(t.id)}
          onCheckedChange={() => toggle(t.id)}
          aria-label={`Select ${t.name}`}
        />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{t.name}</span>
          {(t.conditions || []).length > 0 ? (
            <BadgeRow items={t.conditions} maxLines={1} className={styles.rowConditions} />
          ) : null}
        </span>
        {favSet.has(t.id) && <Icon name="solar:star-bold" size={14} color="var(--status-warning)" />}
        <Badge tone="grey" size="S" label={String(t.goalCount)} />
      </label>
    </div>
  );

  const headerRight = (
    <>
      <Button
        variant="primary"
        size="L"
        onClick={() => onApply?.([...selected])}
      >
        Apply
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer title="Care Plan Templates" onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <Input
          type="search"
          aria-label="Search templates"
          placeholder="Search templates"
          leadingIcon="solar:magnifer-linear"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className={styles.list}>
          {libraryLoading && templates.length === 0 ? (
            <p className={styles.empty}>Loading templates…</p>
          ) : total === 0 ? (
            <p className={styles.empty}>
              {templates.length === 0
                ? 'No templates in the library yet. Create one in Settings → Care Plan Library.'
                : `No templates match “${query.trim()}”.`}
            </p>
          ) : (
            <>
              {favRows.length > 0 && (
                <>
                  <span className={styles.sectionLabel}>Favourite</span>
                  {favRows.map(renderRow)}
                </>
              )}
              {restRows.length > 0 && (
                <>
                  {favRows.length > 0 && <span className={styles.sectionLabel}>All Templates</span>}
                  {restRows.map(renderRow)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
