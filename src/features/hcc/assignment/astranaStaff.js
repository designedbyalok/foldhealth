// Astrana staff roster for the HCC assignment engine.
//
// This is the single source of truth used by `engine.js` to pick an assignee
// at every role transition (Support → Coder → Reviewer → Reviewer 2). "Reviewer 3"
// does not exist as a role, the review pipeline has exactly four stages.
// Members of the roster are real names used by the existing mock data + the
// story examples so the engine's output looks consistent with what already
// appears in the worklist and activity log.
//
// Each entry exposes:
//   id: short stable handle (e.g. 'EJ', 'DH'). Used everywhere internally.
//   name: full display name surfaced in the UI.
//   initials: 2-letter avatar initials.
//   role: primary role this person works ('support' | 'coder' | 'reviewer' | 'reviewer2').
//   active: false = on leave / inactive. Excluded from auto-assignment.
//   tins: TIN strings this person owns (Support + Coder use these).
//   vendors: vendor codes routed to this person (Coder + R2/R3 use these).
//   capacity: soft monthly DOS cap. The workload-balancer prefers members
//               whose current count is furthest from capacity.
//
// Role pools deliberately overlap a bit (e.g. K. Patel handles R1 and R2 at
// different times) to mirror real life, the engine never picks the same
// person for two roles on the same DOS (see engine.js `excludePeer`).

export const ASTRANA_STAFF = [
  // ─── Support (Medical Support Staff) ──────────────────────────────
  { id: 'EJ', name: 'E. Johnson',    initials: 'EJ', role: 'support', active: true,  tins: ['TIN-1001','TIN-1004'], vendors: [],         capacity: 80 },
  { id: 'AB', name: 'A. Beauchamp',  initials: 'AB', role: 'support', active: true,  tins: ['TIN-1002'],            vendors: [],         capacity: 70 },
  { id: 'KS', name: 'K. Stroman',    initials: 'KS', role: 'support', active: true,  tins: ['TIN-1003'],            vendors: [],         capacity: 70 },
  { id: 'LT', name: 'L. Torrance',   initials: 'LT', role: 'support', active: true,  tins: [],                      vendors: [],         capacity: 60 },
  { id: 'MT', name: 'M. Thompson',   initials: 'MT', role: 'support', active: true,  tins: ['TIN-1005'],            vendors: [],         capacity: 70 },
  { id: 'OT', name: 'O. Twist',      initials: 'OT', role: 'support', active: true,  tins: [],                      vendors: [],         capacity: 70 },

  // ─── Coder ────────────────────────────────────────────────────────
  { id: 'DH', name: 'Deborah Hintz', initials: 'DH', role: 'coder',   active: true,  tins: ['TIN-1001','TIN-1002'], vendors: ['CIOX'],   capacity: 60 },
  { id: 'PP', name: 'P. Plourde',    initials: 'PP', role: 'coder',   active: true,  tins: ['TIN-1003','TIN-1005'], vendors: ['MRO'],    capacity: 60 },
  { id: 'CK', name: 'C. Kessler',    initials: 'CK', role: 'coder',   active: true,  tins: ['TIN-1004'],            vendors: [],         capacity: 60 },

  // ─── Reviewer ─────────────────────────────────────────────────────
  { id: 'MA', name: 'M. Almeda',     initials: 'MA', role: 'reviewer',  active: true,  tins: [], vendors: [],          capacity: 50 },
  { id: 'BO', name: 'B. Olafson',    initials: 'BO', role: 'reviewer',  active: true,  tins: [], vendors: ['CIOX'],    capacity: 50 },
  { id: 'EF', name: 'E. Fortier',    initials: 'EF', role: 'reviewer',  active: true,  tins: [], vendors: [],          capacity: 50 },

  // ─── Reviewer 2 ───────────────────────────────────────────────────
  // J. Martinez previously held a Reviewer-3-only slot; reassigned here
  // rather than dropped from the roster now that Reviewer 3 doesn't exist.
  { id: 'KP', name: 'K. Patel',      initials: 'KP', role: 'reviewer2', active: true,  tins: [], vendors: [],          capacity: 30 },
  { id: 'NR', name: 'N. Richards',   initials: 'NR', role: 'reviewer2', active: true,  tins: [], vendors: ['CIOX'],    capacity: 30 },
  { id: 'JM', name: 'J. Martinez',   initials: 'JM', role: 'reviewer2', active: true,  tins: [], vendors: [],          capacity: 30 },
];

// Map role → array of staff in that pool. Inactive members are kept here for
// `staffById` lookups (used by the Activity Log) but filtered out by the
// engine via `activeStaffForRole`.
for (const s of ASTRANA_STAFF) {
  s._tinSet = new Set(s.tins || []);
  s._vendorSet = new Set(s.vendors || []);
}

const _byRole = ASTRANA_STAFF.reduce((acc, s) => {
  (acc[s.role] = acc[s.role] || []).push(s);
  return acc;
}, {});

const _byId = Object.fromEntries(ASTRANA_STAFF.map(s => [s.id, s]));

export const ROLES = ['support', 'coder', 'reviewer', 'reviewer2'];

export const ROLE_LABEL = {
  support:   'Support',
  coder:     'Coder',
  reviewer:  'QA',
  reviewer2: 'Compliance',
};

export function staffById(id) { return _byId[id] || null; }

export function staffForRole(role)       { return _byRole[role] || []; }
export function activeStaffForRole(role) { return (_byRole[role] || []).filter(s => s.active); }

// TIN mapping: returns the (active) staff in `role` who owns the given TIN.
// Multiple matches are allowed; the caller (engine) workload-balances among them.
export function staffForTin(role, tin) {
  if (!tin) return [];
  return activeStaffForRole(role).filter(s => s._tinSet.has(tin));
}

// Vendor mapping: same shape as `staffForTin`.
export function staffForVendor(role, vendor) {
  if (!vendor) return [];
  return activeStaffForRole(role).filter(s => s._vendorSet.has(vendor));
}
