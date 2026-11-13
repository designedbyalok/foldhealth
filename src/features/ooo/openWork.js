/**
 * Step 2 of an Out of Office record (Reassign Open Work): the away user's
 * open items, sorted into cards, and who each goes to by default. Pure.
 *
 * Plans map an item id → { action: 'reassign', to, toId } (the person it
 * goes to), as Reassign Appointments' plans do; an item not in a plan stays
 * with the away user.
 */
import { apptSpan, scopeAppointments } from './reassignUtils';
import { samePerson } from './oooUtils';

const has = (t, re) => re.test([...(t.labels || []), t.name || ''].join(' '));

/** The task cards, in order; Other Tasks takes what the others don't. */
export const TASK_CARDS = [
  { key: 'carePlan', title: 'Care Plan Review Tasks', match: t => has(t, /care plan review/i) },
  { key: 'medRecon', title: 'Med Recon Review Tasks', match: t => has(t, /med(ication)?\.? ?rec(on|onciliation)?\b/i) },
  { key: 'intervention', title: 'Intervention Tasks', match: t => has(t, /intervention/i) },
  { key: 'tasks', title: 'Other Tasks', match: () => true },
];

// "MM-DD-YYYY" or "MM/DD/YYYY" (or ISO) → the end of that day (ms), or NaN.
export function dueEnd(due) {
  const m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(String(due || ''));
  const d = m ? new Date(+m[3], +m[1] - 1, +m[2]) : new Date(due);
  if (Number.isNaN(d.getTime())) return NaN;
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * The away user's open tasks (pending or missed) due by the end of the out
 * of office dates (or with no due date), by card.
 */
export function openTasksByCard(tasks, away, endAt) {
  const end = endAt ? new Date(endAt).getTime() : Infinity;
  const open = (tasks || []).filter((t) => {
    if (t.status !== 'pending' && t.status !== 'missed') return false;
    if (t.is_subtask) return false;
    if (!samePerson({ id: t.assigned_to_id || null, name: t.assigned_to || '' }, away)) return false;
    const due = dueEnd(t.due_date);
    return Number.isNaN(due) || due - 86399999 <= end;
  });
  const out = Object.fromEntries(TASK_CARDS.map(c => [c.key, []]));
  open.forEach((t) => { out[TASK_CARDS.find(c => c.match(t)).key].push(t); });
  return out;
}

/** The away user's upcoming appointments in the out of office dates. */
export function openAppointments(appointments, away, startAt, endAt, now = new Date()) {
  if (!startAt || !endAt) return [];
  return scopeAppointments(appointments, away, { from: new Date(startAt).getTime(), to: new Date(endAt).getTime() }, now);
}

/** "24 Pending • 6 Missed". */
export function taskCountLine(list) {
  const pending = list.filter(t => t.status === 'pending').length;
  const missed = list.filter(t => t.status === 'missed').length;
  return [pending && `${pending} Pending`, missed && `${missed} Missed`].filter(Boolean).join(' • ');
}

/** Each item (appointment, task, program) to the covering provider of its department (`location`). */
export function defaultAppointmentPlan(appts, coverage) {
  const plan = {};
  (appts || []).forEach((a) => {
    const c = (coverage || []).find(x => String(x.location || '').trim().toLowerCase() === String(a.location || '').trim().toLowerCase())
      || ((coverage || []).length && new Set(coverage.map(x => x.userId || x.userName)).size === 1 ? coverage[0] : null);
    if (c) plan[a.id] = { action: 'reassign', to: c.userName, toId: c.userId || null };
  });
  return plan;
}

/** Who a plan sends these items to: [{ id, name, count }], most first. */
export function planPeople(plan, ids) {
  const by = new Map();
  (ids || []).forEach((id) => {
    const p = plan?.[id];
    if (p?.action !== 'reassign') return;
    const k = p.toId || p.to;
    if (!by.has(k)) by.set(k, { id: p.toId || null, name: p.to, count: 0 });
    by.get(k).count += 1;
  });
  return [...by.values()].sort((a, b) => b.count - a.count);
}

const CLOSED_PROGRAM = /complete|closed|discontinu|inactive|disenroll|ended|cancel/i;
/** Care program enrollments still open (not completed, closed or ended). */
export const openPrograms = (programs) => (programs || []).filter(p => !CLOSED_PROGRAM.test(String(p.status || '')));

export const NO_DEPARTMENT = 'No Department';

/**
 * Each patient's department: the location of their latest appointment (by
 * patient id, else name). Tasks and care programs carry their own
 * `location` once tasks_location_migration.sql runs; until then (or when
 * it's empty) they take their patient's.
 */
export function patientDepartments(appointments) {
  const latest = new Map();
  (appointments || []).forEach((a) => {
    const loc = String(a.location || '').trim();
    if (!loc) return;
    const t = apptSpan(a).start;
    [a.patient_id && `id:${a.patient_id}`, a.patient_name && `name:${String(a.patient_name).trim().toLowerCase()}`].filter(Boolean).forEach((k) => {
      const cur = latest.get(k);
      if (!cur || t > cur.t) latest.set(k, { t, loc });
    });
  });
  return (patientId, patientName) => (patientId && latest.get(`id:${patientId}`)?.loc)
    || (patientName && latest.get(`name:${String(patientName).trim().toLowerCase()}`)?.loc)
    || null;
}

/** Items with a department (`location`): their own, else their patient's. */
export const withDepartments = (list, deptOf, patientOf) => (list || []).map((it) => {
  const own = String(it.location || '').trim();
  const { id, name } = patientOf(it);
  return { ...it, location: own || deptOf(id, name) || NO_DEPARTMENT };
});

/** Any items by department (A–Z), "No Department" last. */
export function byDepartment(list) {
  const map = new Map();
  (list || []).forEach((it) => {
    const d = String(it.location || '').trim() || NO_DEPARTMENT;
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(it);
  });
  return [...map.entries()]
    .sort(([a], [b]) => (a === NO_DEPARTMENT) - (b === NO_DEPARTMENT) || a.localeCompare(b))
    .map(([name, items]) => ({ name, items }));
}
