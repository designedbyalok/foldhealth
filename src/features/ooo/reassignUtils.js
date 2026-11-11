/**
 * Reassignment planning: which of a provider's appointments are in scope,
 * how they group by department (the appointment's practice location), who
 * can cover each department, and what a plan adds up to. Pure functions,
 * shared by the Reassign Appointments drawer and the job that runs a plan.
 *
 * A plan maps appointment id → { action: 'reassign', to: userName } or
 * { action: 'cancel' }; anything not in it is left as is.
 */
import { apptPerson, personOf, recordPerson, sameName, samePerson } from './oooUtils';

export const NO_DEPARTMENT = 'No Department';

const toMs = (v) => (v instanceof Date ? v.getTime() : new Date(v).getTime());

// "10-02-2026" + "9:30 am" → that local moment (ms), or NaN.
function at(date, time) {
  const d = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date || '');
  const t = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(time || '').trim());
  if (!d || !t) return NaN;
  const h = (Number(t[1]) % 12) + (t[3].toLowerCase() === 'pm' ? 12 : 0);
  return new Date(+d[3], +d[1] - 1, +d[2], h, +t[2]).getTime();
}

/** An appointment's start and end (ms); a missing end counts as 30 minutes. */
export function apptSpan(a) {
  const start = at(a?.date, a?.time_start);
  const end = at(a?.date, a?.time_end);
  return { start, end: Number.isNaN(end) || end <= start ? start + 30 * 60000 : end };
}

/**
 * The time a reassignment covers: an Out of Office record's dates, a
 * one-time start and end, or (permanent) from now on.
 */
export function reassignWindow({ type, record, startAt, endAt }, now = new Date()) {
  if (type === 'permanent') return { from: toMs(now), to: Infinity };
  if (type === 'ooo') return record ? { from: toMs(record.startAt), to: toMs(record.endAt) } : null;
  if (startAt && endAt && toMs(endAt) > toMs(startAt)) return { from: toMs(startAt), to: toMs(endAt) };
  return null;
}

/**
 * The provider's appointments to plan: theirs (an appointment already moved
 * to someone else no longer counts), not cancelled, starting inside the
 * window and not already in the past.
 */
export function scopeAppointments(appointments, fromUser, window, now = new Date()) {
  if (!fromUser || !window || !personOf(fromUser).name && !personOf(fromUser).id) return [];
  const from = Math.max(window.from, toMs(now));
  return (appointments || [])
    .filter((a) => {
      if (a.status === 'Cancelled' || !samePerson(apptPerson(a), fromUser)) return false;
      const { start } = apptSpan(a);
      return start >= from && start < window.to;
    })
    .sort((a, b) => apptSpan(a).start - apptSpan(b).start);
}

/** Appointments by department (location), departments A–Z. */
export function groupByDepartment(appts) {
  const map = new Map();
  (appts || []).forEach((a) => {
    const dept = (a.location || '').trim() || NO_DEPARTMENT;
    if (!map.has(dept)) map.set(dept, []);
    map.get(dept).push(a);
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => ({ name, appointments: list }));
}

/**
 * Who can cover a department: people who work there (it's in their
 * locations), other than the provider who's away and anyone who is out of
 * office themselves at any point in the window.
 */
export function coveringProviders(dept, users, { awayUser, oooRecords = [], window }) {
  const out = (oooRecords || [])
    .filter(r => window && toMs(r.startAt) < window.to && toMs(r.endAt) > window.from)
    .map(recordPerson);
  return (users || []).filter(u =>
    (u.locations || []).some(l => sameName(l, dept))
    && !samePerson(u, awayUser)
    && !out.some(p => samePerson(u, p)));
}

/**
 * The access a covering provider needs for the away person's work. Shown
 * only: nothing reads real permissions yet, so `missingAccess` is a stable
 * mock (about one person in five lacks one or two of these).
 */
export const COVER_ACCESS = ['Manage Tasks & Alerts', 'Program Worklists', 'Inbox'];
export function missingAccess(user) {
  const key = String(user?.id || user?.name || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  if (h % 5 !== 0) return [];
  // Most lack one; every third of those lacks two.
  const first = Math.floor(h / 5) % COVER_ACCESS.length;
  const count = Math.floor(h / 15) % 3 === 0 ? 2 : 1;
  return Array.from({ length: count }, (_, i) => COVER_ACCESS[(first + i) % COVER_ACCESS.length]);
}

/**
 * Who can cover an Out of Office record, in the drawer's three groups:
 *  - suggested:   free on those dates with the access the work needs; those
 *                 sharing a location with the away provider first, then
 *                 the same role.
 *  - limited:     free, but lacking access needed for part of the work
 *                 (`missing`, see missingAccess); picked with a warning.
 *  - unavailable: out of office themselves for some of those dates (`out`
 *                 is that record); can't be picked.
 * The away provider is left out. Without dates nobody is unavailable.
 * With `location`, Suggested leads with people who work at that location.
 */
export function coveringGroups(away, users, { oooRecords = [], from = null, to = null, recordId = null, location = null } = {}) {
  const list = users || [];
  const awayUser = list.find(u => samePerson(u, away));
  // Covering one location: those who work there come first.
  const awayLocs = location ? [location] : (awayUser?.locations || []);
  const awayRole = awayUser?.clinicalRoles?.[0];
  const clashing = from != null && to != null
    ? (oooRecords || []).filter(r => r.id !== recordId && toMs(r.startAt) < to && toMs(r.endAt) > from)
    : [];
  const groups = { suggested: [], limited: [], unavailable: [] };
  list.forEach((u) => {
    if (!u?.name || samePerson(u, away)) return;
    const out = clashing.find(r => samePerson(u, recordPerson(r)));
    const missing = missingAccess(u);
    if (out) groups.unavailable.push({ user: u, out });
    else if (missing.length) groups.limited.push({ user: u, missing });
    else groups.suggested.push({ user: u });
  });
  const sharesLoc = u => ((u.locations || []).some(l => awayLocs.some(a => sameName(a, l))) ? 0 : 1);
  const sameRole = u => (awayRole && (u.clinicalRoles || []).includes(awayRole) ? 0 : 1);
  groups.suggested.sort((a, b) => sharesLoc(a.user) - sharesLoc(b.user) || sameRole(a.user) - sameRole(b.user) || a.user.name.localeCompare(b.user.name));
  groups.limited.sort((a, b) => a.user.name.localeCompare(b.user.name));
  groups.unavailable.sort((a, b) => a.user.name.localeCompare(b.user.name));
  return groups;
}

/**
 * A record's coverage when one provider covers it: an entry for each of the
 * away provider's locations (one with no location when they have none).
 */
export function coverageFor(coverer, awayLocations) {
  if (!coverer?.name) return [];
  const locs = (awayLocations || []).length ? awayLocations : [''];
  return locs.map(location => ({ userId: coverer.id || null, userName: coverer.name, location }));
}

/**
 * An appointment already on the covering provider's calendar that overlaps
 * this one, if any: the reassignment still goes ahead, flagged as a conflict.
 */
export function findConflict(appt, toUser, appointments) {
  const { start, end } = apptSpan(appt);
  return (appointments || []).find((b) => {
    if (b.id === appt.id || b.status === 'Cancelled' || !samePerson(apptPerson(b), toUser)) return false;
    const s = apptSpan(b);
    return s.start < end && s.end > start;
  }) || null;
}

/** Reassigning / cancelling / no-action counts for the appointments in scope. */
export function tallyPlan(plan, appts) {
  let reassigning = 0;
  let cancelling = 0;
  (appts || []).forEach((a) => {
    const p = plan[a.id];
    if (p?.action === 'reassign') reassigning += 1;
    else if (p?.action === 'cancel') cancelling += 1;
  });
  return { reassigning, cancelling, noAction: (appts || []).length - reassigning - cancelling };
}

/** "10 Appointments (9 Reassigned • 1 Cancelled)" detail for a group. */
export function planDetail(plan, appts) {
  const { reassigning, cancelling } = tallyPlan(plan, appts);
  const n = (appts || []).length;
  if (!reassigning && !cancelling) return '';
  if (reassigning === n) return 'All Reassigned';
  if (cancelling === n) return 'All Cancelled';
  return [reassigning && `${reassigning} Reassigned`, cancelling && `${cancelling} Cancelled`].filter(Boolean).join(' • ');
}

// "10-02-2026" → "10/02/2026"; "9:00 am"–"9:30 am" → "9:00-9:30 AM".
const slash = (d) => String(d || '').replace(/-/g, '/');
function timeRange(start, end) {
  const s = String(start || '').trim().toUpperCase();
  const e = String(end || '').trim().toUpperCase();
  if (!e) return s;
  const [sT, sM] = s.split(' ');
  const [eT, eM] = e.split(' ');
  return sM === eM ? `${sT}-${eT} ${eM}` : `${s}-${e}`;
}

/** "10/02/2026, 9:00-9:30 AM • LTC Initial Evaluation Visit" for an appointment or a job snapshot. */
export function apptLine(a) {
  const date = a.date;
  const start = a.time_start ?? a.timeStart;
  const end = a.time_end ?? a.timeEnd;
  const type = a.appointment_type_name ?? a.type;
  return [`${slash(date)}, ${timeRange(start, end)}`, type].filter(Boolean).join(' • ');
}
