import { useRef, useState, useEffect, useMemo, memo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import {
  RafTooltip,
  VisitsPopover,
  ChartPopover,
  ActionsMenuPopover,
  OpenIcdsHoverPopover,
} from './RowPopovers';
import { ChartDetailDrawer } from './ChartDetailDrawer';
import { DocPreviewDrawer } from './DocPreviewDrawer';
import { getChartDocs } from './data/chartDocs';
import { computeSla, slaOutcome } from './sla';
// From foldhealth/main: getOpenIcdsForMember is already imported below from
// './data/icds', so this duplicate is commented out to avoid a redeclaration.
// import { getOpenIcdsForMember } from './data/icds';
import { dosSourceLetter, DOS_SOURCE_META } from './dosSource';
import { getIcdsForMember, getNotLinkedForMember, getOpenIcdsForMember } from './data/icds';
import { getStatusSpec, hasStatusSpec } from './statusSpec';
import { StatusIcon } from './StatusIcon';
import { staffById, ROLE_LABEL, ROLES } from './assignment/astranaStaff';
import { RoleAssigneePicker } from './RoleAssigneePicker';
import { ReviewProgressPopover, buildReviewStages } from './DiagPanel/ReviewProgressPopover';
import { createPortal } from 'react-dom';
import { dosKey } from './assignment/dosState';
import styles from './HccWorklistRow.module.css';

const RISK_VARIANT = { High: 'lace-high', Medium: 'lace-medium', Low: 'lace-low' };

// Short display label for the Visit Type column — keeps the underlying value
// unchanged (filters + data still match the canonical name) while the cell
// renders a compact form so more columns fit on screen. Falls back to the
// canonical name for anything not in the map.
const VT_SHORT = {
  'AWV - Annual Wellness Visit':               'AWV',
  'IPPE - Initial Preventive Physical Exam':   'IPPE',
  'Annual Physical Exam':                       'APE',
  'New Patient Office Visit':                   'New Patient',
  'Established Patient Office Visit':           'Est. Patient',
  'Telehealth Visit':                           'Telehealth',
  'Specialist Visit / Consult':                 'Specialist',
  'ER Visit':                                   'ER',
  'Inpatient Visit / Admission':                'Inpatient',
  'Observation Visit':                          'Observation',
  'Skilled Nursing Facility Visit':             'SNF',
  'Home Visit':                                 'Home',
  'Hospice Visit':                              'Hospice',
  'Lab/Imaging Order':                          'Lab/Imaging',
  'Transitional Care Management (TCM) Visit':   'TCM',
  'Chronic Care Management (CCM)':              'CCM',
};
const vtShortLabel = (v) => VT_SHORT[v] || v || 'HCC';

function LastVisitCell({ dos, visits, fromClaim, onClickDate, onClickVisits }) {
  if (!dos) return <span className={styles.muted}>—</span>;
  // Two click targets in one cell:
  //   - The DATE opens the Claim Preview drawer (only when fromClaim).
  //   - The "X of Y Visits" sub-text always opens the all-DOSs popover for
  //     the patient — that behaviour is independent of the date's source.
  return (
    <span className={styles.lastVisitStack}>
      {fromClaim ? (
        <button
          type="button"
          className={styles.lastVisitDateBtn}
          onClick={onClickDate}
        >
          <span className={styles.lastVisitDate}>{dos}</span>
        </button>
      ) : (
        <span className={styles.lastVisitDateMuted}>{dos}</span>
      )}
      {visits && (
        <button
          type="button"
          className={styles.lastVisitVisitsBtn}
          onClick={onClickVisits}
        >
          <span className={styles.lastVisitMeta}>{visits}</span>
        </button>
      )}
    </span>
  );
}

function CreateDateCell({ member, dosState }) {
  const date = member.date;
  // Once Support AND Coder are both Completed, the SLA window has closed —
  // show the verdict (✓ SLA Met within the window, ✗ SLA Breached after).
  const supDone = (dosState?.support?.status || member.supS) === 'Completed';
  const cdrDone = (dosState?.coder?.status || member.cdrS) === 'Completed';
  if (supDone && cdrDone) {
    const coderDoneAt = dosState?.coder?.history?.[dosState.coder.history.length - 1]?.at || null;
    const outcome = slaOutcome(date, coderDoneAt);
    if (outcome) {
      return (
        <div className={styles.stackCell}>
          <span className={styles.dateText}>{date}</span>
          <span className={styles.dueLine} style={{ color: outcome.colorVar }}>
            <Icon name={outcome.icon} size={12} color={outcome.colorVar} />
            <span>{outcome.label}</span>
          </span>
        </div>
      );
    }
  }
  // Otherwise colour the Created Date against the live 14-day SLA window.
  const sla = computeSla(date);
  const label = sla ? sla.label : member.due;
  const color = sla ? sla.colorVar : member.dueCol;
  return (
    <div className={styles.stackCell}>
      <span className={styles.dateText}>{date}</span>
      {label && (
        <span className={styles.dueLine} style={{ color }}>
          <Icon name="solar:clock-circle-linear" size={12} color={color} />
          <span>{label}</span>
        </span>
      )}
    </div>
  );
}

function HccEvidenceCell({ charts, onClick, onMouseEnter, onMouseLeave, onUpload }) {
  // No chart on file yet → ghost "Upload" link button (Fold Button variant
  // ghost = transparent bg + neutral-300 text). Click opens the upload
  // drawer for this member.
  if (!charts || charts.length === 0) {
    return (
      <Button
        variant="ghost"
        size="S"
        leadingIcon="solar:upload-linear"
        onClick={(e) => { e.stopPropagation(); onUpload?.(); }}
      >
        Upload
      </Button>
    );
  }
  // Status line (Figma 4680:138476): when every chart shares a status,
  // show a single dot + "All Passed / Pending / Failed"; when mixed, show
  // per-status dots with counts (●2 ●1).
  const count = charts.length;
  const list = charts.map(d => (d.status || 'pending').toLowerCase());
  const pass = list.filter(s => s === 'passed').length;
  const fail = list.filter(s => s === 'failed').length;
  const pend = list.filter(s => s === 'pending').length;
  const uniform = [pass, fail, pend].filter(n => n > 0).length <= 1;
  const uniformLabel = pass ? 'All Passed' : fail ? 'All Failed' : pend ? 'All Pending' : 'No Charts';
  const uniformColor = pass ? 'var(--status-success)' : fail ? 'var(--status-error)' : 'var(--neutral-300)';
  return (
    <button
      type="button"
      className={styles.evidenceTrigger}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.evidenceBadge}>
        <Icon name="solar:document-text-linear" size={12} color="var(--primary-300)" />
        <span>{count}</span>
        <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--primary-300)" />
      </div>
      <div className={styles.evidenceStatus}>
        {uniform ? (
          <>
            <span className={styles.evidenceDot} style={{ background: uniformColor }} />
            <span>{uniformLabel}</span>
          </>
        ) : (
          <span className={styles.evidenceDots}>
            {pass > 0 && <span className={styles.evidenceDotCount}><span className={styles.evidenceDot} style={{ background: 'var(--status-success)' }} />{pass}</span>}
            {fail > 0 && <span className={styles.evidenceDotCount}><span className={styles.evidenceDot} style={{ background: 'var(--status-error)' }} />{fail}</span>}
            {pend > 0 && <span className={styles.evidenceDotCount}><span className={styles.evidenceDot} style={{ background: 'var(--neutral-300)' }} />{pend}</span>}
          </span>
        )}
      </div>
    </button>
  );
}

// Progress stepper (Figma 4680:138476) — one dot per workflow stage
// (Support → Coder → QA → Compliance), coloured by that stage's status:
// completed = green, active/in-progress = amber, pending = grey. Dots are
// joined by short connector lines.
const PROGRESS_TERMINAL = new Set(['Completed', 'Billing Ready']);
const PROGRESS_ACTIVE = new Set(['In Progress', 'New', 'Records Requested', 'Record Received', 'Rebuttal', 'Insufficient', 'Returned']);
function progressTone(status) {
  if (!status || status === 'Assign') return 'pending';
  if (PROGRESS_TERMINAL.has(status)) return 'done';
  if (PROGRESS_ACTIVE.has(status)) return 'active';
  return 'pending';
}
function ProgressStepper({ member }) {
  const anchorRef = useRef(null);
  const [rect, setRect] = useState(null);
  // When pinned (via click), hover-leave doesn't close the popover; only
  // a click on the trigger or outside the popover dismisses it.
  const [pinned, setPinned] = useState(false);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const stages = useMemo(() => buildReviewStages(member, null), [member]);
  const statuses = [member.supS, member.cdrS, member.r1s, member.r2s];

  const measureRect = () => anchorRef.current?.getBoundingClientRect() || null;
  const openPopover = () => {
    clearTimeout(closeTimer.current);
    if (rect) return;
    openTimer.current = setTimeout(() => {
      const r = measureRect();
      if (r) setRect(r);
    }, 150);
  };
  const closePopover = () => {
    if (pinned) return;
    clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setRect(null), 180);
  };
  const togglePinned = (e) => {
    e.stopPropagation();
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    if (pinned) {
      setPinned(false);
      setRect(null);
    } else {
      const r = measureRect();
      if (r) { setRect(r); setPinned(true); }
    }
  };
  useEffect(() => () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);
  // Dismiss on outside-click / Escape when pinned.
  useEffect(() => {
    if (!pinned) return undefined;
    const onDoc = (e) => {
      if (anchorRef.current?.contains(e.target)) return;
      // The popover itself is portaled to document.body; keep it open when
      // the click lands inside it.
      if (e.target.closest?.('[role="tooltip"][aria-label="Review progress"]')) return;
      setPinned(false); setRect(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setPinned(false); setRect(null); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  return (
    <>
      <span
        ref={anchorRef}
        className={styles.progress}
        onMouseEnter={openPopover}
        onMouseLeave={closePopover}
        onClick={togglePinned}
        role="button"
        tabIndex={0}
        aria-label="Review progress"
        aria-expanded={!!rect}
      >
        {statuses.map((st, i) => {
          const tone = progressTone(st);
          return (
            <span key={i} className={styles.progressSeg}>
              {i > 0 && <span className={styles.progressLine} />}
              <span className={[styles.progressDot, styles[`progressDot_${tone}`]].join(' ')} />
            </span>
          );
        })}
      </span>
      {rect && (
        <ReviewProgressPopover
          anchorRect={rect}
          stages={stages}
          onEnter={() => clearTimeout(closeTimer.current)}
          onLeave={closePopover}
          onClose={() => { setPinned(false); setRect(null); }}
        />
      )}
    </>
  );
}

// Each role's default "not started" status — used when a cell carries a
// status outside the coding workflow (e.g. AWV rows). Support's pending state
// is "Action Needed" (Awaiting); the coding roles start at "New".
const ROLE_DEFAULT_STATUS = { support: 'Awaiting', coder: 'New', reviewer: 'New', reviewer2: 'New' };

/**
 * Render role-status cell (Support / Coder / Rev 1-3).
 *
 * Two states:
 *   - Unassigned ("Assign" / null status) → user-add icon + "Assign" muted label.
 *   - Assigned → `name` on top, `[status icon] [role-offset date]` below.
 *
 * The icon's COLOR encodes the status (success / warning / secondary / error
 * etc. per STATUS_SPEC). The visible bottom-line text is the *date* the role
 * is expected to complete, computed by offsetting member.date by a fixed
 * number of days per role (Support=+0, Coder=+7, Reviewer=+14, Reviewer 2=+21).
 * The status itself isn't spelled out — the row legend at the bottom of the
 * worklist explains the icon meanings.
 */
function RoleStatusCell({ name, status, date, role, memberId, dosDate, priorResolved = true }) {
  // Show the "Assign" pill only when the role genuinely has no assignee.
  // The `priorResolved` gate below suppresses the STATUS icon + date until
  // the upstream role finishes — but the assignee name itself always
  // renders once picked. Folding priorResolved into the unassigned check
  // (previous behaviour) made a fresh pick invisible on the worklist
  // because the cell kept rendering the Assign pill until Support/Coder
  // reached Completed — indistinguishable from "the assignment silently
  // failed".
  const unassigned = !name || !status || status === 'Assign';
  if (unassigned) {
    return <RolePicker role={role} memberId={memberId} dosDate={dosDate} current={null} />;
  }
  // A status outside the coding workflow (e.g. AWV outreach states ported into
  // the unified worklist) maps to the role's default pending status so the
  // glyph always matches the legend — Support reads as "Action Needed"
  // (its work, document review, is pending); Coder/QA/Compliance read "New".
  const effectiveStatus = hasStatusSpec(status) ? status : (ROLE_DEFAULT_STATUS[role] || 'New');
  const spec = getStatusSpec(effectiveStatus);
  const display = (
    <>
      <span className={styles.roleName}>{name}</span>
      {priorResolved && (
        <span className={styles.roleStatusLine}>
          <StatusIcon status={effectiveStatus} size={12} color={spec.color} />
          {date && <span className={styles.roleDate}>{date}</span>}
        </span>
      )}
    </>
  );
  // Completed steps are locked; every step still in flight can be reassigned.
  if (status === 'Completed') {
    return <div className={styles.stackCell}>{display}</div>;
  }
  return (
    <RolePicker role={role} memberId={memberId} dosDate={dosDate} current={{ name }}>
      {display}
    </RolePicker>
  );
}

/**
 * Role-assignee cell trigger. Wraps the shared searchable RoleAssigneePicker
 * with the worklist's native triggers: the current name/status cell (reassign)
 * or the muted "Assign" pill (unassigned). Used for unassigned steps and any
 * assigned step that isn't Completed yet.
 */
function RolePicker({ role, memberId, dosDate, current, children }) {
  return (
    <RoleAssigneePicker
      role={role}
      memberId={memberId}
      dosDate={dosDate}
      currentName={current?.name || null}
      trigger={({ ref, onClick }) => (current ? (
        <button ref={ref} type="button" className={styles.roleReassignTrigger} title="Change assignee" onClick={onClick}>
          {children}
        </button>
      ) : (
        <button ref={ref} type="button" className={styles.roleUnassigned} onClick={onClick}>
          <Icon name="solar:user-plus-rounded-linear" size={14} color="var(--neutral-200)" />
          <span>Assign</span>
        </button>
      ))}
    />
  );
}

// Derive role-offset date "MM/DD/YYYY" from a base date "MM/DD/YYYY".
// Matches the prototype's addDaysToDate helper (line 3490).
function addDaysToDate(dateStr, days) {
  if (!dateStr) return '';
  const [mm, dd, yyyy] = dateStr.split('/').map((s) => parseInt(s, 10));
  if (!mm || !dd || !yyyy) return '';
  const d = new Date(yyyy, mm - 1, dd);
  d.setDate(d.getDate() + (days || 0));
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}
const ROLE_OFFSET = { sup: 0, cdr: 7, r1: 14, r2: 21 };

function OpenIcdsCell({ member, onOpenWithCode }) {
  // Count is derived from the SAME open-ICD list the popover renders, so the
  // badge number always equals the number of ICDs shown on hover. Mandatory
  // field — never render an empty ICD count: fall back to the record's stored
  // open-ICD count when there's no detailed gap list (e.g. AWV rows).
  const gapCount = getOpenIcdsForMember(member?.name).all.length;
  const count = gapCount || member?.open || 0;
  const cellRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const [rect, setRect] = useState(null);
  const [hovered, setHovered] = useState(false);

  const recordRect = () => {
    const r = cellRef.current?.getBoundingClientRect();
    if (r) setRect(r);
  };

  const onEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (hovered) return;
    openTimer.current = setTimeout(() => { recordRect(); setHovered(true); }, 200);
  };
  const onLeave = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setHovered(false), 200);
  };
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const requestClose = () => { closeTimer.current = setTimeout(() => setHovered(false), 200); };

  useEffect(() => () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  if (!count) return <span className={styles.muted}>—</span>;

  return (
    <>
      <div
        ref={cellRef}
        className={styles.openIcdsTrigger}
        onMouseEnter={gapCount ? onEnter : undefined}
        onMouseLeave={gapCount ? onLeave : undefined}
      >
        <Badge variant="status-queued" label={String(count)} />
      </div>
      {hovered && rect && gapCount > 0 && (
        <OpenIcdsHoverPopover
          anchorRect={rect}
          member={member}
          onIcdClick={onOpenWithCode}
          onEnter={cancelClose}
          onLeave={requestClose}
        />
      )}
    </>
  );
}

function RafImpactCell({ value, ru }) {
  if (value == null) return <span className={styles.muted}>—</span>;
  const positive = ru !== false; // default to positive/up unless explicitly false
  const color = positive ? 'var(--status-success)' : 'var(--status-error)';
  const bg    = positive ? 'var(--status-success-light)' : 'var(--status-error-light)';
  const border = positive ? 'rgba(0,155,83,0.2)' : 'rgba(215,40,37,0.2)';
  const arrow = positive ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear';
  return (
    <span className={styles.rafImpactBadge} style={{ color, background: bg, borderColor: border }}>
      <span>{value}</span>
      <Icon name={arrow} size={12} color={color} />
    </span>
  );
}

// Skip rendering a `<td>` entirely if the parent column-config has hidden it.
function Cell({ colKey, hidden, children, ...rest }) {
  if (hidden) return null;
  return (
    <td data-col={colKey} {...rest}>
      {children}
    </td>
  );
}

// Statuses that count as "this role finished successfully and the work hands
// off downstream." Reject / Rejected / Insufficient are terminal for the stage
// too, but they STOP the pipeline — the DOS never reaches the next role, so
// they must be treated distinctly here or the LOW→HIGH walk would incorrectly
// advance past a rejected Support to Coder.
const TERMINAL_STATUSES = new Set(['Completed', 'Skipped', 'Billing Ready']);
const BLOCKING_STATUSES = new Set(['Reject', 'Rejected', 'Insufficient']);
// Narrower — the two variants that specifically mean "a reviewer rejected the
// stage's work" (Insufficient lives one bucket earlier in the pipeline).
const REJECTED_STATUSES = new Set(['Rejected', 'Reject']);
export function isRejectedStatus(s) { return REJECTED_STATUSES.has(s); }
// Prior-role "resolved" (Completed or auto-Skipped) — gates whether the
// downstream role's status column reveals its own state on the worklist row.
const RESOLVED_STATUSES = new Set(['Completed', 'Skipped']);
function isRoleResolved(s) { return RESOLVED_STATUSES.has(s); }

// Sequential workflow order. The first role whose status is NOT terminal
// is where the DOS currently sits (HCC reality: Support → Coder → Reviewer →
// Reviewer 2 → Billing). If a stage has no status / 'Assign' placeholder
// that means it's waiting for someone to pick it up — that's the
// current bucket but with no assignee yet.
const STAGES_LOW_TO_HIGH = ['support', 'coder', 'reviewer', 'reviewer2'];

/**
 * Resolves who currently holds a DOS based on real HCC workflow rules.
 * Returns one of three shapes:
 *
 *   { kind: 'active',     name, initials, role }   // a real person owns it
 *   { kind: 'unassigned', role }                   // current bucket, no pick yet
 *   { kind: 'billing' }                            // every stage completed
 *
 * Walks LOW→HIGH and stops at the first non-terminal stage. Engine state
 * wins; legacy `member.sup/cdr/r1/r2/r3` + status fields are the fallback.
 */
// Resolve a staff id to a display name across BOTH rosters:
//   1. Astrana staff (seed roster, keyed by short ids like "EJ", "PW")
//   2. Platform users (Supabase profiles, keyed by UUID)
// Manual reassignments via RoleAssigneePicker use platform-user UUIDs, so
// without the second lookup the worklist would render a raw UUID.
export function resolveStaffName(id, platformUsers = []) {
  if (!id) return null;
  const staff = staffById(id);
  if (staff?.name) return { name: staff.name, initials: staff.initials };
  const pu = platformUsers.find(u => u.id === id);
  if (pu?.name) return { name: pu.name, initials: pu.initials || nameToInitials(pu.name) };
  return null;
}

export function resolveCurrentAssignee(member, dosState, platformUsers = []) {
  // ── Engine path ────────────────────────────────────────────────────
  if (dosState) {
    for (const role of STAGES_LOW_TO_HIGH) {
      const rs = dosState[role];
      const status = rs?.status;
      const hasReachedStage = !!(status || rs?.assignee);
      // If this stage hasn't started AND a prior stage was active, the
      // DOS is sitting at the previous stage — the outer loop already
      // returned. So reaching here means we're at the next bucket
      // that's awaiting handoff.
      if (!hasReachedStage || !status || status === 'Assign') {
        // Bucket waiting for assignment. If there's an assignee but no
        // status, treat as active (just-assigned, no work logged yet).
        if (rs?.assignee && status && status !== 'Assign') {
          return makeActive(rs.assignee, role, status, platformUsers);
        }
        return { kind: 'unassigned', role };
      }
      // Blocking status (Reject / Rejected / Insufficient) — the pipeline
      // stops here. Keep the DOS on this stage instead of advancing.
      if (BLOCKING_STATUSES.has(status)) {
        return makeActive(rs?.assignee, role, status, platformUsers);
      }
      // Stage has a non-terminal status → DOS lives here right now.
      if (!TERMINAL_STATUSES.has(status)) {
        return makeActive(rs?.assignee, role, status, platformUsers);
      }
      // Otherwise terminal-done → continue down the chain.
    }
    // All four stages terminal-done → Billing Ready.
    return { kind: 'billing' };
  }

  // ── Legacy fallback (no engine state yet) ──────────────────────────
  // Reads from the unrenamed legacy member fields (member.r1/.r1s etc.)
  // but reports the engine's role vocabulary so ROLE_LABEL lookups agree
  // with the engine path above.
  const legacy = [
    { role: 'support',   name: member.sup, status: member.supS },
    { role: 'coder',     name: member.cdr, status: member.cdrS },
    { role: 'reviewer',  name: member.r1,  status: member.r1s },
    { role: 'reviewer2', name: member.r2,  status: member.r2s },
  ];
  for (const r of legacy) {
    if (!r.name && (!r.status || r.status === 'Assign')) {
      return { kind: 'unassigned', role: r.role };
    }
    if (!r.status || r.status === 'Assign') {
      return makeActiveLegacy(r.name, r.role, r.status);
    }
    // Blocking status stays with this stage — don't advance.
    if (BLOCKING_STATUSES.has(r.status)) {
      return makeActiveLegacy(r.name, r.role, r.status);
    }
    if (!TERMINAL_STATUSES.has(r.status)) {
      return makeActiveLegacy(r.name, r.role, r.status);
    }
  }
  return { kind: 'billing' };
}

function makeActive(staffId, role, status, platformUsers = []) {
  const resolved = resolveStaffName(staffId, platformUsers);
  return {
    kind: 'active',
    // Fall back to null (renders "—") rather than the raw UUID/id when the
    // staff can't be resolved — a stray UUID in the cell is worse than empty.
    name: resolved?.name || null,
    initials: resolved?.initials || (staffId || '').slice(0, 2),
    role,
    status,
  };
}
function makeActiveLegacy(name, role, status) {
  return {
    kind: 'active',
    name: name || null,
    initials: nameToInitials(name || ''),
    role,
    status,
  };
}

function nameToInitials(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Renders the current assignee cell with three visual variants:
 *   - 'active'     → orange provider avatar + name + role (current behaviour)
 *   - 'unassigned' → empty grey avatar slot + "Unassigned" + role hint
 *   - 'billing'    → green check chip + "Billing Ready"
 */
function AssigneeCell({ member, dosState }) {
  const platformUsers = useAppStore(s => s.platformUsers);
  const a = resolveCurrentAssignee(member, dosState, platformUsers);

  if (!a || (a.kind === 'active' && !a.name)) {
    return <span className={styles.muted}>—</span>;
  }

  if (a.kind === 'billing') {
    return (
      <div className={styles.assigneeCell}>
        <span className={styles.billingBadge}>
          <Icon name="solar:check-circle-bold" size={16} color="var(--status-success)" />
        </span>
        <div className={styles.assigneeText}>
          <span className={styles.assigneeName}>Billing Ready</span>
          <span className={styles.assigneeRole}>All reviews complete</span>
        </div>
      </div>
    );
  }

  if (a.kind === 'unassigned') {
    return (
      <div className={styles.assigneeCell}>
        <span className={styles.unassignedSlot} aria-hidden="true">
          <Icon name="solar:user-rounded-linear" size={18} color="var(--neutral-200)" />
        </span>
        <div className={styles.assigneeText}>
          <span className={styles.assigneeNameMuted}>Unassigned</span>
          <span className={styles.assigneeRole}>Awaiting {ROLE_LABEL[a.role] || a.role}</span>
        </div>
      </div>
    );
  }

  // active
  return (
    <div className={styles.assigneeCell}>
      <Avatar variant="provider" initials={a.initials} />
      <div className={styles.assigneeText}>
        <span className={styles.assigneeName}>{a.name}</span>
        <span className={styles.assigneeRole}>{ROLE_LABEL[a.role] || a.role}</span>
      </div>
    </div>
  );
}

// DOS-level columns (Figma 4680:138476) — their value varies per visit
// within a record's dos_list. In the collapsed row only the primary
// (entry 0) shows; expanding reveals every entry stacked inside a
// bordered box spanning these columns. Every other column is a flat,
// record-level fact rendered once (top-aligned).
const DOS_LEVEL_COLS = new Set(['dos', 'open', 'vt', 'rp', 'pos']);

// Small circular source badge next to the DOS date (D=Document, C=Claim,
// M=Manual). Classifier + meta come from the shared `dosSource` module so the
// badge and the "DOS Source" filter agree on the source per date.
function DosSourceBadge({ date, hasDoc = true }) {
  const letter = dosSourceLetter(date, hasDoc);
  const meta = DOS_SOURCE_META[letter] || DOS_SOURCE_META.D;
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      className={[styles.dosSrcBadge, styles[meta.cls]].join(' ')}
      aria-label={`${meta.label} · ${date}`}
      onMouseEnter={show}
      onFocus={show}
      onMouseLeave={hide}
      onBlur={hide}
      tabIndex={0}
    >
      {letter}
      {pos && createPortal(
        <div className={styles.dosSrcTip} style={{ top: pos.top, left: pos.left }} role="tooltip">
          <div className={styles.dosSrcTipHead}>
            <Icon name="solar:document-text-linear" size={12} />
            {meta.label}
          </div>
          <div className={styles.dosSrcTipMeta}>{meta.hint}</div>
          <div className={styles.dosSrcTipDate}>DOS: {date}</div>
        </div>,
        document.body,
      )}
    </span>
  );
}

// Inner content (NOT the <td>) for each DOS-level column, given one
// dos_list entry. The main row wraps these in a stacked `<td>`.
const DOS_INNER = {
  dos: (entry, { openClaimPreview, member, hasDoc }) => {
    // Only claim-sourced DOS (the "C" badge) open the Claims drawer;
    // document/manual dates render as plain grey text. Date colour is
    // neutral-300 in all cases (no purple link styling).
    const isClaim = dosSourceLetter(entry.date, hasDoc) === 'C';
    return (
      <span className={styles.dosItem}>
        {isClaim ? (
          <button type="button" className={styles.lastVisitDateBtn} onClick={() => openClaimPreview?.(member, entry.date)}>
            <span className={styles.lastVisitDate}>{entry.date}</span>
          </button>
        ) : (
          <span className={styles.lastVisitDate}>{entry.date}</span>
        )}
        <DosSourceBadge date={entry.date} hasDoc={hasDoc} />
      </span>
    );
  },
  open: (entry, { openDiagPanel, member }) => (
    <OpenIcdsCell
      member={member}
      onOpenWithCode={(code) => openDiagPanel(member.id, {
        highlightCode: code, initialDos: entry.date,
        // Land with the Documents (Document Review) panel expanded on the
        // left, and the clicked ICD marked as the selected activity ICD so
        // its card renders in the "selected" state.
        leftPanel: 'documents', activityIcd: code,
      })}
    />
  ),
  vt: (entry, { member }) => {
    const full = entry.vt || member.visitType || member.vt || 'HCC';
    return <span className={styles.vtText} title={full}>{vtShortLabel(full)}</span>;
  },
  rp: (entry, { member }) => {
    // Show just the provider name — drop any trailing "(Specialty)" suffix.
    const full = entry.provider || member.rp || '';
    const name = full.replace(/\s*\([^)]*\)\s*$/, '');
    return <span className={styles.providerText} title={full}>{name}</span>;
  },
  pos: (entry) => (
    entry.pos
      ? <span className={styles.posText}>{entry.pos}{entry.posDesc ? ` - ${entry.posDesc}` : ''}</span>
      : <span className={styles.muted}>—</span>
  ),
};

// Per-column cell renderers for the RECORD-LEVEL columns (everything not
// in DOS_LEVEL_COLS). Each receives the record `member` and returns a
// populated `<td>`, rendered once per row (top-aligned).
const CELL_RENDERERS = {
  date: ({ member, dosStateFor }) => (
    <td key="date" data-col="date" className={styles.colDate}>
      <CreateDateCell member={member} dosState={dosStateFor(member)} />
    </td>
  ),
  evidence: ({ member, charts, openChartDrawer, openChartPopoverHover, closeChartPopoverHover, openUpload }) => (
    <td key="evidence" data-col="evidence" className={styles.colEvidence} onClick={(e) => e.stopPropagation()}>
      <HccEvidenceCell
        charts={charts}
        onClick={openChartDrawer}
        onMouseEnter={openChartPopoverHover}
        onMouseLeave={closeChartPopoverHover}
        onUpload={() => openUpload(member)}
      />
    </td>
  ),
  assignee: ({ member, dosStateFor }) => (
    <td key="assignee" data-col="assignee" className={styles.colAssignee}>
      <AssigneeCell member={member} dosState={dosStateFor(member)} />
    </td>
  ),
  // Role columns — status prefers per-DOS engine state (single source of
  // truth) with the legacy member field as a fallback, so the row and the
  // DiagPanel drawer never diverge for the same DOS.
  sup: ({ member, dosStateFor, nameOf }) => {
    const s = dosStateFor(member);
    const status = s?.support?.status || member.supS;
    return (
      <td key="sup" data-col="sup" data-status={isRejectedStatus(status) ? 'rejected' : undefined} className={styles.colRole}>
        <RoleStatusCell
          name={s?.support?.assignee ? (nameOf(s.support.assignee) || member.sup) : member.sup}
          status={status}
          date={addDaysToDate(member.date, ROLE_OFFSET.sup)}
          role="support" memberId={member.id} dosDate={member.date} />
      </td>
    );
  },
  cdr: ({ member, dosStateFor, nameOf }) => {
    const s = dosStateFor(member);
    const status = s?.coder?.status || member.cdrS;
    const supStatus = s?.support?.status || member.supS;
    return (
      <td key="cdr" data-col="cdr" data-status={isRejectedStatus(status) ? 'rejected' : undefined} className={styles.colRole}>
        <RoleStatusCell
          name={s?.coder?.assignee ? (nameOf(s.coder.assignee) || member.cdr) : member.cdr}
          status={status}
          date={addDaysToDate(member.date, ROLE_OFFSET.cdr)}
          priorResolved={isRoleResolved(supStatus)}
          role="coder" memberId={member.id} dosDate={member.date} />
      </td>
    );
  },
  r1: ({ member, dosStateFor, nameOf }) => {
    const s = dosStateFor(member);
    const status = s?.reviewer?.status || member.r1s;
    const cdrStatus = s?.coder?.status || member.cdrS;
    return (
      <td key="r1" data-col="r1" data-status={isRejectedStatus(status) ? 'rejected' : undefined} className={styles.colRole}>
        <RoleStatusCell
          name={s?.reviewer?.assignee ? (nameOf(s.reviewer.assignee) || member.r1) : member.r1}
          status={status}
          date={addDaysToDate(member.date, ROLE_OFFSET.r1)}
          priorResolved={isRoleResolved(cdrStatus)}
          role="reviewer" memberId={member.id} dosDate={member.date} />
      </td>
    );
  },
  r2: ({ member, dosStateFor, nameOf }) => {
    const s = dosStateFor(member);
    const status = s?.reviewer2?.status || member.r2s;
    const r1Status = s?.reviewer?.status || member.r1s;
    return (
      <td key="r2" data-col="r2" data-status={isRejectedStatus(status) ? 'rejected' : undefined} className={styles.colRole}>
        <RoleStatusCell
          name={s?.reviewer2?.assignee ? (nameOf(s.reviewer2.assignee) || member.r2) : member.r2}
          status={status}
          date={addDaysToDate(member.date, ROLE_OFFSET.r2)}
          priorResolved={isRoleResolved(r1Status)}
          role="reviewer2" memberId={member.id} dosDate={member.date} />
      </td>
    );
  },
  r3: ({ member }) => (
    <td key="r3" data-col="r3" className={styles.colRole}>
      <RoleStatusCell name={member.r3} status={member.r3s} date={addDaysToDate(member.date, ROLE_OFFSET.r3)}
        role="r3" memberId={member.id} dosDate={member.date} />
    </td>
  ),
  posDesc: ({ member }) => (
    <td key="posDesc" data-col="posDesc" className={styles.colPosDesc}>
      <span className={styles.codeText}>{member.posDesc}</span>
    </td>
  ),
  raf: ({ member }) => (
    <td key="raf" data-col="raf" className={styles.colRaf}>
      <RafTooltip memberName={member.name}>
        <span className={styles.numText}>{member.raf}</span>
      </RafTooltip>
    </td>
  ),
  ri: ({ member }) => (
    <td key="ri" data-col="ri" className={styles.colRi}>
      <RafTooltip memberName={member.name}>
        <RafImpactCell value={member.ri} ru={member.ru} />
      </RafTooltip>
    </td>
  ),
  ipa: ({ member }) => (
    <td key="ipa" data-col="ipa" className={styles.colIpa}>
      <span className={styles.codeText}>{member.ipa}</span>
    </td>
  ),
  hp: ({ member }) => (
    <td key="hp" data-col="hp" className={styles.colHp}>
      <span className={styles.codeText}>{member.hp}</span>
    </td>
  ),
  progress: ({ member }) => (
    <td key="progress" data-col="progress" className={styles.colProgress}>
      <ProgressStepper member={member} />
    </td>
  ),
  pcp: ({ member }) => (
    <td key="pcp" data-col="pcp" className={styles.colPcp}>
      <div className={styles.pcpCell}>
        <span className={styles.providerText}>{member.pcp}</span>
        <span className={styles.pcpMore}>+2 More</span>
      </div>
    </td>
  ),
  dec: ({ member }) => (
    <td key="dec" data-col="dec" className={styles.colDec}>
      <span className={styles.numText}>{member.dec}</span>
    </td>
  ),
  coh: ({ member }) => (
    <td key="coh" data-col="coh" className={styles.colCoh}>
      <span className={styles.codeText}>{member.coh}</span>
    </td>
  ),
  rl: ({ member }) => (
    <td key="rl" data-col="rl" className={styles.colRl}>
      {member.rl
        ? <span className={styles.codeText}>{member.rl}</span>
        : <span className={styles.muted}>—</span>}
    </td>
  ),
  ad: ({ member }) => (
    <td key="ad" data-col="ad" className={styles.colAd}>
      <span className={styles.numText}>{member.ad}</span>
    </td>
  ),
  fr: ({ member }) => (
    <td key="fr" data-col="fr" className={styles.colFr}>
      <span className={styles.numText}>{member.fr}</span>
    </td>
  ),
};

/**
 * One worklist row per record (Figma 4680:138476). Renders as a single
 * `<tr>`:
 *   - Member identity + all record-level columns (Created Date,
 *     Documents, Support Team, Coder, RAF, …) render once, top-aligned.
 *   - The DOS-level columns (DOS · Open ICDs · Visit Type · Provider ·
 *     POS) render a vertical STACK: collapsed shows only the primary
 *     visit + a "View More N ⌄" link under the DOS; expanding reveals
 *     every visit in the record's dos_list, enclosed in a bordered box
 *     with a "View Less ⌃" link at the bottom.
 * The same patient can appear in multiple records — the member identity
 * simply repeats, matching the design.
 */
// Rows that stay on-screen across page flips (e.g. when the table only
// re-slices its window) should NOT re-run their internal setup. Wrap in
// React.memo so a shallow-equal member + columns + hiddenCols skips
// the re-render. Store slices this row subscribes to still trigger it
// when their own values change (Zustand handles that independently).
function HccWorklistRowImpl({ member, hiddenCols, columns }) {
  const selectedHccIds = useAppStore(s => s.selectedHccIds);
  const selectHccMember = useAppStore(s => s.selectHccMember);
  const openDiagPanel = useAppStore(s => s.openDiagPanel);
  const diagPanelMemberId = useAppStore(s => s.diagPanelMemberId);
  const openQuickView = useAppStore(s => s.openQuickView);
  const showToast = useAppStore(s => s.showToast);
  const openHccUploadDrawer = useAppStore(s => s.openHccUploadDrawer);
  const openAddDos = useAppStore(s => s.openHccAddDos);
  const openClaimPreview = useAppStore(s => s.openHccClaimPreview);
  const hccDosAssignments = useAppStore(s => s.hccDosAssignments);
  const platformUsers = useAppStore(s => s.platformUsers);
  const dosStateFor = (m) => (m?.id && m?.dos ? hccDosAssignments[dosKey(m.id, m.dos, m.rp, m.pos)] : null);
  // Resolve a staff/user id to a display name across BOTH rosters (Astrana
  // + Supabase platform users). Falls back to null so an unresolved UUID
  // never leaks into the cell verbatim.
  const nameOf = (id) => resolveStaffName(id, platformUsers)?.name || null;

  const checked = selectedHccIds.includes(member.id);
  const isOpenInDrawer = diagPanelMemberId === member.id;
  const isHidden = (k) => hiddenCols?.has(k);

  const dosEntries = Array.isArray(member.dos_list) && member.dos_list.length > 0
    ? member.dos_list
    : [{ date: member.dos, label: member.due, labelColor: member.dueCol, vt: member.vt, provider: member.rp, pos: member.pos, posDesc: member.posDesc, open: member.open }];
  const extraCount = dosEntries.length - 1;
  const [expanded, setExpanded] = useState(false);
  const visibleEntries = expanded ? dosEntries : dosEntries.slice(0, 1);

  const [chartRect, setChartRect] = useState(null);
  const [chartDetail, setChartDetail] = useState(null);
  const [actionsRect, setActionsRect] = useState(null);
  const hccRole = useAppStore(s => s.hccUserRole);
  const addedCharts = useAppStore(s => s.hccAddedCharts[member.id]);
  const chartStatus = useAppStore(s => s.hccChartStatus[member.id]);
  const removedCharts = useAppStore(s => s.hccRemovedCharts[member.id]);
  const charts = useMemo(() => getChartDocs(member, addedCharts || [], chartStatus || {}, removedCharts || []), [member, addedCharts, chartStatus, removedCharts]);
  // Click → jump straight into the Document Review drawer, bypassing the
  // popover. The popover is now a hover-only preview so busy reviewers can
  // peek at document status without a full drawer round-trip.
  const openChartDrawer = (e) => {
    e.stopPropagation();
    setChartRect(null);
    if (chartHoverCloseTimer.current) { clearTimeout(chartHoverCloseTimer.current); chartHoverCloseTimer.current = null; }
    if (chartHoverOpenTimer.current)  { clearTimeout(chartHoverOpenTimer.current);  chartHoverOpenTimer.current = null; }
    setChartDetail({ id: null });
  };
  // Hover-open the popover with a small 80ms delay so passing over the cell
  // during a scroll doesn't flash it open. Leaving the trigger closes it
  // after 200ms — long enough to bridge the gap into the popover, where
  // its own onMouseEnter clears the timer to keep it pinned.
  const chartHoverOpenTimer = useRef(null);
  const chartHoverCloseTimer = useRef(null);
  const openChartPopoverHover = (e) => {
    if (chartHoverCloseTimer.current) { clearTimeout(chartHoverCloseTimer.current); chartHoverCloseTimer.current = null; }
    if (chartRect) return;
    const rect = e.currentTarget.getBoundingClientRect();
    chartHoverOpenTimer.current = setTimeout(() => setChartRect(rect), 80);
  };
  const closeChartPopoverHover = () => {
    if (chartHoverOpenTimer.current) { clearTimeout(chartHoverOpenTimer.current); chartHoverOpenTimer.current = null; }
    chartHoverCloseTimer.current = setTimeout(() => setChartRect(null), 200);
  };
  const cancelChartPopoverClose = () => {
    if (chartHoverCloseTimer.current) { clearTimeout(chartHoverCloseTimer.current); chartHoverCloseTimer.current = null; }
  };
  const requestChartPopoverClose = () => {
    chartHoverCloseTimer.current = setTimeout(() => setChartRect(null), 200);
  };
  const openActions = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActionsRect(prev => prev ? null : rect);
  };

  // A row with no document on file cannot produce a Document-sourced DOS
  // badge — drives the exclusion inside `dosSourceLetter`.
  const hasDoc = (charts?.length || 0) > 0;
  const innerCtx = { member, openClaimPreview, openDiagPanel, hasDoc };

  // Any role marking the record Rejected disables row-level actions and
  // locks the avatars. Reads the engine-state first (canonical source),
  // then falls back to the legacy member.*S fields. Insufficient / Reject
  // are separate blocking statuses that live upstream in the workflow —
  // we specifically match user-facing "Rejected" here.
  const rejectedStatuses = new Set(['Rejected', 'Reject']);
  const dosState = dosStateFor(member);
  const isRecordRejected = (() => {
    if (dosState) {
      for (const role of ['support', 'coder', 'reviewer', 'reviewer2']) {
        if (rejectedStatuses.has(dosState[role]?.status)) return true;
      }
    }
    return rejectedStatuses.has(member.supS)
      || rejectedStatuses.has(member.cdrS)
      || rejectedStatuses.has(member.r1s)
      || rejectedStatuses.has(member.r2s);
  })();

  // Identify the role that flipped this record to Rejected so the tooltip
  // is specific ("Rejected by Coder") — otherwise the muted row just looks
  // greyed out with no explanation. Engine state wins; falls back to the
  // legacy member.*S fields when the engine hasn't seeded this DOS yet.
  const rejectingRole = (() => {
    if (!isRecordRejected) return null;
    const map = { support: 'Support', coder: 'Coder', reviewer: 'QA', reviewer2: 'Compliance' };
    if (dosState) {
      for (const role of ['support', 'coder', 'reviewer', 'reviewer2']) {
        if (rejectedStatuses.has(dosState[role]?.status)) return map[role];
      }
    }
    if (rejectedStatuses.has(member.supS)) return 'Support';
    if (rejectedStatuses.has(member.cdrS)) return 'Coder';
    if (rejectedStatuses.has(member.r1s))  return 'QA';
    if (rejectedStatuses.has(member.r2s))  return 'Compliance';
    return null;
  })();
  const rejectedTooltip = isRecordRejected
    ? `Rejected${rejectingRole ? ` by ${rejectingRole}` : ''} — record is read-only. Expand DOSs or open the record to review comments.`
    : undefined;

  return (
    <>
    <tr
      className={[
        styles.row,
        checked ? styles.rowChecked : '',
        isOpenInDrawer ? styles.rowActive : '',
        expanded ? styles.rowExpanded : '',
        isRecordRejected ? styles.rowRejected : '',
      ].filter(Boolean).join(' ')}
      aria-disabled={isRecordRejected || undefined}
      title={rejectedTooltip}
    >
      {/* Sticky left: checkbox */}
      <td className={`${styles.checkTd} ${styles.stickyLeft} ${styles.stickyCheck}`} onClick={(e) => e.stopPropagation()}>
        {/* Centered against the 32px avatar so the checkbox lines up with
            the member's avatar, not the top of a (possibly expanded) row. */}
        <div className={styles.checkAlign}>
          <Checkbox
            checked={checked}
            onCheckedChange={() => selectHccMember(member.id)}
            aria-label={`Select ${member.name}`}
            disabled={isRecordRejected}
          />
        </div>
      </td>

      {/* Sticky left: member identity — renders once, top-aligned. */}
      <td className={`${styles.memberTd} ${styles.stickyLeft} ${styles.stickyMember} ${styles.colMember}`}>
        <div className={styles.patientCell}>
          <Avatar variant="patient" initials={member.in} locked={isRecordRejected} />
          <div>
            <div className={styles.patientName}>
              <button
                className={styles.patientNameLink}
                onClick={e => { e.stopPropagation(); openQuickView({ id: member.id, name: member.name, initials: member.in, gender: member.g, age: member.age, memberId: member.memberId, language: member.language, raf: member.raf }); }}
              >{member.name}</button>{' '}
              {(() => {
                const dobLabel = formatDobDisplay(member.dob) || deriveDob(member.age, member.name);
                return (
                  <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
                    <span className={styles.patientDemo}>({member.g}&bull;{member.age})</span>
                  </Tooltip>
                );
              })()}
            </div>
            <div className={styles.patientMeta}>
              {member.memberId} &bull;{' '}
              <button type="button" className={styles.langBadge} onClick={(e) => e.stopPropagation()}>
                {(member.language || 'en').toUpperCase()}
                <span className={styles.langTooltip}>Preferred Language: English</span>
              </button>
            </div>
          </div>
        </div>
      </td>

      {/* Body cells — order driven by `columns`. DOS-level columns stack;
          the rest render once (top-aligned). */}
      {(columns || []).map((col) => {
        if (isHidden(col.k)) return null;

        if (DOS_LEVEL_COLS.has(col.k)) {
          const inner = DOS_INNER[col.k];
          const isDos = col.k === 'dos';
          // The DOS group (DOS · Open ICDs · Visit Type · Provider · POS)
          // is bracketed by full-height vertical divider lines — the left
          // one is the Member column's right border; the right one is the
          // POS column's right border (styles.dosTdLast). Within a mini-
          // sweep the visits stack with horizontal dividers. No rounded
          // box — matches Figma 4672:131830.
          return (
            <td
              key={col.k}
              data-col={col.k}
              className={[
                styles.dosTd,
                col.k === 'pos' ? styles.dosTdLast : '',
              ].filter(Boolean).join(' ')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.dosStack}>
                {visibleEntries.map((entry, i) => (
                  <div key={`${col.k}-${i}`} className={styles.dosStackItem}>
                    {inner(entry, innerCtx)}
                  </div>
                ))}
                {/* Footer row rendered in EVERY DOS-level column (empty in
                    all but DOS) so the box stays the same height across
                    columns and its bottom border/divider stays aligned. */}
                {extraCount > 0 && (
                  <div className={styles.dosFooter}>
                    {isDos && (
                      <button
                        type="button"
                        className={styles.viewMoreBtn}
                        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                      >
                        {expanded ? 'View Less' : `View More ${extraCount}`}
                        <Icon name={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={12} color="var(--neutral-300)" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </td>
          );
        }

        const render = CELL_RENDERERS[col.k];
        if (!render) return null;
        return render({ member, charts, dosStateFor, nameOf, openChartDrawer, openChartPopoverHover, closeChartPopoverHover, openDiagPanel, openUpload: (m) => openHccUploadDrawer(m) });
      })}

      {/* Sticky right: actions */}
      <td className={`${styles.actionsCell} ${styles.stickyRight} ${styles.colActions}`}>
        <div className={styles.actionsRow}>
          <ActionButton
            icon="solar:eye-linear"
            size="L"
            tooltip="View Diagnosis Gaps"
            onClick={(e) => {
              e.stopPropagation();
              // Open the Documents left panel with the first chart doc already
              // in the preview — mirrors the ICD-card entry point so the user
              // isn't left staring at a list they have to click through. The
              // in-drawer "back" arrow returns to the listing.
              openDiagPanel(member.id, { leftPanel: 'documents' });
              const firstDoc = charts?.[0];
              if (firstDoc?.id) useAppStore.getState().setDiagOpenDocId(firstDoc.id);
            }}
          />
          <span className={styles.actionsDivider} />
          <ActionButton
            icon="custom:add-dos"
            size="L"
            tooltip="Add DOS"
            onClick={(e) => { e.stopPropagation(); openAddDos(member); }}
          />
          <span className={styles.actionsDivider} />
          <ActionButton
            icon="solar:menu-dots-linear"
            size="L"
            tooltip="More actions"
            onClick={openActions}
          />
        </div>
      </td>
    </tr>

    {chartRect && (
      <ChartPopover
        anchorRect={chartRect}
        member={member}
        charts={charts}
        onClose={() => setChartRect(null)}
        onEnter={cancelChartPopoverClose}
        onLeave={requestChartPopoverClose}
        onUpload={() => { setChartRect(null); openHccUploadDrawer(member); }}
        onSelectChart={(chart) => { setChartRect(null); setChartDetail({ id: chart.id }); }}
        onViewMore={() => { setChartRect(null); setChartDetail({ id: null }); }}
      />
    )}
    {chartDetail && (
      hccRole === 'Support' ? (
        <ChartDetailDrawer
          charts={charts}
          initialId={chartDetail.id}
          member={member}
          onClose={() => setChartDetail(null)}
        />
      ) : (
        <DocPreviewDrawer
          charts={charts}
          initialId={chartDetail.id}
          member={member}
          onClose={() => setChartDetail(null)}
        />
      )
    )}
    {actionsRect && (
      <ActionsMenuPopover
        anchorRect={actionsRect}
        onClose={() => setActionsRect(null)}
        onAction={(label) => showToast(`${label} — coming soon`)}
      />
    )}
    </>
  );
}

// Exported wrapper — skips a re-render when the parent hands back the
// same member reference. `hiddenCols` is a Set from useMemo so its
// identity is stable across renders too.
export const HccWorklistRow = memo(HccWorklistRowImpl, (prev, next) => (
  prev.member === next.member
  && prev.hiddenCols === next.hiddenCols
  && prev.columns === next.columns
));
