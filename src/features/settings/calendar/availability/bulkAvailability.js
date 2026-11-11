// Add availability for multiple users (VBC-26548): the checks Review runs
// for each user before the schedules in the drawer are copied to them.
// A user gets every schedule or none: one failing schedule skips the user.

import { ALL_TYPES, blockStatus, findConflicts, formatDate, isoDay } from './availabilityUtils';
import { occursOn } from './newViewUtils';

const norm = (s) => String(s || '').trim().toLowerCase();
const listOf = (v) => (Array.isArray(v) ? v : []);

// Roles an appointment type is open to until it has its own Applicable For
// (appointment_types.applicable_roles, from
// appointment_types_applicable_roles_migration.sql, which seeds the same list).
export const DEFAULT_APPLICABLE_ROLES = ['Physician/Doctor', 'Physician', 'Nurse Practitioner', 'Nurse'];

/** A user's role as the app shows it: their first clinical role, or Staff. */
export const roleOf = (user) => user.clinicalRoles?.[0] || user.role || 'Staff';

/**
 * Whether an appointment type can be booked with `user`: it's active, and its
 * Applicable For (roles, or a list of providers) includes them. "All
 * appointment types" applies when any active type does. A type we don't know
 * is open to everyone.
 */
export function typeApplicable(typeName, user, appointmentTypes = []) {
  const active = appointmentTypes.filter(t => t.active !== false);
  if (!typeName || typeName === ALL_TYPES) {
    return !appointmentTypes.length || active.some(t => typeApplicable(t.name, user, active));
  }
  const t = appointmentTypes.find(x => norm(x.name) === norm(typeName));
  if (!t) return true;
  if (t.active === false) return false;
  // Before the migration the column isn't there: the default roles apply.
  const roles = listOf('applicable_roles' in t || 'applicableRoles' in t ? (t.applicable_roles ?? t.applicableRoles) : DEFAULT_APPLICABLE_ROLES).map(norm);
  const people = listOf(t.applicable_users ?? t.applicableUsers).map(p => norm(p?.id ?? p?.name ?? p));
  if (!roles.length && !people.length) return true;
  const userRoles = (user.clinicalRoles?.length ? user.clinicalRoles : [roleOf(user)]).map(norm);
  if (roles.some(r => userRoles.includes(r))) return true;
  return people.includes(norm(user.id)) || people.includes(norm(user.name));
}

// Where and when a schedule runs, to tell whether a user already has it.
const sameSchedule = (a, b) => norm(a.location) === norm(b.location)
  && (a.timezone || '') === (b.timezone || '')
  && (a.startDate || '') === (b.startDate || '') && (a.endDate || '') === (b.endDate || '')
  && (a.repeat || 'weekly') === (b.repeat || 'weekly') && (Number(a.interval) || 1) === (Number(b.interval) || 1)
  && [...(a.days || [])].sort().join() === [...(b.days || [])].sort().join()
  && [...(a.weeks || [])].sort().join() === [...(b.weeks || [])].sort().join()
  && JSON.stringify((a.slots || []).map(x => [x.appointmentType || ALL_TYPES, x.start, x.end]))
    === JSON.stringify((b.slots || []).map(x => [x.appointmentType || ALL_TYPES, x.start, x.end]));

/** "Schedule 1", "Schedules 1 and 3", "Schedules 1, 2 and 4". */
export function schedulesText(numbers) {
  const n = [...new Set(numbers)].sort((a, b) => a - b);
  if (n.length === 1) return `Schedule ${n[0]}`;
  return `Schedules ${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

/**
 * One user's outcome: 'add', 'warn' (added, with lines to check) or 'skip'
 * (gets none of the schedules), with one line per problem.
 *
 * @param {object}   user     – { id, name, role, clinicalRoles, locations }
 * @param {object[]} blocks   – the drawer's schedules, in order (Schedule 1 first)
 * @param {object}   opts
 * @param {object[]} opts.existing – the user's own saved schedules
 * @param {object[]} [opts.appointmentTypes]
 * @param {boolean}  [opts.requireUserAvailability] – the booking setting
 * @param {string}   [opts.sourceName] – whose schedules were imported
 * @param {string}   [opts.today] – ISO day
 */
export function reviewUser(user, blocks, { existing = [], appointmentTypes = [], requireUserAvailability = false, sourceName = '', today = isoDay(new Date()) } = {}) {
  // The import's source, or someone who already has every one of them.
  if ((sourceName && norm(user.name) === norm(sourceName))
    || (blocks.length && blocks.every(b => existing.some(e => sameSchedule(b, e))))) {
    return { user, outcome: 'skip', lines: ['Already has these schedules.'] };
  }
  const skips = [];
  const assigned = new Set(listOf(user.locations).map(norm));
  blocks.forEach((b, i) => {
    const label = `Schedule ${i + 1}`;
    // No locations on record: nothing to check against.
    if (assigned.size && b.location && !assigned.has(norm(b.location))) {
      skips.push(`${label}: ${b.location} isn't assigned to this user.`);
    }
    const types = (b.slots || []).map(s => s.appointmentType || ALL_TYPES);
    if (types.length && !types.some(t => typeApplicable(t, user, appointmentTypes))) {
      skips.push(`${label}: No active appointment type is applicable for the ${roleOf(user)} role.`);
    }
  });
  if (skips.length) return { user, outcome: 'skip', lines: skips };

  const warnings = [];
  const current = existing.filter(b => blockStatus(b, today) !== 'expired');
  // Overlaps with what the user already has, one line per existing location.
  const byLocation = new Map();
  blocks.forEach((b, i) => {
    const hits = findConflicts([b, ...current], today)[0] || [];
    hits.forEach(({ index }) => {
      const loc = current[index - 1]?.location || 'another location';
      byLocation.set(loc, [...(byLocation.get(loc) || []), i + 1]);
    });
  });
  byLocation.forEach((nums, loc) => {
    const one = new Set(nums).size === 1;
    warnings.push(`${schedulesText(nums)} ${one ? 'overlaps' : 'overlap'} existing schedules at ${loc}. Double booking may occur.`);
  });
  if (!requireUserAvailability) {
    const [y, m, d] = today.split('-').map(Number);
    const todayDate = new Date(y, m - 1, d);
    if (!current.some(b => occursOn(b, todayDate))) {
      warnings.push('Has no schedule today. After saving, this user is booked only from these schedules.');
      const first = blocks.map(b => b.startDate).filter(Boolean).sort()[0];
      if (first && first > today) warnings.push(`Can't be booked until ${formatDate(first)}, when the first schedule starts.`);
    }
  }
  return { user, outcome: warnings.length ? 'warn' : 'add', lines: warnings };
}

/** A copy of each schedule for each user, ready to save as their own. */
export function copiesFor(user, blocks, { by, now = new Date().toISOString() } = {}) {
  return blocks.map((b, i) => ({
    ...b,
    id: `ua-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    userId: user.id ? String(user.id) : null,
    userName: user.name,
    userEmail: user.email || null,
    days: [...(b.days || [])],
    weeks: [...(b.weeks || [])],
    slots: (b.slots || []).map(s => ({ ...s })),
    allowOverlap: false,
    createdBy: by || null,
    createdAt: now,
    updatedAt: now,
    collapsed: undefined, arrive: undefined, checked: undefined, importedFrom: undefined, importedFromId: undefined,
  }));
}
