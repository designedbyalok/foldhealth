import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useCovering } from '../../ooo/useCovering';
import { sameName } from '../../ooo/oooUtils';
import { EMPTY_COMMS_FILTERS, commsFiltersActive, dateWindow } from './commsFilters';

/**
 * The Filters drawer's state for a Comms list (Email, eFax): the applied
 * filters, their date window (fixed when applied), the people I'm covering,
 * and whether a set of assignees includes a covered person.
 *
 * @returns {{ open, setOpen, filters, apply, active, inWindow, coveringNames, coveredBy }}
 *   inWindow(iso)   – whether a time passes By Date
 *   coveredBy(names) – whether one of `names` (an inbox's assignees) is picked under Covering for
 */
export function useCommsFilters() {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_COMMS_FILTERS);
  const [range, setRange] = useState(null);
  const { names: coveringNames } = useCovering();
  const apply = (f) => { setFilters(f); setRange(dateWindow(f)); };
  const inWindow = (iso) => {
    if (!range) return true;
    const t = new Date(iso || 0).getTime();
    return t >= range.from && t < range.to;
  };
  const coveredBy = (names) => filters.covering.some(n => (names || []).some(x => sameName(x, n)));
  return { open, setOpen, filters, apply, active: commsFiltersActive(filters), inWindow, coveringNames, coveredBy };
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
