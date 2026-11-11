import { formatDate, formatDateTime } from '../../lib/dateFormat';
/**
 * Out of Office (OOO) records: statuses, formatting and the edit-diff rules.
 *
 * A record is { id, userId, userName, userEmail, userRole, startAt, endAt,
 * reason, autoReply, autoReplyMessage, createdBy, createdAt, updatedAt },
 * with startAt / endAt as ISO strings. People are matched by id (two staff
 * can share a name): a record's `userId`, an appointment's `primary_user_id`.
 * Only rows saved before ids were stored fall back to the name.
 */

export const OOO_ICON = 'solar:square-arrow-right-linear';
export const DEFAULT_AUTO_REPLY = 'Hi! Thanks for reaching out. I\'m currently unavailable but will get back to you as soon as I can.';

const toMs = (v) => (v instanceof Date ? v.getTime() : new Date(v).getTime());

/** 'Upcoming' | 'Ongoing' | 'Past' at `now`. */
export function oooStatus(record, now = new Date()) {
  const t = toMs(now);
  if (toMs(record.endAt) <= t) return 'Past';
  if (toMs(record.startAt) <= t) return 'Ongoing';
  return 'Upcoming';
}

export const STATUS_TONE = { Upcoming: 'success', Ongoing: 'primary', Past: 'grey' };

/** Past records are read-only; an ongoing one can be edited but not deleted. */
export const canEdit = (record, now) => oooStatus(record, now) !== 'Past';
export const canDelete = (record, now) => oooStatus(record, now) === 'Upcoming';

export const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** A person as { id, name }; a bare string is a name (data from before ids). */
export const personOf = (who) => (who && typeof who === 'object' ? { id: who.id || null, name: who.name || '' } : { id: null, name: who || '' });
export const recordPerson = (r) => ({ id: r?.userId || null, name: r?.userName || '' });
export const apptPerson = (a) => ({ id: a?.primary_user_id || null, name: a?.primary_user || '' });

/** Same person: by id when both have one, else (older data) by name. */
export function samePerson(a, b) {
  const x = personOf(a), y = personOf(b);
  if (x.id && y.id) return String(x.id) === String(y.id);
  return !!x.name && sameName(x.name, y.name);
}

/** A stable key for a person in pickers: their id, else (older data) the name. */
export const personKey = (who) => { const p = personOf(who); return p.id ? String(p.id) : p.name; };

/**
 * Picker options for people, valued by `personKey`. Two people with the same
 * name are told apart by their email (else role).
 */
export function peopleOptions(people) {
  const count = new Map();
  (people || []).forEach(u => { const k = String(u.name || '').trim().toLowerCase(); count.set(k, (count.get(k) || 0) + 1); });
  return (people || []).map((u) => {
    const shared = count.get(String(u.name || '').trim().toLowerCase()) > 1;
    const extra = u.email || u.role || '';
    return { value: personKey(u), label: shared && extra ? `${u.name} (${extra})` : u.name };
  });
}

/** A person's records; `who` is { id, name } (or, for older data, a name). */
export const recordsFor = (records, who) => (records || []).filter(r => samePerson(recordPerson(r), who));

/** The record a person is out on right now, if any. */
export function activeOooFor(records, who, now = new Date()) {
  if (!who) return null;
  return (records || []).find(r => samePerson(recordPerson(r), who) && oooStatus(r, now) === 'Ongoing') || null;
}

/** Local-day bounds of an ISO date ("2026-09-08"). */
function dayBounds(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 1).getTime()];
}

/** Records that overlap any part of the local day `isoDate`. */
export function recordsOnDate(records, isoDate) {
  const [from, to] = dayBounds(isoDate);
  return (records || []).filter(r => toMs(r.startAt) < to && toMs(r.endAt) > from);
}

/**
 * The part of a record inside the local day `isoDate`, as fractions of the
 * day (0–1), or null when it doesn't touch that day. For drawing the block
 * in Day / Week views.
 */
export function daySpan(record, isoDate) {
  const [from, to] = dayBounds(isoDate);
  const s = Math.max(from, toMs(record.startAt));
  const e = Math.min(to, toMs(record.endAt));
  if (e <= s) return null;
  return { start: (s - from) / (to - from), end: (e - from) / (to - from) };
}

const pad = (n) => String(n).padStart(2, '0');

export { formatDate, formatDateTime };


/** ISO ↔ DateTimePicker's value, "MM/DD/YYYY, HH:MM" (local, 24-hour). */
export function toPickerValue(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromPickerValue(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}), (\d{1,2}):(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]).toISOString();
}

/**
 * How an edit changes the dates: `reduced` when some previously covered
 * time is no longer out of office (its appointments can be restored),
 * `extended` when new time is added (its appointments need reassigning).
 * Both can be true (e.g. the start moves later and the end moves later).
 */
export function rangeChange(original, next) {
  if (!original || !next?.startAt || !next?.endAt) return { reduced: false, extended: false };
  const os = toMs(original.startAt), oe = toMs(original.endAt);
  const ns = toMs(next.startAt), ne = toMs(next.endAt);
  return {
    reduced: ns > os || ne < oe,
    extended: ns < os || ne > oe,
  };
}

/**
 * How new dates [startAt, endAt) clash with a provider's other records, and
 * the two ways out: extend what's there, or keep only the uncovered time.
 *   - covered: the part of the new dates already out of office, { from, to } (ms)
 *   - gaps: the uncovered parts, in order, { from, to } (ms)
 *   - extend: the record changes that cover every new moment, [{ record, startAt,
 *     endAt }]: the last record runs on to the new end, the first starts at the
 *     new start, and a record before a gap between two of them runs on to the next
 * Null when nothing clashes.
 */
export function overlapPlan(values, existing = [], originalId = null) {
  const s = toMs(values.startAt), e = toMs(values.endAt);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s || !values.userName) return null;
  const clashes = (existing || [])
    .filter(r => r.id !== originalId && samePerson(recordPerson(r), recordPerson(values)) && s < toMs(r.endAt) && e > toMs(r.startAt))
    .sort((a, b) => toMs(a.startAt) - toMs(b.startAt));
  if (!clashes.length) return null;
  const gaps = [];
  let at = s;
  clashes.forEach((r) => {
    const rs = toMs(r.startAt), re = toMs(r.endAt);
    if (rs > at) gaps.push({ from: at, to: Math.min(rs, e) });
    at = Math.max(at, re);
  });
  if (at < e) gaps.push({ from: at, to: e });
  const first = Math.max(s, toMs(clashes[0].startAt));
  const last = Math.min(e, Math.max(...clashes.map(r => toMs(r.endAt))));
  const changes = new Map();
  const change = (r, patch) => changes.set(r.id, { record: r, startAt: r.startAt, endAt: r.endAt, ...changes.get(r.id), ...patch });
  gaps.forEach((g) => {
    if (g.from === s && s < toMs(clashes[0].startAt)) {
      change(clashes[0], { startAt: new Date(s).toISOString() });
    } else {
      // The record that ends where the gap starts runs on to where it ends.
      const before = clashes.filter(r => toMs(r.endAt) <= g.from).reduce((a, r) => (!a || toMs(r.endAt) > toMs(a.endAt) ? r : a), null);
      if (before) change(before, { endAt: new Date(g.to).toISOString() });
    }
  });
  const extend = [...changes.values()];
  return { clashes, covered: { from: first, to: last }, gaps, extend };
}

/**
 * Form problems, keyed by field. A record may start today (it's out of
 * office from now) but not on an earlier day, must end after it starts, and
 * can't overlap another of the same provider's records (`existing`).
 */
export function validateOoo(values, { now = new Date(), original = null, existing = [] } = {}) {
  const errors = {};
  const s = values.startAt ? toMs(values.startAt) : NaN;
  const e = values.endAt ? toMs(values.endAt) : NaN;
  if (Number.isNaN(s)) errors.startAt = 'Pick a start date and time.';
  if (Number.isNaN(e)) errors.endAt = 'Pick an end date and time.';
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  // An ongoing record keeps its start in the past.
  const startLocked = original && toMs(original.startAt) <= toMs(now) && s === toMs(original.startAt);
  if (!errors.startAt && !startLocked && s < today.getTime()) errors.startAt = 'Start can\'t be before today.';
  if (!errors.startAt && !errors.endAt && e <= s) errors.endAt = 'End must be after the start.';
  if (!errors.endAt && e <= toMs(now)) errors.endAt = 'End must be in the future.';
  if (!errors.startAt && !errors.endAt && values.userName) {
    const clash = (existing || []).find(r => r.id !== original?.id && samePerson(recordPerson(r), recordPerson(values))
      && s < toMs(r.endAt) && e > toMs(r.startAt));
    // Keyed on its own: it's about the pair of dates, not either field.
    if (clash) errors.overlap = 'An out of office record already exists for this duration';
  }
  return errors;
}

/** Sort: ongoing, then upcoming (soonest first), then past (latest first). */
export function sortRecords(records, now = new Date()) {
  const rank = { Ongoing: 0, Upcoming: 1, Past: 2 };
  return [...(records || [])].sort((a, b) => {
    const ra = rank[oooStatus(a, now)], rb = rank[oooStatus(b, now)];
    if (ra !== rb) return ra - rb;
    return ra === 2 ? toMs(b.startAt) - toMs(a.startAt) : toMs(a.startAt) - toMs(b.startAt);
  });
}

/** "personal leave" → "Personal leave". */
/**
 * A record's covering providers, one entry per person with the locations
 * they cover, in the order first picked. `coverage` is
 * `[{ userId, userName, location }]`, one entry per location.
 */
export function coveringPeople(coverage) {
  const byKey = new Map();
  (coverage || []).forEach((c) => {
    const name = String(c?.userName || '').trim();
    if (!name) return;
    const key = c.userId || name.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { id: c.userId || null, name, locations: [] });
    const loc = String(c.location || '').trim();
    if (loc && !byKey.get(key).locations.includes(loc)) byKey.get(key).locations.push(loc);
  });
  return [...byKey.values()];
}

/**
 * Who answers the Out of Office phone tree at each location while `away` is
 * out (`from`–`to`, ms): on call schedules of that type on any day of the
 * range (and one of its weekdays), for that location or for every location
 * (no location). → [{ location, people: [name] }], in `locations` order; with
 * no locations, one row (location null) for the schedules on every location.
 */
export function phoneTreeOnCall(schedules, locations, { away, from, to } = {}) {
  if (from == null || to == null || to <= from) return [];
  const days = [];
  const d = new Date(from); d.setHours(0, 0, 0, 0);
  for (let i = 0; d.getTime() < to && i < 366; i += 1, d.setDate(d.getDate() + 1)) {
    days.push({ iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, dow: d.getDay() });
  }
  const live = (schedules || []).filter(s => s.phoneTreeType === 'Out of Office'
    && (s.users || [{ id: s.userId, name: s.userName }]).some(u => !(away && samePerson(u, away)))
    && days.some(x => x.iso >= s.fromDate && x.iso <= s.toDate && (!s.days?.length || s.days.includes(x.dow))));
  const rows = locations?.length ? locations : [null];
  return rows.map((location) => {
    const here = live.filter(s => !s.location || s.location === location);
    return {
      location,
      // The schedules behind it (most specific first), to view them.
      schedules: [...here].sort((a, b) => (!!b.location) - (!!a.location)),
      people: [...new Set(here
        .flatMap(s => (s.users || [{ id: s.userId, name: s.userName }]).filter(u => !(away && samePerson(u, away))).map(u => u.name)))],
    };
  });
}

export const capFirst = (v) => { const t = String(v || ''); return t ? t[0].toUpperCase() + t.slice(1) : t; };

export const initialsOf = (name) => String(name || '?').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

/**
 * A record's span, and how long it is: { span: "10/02/2026 – 10/14/2026",
 * length: "13 days" } for 10/02 to 10/15 at midnight (whole days show the
 * last day out). Times show when it doesn't start and end at midnight:
 * { span: "10/20/2026, 09:00AM – 01:00PM", length: "4 hours" }.
 */
export function describeRange(startAt, endAt) {
  const s = new Date(startAt), e = new Date(endAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return { span: '', length: '' };
  // MM/DD/YYYY and "09:00AM", as formatDate / formatDateTime, so the
  // whole flow reads one way.
  const t = (d) => `${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())}${d.getHours() < 12 ? 'AM' : 'PM'}`;
  const allDay = s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0;
  const mins = Math.round((e - s) / 60000);
  const hours = Math.round(mins / 60);
  const days = Math.round(hours / 24);
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  const length = mins < 60 ? plural(mins, 'minute') : hours < 24 ? plural(hours, 'hour') : plural(days, 'day');
  let span;
  // Whole days end at midnight, so the last day out is the one before.
  if (allDay) {
    const last = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 1);
    span = last.getTime() <= s.getTime() ? formatDate(s) : `${formatDate(s)} – ${formatDate(last)}`;
  } else if (s.toDateString() === e.toDateString()) span = `${formatDate(s)}, ${t(s)} – ${t(e)}`;
  else span = `${formatDate(s)}, ${t(s)} – ${formatDate(e)}, ${t(e)}`;
  return { span, length };
}

// "10-02-2026" + "9:30 am" → that local moment (ms), or NaN.
function apptStart(a) {
  const d = /^(\d{2})-(\d{2})-(\d{4})$/.exec(a?.date || '');
  const t = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(a?.time_start || '').trim());
  if (!d || !t) return NaN;
  const h = (Number(t[1]) % 12) + (t[3].toLowerCase() === 'pm' ? 12 : 0);
  return new Date(+d[3], +d[1] - 1, +d[2], h, +t[2]).getTime();
}

/**
 * The provider's appointments still to reassign for a record: not
 * cancelled, starting inside its dates and not yet in the past (what's
 * already happened can't move). Until reassignment is tracked, every such
 * appointment counts as still to move.
 */
export function appointmentsToReassign(record, appointments, now = new Date()) {
  const from = Math.max(toMs(record.startAt), toMs(now));
  const to = toMs(record.endAt);
  return (appointments || []).filter((a) => {
    if (a.status === 'Cancelled' || !samePerson(apptPerson(a), recordPerson(record))) return false;
    const at = apptStart(a);
    return at >= from && at < to;
  });
}
