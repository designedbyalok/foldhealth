// Auto-assignment engine for the Astrana HCC workflow.
//
// Given a (patient, DOS, role), `pickAssignee` walks the per-role priority
// chain defined in the user story and returns the staff member that should
// be assigned, plus a short `reason` describing which rule fired. The engine
// is **pure**: no React, no Zustand. The store calls it during transition
// actions (see `lifecycle.js`).
//
// Astrana invariant (Global Assignment Rule):
//   "All DOSs for one patient must be routed to the same team member at every
//    stage."
//
// We honour this by checking `existingAssigneeForPatient` first at every
// role. Only if the patient has NEVER been touched at this role do we run
// the role-specific priority chain.

import {
  activeStaffForRole,
  staffForTin,
  staffForVendor,
  staffById,
  ROLES,
} from './astranaStaff';

// ── Helpers ──────────────────────────────────────────────────────────────

// Find an assignee that's already been pinned to this patient at the given
// role: looks across all DOSs the engine has previously assigned.
// `patientHistory[patientId]?.[role]` is `{ assignee, since } | undefined`.
function existingAssigneeForPatient(patientHistory, patientId, role) {
  return patientHistory?.[patientId]?.[role]?.assignee || null;
}

// Workload balancer: pick the staff member with the most spare capacity.
// `workload[staffId]` is the current count of DOSs assigned to that person.
// Ties are broken by `id` (alphabetical) so output is deterministic.
function pickByWorkload(candidates, workload = {}) {
  if (!candidates.length) return null;
  const scored = candidates.map(s => {
    const used = workload[s.id] || 0;
    const headroom = (s.capacity || 0) - used;
    return { s, headroom };
  });
  scored.sort((a, b) => {
    if (b.headroom !== a.headroom) return b.headroom - a.headroom;
    return a.s.id.localeCompare(b.s.id);
  });
  return scored[0].s;
}

// Deterministic "random" fallback: keyed off (patientId, dosDate) so the
// same DOS always lands on the same person if the engine is re-run, but the
// distribution is still spread across the pool.
function pickByStableRandom(candidates, seed) {
  if (!candidates.length) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return candidates[(h >>> 0) % candidates.length];
}

// ── Per-role priority chains ─────────────────────────────────────────────

// AC-1: Blank → Support
function pickSupport(ctx) {
  const { patient, dos, workload, opts = {} } = ctx;
  const pool = activeStaffForRole('support');
  if (!pool.length) return null;

  // Priority 1: TIN mapping (provider TIN on the DOS / member)
  const tin = dos?.tin || patient?.tin || null;
  const tinMatches = staffForTin('support', tin);
  if (tinMatches.length === 1) {
    return { staff: tinMatches[0], reason: `tin:${tin}` };
  }
  if (tinMatches.length > 1) {
    const w = pickByWorkload(tinMatches, workload);
    return { staff: w, reason: `tin:${tin}+workload` };
  }

  // Priority 2: workload balance across the full pool
  if (!opts.skipWorkload) {
    const w = pickByWorkload(pool, workload);
    if (w) return { staff: w, reason: 'workload' };
  }

  // Fallback: deterministic random
  const fb = pickByStableRandom(pool, `support::${patient?.id}::${dos?.date}::${dos?.renderingProvider}::${dos?.pos}`);
  return fb ? { staff: fb, reason: 'fallback' } : null;
}

// AC-2: Support → Coder
function pickCoder(ctx) {
  const { patient, dos, workload } = ctx;
  const pool = activeStaffForRole('coder');
  if (!pool.length) return null;

  // 1. Provider / TIN mapping
  const tin = dos?.tin || patient?.tin || null;
  const tinMatches = staffForTin('coder', tin);
  if (tinMatches.length === 1) return { staff: tinMatches[0], reason: `tin:${tin}` };
  if (tinMatches.length > 1) {
    return { staff: pickByWorkload(tinMatches, workload), reason: `tin:${tin}+workload` };
  }

  // 3. Vendor rules
  const vendor = dos?.vendor || patient?.vendor || null;
  const vendorMatches = staffForVendor('coder', vendor);
  if (vendorMatches.length) {
    return { staff: pickByWorkload(vendorMatches, workload), reason: `vendor:${vendor}` };
  }

  // 2 + 4. Workload balance over the whole pool, then random fallback.
  const w = pickByWorkload(pool, workload);
  if (w) return { staff: w, reason: 'workload' };
  const fb = pickByStableRandom(pool, `coder::${patient?.id}::${dos?.date}::${dos?.renderingProvider}::${dos?.pos}`);
  return fb ? { staff: fb, reason: 'fallback' } : null;
}

// Shared priority chain for AC-3 / AC-4 (Reviewer / Reviewer 2).
// `priorRole` is the role just below this one ('coder' → 'reviewer',
// 'reviewer' → 'reviewer2'): used for the "role-to-role mapping" rule.
function pickReviewer(role, priorRole, ctx) {
  const { patient, dos, workload, slaCloseDays, patientHistory } = ctx;
  const pool = activeStaffForRole(role);
  if (!pool.length) return null;

  // 1. Coder → R1 / R1 → R2 / R2 → R3 role mapping. We model this as: the
  //    person who handled the prior role on this patient may have a "preferred
  //    reviewer" attribute. We don't have that data today; honour it if a
  //    `priorRoleMapping[<priorAssigneeId>]` exists in ctx.
  const priorAssignee = existingAssigneeForPatient(patientHistory, patient?.id, priorRole);
  const mapped = priorAssignee && ctx.priorRoleMapping?.[priorAssignee]?.[role];
  const mappedStaff = mapped && staffById(mapped);
  if (mappedStaff && mappedStaff.role === role && mappedStaff.active) {
    return { staff: mappedStaff, reason: `mapped:${priorAssignee}→${mappedStaff.id}` };
  }

  // 2. Vendor mapping (Reviewer 2 step in the story)
  const vendor = dos?.vendor || patient?.vendor || null;
  const vendorMatches = staffForVendor(role, vendor);
  if (vendorMatches.length) {
    return { staff: pickByWorkload(vendorMatches, workload), reason: `vendor:${vendor}` };
  }

  // 3. SLA prioritisation: if the DOS has a deadline within `slaCloseDays`,
  //    prefer reviewers with the highest spare capacity (they can act fastest).
  //    Falls through to the workload step otherwise.
  const slaDue = !!dos?.due && Number.isFinite(dos?.daysUntilDue) && dos.daysUntilDue <= (slaCloseDays || 7);
  if (slaDue) {
    const w = pickByWorkload(pool, workload);
    if (w) return { staff: w, reason: `sla<${slaCloseDays || 7}d` };
  }

  // 4. Same-patient preference: has any reviewer in this role already
  //    handled a DOS for this patient? (Used when the patient has multiple
  //    DOSs and one was already routed before the Astrana pin took effect,
  //    rare but a real edge case in test data.)
  const sameUser = existingAssigneeForPatient(patientHistory, patient?.id, role);
  if (sameUser) {
    const s = staffById(sameUser);
    if (s?.role === role && s.active) return { staff: s, reason: 'same-patient' };
  }

  // 5. Workload balance, then 6. random fallback.
  const w = pickByWorkload(pool, workload);
  if (w) return { staff: w, reason: 'workload' };
  const fb = pickByStableRandom(pool, `${role}::${patient?.id}::${dos?.date}::${dos?.renderingProvider}::${dos?.pos}`);
  return fb ? { staff: fb, reason: 'fallback' } : null;
}

// ── Public entry point ───────────────────────────────────────────────────

/**
 * Resolve which staff member should be assigned to `(patient, dos)` at `role`.
 *
 * Returns `{ staff, reason }` or `null` if no candidate can be found (e.g.
 * the role pool is empty and there's no fallback).
 *
 * `ctx` shape:
 *   {
 *     patient:      { id, tin?, vendor?, ... }
 *     dos:          { date, tin?, vendor?, daysUntilDue?, due?, ... }
 *     workload:     { [staffId]: number }   // current open DOS count per staff
 *     patientHistory: {                     // per-patient history across roles
 *       [patientId]: { [role]: { assignee, since } }
 *     }
 *     priorRoleMapping?: { [staffId]: { reviewer?: id, reviewer2?: id } }
 *     slaCloseDays?: number  // default 7 (Reviewer→Reviewer 2 SLA priority window)
 *     opts?:        { astrana: boolean }    // toggles Global Assignment Rule
 *   }
 */
export function pickAssignee(role, ctx) {
  if (!ROLES.includes(role)) {
    throw new Error(`pickAssignee: unknown role "${role}"`);
  }
  const astrana = ctx?.opts?.astrana !== false; // default ON

  // Continuity pin: caller-supplied preferred assignee wins over everything
  // else when valid. Used by the QA/Compliance +ICD flow to keep the same
  // Coder on the newly-spawned DOS as on the DOS the user was reviewing.
  const preferredId = ctx?.preferredAssignees?.[role] || ctx?.preferredAssignee;
  if (preferredId) {
    const pref = staffById(preferredId);
    if (pref && pref.role === role && pref.active) {
      return { staff: pref, reason: 'continuity' };
    }
    // Preferred id doesn't resolve to an active staff member → fall through
    // and let the standard priority chain pick someone else.
  }

  // Global Assignment Rule (Astrana): pin to whoever is already on this
  // patient at this role. Skipped for non-Astrana clients.
  if (astrana) {
    const pinnedId = existingAssigneeForPatient(ctx.patientHistory, ctx.patient?.id, role);
    if (pinnedId) {
      const pinned = staffById(pinnedId);
      if (pinned && pinned.role === role && pinned.active) {
        return { staff: pinned, reason: 'astrana-pin' };
      }
      // Pinned person is inactive (on leave) → fall through to re-pick. The
      // caller is responsible for marking the prior assignment Inactive (AC-9).
    }
  }

  switch (role) {
    case 'support':   return pickSupport(ctx);
    case 'coder':     return pickCoder(ctx);
    case 'reviewer':  return pickReviewer('reviewer',  'coder',    ctx);
    case 'reviewer2': return pickReviewer('reviewer2', 'reviewer', ctx);
    default:          return null;
  }
}

// Re-export ROLES for consumers that import from engine.js directly.
export { ROLES } from './astranaStaff';
