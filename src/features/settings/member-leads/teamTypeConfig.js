// Single source of truth for the ConfigureTeamDrawer's team-type and
// Assign-To dropdowns. The mapping mirrors the Phase 2 Auto-Assignment
// spec (Risk Adjustment / Coder Workflow) — Coder → Reviewer (TIN fallback),
// Reviewer → Reviewer 2 (vendor fallback), Coder pool routed by TIN + vendor.
// "Reviewer 3" does not exist — Reviewer 2 is the terminal review stage.
import { ASTRANA_STAFF, staffForRole, ROLE_LABEL } from '../../hcc/assignment/astranaStaff';

// Team Type options per Care Team kind. Keep entries in display order.
export const TEAM_TYPE_OPTIONS = {
  hcc: ['Coder', 'QA', 'Compliance'],
  'care-program': ['SNP', 'AWV', 'CCM', 'TCM', 'ECM', 'CBP', 'MRP'],
  hedis: ['Assignee'],
};

// Which dimensions an admin can route patients/gaps from for a given team
// type. For HCC: Coder is fed by TIN/Vendor; Reviewer by Coder/TIN;
// Reviewer 2 walks the chain upward. Care Program / HEDIS teams route by
// TIN or Vendor.
export const ASSIGN_TO_DIMENSIONS = {
  Coder:        ['TIN', 'Vendor'],
  'QA':         ['Coder', 'TIN'],
  'Compliance': ['QA', 'Vendor'],
  SNP:          ['TIN'],
  AWV:          ['TIN'],
  CCM:          ['TIN'],
  TCM:          ['TIN'],
  ECM:          ['TIN'],
  CBP:          ['TIN'],
  MRP:          ['TIN'],
  Assignee:     ['TIN'],
};

export const KIND_LABEL = {
  hcc:            'HCC',
  'care-program': 'Care Program',
  hedis:          'HEDIS',
};

// Display string used in the Care Team table's "Created For" badge.
export const KIND_BADGE_VARIANT = {
  hcc:            'toc-oncall',
  'care-program': 'status-scheduled',
  hedis:          'status-review',
};

// ── Rich TIN model ──
// In the real system a TIN identifies a provider group; the dropdown shows
// the TIN number, the number of providers in it, and how much of its total
// load is already assigned to teams. The assignedPct is mocked here until a
// backend ships — the engine reads this same map at auto-assignment time.
export const TIN_DATA = [
  { tin: '12-3456789', providers: 18, assignedPct: 35 },
  { tin: '98-7654321', providers: 24, assignedPct: 0  },
  { tin: '45-6789012', providers: 32, assignedPct: 5  },
  { tin: '11-2233445', providers: 15, assignedPct: 20 },
  { tin: '22-3344556', providers: 21, assignedPct: 15 },
];

// Map any legacy TIN string (e.g. 'TIN-1001' from astranaStaff) to a rich
// TIN. We pair them up by order so existing seeded teams keep working.
const _legacyTinsOrdered = Array.from(new Set(
  ASTRANA_STAFF.flatMap(s => s.tins || []),
)).sort();
export const LEGACY_TIN_MAP = Object.fromEntries(
  _legacyTinsOrdered.map((t, i) => [t, TIN_DATA[i % TIN_DATA.length]?.tin]),
);

const VENDORS = Array.from(new Set(
  ASTRANA_STAFF.flatMap(s => s.vendors || []),
)).sort();

// Each option carries enough metadata for the custom dropdown to render
// rich rows (TIN: icon bubble + provider count + Assigned %; staff: avatar
// + role). Backwards-compatible: `value` and `label` remain the keys older
// callers read.
export function valueOptionsForDimension(dim) {
  if (dim === 'TIN') {
    return TIN_DATA.map(t => ({
      value:       t.tin,
      label:       t.tin,
      kind:        'tin',
      providers:   t.providers,
      assignedPct: t.assignedPct,
    }));
  }
  if (dim === 'Vendor') {
    return VENDORS.map(v => ({ value: v, label: v, kind: 'vendor' }));
  }
  const roleKey =
    dim === 'Coder'      ? 'coder'     :
    dim === 'QA'         ? 'reviewer'  :
    dim === 'Compliance' ? 'reviewer2' : null;
  if (!roleKey) return [];
  return staffForRole(roleKey).map(s => ({
    value:    s.id,
    label:    s.name,
    kind:     'staff',
    initials: s.initials,
    role:     ROLE_LABEL[s.role],
  }));
}

// Color thresholds for REMAINING capacity in the user-picker badge.
// 0–30%     → red    (nearly or fully booked)
// 31–70%    → yellow (partially booked)
// 71–100%   → green  (mostly free)
export function capacityTone(pct) {
  if (pct == null) return 'neutral';
  if (pct <= 30) return 'error';
  if (pct <= 70) return 'warning';
  return 'success';
}

// Re-export role label so the drawer can show e.g. "Coder" instead of 'r1'.
export { ROLE_LABEL };
