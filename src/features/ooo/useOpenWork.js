import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { coveringGroups } from './reassignUtils';
import { personKey } from './oooUtils';
import { defaultAppointmentPlan, openAppointments, openPrograms, openTasksByCard, patientDepartments, TASK_CARDS, withDepartments } from './openWork';

export const MODULES = [
  { key: 'appointments', title: 'Appointments', noun: 'Appointment', icon: 'solar:calendar-linear' },
  ...TASK_CARDS.map(c => ({ key: c.key, title: c.title, noun: 'Task', icon: 'solar:checklist-minimalistic-linear' })),
  { key: 'programs', title: 'Care Programs', noun: 'Program', icon: 'solar:clipboard-list-linear' },
];

/**
 * Step 2's data: the away user's open work in the out of office dates, by
 * module, and the plan for each (who each item goes to). A module's plan is
 * its default (the covering provider of the item's department, else the one
 * covering provider) until it's edited.
 *
 * @param {object}  opts
 * @param {boolean} opts.enabled  – Load only once step 2 opens
 * @param {{ id, name }} opts.away
 * @param {string}  opts.startAt
 * @param {string}  opts.endAt
 * @param {object[]} opts.coverage – The record's covering providers by location
 * @param {string}  [opts.recordId]
 */
export function useOpenWork({ enabled, away, startAt, endAt, coverage, recordId }) {
  const appointments = useAppStore(s => s.appointments);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const tasks = useAppStore(s => s.tasks);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const fetchProgramsAssignedTo = useAppStore(s => s.fetchProgramsAssignedTo);
  const people = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  const oooRecords = useAppStore(s => s.oooRecords);
  const [programs, setPrograms] = useState({ for: null, list: [] });

  useEffect(() => {
    if (!enabled) return;
    fetchAppointments?.();
    fetchTasks?.();
  }, [enabled, fetchAppointments, fetchTasks]);
  const awayName = away?.name || '';
  useEffect(() => {
    if (!enabled || !awayName) return undefined;
    let live = true;
    fetchProgramsAssignedTo?.(awayName).then(list => { if (live) setPrograms({ for: awayName, list: list || [] }); });
    return () => { live = false; };
  }, [enabled, awayName, fetchProgramsAssignedTo]);

  const items = useMemo(() => {
    const appts = openAppointments(appointments, away, startAt, endAt);
    const byCard = openTasksByCard(tasks, away, endAt);
    // Every module is grouped by department, like appointments.
    const deptOf = patientDepartments(appointments);
    const taskPatient = t => ({ id: t.patient_id, name: t.member });
    return {
      appointments: appts,
      ...Object.fromEntries(Object.entries(byCard).map(([k, list]) => [k, withDepartments(list, deptOf, taskPatient)])),
      programs: programs.for === awayName ? withDepartments(openPrograms(programs.list), deptOf, p => ({ id: p.patientId, name: p.patientName })) : [],
    };
  }, [appointments, tasks, programs, away, awayName, startAt, endAt]);
  const loading = enabled && programs.for !== awayName;

  // "Assign all work to covering providers automatically" (on by default):
  // each item goes to the covering provider of its location (else, with one
  // covering provider, to them). Off: every area starts unassigned.
  const [autoAssign, setAutoAssignState] = useState(true);
  const defaults = useMemo(
    () => Object.fromEntries(MODULES.map(m => [m.key, autoAssign ? defaultAppointmentPlan(items[m.key], coverage) : {}])),
    [items, coverage, autoAssign],
  );

  // Edited plans replace the default for their module; switching auto-assign
  // starts every area over from the new default.
  const [edits, setEdits] = useState({});
  const setAutoAssign = (on) => { setAutoAssignState(on); setEdits({}); };
  const plans = Object.fromEntries(MODULES.map(m => [m.key, edits[m.key] ?? defaults[m.key]]));
  const setPlan = (key, next) => setEdits(e => ({ ...e, [key]: typeof next === 'function' ? next(e[key] ?? defaults[key]) : next }));

  // Who can take an item: Suggested (shared location first), Limited Access
  // and Not Available (disabled), as on the covering provider picker.
  const pickUsers = (location = null, badges = {}) => {
    const g = coveringGroups(away, people, {
      oooRecords,
      from: startAt ? new Date(startAt).getTime() : null,
      to: endAt ? new Date(endAt).getTime() : null,
      recordId,
      location,
    });
    const asUser = ({ user }, section, extra) => ({ id: personKey(user), realId: user.id || null, name: user.name, role: user.clinicalRoles?.[0] || 'Staff', initials: user.initials, locations: user.locations || [], section, ...extra });
    return [
      ...g.suggested.map(x => asUser(x, 'Suggested')),
      ...g.limited.map(x => asUser(x, 'Limited Access', { badge: badges.limited?.(x.missing) })),
      ...g.unavailable.map(x => asUser(x, 'Not Available', { badge: badges.out?.(x.out), disabled: true })),
    ];
  };

  return { items, plans, defaults, setPlan, pickUsers, loading, autoAssign, setAutoAssign };
}
