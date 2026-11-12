import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { coveringPeople, oooStatus, recordPerson, samePerson } from './oooUtils';

const norm = (n) => String(n || '').trim().toLowerCase();

/**
 * Whom the signed-in user is covering: people out (now or soon) whose Out of
 * Office record names them as a covering provider. For the "Covering for"
 * filter and note on worklists (their work still assigned to them; work
 * reassigned to me is simply mine).
 *
 * Returns { names, coveringOn }:
 *   names       – sorted display names, for the filter's options
 *   coveringOn  – (assigneeNames: string[], picked?: string[]) =>
 *                 [{ name, startAt, endAt }] of the people I'm covering among
 *                 those assignees (limited to `picked` when given)
 */
export function useCovering() {
  const records = useAppStore(s => s.oooRecords);
  const me = useAppStore(s => s.currentUserProfile);
  return useMemo(() => {
    const self = { id: me?.id || null, name: me?.name || '' };
    const byName = new Map();
    (records || [])
      .filter(r => oooStatus(r) !== 'Past' && coveringPeople(r.coverage).some(c => samePerson(c, self)))
      .forEach((r) => { const n = recordPerson(r).name; if (n && !byName.has(norm(n))) byName.set(norm(n), r); });
    const names = [...byName.values()].map(r => recordPerson(r).name).sort((a, b) => a.localeCompare(b));
    const coveringOn = (assigneeNames = [], picked = null) => {
      const allow = picked?.length ? new Set(picked.map(norm)) : null;
      const seen = new Set();
      return assigneeNames.map(norm).filter((n) => {
        if (!n || seen.has(n) || !byName.has(n) || (allow && !allow.has(n))) return false;
        seen.add(n);
        return true;
      }).map((n) => {
        const r = byName.get(n);
        return { name: recordPerson(r).name, startAt: r.startAt, endAt: r.endAt };
      });
    };
    return { names, coveringOn };
  }, [records, me]);
}
