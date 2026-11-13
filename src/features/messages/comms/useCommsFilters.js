import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useCovering } from '../../ooo/useCovering';
import { sameName } from '../../ooo/oooUtils';
import { EMPTY_COMMS_FILTERS, commsFiltersActive } from './commsFilters';
import { inDatePreset } from '../../../components/DateRangeFilter/dateRangePresets';

/**
 * The FilterChip row's state for a Comms list (Email, eFax): whether the row
 * is shown, the filters, the people I'm covering, and whether a set of
 * assignees includes a covered person.
 *
 * @returns {{ open, setOpen, filters, setFilter, active, inWindow, coveringNames, coveredBy }}
 *   setFilter(patch) – merge into the filters
 *   inWindow(iso)    – whether a time passes the Date filter
 *   coveredBy(names) – whether one of `names` (an inbox's assignees) is picked under Covering for
 */
export function useCommsFilters() {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_COMMS_FILTERS);
  const setFilter = (patch) => setFilters(f => ({ ...f, ...patch }));
  const { names: coveringNames } = useCovering();
  // The date window is fixed when the date filter is picked, not each render.
  const inDate = useMemo(() => inDatePreset(filters.datePreset, filters.dateRange), [filters.datePreset, filters.dateRange]);
  const inWindow = (iso) => !filters.datePreset || inDate(iso);
  const coveredBy = (names) => filters.covering.some(n => (names || []).some(x => sameName(x, n)));
  return { open, setOpen, filters, setFilter, active: commsFiltersActive(filters), inWindow, coveringNames, coveredBy };
}

/** The practice's eFax numbers as inboxes ({ id, name, address, users, members }): `users` are the linked users' names, `members` the users themselves. */
export function useEfaxInboxes() {
  const numbers = useAppStore(s => s.efaxNumbers);
  const fetchEfaxNumbers = useAppStore(s => s.fetchEfaxNumbers);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchEfaxNumbers(); fetchPlatformUsers?.(); }, [fetchEfaxNumbers, fetchPlatformUsers]);
  return useMemo(() => (numbers || [])
    .filter(n => n.isActive)
    .map(n => {
      const members = n.linkedUserIds.map(id => (platformUsers || []).find(u => u.id === id)).filter(Boolean);
      return { id: n.id, name: n.name, address: n.number, users: members.map(u => u.name), members };
    }), [numbers, platformUsers]);
}
