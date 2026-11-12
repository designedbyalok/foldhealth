import { useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { activeOooFor, coveringPeople } from '../ooo/oooUtils';

// A person's role for the assignee pickers, as booking shows it: their first
// clinical role, else Staff.
export function useRoleOf() {
  const platformUsers = useAppStore(s => s.platformUsers);
  return useMemo(() => {
    const byName = new Map((platformUsers || []).map(u => [String(u.name || '').trim().toLowerCase(), u.clinicalRoles?.[0]]));
    return (name) => byName.get(String(name || '').trim().toLowerCase()) || 'Staff';
  }, [platformUsers]);
}

// Who's out of office now, for the assignee picker (as when booking): they
// can't be given the task, and the picker names who covers them. Takes a
// user ({ id, name }) or a dropdown option (a name, or { value }).
export function useAssigneeOoo() {
  const records = useAppStore(s => s.oooRecords);
  return useCallback((u) => {
    const who = typeof u === 'string' ? { name: u } : { id: u.id || null, name: u._realName || u.name || u.value };
    const r = activeOooFor(records, who);
    return r ? { startAt: r.startAt, endAt: r.endAt, coveredBy: coveringPeople(r.coverage).map(p => p.name) } : null;
  }, [records]);
}
