import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Input } from '../../../components/Input/Input';
import { useAppStore } from '../../../store/useAppStore';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedRow, GroupedSection } from '../more/GroupedList';
import { NoAccountAccess } from './accountAccess';
import { useAccountAccess } from './useAccountAccess';
import common from '../mobile.module.css';
import more from '../more/more.module.css';

/**
 * Settings > Account > Locations: the practice locations with the desktop
 * search; tap one to edit it, + to add one.
 */
export function LocationsScreen() {
  const allowed = useAccountAccess();
  if (!allowed) return <NoAccountAccess title="Locations" />;
  return <Locations />;
}

function Locations() {
  const { push } = useMobileNav();
  const locations = useAppStore(s => s.practiceLocations);
  const loading = useAppStore(s => s.practiceLocationsLoading);
  const fetched = useAppStore(s => s.practiceLocationsFetched);
  const fetchLocations = useAppStore(s => s.fetchPracticeLocations);
  const [query, setQuery] = useState('');

  useEffect(() => { if (!fetched) fetchLocations(); }, [fetched, fetchLocations]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? locations.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.addressLine1 || '').toLowerCase().includes(q) ||
      (l.city || '').toLowerCase().includes(q) ||
      (l.state || '').toLowerCase().includes(q) ||
      (l.zipCode || '').toLowerCase().includes(q)) : locations;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, query]);

  return (
    <div className={common.screen}>
      <MobileSubHeader
        title="Locations"
        actions={<ActionButton icon="solar:add-circle-linear" size="lg" aria-label="New location" onClick={() => push('settingsLocation', {})} />}
      />
      <div className={more.toolbar}>
        <Input
          leadingIcon="solar:magnifer-linear"
          size="lg"
          type="search"
          placeholder="Search locations"
          enterKeyHint="search"
          aria-label="Search locations"
          value={query}
          onValueChange={setQuery}
        />
      </div>
      <div className={common.body}>
        {loading && !fetched ? <MobileListSkeleton height={72} /> : rows.length === 0 ? (
          <MobileEmpty
            icon="solar:map-point-linear"
            title={query ? 'No locations match' : 'No practice locations yet'}
            description={query ? 'Try a different search term.' : 'Add your first practice location to start assigning users and appointments.'}
          />
        ) : (
          <div className={more.stack}>
            <GroupedSection label={`${rows.length} locations`}>
              {rows.map(l => (
                <GroupedRow
                  key={l.id}
                  icon="solar:map-point-linear"
                  label={l.name}
                  sub={[l.addressLine1, l.city, l.state, l.zipCode].filter(Boolean).join(', ') || undefined}
                  detail={l.ehrInstance}
                  onClick={() => push('settingsLocation', { locationId: l.id })}
                />
              ))}
            </GroupedSection>
          </div>
        )}
      </div>
    </div>
  );
}
