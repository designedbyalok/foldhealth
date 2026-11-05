// Per-DOS assignment state shape + read/write helpers.
//
// The existing member model carries one set of role assignees + statuses at
// the **member** level (`member.sup`, `member.supS`, etc.). For Astrana we
// need state per (patient, DOS) tuple so that multiple DOSs for one patient
// can each have their own status while still being pinned to the same staff
// member at every role (the Astrana invariant).
//
// We keep the existing top-level member fields intact for backwards
// compatibility (the worklist table still reads them), but mirror everything
// into a `hccDosAssignments` map in the store, keyed by `${patientId}::${dos}`.
//
//   hccDosAssignments[`${patientId}::${dosDate}::${provider}::${pos}`] = {
//     patientId, dosDate, renderingProvider, pos,
//     support: RoleState, coder: RoleState, reviewer: RoleState, reviewer2: RoleState,
//     sampling: { reviewer2: null|true|false },
//     billingReady: boolean,
//     asmGenerated: boolean,
//     activity: ActivityEntry[],
//   }
//
//   RoleState = {
//     assignee:        staffId | null,    // currently Active assignee
//     status:          canonical status string | null,
//     originalAssignee: staffId | null,   // first person ever on this role for this DOS
//     history:         [{ assignee, status, at, active: bool }, …]
//   }
//
// Active vs Inactive (AC-9):
//   `assignee` is always the Active one. The full audit trail is in `history`.
//
// Composite key: the locked identity for a DOS record is
// Patient ID + DOS + Rendering Provider + POS, two DOS rows sharing a date
// but differing provider/POS have independent created dates and independent
// SLA clocks, so they must never collapse into the same dosState record.

import { ROLES } from './astranaStaff';
import { isEmptyDash } from '../../../lib/emptyDash';

export const dosKey = (patientId, dosDate, renderingProvider, pos) =>
  `${patientId}::${dosDate}::${renderingProvider || '-'}::${pos || '-'}`;

// Splits a composite key back into its parts. None of today's call sites
// need this yet, but it's the natural inverse of dosKey() and cheap to keep
// around for whoever next needs to go the other way (e.g. debugging tools).
export function parseDosKey(key) {
  const [patientId, dosDate, renderingProvider, pos] = String(key).split('::');
  return {
    patientId,
    dosDate,
    renderingProvider: isEmptyDash(renderingProvider) ? null : renderingProvider,
    pos: isEmptyDash(pos) ? null : pos,
  };
}

// Status keys used by the lifecycle. Mirror what's in statusSpec.js plus a
// few engine-only sentinels (`Assign`, `Billing Ready`).
export const STATUS = {
  ASSIGN:           'Assign',           // role exists but no one picked yet
  NEW:              'New',              // role just received the DOS
  AWAITING:         'Awaiting',         // Support default (a.k.a. Action Needed)
  IN_PROGRESS:      'In Progress',
  COMPLETED:        'Completed',
  RECORD_REQUESTED: 'Record Requested',
  RECORD_RECEIVED:  'Record Received',
  RETURNED:         'Returned',         // destination of a records request
  REBUTTAL:         'Rebuttal',         // QA / Compliance sent the record back
  INSUFFICIENT:     'Insufficient',
  REJECT:           'Reject',
  SKIPPED:          'Skipped',          // role bypassed, a later role acted first
  BILLING_READY:    'Billing Ready',
};

const EMPTY_ROLE_STATE = () => ({
  assignee: null,
  status: null,
  originalAssignee: null,
  history: [],
});

// Build a fresh blank DOS-state record. Used the first time we touch a DOS.
export function blankDosState(patientId, dosDate, renderingProvider = null, pos = null) {
  return {
    patientId,
    dosDate,
    renderingProvider,
    pos,
    support:   EMPTY_ROLE_STATE(),
    coder:     EMPTY_ROLE_STATE(),
    reviewer:  EMPTY_ROLE_STATE(),
    reviewer2: EMPTY_ROLE_STATE(),
    // Only Reviewer→Reviewer2 is a sampled transition (Coder→Reviewer is
    // unconditional): no equivalent "sampling.reviewer" field exists.
    sampling: { reviewer2: null },
    billingReady: false,
    asmGenerated: false,
    // Provenance for records created via +ICD from QA / Compliance:
    //   originatorRole: 'reviewer' | 'reviewer2' when a QA / Compliance
    //                         user added the ICD; null for pipeline records.
    //   originatorAssignee: snapshot of that user's staff id so the DOS can
    //                         be returned to the same person on Coder complete
    //                         (bypasses the QA / Compliance sampling picker).
    //   manuallyAdded: true iff the DOS was created via +ICD (worklist
    //                         chip). Independent of originatorRole so a Coder
    //                         adding a code doesn't get the QA-return branch.
    //   visitType: snapshot of the DOS's Visit Type at creation time
    //                         (used for downstream routing rules).
    originatorRole: null,
    originatorAssignee: null,
    manuallyAdded: false,
    visitType: null,
    activity: [],
  };
}

// Pure setter: returns a new DOS-state with `role` partially merged. Always
// keeps `history` immutable + appends rather than overwriting.
export function setRoleState(state, role, patch, meta = {}) {
  if (!ROLES.includes(role)) {
    throw new Error(`setRoleState: unknown role "${role}"`);
  }
  const prev = state[role];
  const next = { ...prev, ...patch };

  // Track originalAssignee the first time someone is assigned to this role.
  if (patch.assignee && !prev.originalAssignee) {
    next.originalAssignee = patch.assignee;
  }

  // Append to history whenever assignee OR status changes.
  const assigneeChanged = patch.assignee !== undefined && patch.assignee !== prev.assignee;
  const statusChanged   = patch.status   !== undefined && patch.status   !== prev.status;
  if (assigneeChanged || statusChanged) {
    // Mark the prior assignee Inactive (AC-9) by setting active:false on the
    // last history entry that matched their id. We push a new entry below.
    const history = prev.history.map((h, i) =>
      i === prev.history.length - 1 && h.active
        ? { ...h, active: false, deactivatedAt: meta.at || new Date().toISOString() }
        : h
    );
    history.push({
      assignee: next.assignee,
      status:   next.status,
      at:       meta.at || new Date().toISOString(),
      by:       meta.by || 'system',
      reason:   meta.reason || null,
      active:   true,
    });
    next.history = history;
  }

  return { ...state, [role]: next };
}

// Pure pusher for activity-log entries. Keeps the array bounded so the
// in-memory store doesn't grow forever during a long demo session.
const MAX_ACTIVITY = 200;
export function pushActivity(state, entry) {
  const next = [...state.activity, { ...entry, at: entry.at || new Date().toISOString() }];
  if (next.length > MAX_ACTIVITY) next.splice(0, next.length - MAX_ACTIVITY);
  return { ...state, activity: next };
}

// Compute the workload map across all DOS-state records in the store. A
// staff member's workload is the count of DOSs where they are the current
// Active assignee at any role (open status: not Completed / Reject).
const TERMINAL_STATUSES = new Set([STATUS.COMPLETED, STATUS.REJECT, STATUS.SKIPPED, STATUS.BILLING_READY]);
export function computeWorkload(dosStateMap) {
  const workload = {};
  for (const state of Object.values(dosStateMap || {})) {
    for (const role of ROLES) {
      const rs = state[role];
      if (!rs?.assignee) continue;
      if (TERMINAL_STATUSES.has(rs.status)) continue;
      workload[rs.assignee] = (workload[rs.assignee] || 0) + 1;
    }
  }
  return workload;
}

// Compute the per-patient assignee history map used by the engine to enforce
// the Astrana pin + same-patient preference. For each patient, returns the
// currently-Active assignee at each role across all of that patient's DOSs.
export function computePatientHistory(dosStateMap) {
  const history = {};
  for (const state of Object.values(dosStateMap || {})) {
    const pid = state.patientId;
    if (!pid) continue;
    history[pid] = history[pid] || {};
    for (const role of ROLES) {
      const rs = state[role];
      if (!rs?.assignee) continue;
      // First write wins per (patient, role), Astrana pins to the first
      // person who ever held the role.
      if (!history[pid][role]) {
        history[pid][role] = {
          assignee: rs.assignee,
          since: rs.history?.[0]?.at || null,
        };
      }
    }
  }
  return history;
}

// Map from short staff initials (used by the legacy member model) to a
// best-effort staff id. Lets us hydrate the new map from old member fields
// without forcing a Supabase migration.
export function inferStaffIdFromName(name) {
  if (!name) return null;
  const parts = String(name).trim().split(/\s+/);
  if (!parts.length) return null;
  // "E. Johnson" → "EJ", "Deborah Hintz" → "DH", "N. Richards" → "NR"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].replace(/[^A-Z]/gi, '')[0];
  const last  = parts[parts.length - 1][0];
  return `${first || ''}${last || ''}`.toUpperCase();
}

// Hydrate a per-DOS state from the legacy member fields. Used once at boot
// per (member, dos) so the engine has somewhere to read from before the user
// drives any transitions. Returns a fully-formed DosState.
//
// We now seed every DOS identically from the legacy fields (previously
// only DOS index 0 was seeded, which left later DOSs in a "Support
// Awaiting" state that diverged from the rest of the worklist). The
// Astrana invariant still holds: every DOS of a patient is pinned to
// the same staff member at every role, and the engine can override
// per-DOS state via real lifecycle transitions later.
export function hydrateFromMember(member, dosDate, _idx = 0, renderingProvider = null, pos = null) {
  const initial = blankDosState(member.id, dosDate, renderingProvider, pos);

  // Legacy member fields keep their historical r1/r1s/r2/r2s names (and the
  // Supabase columns behind them): only the engine's internal role keys
  // are renamed to reviewer/reviewer2. There is no r3 seed: the role no
  // longer exists.
  const seed = [
    { role: 'support',   name: member.sup, status: member.supS },
    { role: 'coder',     name: member.cdr, status: member.cdrS },
    { role: 'reviewer',  name: member.r1,  status: member.r1s },
    { role: 'reviewer2', name: member.r2,  status: member.r2s },
  ];

  let state = initial;
  for (const { role, name, status } of seed) {
    const id = inferStaffIdFromName(name);
    if (!id && !status) continue;
    state = setRoleState(state, role,
      { assignee: id, status: status || null },
      { by: 'hydrate', reason: 'seed-from-member' },
    );
  }
  // Carry the row-level manual/originator markers through to the DOS state
  // so a page reload doesn't lose the "QA-created" provenance.
  if (member.manuallyAdded) state = { ...state, manuallyAdded: true };
  if (member.originatorRole) state = { ...state, originatorRole: member.originatorRole };
  if (member.originatorAssignee) state = { ...state, originatorAssignee: member.originatorAssignee };
  const dosVt = member.dos_list?.find(d => d.date === dosDate)?.vt || member.vt || member.visitType || null;
  if (dosVt) state = { ...state, visitType: dosVt };
  return state;
}
