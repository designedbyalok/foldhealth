// How each desktop worklist reads as a mobile card. One adapter per list:
// where its rows live in the store, how to load them, and how a row maps to
// a card (name, status, key fields, stacked sub-items, ids to open).
//
// Status and assignee changes call the same store actions as the desktop
// menus and cells, so the two layouts write to the same place.
//
// Card extras the screen acts on:
//   assign       { title, current, users: 'eligible' | 'all' | 'picker', unassign?, set(s, user|null) }
//   field.action 'assign' (tap opens the assignee picker) or { screen, props } (push)
//   sub.open     { screen, props } (tap the sub-row)
//   sub.team     [{ key, label, value, set(s, user) }] (CMP care team per enrollment)
//   detail       { label, icon, screen, props } (third card action)

import { CMP_STATUSES, CMP_STATUS_TONE } from '../../cmp-worklist/cmpStatuses';
import {
  MANUAL_GAP_STATUSES, MEASURE_NAMES, canSetGapStatus, enrichPharmacyMember, gapBadge,
} from '../../pharmacy-worklist/pharmacyWorklist.utils';
import { MEASURE_NAMES as HEDIS_MEASURE_NAMES } from '../../hedis-worklist/CareGapDetailDrawer.utils';
import { resolveAiTaskCount } from '../../toc/tocOutcome';

const EMPTY = [];

// ── Shared helpers ──────────────────────────────────────────────────────
const genderLabel = (g) => (/^m/i.test(g || '') ? 'Male' : /^f/i.test(g || '') ? 'Female' : g || '');
export const metaLine = (gender, age) => [genderLabel(gender), age ? String(age) : ''].filter(Boolean).join(' • ');

/** A due date (MM/DD/YYYY or MM/DD) as a Date, or null. */
export function parseDue(value) {
  const m = String(value || '').match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!m) return null;
  const year = m[3] ? Number(m[3]) : new Date().getFullYear();
  return new Date(year, Number(m[1]) - 1, Number(m[2]));
}
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isPast = (value) => { const d = parseDue(value); return !!d && d < startOfToday(); };

const outreachText = (o) => {
  if (!o) return '';
  if (typeof o === 'number') return o ? `${o} ${o === 1 ? 'attempt' : 'attempts'}` : 'None yet';
  if (typeof o === 'string') return o;
  return [o.status, o.date].filter(Boolean).join(' • ');
};

const field = (label, value, danger = false, action = null) => (
  value || action ? { label, value: String(value || '-'), danger, action } : null
);
const assigneeField = (name) => field('Assignee', name || 'Unassigned', false, 'assign');

// Open on a phone: a gap still being worked (not completed or closed, not an
// older instance replaced by a newer one).
export const isOpenHedisGap = (g) => !g.supersededAt && g.status !== 'Completed' && !String(g.status || '').startsWith('Closed');

// Care plan statuses the desktop SNP row opens in Review care plan.
const REVIEWABLE_CARE_PLAN = new Set(['Signed', 'Draft', 'On Hold']);

// Who owns a CMP enrollment besides its assignee (desktop cmpColumns).
const CMP_CARE_TEAM = [
  { key: 'assignee', label: 'Assignee' },
  { key: 'nurseHealthCoach', label: 'Nurse/Health Coach' },
  { key: 'coordinator', label: 'Coordinator' },
  { key: 'socialWorker', label: 'Social Worker' },
  { key: 'communityHealthWorker', label: 'Community Health Worker' },
];

// TOC rows (TCM and TOC IP) share the desktop AssigneeCell write and the
// AI Tasks drawer.
const tocAssign = (p) => ({
  title: p.assignee ? 'Change Assignee' : 'Assign User',
  current: p.assignee,
  users: 'picker',
  set: (s, u) => s.updatePatient(p.id, { assignee: u.name, assigneeInitials: u.initials, assigneeRole: u.role }),
});
const tocAiTasks = (p) => {
  const n = resolveAiTaskCount(p);
  return n ? { label: `Tasks (${n})`, icon: 'solar:checklist-minimalistic-linear', screen: 'worklistAiTasks', props: { patientId: p.id } } : null;
};

// Badge tones by status word, for lists that don't carry their own map.
function toneFor(status) {
  const s = String(status || '').toLowerCase();
  if (/declin|do not call|reopen|fail/.test(s)) return 'danger';
  if (/unable|closed|excluded/.test(s)) return 'neutral';
  if (/attempt|follow|pending/.test(s)) return 'warning';
  if (/engaged|enrolled|complete|met|success/.test(s)) return 'success';
  if (/progress/.test(s)) return 'primary';
  return 'info';
}

const SNP_STATUSES = ['New', 'Engaged', 'Declined', 'Unable to Reach', 'Attempted', 'Enrolled', 'Completed', 'Closed - Other', 'Closed - Excluded', 'Closed - Do not call'];
const AWV_STATUSES = ['Engaged', 'Attempted', 'Engaged - Requires Follow Up'];

// ── Enrollment lists (one row per member in a program) ──────────────────
function annualVisitLike({ rows, loading, fetch, update }) {
  return {
    rows: s => s[rows] || EMPTY,
    loading: s => s[loading],
    fetch: s => s[fetch],
    hasDue: true,
    toCard: (m) => ({
      key: m.id,
      name: m.name,
      initials: m.in,
      meta: metaLine(m.g, m.age),
      status: {
        label: m.progSubStatus || 'New',
        tone: toneFor(m.progSubStatus),
        options: AWV_STATUSES,
        set: (s, next) => s[update](m.id, next),
      },
      fields: [
        field('Program', m.progName),
        field('Due', [m.due, m.dueLabel].filter(Boolean).join(' • '), /^overdue/i.test(m.dueLabel || '') || isPast(m.due)),
        field('Outreach', [outreachText(m.outreach), m.lastOutreach].filter(Boolean).join(' • ')),
        field('Assignee', m.assignee),
      ].filter(Boolean),
      due: parseDue(m.due),
      assignee: { name: m.assignee },
      ids: { id: m.patientId, memberId: m.memberId, name: m.name },
    }),
  };
}

export const WORKLIST_ADAPTERS = {
  SNP: {
    rows: s => s.snpWorklistMembers || EMPTY,
    loading: s => s.snpWorklistLoading,
    fetch: s => s.fetchSnpWorklistMembers,
    hasDue: true,
    toCard: (m) => ({
      key: m.id,
      name: m.name,
      initials: m.initials,
      meta: metaLine(m.gender, m.age),
      status: {
        label: m.programSubStatus || 'New',
        tone: toneFor(m.programSubStatus),
        options: SNP_STATUSES,
        set: (s, next) => s.setSnpProgramSubStatus(m.id, next),
      },
      fields: [
        field('Next Action Due', m.nextActionDue, isPast(m.nextActionDue)),
        // Desktop opens a reviewable plan in the Review care plan drawer; the
        // phone opens the same plan in the care plan screen.
        field('Care Plan', m.carePlanStatus, false,
          m.patientId && m.programId && REVIEWABLE_CARE_PLAN.has(m.carePlanStatus)
            ? { screen: 'carePlan', props: { patientId: m.patientId, programId: m.programId } } : null),
        field('Outreach', outreachText(m.outreach)),
        assigneeField(m.assigneeName),
      ].filter(Boolean),
      due: parseDue(m.nextActionDue),
      assignee: { id: m.assigneeId, name: m.assigneeName },
      assign: {
        title: m.assigneeName ? 'Change Assignee' : 'Assign User',
        current: m.assigneeName,
        users: 'eligible',
        set: (s, u) => s.setSnpAssignee(m.id, u),
      },
      ids: { id: m.patientId, memberId: m.memberId, name: m.name },
    }),
  },

  // Status and assignee are read-only on desktop too; billing review needs
  // the desktop drawer.
  CCM: {
    rows: s => s.ccmWorklistMembers || EMPTY,
    readOnlyNote: 'Open on desktop for billing review.',
    loading: s => s.ccmWorklistLoading,
    fetch: s => s.fetchCcmWorklistMembers,
    hasDue: true,
    toCard: (m) => ({
      key: m.id,
      name: m.name,
      initials: m.initials,
      meta: metaLine(m.gender, m.age),
      status: { label: m.status || 'New', tone: toneFor(m.status) },
      fields: [
        field('Next Action Due', m.nextActionDue, !!m.nextActionOverdue || isPast(m.nextActionDue)),
        field('Outreach', [m.outreachStatus, m.outreachDate].filter(Boolean).join(' • ')),
        field('Billable', m.billableSeconds ? `${Math.round(m.billableSeconds / 60)} min this month` : ''),
        // Read-only: the desktop CCM assignee cell is not wired yet.
        field('Assignee', m.assigneeName),
      ].filter(Boolean),
      due: m.nextActionOverdue ? new Date(0) : parseDue(m.nextActionDue),
      assignee: { id: m.assigneeId, name: m.assigneeName },
      ids: { id: m.patientId, memberId: m.memberId, name: m.name },
    }),
  },

  'Annual Visit': annualVisitLike({ rows: 'awvMembers', loading: 'awvMembersLoading', fetch: 'fetchAwvMembers', update: 'updateAwvMemberStatus' }),
  JSA: annualVisitLike({ rows: 'jsaMembers', loading: 'jsaMembersLoading', fetch: 'fetchJsaMembers', update: 'updateJsaMemberStatus' }),

  // One card per member; each sub-program enrollment is a sub-row.
  CMP: {
    rows: s => s.cmpMembers || EMPTY,
    loading: s => s.cmpMembersLoading,
    fetch: s => s.fetchCmpMembers,
    hasDue: true,
    group: m => m.memberId || m.id,
    toCard: (m, enrollments = [m]) => ({
      key: m.memberId || m.id,
      name: m.name,
      initials: m.in,
      meta: metaLine(m.g, m.age),
      fields: [field('Risk', m.ri)].filter(Boolean),
      subItems: enrollments.map(e => ({
        key: e.id,
        title: e.subProgram || 'CMP',
        team: CMP_CARE_TEAM.map(r => ({
          key: r.key,
          label: r.label,
          value: e[r.key] || null,
          set: (s, u) => s.setCmpCareTeam([e.id], r.key, u),
        })),
        detail: [e.nextActionDue ? `Due ${e.nextActionDue}` : '', e.assignee].filter(Boolean).join(' • '),
        danger: isPast(e.nextActionDue),
        status: {
          label: e.progSubStatus || 'New',
          tone: CMP_STATUS_TONE[e.progSubStatus] || 'neutral',
          options: CMP_STATUSES,
          set: (s, next) => s.updateCmpMemberStatus(e.id, next),
        },
      })),
      due: enrollments.map(e => parseDue(e.nextActionDue)).filter(Boolean).sort((a, b) => a - b)[0] || null,
      assignee: { names: enrollments.map(e => e.assignee).filter(Boolean) },
      ids: { id: m.patientId, memberId: m.memberId, name: m.name },
    }),
  },

  // ── Patient lists ─────────────────────────────────────────────────────
  TCM: {
    rows: s => s.patients || EMPTY,
    loading: s => s.patientsLoading,
    fetch: s => s.fetchPatients,
    toCard: (p) => ({
      key: p.id,
      name: p.name,
      initials: p.initials,
      meta: metaLine(p.gender, p.age),
      status: p.tocStatus ? { label: p.tocStatus, tone: toneFor(p.tocStatus) } : null,
      fields: [
        field('LACE', p.lace),
        field('Next Outreach', p.nextOutreach, isPast(p.nextOutreach)),
        field('Outreach', [p.outreachType, p.outreachLeft].filter(Boolean).join(' • ')),
        assigneeField(p.assignee),
      ].filter(Boolean),
      due: parseDue(p.nextOutreach),
      assignee: { id: p.assigneeId, name: p.assignee },
      assign: tocAssign(p),
      detail: tocAiTasks(p),
      ids: { id: p.id, memberId: p.memberId, name: p.name },
    }),
  },
  'TOC IP': {
    rows: s => s.patients || EMPTY,
    filter: p => !!p.agentAssigned,
    loading: s => s.patientsLoading,
    fetch: s => s.fetchPatients,
    toCard: (p) => ({
      key: p.id,
      name: p.name,
      initials: p.initials,
      meta: metaLine(p.gender, p.age),
      status: p.status ? { label: p.status, tone: toneFor(p.status) } : null,
      fields: [
        field('Next Action', p.nextAction),
        field('AI Outcome', p.aiOutcomeStatus),
        field('Agent', p.agentAssigned),
        assigneeField(p.assignee),
      ].filter(Boolean),
      assignee: { id: p.assigneeId, name: p.assignee },
      assign: tocAssign(p),
      detail: tocAiTasks(p),
      ids: { id: p.id, memberId: p.memberId, name: p.name },
    }),
  },

  // ── Gap lists (one card per member, gaps as sub-rows) ─────────────────
  HEDIS: {
    rows: s => s.hedisMembers || EMPTY,
    loading: s => s.hedisLoading,
    fetch: s => s.fetchHedisMembers,
    toCard: (m) => {
      const live = (m.gaps || []).filter(g => !g.supersededAt);
      const open = live.filter(isOpenHedisGap);
      return {
      key: m.id,
      name: m.name,
      initials: m.in,
      meta: metaLine(m.gender, m.age),
      fields: [
        field('Open Gaps', `${open.length} of ${live.length}`),
        field('Start Date', m.startDate),
        field('Risk', m.riskLevel),
        field('Assignee', m.assignee),
      ].filter(Boolean),
      // Open gaps only; each opens its gap screen (status, assignee,
      // reminders, comments).
      subItems: open.map(g => ({
        key: g.code,
        title: g.code,
        detail: [HEDIS_MEASURE_NAMES[g.code], g.assignee || m.assignee].filter(Boolean).join(' • '),
        status: { label: g.status || 'Open', tone: toneFor(g.status) },
        open: { screen: 'worklistGap', props: { memberId: m.id, code: g.code } },
      })),
      // Filters match what the card shows: open gaps only.
      statuses: open.map(g => g.status || 'Open'),
      assignee: { name: m.assignee, names: open.map(g => g.assignee).filter(Boolean) },
      phone: m.phone,
      ids: { id: m.patientId, memberId: m.memberId, name: m.name },
      };
    },
  },

  Pharmacy: {
    rows: s => s.pharmacyWorklistMembers || EMPTY,
    loading: s => s.pharmacyWorklistLoading,
    fetch: s => s.fetchPharmacyWorklistMembers,
    hasDue: true,
    enrich: m => enrichPharmacyMember(m),
    toCard: (m) => ({
      key: m.id,
      name: m.name,
      initials: m.initials || m.in,
      meta: metaLine(m.gender || m.g, m.age),
      fields: [
        field('Priority', m.priority),
        field('Next Fill Due', m.nextFillDue, isPast(m.nextFillDue)),
        field('PDC', m.pdc != null ? `${Math.round(m.pdc)}%` : ''),
        field('Assigned To', m.assigneeName || 'Unassigned', false, 'assign'),
      ].filter(Boolean),
      subItems: (m.gaps || []).map(g => {
        const badge = gapBadge(g.status);
        return {
          key: g.code,
          title: g.code,
          detail: MEASURE_NAMES[g.code] || '',
          status: {
            label: badge.label,
            tone: badge.tone === 'white' ? 'neutral' : badge.tone,
            options: canSetGapStatus(g.status) ? MANUAL_GAP_STATUSES : null,
            set: (s, next) => s.setPharmacyGapStatus(m.id, g.code, next),
          },
        };
      }),
      due: parseDue(m.nextFillDue),
      assignee: { id: m.assigneeId, name: m.assigneeName },
      assign: {
        title: m.assigneeName ? 'Change Assignee' : 'Assign User',
        current: m.assigneeName,
        users: 'eligible',
        set: (s, u) => s.setPharmacyAssignee(m.id, u),
      },
      detail: { label: 'Gaps', icon: 'solar:pills-linear', screen: 'worklistPharmacy', props: { id: m.id } },
      phone: (m.phones || []).find(ph => !ph.doNotUse)?.number || m.phone,
      ids: { id: m.patientId, memberId: m.memberId, name: m.name },
    }),
  },

  // Read-only: chart review and coding need the desktop diagnosis panel.
  HCC: {
    rows: s => s.hccMembers || EMPTY,
    loading: s => s.hccMembersLoading,
    fetch: s => s.fetchHccMembers,
    group: m => String(m.memberId || m.id).replace(/^#/, ''),
    readOnlyNote: 'Open on desktop for chart review.',
    toCard: (m, visits = [m]) => {
      const open = visits.reduce((n, v) => n + (Number(v.open) || 0), 0);
      return {
        key: String(m.memberId || m.id),
        name: m.name,
        initials: m.in,
        meta: metaLine(m.g, m.age),
        fields: [
          field('Dates of Service', `${visits.length}${visits[0]?.dos ? ` • latest ${visits[0].dos}` : ''}`),
          field('Open ICDs', open ? String(open) : ''),
          field('RAF', m.raf),
          field('Assignee', m.assignee),
        ].filter(Boolean),
        assignee: { name: m.assignee, names: visits.map(v => v.assignee).filter(Boolean) },
        ids: { id: m.patientId, memberId: m.memberId, name: m.name },
      };
    },
  },
};
