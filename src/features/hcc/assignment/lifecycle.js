// Lifecycle transitions for the HCC assignment workflow.
//
// Each public function maps to one of the acceptance criteria in the story.
// All are **pure**: they take the current dos-state-map (read-only) plus
// any context (patient, dos date, actor, reason) and return:
//
//   { nextMap, events: ActivityEvent[] }
//
// `nextMap` is a new dos-state-map with this transition applied. The store
// just replaces its slice with `nextMap`. `events` is a list of per-DOS log
// entries the store also persists (today the same list is folded into
// `state.activity`, but the shape is decoupled so a future audit log table
// can consume it directly).
//
// AC mapping:
//   initializeDos: AC-1 (blank → Support, awaiting state)
//   markSupportInProgress: AC-1 (Support starts work)
//   completeSupport: AC-1/AC-2 (Support completes → assign Coder)
//   markInsufficient: AC-1 (Support: incomplete docs, stays with Support)
//   rejectDos: AC-1 (Support: terminal reject)
//   completeCoder: AC-2/AC-3 (Coder completes → assign Reviewer)
//   requestRecords: AC-6 (Coder asks Support for more docs)
//   recordsReceived: AC-6 (Support finishes, DOS returns to original Coder)
//   completeReviewer: AC-3/AC-4 (Reviewer completes; maybe → Reviewer 2 via 10% sample)
//   completeReviewer2: AC-4/AC-5 (Reviewer 2 completes → Billing Ready; no further tier)
//   returnDos: AC-7 (reviewer returns to immediate prior role)
//   reassignRole: AC-9 (manual reassignment; previous → Inactive)
//
// "Reviewer 3" does not exist in this workflow, Reviewer 2 is the terminal
// review stage and always resolves to Billing Ready on completion.

import { pickAssignee } from './engine';
import { ROLES, ROLE_LABEL } from './astranaStaff';
import { validateAsmReadinessConfig } from './sampling';
import { routeRoleForVisitType } from '../reference/assignmentRouting';
import {
  STATUS,
  blankDosState,
  setRoleState,
  pushActivity,
  computeWorkload,
  computePatientHistory,
  hydrateFromMember,
  dosKey,
} from './dosState';

// ── Shared helpers ───────────────────────────────────────────────────────

// Pull (or lazily seed) the DOS-state record for the composite key
// (patientId, dosDate, provider, pos).
function getOrInit(map, patientId, dosDate, provider, pos) {
  const k = dosKey(patientId, dosDate, provider, pos);
  return map[k] || blankDosState(patientId, dosDate, provider, pos);
}

// Update a single DOS-state record in the map (immutable).
function putState(map, state) {
  return { ...map, [dosKey(state.patientId, state.dosDate, state.renderingProvider, state.pos)]: state };
}

// Build a context object the engine needs to make its decision.
function ctxFor(map, patient, dos, opts = {}) {
  return {
    patient,
    dos,
    workload: computeWorkload(map),
    patientHistory: computePatientHistory(map),
    slaCloseDays: opts.slaCloseDays || 7,
    priorRoleMapping: opts.priorRoleMapping || {},
    // Continuity: caller can pass { coder: <staffId>, reviewer: <staffId>, … }
    // to force the engine to prefer that person if they still fit the role.
    preferredAssignees: opts.preferredAssignees || {},
    opts: { astrana: opts.astrana !== false },
  };
}

// Activity-event factory. Keeps shape consistent across all transitions.
function evt(state, kind, payload) {
  return {
    kind,
    role: payload.role || null,
    from: payload.from || null,
    to:   payload.to   || null,
    by:   payload.by   || 'system',
    reason: payload.reason || null,
    note: payload.note || null,
    patientId: state.patientId,
    dosDate:   state.dosDate,
    at: new Date().toISOString(),
  };
}

// Auto-pick + assign a role's assignee, returning the updated state.
// `transitionReason` describes why this happened in the activity log.
// `ctxOpts` forwards continuity / preferred-assignee hints to the engine.
function autoAssignRole(map, state, patient, dos, role, initialStatus, transitionReason, ctxOpts = {}) {
  const pick = pickAssignee(role, ctxFor(map, patient, dos, ctxOpts));
  if (!pick) return { state, picked: null };

  // AC-9: if the role already had someone, that prior assignment becomes
  // Inactive automatically via setRoleState's history tracking.
  const nextState = setRoleState(state, role,
    { assignee: pick.staff.id, status: initialStatus },
    { by: 'system', reason: `${transitionReason}:${pick.reason}` },
  );
  const withEvt = pushActivity(nextState,
    evt(nextState, 'assign', {
      role,
      to: pick.staff.id,
      reason: `${transitionReason}:${pick.reason}`,
    }),
  );
  return { state: withEvt, picked: pick };
}

// Linear-workflow skip: when a role completes, any EARLIER *review* role that
// never finished its own work is marked Skipped. Only QA (reviewer) and
// Compliance (reviewer2) are skippable: Support and Coder are mandatory and
// can NEVER be skipped. `SKIP_PRESERVE` are states we don't overwrite (real
// resolution, not a bypass).
const SKIPPABLE_ROLES = new Set(['reviewer', 'reviewer2']);
const SKIP_PRESERVE = new Set([STATUS.COMPLETED, STATUS.SKIPPED, STATUS.REJECT, STATUS.BILLING_READY]);
function autoSkipEarlierRoles(state, uptoRole, actor) {
  const idx = ROLES.indexOf(uptoRole);
  let next = state;
  for (let i = 0; i < idx; i++) {
    const role = ROLES[i];
    if (!SKIPPABLE_ROLES.has(role)) continue; // Support + Coder are never skipped
    const status = next[role]?.status;
    if (SKIP_PRESERVE.has(status)) continue;  // already resolved, leave it
    next = setRoleState(next, role,
      { status: STATUS.SKIPPED },
      { by: 'system', reason: `skipped:${uptoRole}-completed-first` },
    );
    next = pushActivity(next, evt(next, 'status', {
      role, to: STATUS.SKIPPED, by: actor, reason: `${ROLE_LABEL[uptoRole]} completed before ${ROLE_LABEL[role]}`,
    }));
  }
  return next;
}

// ── AC-1: Initialize a DOS for Support ───────────────────────────────────

/**
 * Called when a DOS is first added to a patient record. Two paths:
 *
 *  1. Pipeline / normal path: routes to Support with status Awaiting
 *     (a.k.a. "Action Needed"). Support later completes and the cascade
 *     hands off to Coder → QA → Compliance.
 *
 *  2. Manual / QA+Compliance +ICD path: when `opts.originatorRole` is
 *     'reviewer' or 'reviewer2', the DOS SKIPS Support entirely (documents
 *     already exist in the QA workflow the code was added from) and lands
 *     directly on the Visit-Type-appropriate downstream queue. The originator
 *     is snapshotted onto the DOS so completeCoder can bounce it straight
 *     back to that user without going through 10%/5% sampling.
 *
 * If the legacy member already has data for this DOS (member.sup/cdr/...),
 * we seed from that first (`hydrateFromMember`). That keeps existing
 * assignees visible in the Assignee column without re-picking. The engine
 * only runs `autoAssignRole` when there's genuinely nobody assigned yet.
 */
export function initializeDos(map, patient, dos, opts = {}) {
  const k = dosKey(patient.id, dos.date, dos.provider, dos.pos);
  let state = map[k];
  if (!state) {
    const idx = (patient.dos_list || []).findIndex(d => d.date === dos.date);
    state = hydrateFromMember(patient, dos.date, idx < 0 ? 0 : idx, dos.provider, dos.pos);
  }

  // Manual path: QA or Compliance added an ICD via +ICD. Snapshot the
  // originator, skip Support AND Coder, and pin the DOS directly to the
  // originator's role/assignee. The originator raised the code AND owns the
  // initial review, so the DOS never touches a Coder queue, Support docs
  // are already retrieved in their workflow and the code has already been
  // entered on the +ICD form.
  const isManualOrigin = opts.originatorRole === 'reviewer' || opts.originatorRole === 'reviewer2';
  if (isManualOrigin) {
    // Idempotent: if the DOS already has a valid originator AND the target
    // role has been assigned, don't re-run the picker (avoids double-assign
    // on repeat +ICD saves). But when the state carries the origin marker
    // *without* a live assignment: e.g. hydrateFromMember pre-set
    // originatorRole from the member row before the engine's ever run,
    // we still need to proceed and auto-pick the target role's assignee.
    const targetAssignee = state[opts.originatorRole]?.assignee;
    if (state.originatorRole && targetAssignee) {
      return { nextMap: putState(map, state), events: [] };
    }
    // Provenance snapshot on the DOS-state record.
    state = {
      ...state,
      originatorRole: opts.originatorRole,
      originatorAssignee: opts.originatorAssignee || null,
      manuallyAdded: true,
      visitType: opts.visitType || dos.vt || state.visitType || null,
    };
    // Skip Support and Coder: statuses stay Skipped so the worklist row
    // shows the neutral "skipped" glyph rather than pretending anyone is
    // waiting on either step. Coder is skipped even though we normally
    // route by Visit Type, because the originator raised AND reviews the
    // code: there is no code-entry gap for a Coder to close.
    state = setRoleState(state, 'support',
      { status: STATUS.SKIPPED },
      { by: 'system', reason: `manual-origin:${opts.originatorRole}` },
    );
    state = setRoleState(state, 'coder',
      { status: STATUS.SKIPPED },
      { by: 'system', reason: `manual-origin:${opts.originatorRole}` },
    );
    state = pushActivity(state, evt(state, 'status', {
      role: 'support', to: STATUS.SKIPPED, by: opts.actor || 'system',
      reason: `manual-origin:${opts.originatorRole}`,
    }));
    state = pushActivity(state, evt(state, 'status', {
      role: 'coder', to: STATUS.SKIPPED, by: opts.actor || 'system',
      reason: `manual-origin:${opts.originatorRole}`,
    }));

    // Land directly on the originator's role. When we have a known
    // originator (the user who raised the +ICD), pin them straight onto
    // the role: bypassing the Astrana pool-based picker. This lets us
    // honor a logged-in platform user id (a UUID that would otherwise
    // fail `staffById()` and cause the picker to drift to a random
    // Astrana staff). Only fall back to autoAssignRole when no
    // originator id was provided.
    const routedRole = opts.originatorRole;
    if (opts.originatorAssignee) {
      state = setRoleState(state, routedRole,
        { assignee: opts.originatorAssignee, status: STATUS.NEW },
        { by: 'system', reason: `manual-${opts.originatorRole}:originator` },
      );
      state = pushActivity(state, evt(state, 'assign', {
        role: routedRole,
        to: opts.originatorAssignee,
        reason: `manual-${opts.originatorRole}:originator`,
      }));
      return {
        nextMap: putState(map, state),
        events: [evt(state, 'init', {
          role: routedRole, to: opts.originatorAssignee, reason: 'manual:originator',
        })],
      };
    }
    const { state: withRouted, picked } = autoAssignRole(
      putState(map, state), state, patient, dos, routedRole, STATUS.NEW,
      `manual-${opts.originatorRole}→${routedRole}`,
      { preferredAssignees: opts.preferredAssignees || {} },
    );
    state = withRouted;
    return {
      nextMap: putState(map, state),
      events: picked
        ? [evt(state, 'init', { role: routedRole, to: picked.staff.id, reason: `manual:${picked.reason}` })]
        : [],
    };
  }

  // Normal path.
  if (state.support.assignee) {
    // Already initialized (either by engine or by hydrate), idempotent.
    return { nextMap: putState(map, state), events: [] };
  }
  // Auto-picking Support was previously unconditional on init, which meant
  // *opening* a DOS (Eye icon → DiagPanel mount → initializeHccPatient) would
  // silently pin a Support user (usually the top-capacity Astrana pick,
  // "E. Johnson"). Opening a record must be read-only, so callers now have
  // to opt in explicitly (`opts.autoAssignSupport: true`): e.g. the workflow
  // that actually starts Support work. View-path callers omit the flag and
  // the DOS stays Unassigned until a user picks someone from the row's
  // Assign menu.
  if (!opts.autoAssignSupport) {
    return { nextMap: putState(map, state), events: [] };
  }
  const { state: assigned, picked } = autoAssignRole(
    putState(map, state), state, patient, dos, 'support', STATUS.AWAITING, 'initial'
  );
  state = assigned;
  return {
    nextMap: putState(map, state),
    events: picked
      ? [evt(state, 'init', { role: 'support', to: picked.staff.id, reason: picked.reason })]
      : [],
  };
}

// ── AC-1: Support starts work / completes / blocks ──────────────────────

export function markSupportInProgress(map, patient, dos, actor) {
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  state = setRoleState(state, 'support',
    { status: STATUS.IN_PROGRESS },
    { by: actor || state.support.assignee || 'system', reason: 'support-start' },
  );
  state = pushActivity(state, evt(state, 'status', {
    role: 'support', from: STATUS.AWAITING, to: STATUS.IN_PROGRESS, by: actor,
  }));
  return { nextMap: putState(map, state), events: [] };
}

/**
 * AC-1 / AC-2: Support marks the DOS Completed → trigger Coder assignment.
 *
 * Side effects:
 *  - support.status = Completed
 *  - coder.assignee picked by engine (Astrana-pinned if patient already has one)
 *  - coder.status starts as `New`, immediately moved to `In Progress` when assigned
 */
export function completeSupport(map, patient, dos, actor) {
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  state = setRoleState(state, 'support',
    { status: STATUS.COMPLETED },
    { by: actor, reason: 'support-complete' },
  );
  state = pushActivity(state, evt(state, 'status', {
    role: 'support', to: STATUS.COMPLETED, by: actor,
  }));

  // If another role (Coder / QA / Compliance) has an open records_request
  // targeting Support, route the DOS back to that requester with status
  // Record Received instead of running the normal Support → Coder cascade.
  const requester = findRequesterFor(state, 'support');
  if (requester) {
    const { nextMap } = recordsReceivedFor(putState(map, state), patient, dos, requester, actor);
    return { nextMap, events: [] };
  }

  // Auto-assign Coder (AC-2)
  const { state: withCoder, picked } = autoAssignRole(
    putState(map, state), state, patient, dos, 'coder', STATUS.NEW,
    'support-completed→coder',
  );
  state = withCoder;

  return {
    nextMap: putState(map, state),
    events: picked ? [evt(state, 'assign', { role: 'coder', to: picked.staff.id, reason: picked.reason })] : [],
  };
}

export function markInsufficient(map, patient, dos, actor, reason) {
  if (!reason) throw new Error('markInsufficient: reason is mandatory');
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  state = setRoleState(state, 'support',
    { status: STATUS.INSUFFICIENT },
    { by: actor, reason: `insufficient:${reason}` },
  );
  state = pushActivity(state, evt(state, 'status', {
    role: 'support', to: STATUS.INSUFFICIENT, by: actor, reason, note: reason,
  }));
  return { nextMap: putState(map, state), events: [] };
}

export function rejectDos(map, patient, dos, actor, reason) {
  if (!reason) throw new Error('rejectDos: reason is mandatory');
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  // Reject is terminal per AC-1: no further auto-assignment.
  state = setRoleState(state, 'support',
    { status: STATUS.REJECT },
    { by: actor, reason: `reject:${reason}` },
  );
  state = pushActivity(state, evt(state, 'status', {
    role: 'support', to: STATUS.REJECT, by: actor, reason, note: reason,
  }));
  return { nextMap: putState(map, state), events: [] };
}

// ── AC-2 / AC-3: Coder lifecycle ─────────────────────────────────────────

export function markCoderInProgress(map, patient, dos, actor) {
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  state = setRoleState(state, 'coder',
    { status: STATUS.IN_PROGRESS },
    { by: actor || state.coder.assignee || 'system', reason: 'coder-start' },
  );
  state = pushActivity(state, evt(state, 'status', { role: 'coder', to: STATUS.IN_PROGRESS, by: actor }));
  return { nextMap: putState(map, state), events: [] };
}

/**
 * AC-3: Coder marks DOS Completed → assign Reviewer (100% sample, no skip).
 *
 * Two branch-outs before the normal cascade:
 *  1. Records-request loop: if a downstream role has an open records_request
 *     targeting Coder, bounce the DOS back to that requester with status
 *     Record Received instead of advancing to Reviewer.
 *  2. Manual-origin loop: if this DOS was spawned via +ICD from QA/Compliance,
 *     route it straight back to the originator role, bypassing QA sampling
 *     (the originator's role IS the review step for a code they added).
 */
export function completeCoder(map, patient, dos, actor) {
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  state = setRoleState(state, 'coder',
    { status: STATUS.COMPLETED },
    { by: actor, reason: 'coder-complete' },
  );
  state = pushActivity(state, evt(state, 'status', { role: 'coder', to: STATUS.COMPLETED, by: actor }));

  // 1. Records-request short-circuit.
  const requester = findRequesterFor(state, 'coder');
  if (requester) {
    const { nextMap } = recordsReceivedFor(putState(map, state), patient, dos, requester, actor);
    return { nextMap, events: [] };
  }

  // 2. Manual-origin short-circuit: QA/Compliance +ICD DOS bounces back to
  //    the originator role (10%/5% sampling bypassed). The DOS started on the
  //    Coder queue via routeRoleForVisitType; now the Coder is done, so hand
  //    off to whoever raised the code so they can finalise their own review.
  if (state.originatorRole === 'reviewer' || state.originatorRole === 'reviewer2') {
    state = autoSkipEarlierRoles(state, 'coder', actor);
    // Prefer the snapshotted originator user if we have one; otherwise let
    // the engine pick from that role's pool.
    const targetRole = state.originatorRole;
    let picked = null;
    if (state.originatorAssignee) {
      state = setRoleState(state, targetRole,
        { assignee: state.originatorAssignee, status: STATUS.NEW },
        { by: 'system', reason: `manual-return:${targetRole}` },
      );
    } else {
      const res = autoAssignRole(
        putState(map, state), state, patient, dos, targetRole, STATUS.NEW,
        `coder-completed→manual-return:${targetRole}`,
      );
      state = res.state;
      picked = res.picked;
    }
    state = pushActivity(state, evt(state, 'manual-return', {
      role: targetRole,
      to: state.originatorAssignee || picked?.staff?.id || null,
      by: actor,
      reason: `originator-return:${state.originatorRole}`,
    }));
    return { nextMap: putState(map, state), events: [] };
  }

  // Normal cascade: Support never worked it → mark Skipped, then assign QA.
  state = autoSkipEarlierRoles(state, 'coder', actor);
  const { state: withReviewer, picked } = autoAssignRole(
    putState(map, state), state, patient, dos, 'reviewer', STATUS.NEW,
    'coder-completed→reviewer',
  );
  state = withReviewer;

  return { nextMap: putState(map, state), events: picked
    ? [evt(state, 'assign', { role: 'reviewer', to: picked.staff.id, reason: picked.reason })]
    : [] };
}

// ── AC-6: Records Requested loop (any requester role ↔ Coder / Support) ─
//
// Historically this loop was hardwired Coder → Support → Coder. QA and
// Compliance now need the same affordance: request records from either
// Coder or Support Team, have the DOS return to them automatically when
// the destination role marks the request Completed. The core primitives
// are role-agnostic:
//
//   requestRecordsFrom(requesterRole, destinationRole, ...),
//     sets requester.status = Record Requested,
//     reassigns destinationRole to their last-known assignee (fallback
//       to the standard engine picker) with status = Returned,
//     snapshots the request context on requester.records_request so
//       the destination's completion cascade can find it and route back
//
//   recordsReceivedFor(requesterRole, ...),
//     clears requester.records_request,
//     reassigns requester to the original requester (never lost, always
//       the snapshotted assignee taken at request time),
//     sets requester.status = Record Received,
//     leaves destination role at Completed; completeSupport/completeCoder
//       call this when they detect a pending request targeting them and
//       skip the normal auto-advance cascade.
//
// The public `requestRecords` / `recordsReceived` names are kept as thin
// shims routing to (coder, support) so old callers keep working.

// Snapshot of a records request. Lives on the requester's role slot until
// the destination completes and clears it (or until it's overwritten by a
// new request from the same requester). Edge case 4: because it's keyed by
// the requester role, QA and Compliance can each have their own open request
// concurrently without stomping each other.
function makeRecordsRequestContext(state, requesterRole, destinationRole, actor) {
  const rs = state[requesterRole] || {};
  const ds = state[destinationRole] || {};
  return {
    requesterRole,
    requesterAssignee: rs.assignee || null,  // snapshot, used to route back
    destinationRole,
    previousDestAssignee: ds.assignee || null,
    requestedBy: actor || 'system',
    requestedAt: new Date().toISOString(),
    status: 'open',
  };
}

// Find the last-known assignee for a role on this DOS. Prefers `originalAssignee`
// (first person who ever held the role); falls back to scanning the role's
// history for any past assignee.
function lastKnownAssignee(state, role) {
  const rs = state[role];
  if (!rs) return null;
  if (rs.originalAssignee) return rs.originalAssignee;
  const hist = Array.isArray(rs.history) ? rs.history : [];
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].assignee) return hist[i].assignee;
  }
  return null;
}

/**
 * Requester (Coder / QA / Compliance) asks the destination role (Coder or
 * Support Team) for more records. The DOS routes to the destination's
 * last-known assignee (or a fresh pick if none is on file); the requester's
 * own state is preserved so they can pick up where they left off once the
 * request is filled.
 */
export function requestRecordsFrom(map, patient, dos, requesterRole, destinationRole, actor, opts = {}) {
  if (requesterRole === destinationRole) {
    throw new Error(`requestRecordsFrom: requester and destination cannot both be "${requesterRole}"`);
  }
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);

  // Requester side: status = Record Requested + snapshot request context.
  const ctxSnapshot = makeRecordsRequestContext(state, requesterRole, destinationRole, actor);
  state = setRoleState(state, requesterRole,
    { status: STATUS.RECORD_REQUESTED, records_request: ctxSnapshot },
    { by: actor, reason: `records-requested:from-${destinationRole}` },
  );

  // Destination side: the person the requester picked, else the last-known
  // assignee, else a fresh pick.
  const prevDest = opts.destinationAssignee || lastKnownAssignee(state, destinationRole);
  if (prevDest) {
    state = setRoleState(state, destinationRole,
      { assignee: prevDest, status: STATUS.RETURNED },
      { by: opts.destinationAssignee ? actor : 'system',
        reason: opts.destinationAssignee
          ? `records-requested:picked-${destinationRole}`
          : `records-requested:return-to-original-${destinationRole}` },
    );
  } else {
    const pick = pickAssignee(destinationRole, ctxFor(map, patient, dos));
    if (pick) {
      state = setRoleState(state, destinationRole,
        { assignee: pick.staff.id, status: STATUS.RETURNED },
        { by: 'system', reason: `records-requested:no-history;${pick.reason}` },
      );
    }
  }

  state = pushActivity(state, evt(state, 'records-requested', {
    role: requesterRole, to: STATUS.RECORD_REQUESTED, by: actor,
    reason: `from:${destinationRole}${opts.note ? `;note:${opts.note}` : ''}`,
  }));

  return { nextMap: putState(map, state), events: [] };
}

/**
 * Destination role finished the retrieval → DOS returns to the ORIGINAL
 * requester (snapshotted at request time; never inferred from current
 * assignees). Requester status becomes Record Received. All prior work
 * (coding, review, notes, comments, docs) is preserved because we never
 * touch ICDs, comments, or docs in the engine.
 *
 * This is invoked automatically from completeSupport / completeCoder when
 * they detect a records_request on any other role targeting them.
 */
export function recordsReceivedFor(map, patient, dos, requesterRole, actor) {
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  const req = state[requesterRole]?.records_request;
  if (!req) {
    // Nothing to do: the requester's context has already been cleared or
    // never existed. Return the map unchanged so callers can no-op safely.
    return { nextMap: map, events: [] };
  }
  const originalRequester = req.requesterAssignee || lastKnownAssignee(state, requesterRole);
  if (originalRequester) {
    state = setRoleState(state, requesterRole,
      { assignee: originalRequester, status: STATUS.RECORD_RECEIVED, records_request: null },
      { by: 'system', reason: `records-received:return-to-original-${requesterRole}` },
    );
  } else {
    // Original requester unavailable → existing fallback picker for the
    // requester role. AC-3 in the spec: use the standard assignment logic.
    const pick = pickAssignee(requesterRole, ctxFor(map, patient, dos));
    if (pick) {
      state = setRoleState(state, requesterRole,
        { assignee: pick.staff.id, status: STATUS.RECORD_RECEIVED, records_request: null },
        { by: 'system', reason: `records-received:no-original;${pick.reason}` },
      );
    } else {
      // No picker match either: still clear the request so the DOS isn't
      // stuck in an inconsistent state forever.
      state = setRoleState(state, requesterRole,
        { status: STATUS.RECORD_RECEIVED, records_request: null },
        { by: 'system', reason: 'records-received:unassigned' },
      );
    }
  }
  state = pushActivity(state, evt(state, 'records-received', {
    role: requesterRole, to: STATUS.RECORD_RECEIVED, by: actor,
    reason: `from:${req.destinationRole}`,
  }));
  return { nextMap: putState(map, state), events: [] };
}

// Legacy wrapper: Coder requesting records from Support. New code should
// use requestRecordsFrom / recordsReceivedFor directly.
export function requestRecords(map, patient, dos, actor) {
  return requestRecordsFrom(map, patient, dos, 'coder', 'support', actor);
}

// Legacy wrapper: Support completing a Coder-initiated records request.
// New code should let completeSupport / completeCoder auto-detect and
// call recordsReceivedFor.
export function recordsReceived(map, patient, dos, actor) {
  return recordsReceivedFor(map, patient, dos, 'coder', actor);
}

// Find the role whose records_request targets `destinationRole`. Returns
// the requester role key ('coder' | 'reviewer' | 'reviewer2') or null.
function findRequesterFor(state, destinationRole) {
  for (const role of ROLES) {
    if (role === destinationRole) continue;
    const req = state[role]?.records_request;
    if (req && req.status === 'open' && req.destinationRole === destinationRole) {
      return role;
    }
  }
  return null;
}

// ── AC-3 / AC-4: Reviewer lifecycle ──────────────────────────────────────

export function markReviewerInProgress(map, patient, dos, actor) {
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  state = setRoleState(state, 'reviewer', { status: STATUS.IN_PROGRESS },
    { by: actor, reason: 'reviewer-start' });
  return { nextMap: putState(map, state), events: [] };
}

/**
 * QA (Reviewer) completes → ALWAYS advance to Compliance (Reviewer 2).
 *
 * The workflow is a strict linear pipeline Support → Coder → QA → Compliance,
 * so QA completion always hands off to Compliance (no sampling short-circuit
 * to Billing Ready). Any earlier role that never worked the record is skipped.
 */
export function completeReviewer(map, patient, dos, actor) {
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  state = setRoleState(state, 'reviewer', { status: STATUS.COMPLETED },
    { by: actor, reason: 'reviewer-complete' });
  state = resolveRebuttal(state, 'reviewer', actor);
  state = pushActivity(state, evt(state, 'status', { role: 'reviewer', to: STATUS.COMPLETED, by: actor }));
  // Support / Coder never worked it → mark Skipped.
  state = autoSkipEarlierRoles(state, 'reviewer', actor);

  // Manual-origin short-circuit: QA raised AND reviewed the ICD, so there
  // is no downstream Compliance step. Mark Billing Ready directly instead
  // of sampling into Reviewer 2. (Compliance-raised DOSs start on
  // reviewer2 in initializeDos, so they don't reach this branch.)
  if (state.originatorRole === 'reviewer') {
    state = autoSkipEarlierRoles(state, 'reviewer2', actor);
    state = setRoleState(state, 'reviewer2', { status: STATUS.SKIPPED },
      { by: 'system', reason: 'manual-origin:reviewer' });
    state = { ...state, billingReady: true, asmGenerated: true };
    state = pushActivity(state, evt(state, 'billing-ready', {
      role: 'reviewer', reason: 'manual-origin:reviewer-completed',
    }));
    return { nextMap: putState(map, state), events: [] };
  }

  const { state: withReviewer2, picked } = autoAssignRole(
    putState(map, state), state, patient, dos, 'reviewer2', STATUS.NEW,
    'reviewer-completed→reviewer2',
  );
  state = withReviewer2;
  return { nextMap: putState(map, state), events: picked
    ? [evt(state, 'assign', { role: 'reviewer2', to: picked.staff.id, reason: picked.reason })]
    : [] };
}

// ── AC-4 / AC-5: Reviewer 2 lifecycle (terminal: always resolves to Billing Ready) ──

export function markReviewer2InProgress(map, patient, dos, actor) {
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  state = setRoleState(state, 'reviewer2', { status: STATUS.IN_PROGRESS },
    { by: actor, reason: 'reviewer2-start' });
  // Compliance starting work implies QA won't get to it: skip an unresolved
  // reviewer (only reviewer is skippable at this point per SKIPPABLE_ROLES).
  state = autoSkipEarlierRoles(state, 'reviewer2', actor);
  return { nextMap: putState(map, state), events: [] };
}

/**
 * AC-5: Reviewer 2 completes → Billing Ready. There is no further review
 * tier ("Reviewer 3" does not exist), so this always terminates the chain.
 *
 * WR7 (Phase 0): validate the sampling config isn't silently violating a
 * future "minimum two reviews before ASM" rule before flipping billingReady.
 * See sampling.js's `validateAsmReadinessConfig` doc comment for why this is
 * a dormant guard, not new business logic.
 */
export function completeReviewer2(map, patient, dos, actor, config = {}) {
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  state = setRoleState(state, 'reviewer2', { status: STATUS.COMPLETED },
    { by: actor, reason: 'reviewer2-complete' });
  state = resolveRebuttal(state, 'reviewer2', actor);
  state = pushActivity(state, evt(state, 'status', { role: 'reviewer2', to: STATUS.COMPLETED, by: actor }));
  // Any earlier role that never worked it → mark Skipped.
  state = autoSkipEarlierRoles(state, 'reviewer2', actor);

  validateAsmReadinessConfig(config);

  state = { ...state, billingReady: true, asmGenerated: true };
  state = pushActivity(state, evt(state, 'billing-ready', { role: 'reviewer2', reason: 'reviewer2-completed' }));
  return { nextMap: putState(map, state), events: [] };
}

// ── AC-7: Reviewer returns ───────────────────────────────────────────────

const RETURN_TARGET = { reviewer: 'coder', reviewer2: 'reviewer' };

// The sender completing ends the rebuttal: the role it was sent to (still
// read-only in Rebuttal) flips to Completed.
function resolveRebuttal(state, fromRole, actor) {
  const target = RETURN_TARGET[fromRole];
  if (!target || state[target]?.status !== STATUS.REBUTTAL) return state;
  return setRoleState(state, target, { status: STATUS.COMPLETED },
    { by: actor, reason: `rebuttal-resolved-by-${fromRole}` });
}

/**
 * Rebuttal: `fromRole` (QA or Compliance) sends the record back to the
 * ORIGINAL holder of the prior role (QA → Coder, Compliance → QA). Both sides
 * show Rebuttal: the target is read-only (no ICD changes, no status changes)
 * and the sender keeps working. When the sender completes, the target flips
 * to Completed (see resolveRebuttal). All work is preserved.
 *
 * Only valid for reviewer → coder, reviewer2 → reviewer (AC-7 "no level skipping").
 */
export function returnDos(map, patient, dos, fromRole, actor, reason) {
  const targetRole = RETURN_TARGET[fromRole];
  if (!targetRole) {
    throw new Error(`returnDos: invalid fromRole "${fromRole}"`);
  }
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);

  state = setRoleState(state, fromRole, { status: STATUS.REBUTTAL },
    { by: actor, reason: `rebuttal:${reason || 'no-reason'}` });

  // Bounce to the ORIGINAL prior-role holder
  const originalPrior = state[targetRole].originalAssignee || state[targetRole].assignee;
  if (originalPrior) {
    state = setRoleState(state, targetRole,
      { assignee: originalPrior, status: STATUS.REBUTTAL },
      { by: 'system', reason: `rebuttal-from-${fromRole}` },
    );
  }

  state = pushActivity(state, evt(state, 'return', {
    role: fromRole, to: STATUS.REBUTTAL, by: actor, reason, note: `→ ${ROLE_LABEL[targetRole]}`,
  }));

  return { nextMap: putState(map, state), events: [] };
}

// ── AC-9: Manual reassignment ────────────────────────────────────────────

/**
 * Manually reassign a role on a DOS to a different staff member. The prior
 * Active assignee is automatically marked Inactive (history-tracked).
 *
 * Astrana note: this updates the pin for the patient too, subsequent DOSs
 * for the same patient will be routed to the new person via the engine's
 * Astrana pin (which reads from `computePatientHistory`).
 */
export function reassignRole(map, patient, dos, role, newStaffId, actor, reason) {
  if (!ROLES.includes(role)) throw new Error(`reassignRole: bad role "${role}"`);
  let state = getOrInit(map, patient.id, dos.date, dos.provider, dos.pos);
  const prevId = state[role].assignee;
  if (prevId === newStaffId) return { nextMap: map, events: [] };

  state = setRoleState(state, role,
    { assignee: newStaffId },
    { by: actor, reason: `reassign:${reason || 'manual'}` },
  );
  state = pushActivity(state, evt(state, 'reassign', {
    role, from: prevId, to: newStaffId, by: actor, reason,
  }));
  return { nextMap: putState(map, state), events: [] };
}

// ── Bulk: initialize all DOSs of a patient (Astrana) ─────────────────────

/**
 * Walk through every DOS in `patient.dos_list` and initialize Support for
 * each (idempotent). Astrana pin makes sure they all land on the same
 * Support / Coder / Reviewer at every role as the workflow progresses.
 */
export function initializePatient(map, patient, opts) {
  let cur = map;
  const events = [];
  for (const dos of patient.dos_list || []) {
    const r = initializeDos(cur, patient, dos, opts);
    cur = r.nextMap;
    events.push(...r.events);
  }
  return { nextMap: cur, events };
}
