import { useRef, useState, useEffect, useMemo, memo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Checkbox } from '../../components/Checkbox/Checkbox';
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
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { activeOooFor, initialsOf } from '../ooo/oooUtils';
import { ReviewProgressPopover } from './DiagPanel/ReviewProgressPopover';
import { buildReviewStages } from './DiagPanel/ReviewProgressPopover.utils';
import { createPortal } from 'react-dom';
import { dosKey } from './assignment/dosState';
import {
  isRejectedStatus,
  resolveCurrentAssignee,
} from './HccWorklistRow.utils';
import {
  PROGRESS_TERMINAL,
  PROGRESS_ACTIVE,
  ROLE_DEFAULT_STATUS,
} from './HccWorklistRowParts.constants';
import styles from './HccWorklistRow.module.css';
export function LastVisitCell({ dos, visits, fromClaim, onClickDate, onClickVisits }) {
  if (!dos) return <span className={styles.muted}>-</span>;
  // Two click targets in one cell:
  //   - The DATE opens the Claim Preview drawer (only when fromClaim).
  //   - The "X of Y Visits" sub-text always opens the all-DOSs popover for
  //     the patient: that behaviour is independent of the date's source.
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

export function CreateDateCell({ member, dosState }) {
  const date = member.date;
  // Once Support AND Coder are both Completed, the SLA window has closed,
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

export function HccEvidenceCell({ charts, onClick, onMouseEnter, onMouseLeave, onUpload }) {
  // No chart on file yet → ghost "Upload" link button (Fold Button variant
  // ghost = transparent bg + neutral-300 text). Click opens the upload
  // drawer for this member.
  if (!charts || charts.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        leadingIcon="solar:upload-linear"
        onClick={(e) => { e.stopPropagation(); onUpload?.(); }}
      >
        Upload
      </Button>
    );
  }
  // Status line reads per-doc statuses: same source as the doc popover and
  // the Doc Review drawer, so the three surfaces never disagree. Uniform
  // (all passed / all failed / all pending) → single dot + label; mixed →
  // per-status dots with counts (●2 ●1). Doc statuses are seeded in
  // generateDefaultCharts to follow Support's engine status (Completed →
  // Passed, Reject → Failed, otherwise Pending), so an unreviewed row can
  // never advertise "All Passed" and a completed row never "All Pending".
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
      <Badge
        tone="primary"
        size="sm"
        icon="solar:document-text-linear"
        label={String(count)}
        chevron
      />
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

// Progress stepper (Figma 4680:138476), one dot per workflow stage
// (Support → Coder → QA → Compliance), coloured by that stage's status:
// completed = green, active/in-progress = amber, pending = grey. Dots are
// joined by short connector lines.
function progressTone(status) {
  if (!status || status === 'Assign') return 'pending';
  if (PROGRESS_TERMINAL.has(status)) return 'done';
  if (PROGRESS_ACTIVE.has(status)) return 'active';
  return 'pending';
}
export function ProgressStepper({ member }) {
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

  // Terminal Billed state: render a small "Billed" label under the
  // stepper so a reviewer can scan the column at row height and know
  // the record has been submitted, without hovering to open the
  // popover. Rejected already gets its own row treatment; Billed is
  // the green happy-path parallel.
  const isBilled = statuses.some(s => s === 'Billed');
  return (
    <span className={styles.progressStack}>
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
      {isBilled && (
        <span className={styles.progressBilledLabel} aria-label="Billed">
          <Icon name="solar:dollar-linear" size={11} color="var(--status-success)" />
          Billed
        </span>
      )}
      {rect && (
        <ReviewProgressPopover
          anchorRect={rect}
          stages={stages}
          onEnter={() => clearTimeout(closeTimer.current)}
          onLeave={closePopover}
          onClose={() => { setPinned(false); setRect(null); }}
        />
      )}
    </span>
  );
}

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
 * The status itself isn't spelled out: the row legend at the bottom of the
 * worklist explains the icon meanings.
 */
export function RoleStatusCell({ name, status, date, role, memberId, dosDate, priorResolved = true }) {
  // Show the "Assign" pill only when the role genuinely has no assignee.
  // The `priorResolved` gate below suppresses the STATUS icon + date until
  // the upstream role finishes: but the assignee name itself always
  // renders once picked. Folding priorResolved into the unassigned check
  // (previous behaviour) made a fresh pick invisible on the worklist
  // because the cell kept rendering the Assign pill until Support/Coder
  // reached Completed: indistinguishable from "the assignment silently
  // failed".
  const unassigned = !name || !status || status === 'Assign';
  if (unassigned) {
    return <RolePicker role={role} memberId={memberId} dosDate={dosDate} current={null} />;
  }
  // A status outside the coding workflow (e.g. AWV outreach states ported into
  // the unified worklist) maps to the role's default pending status so the
  // glyph always matches the legend: Support reads as "Action Needed"
  // (its work, document review, is pending); Coder/QA/Compliance read "New".
  const effectiveStatus = hasStatusSpec(status) ? status : (ROLE_DEFAULT_STATUS[role] || 'New');
  const spec = getStatusSpec(effectiveStatus);
  // Status glyph + expected-completion date live OUTSIDE the AssigneeChange
  // trigger: the pill owns the name only; the status line stacks beneath it
  // so it stays a data affordance, not part of the reassign click target.
  // The `priorResolved` gate suppresses the glyph while an upstream role is
  // still in flight, EXCEPT when this role is in a records-request cycle
  // (Record Requested / Record Received / Returned). Those states are
  // stand-alone signals worth showing: otherwise a QA row waiting on
  // Coder-Returned reads as a plain "M. Almeda" with no indicator that
  // records were requested.
  const RECORDS_LOOP_STATES = new Set(['Record Requested', 'Record Received', 'Returned', 'Rebuttal']);
  const showStatus = priorResolved || RECORDS_LOOP_STATES.has(effectiveStatus);
  const statusLine = showStatus ? (
    <span className={styles.roleStatusLine}>
      <StatusIcon status={effectiveStatus} size={12} color={spec.color} />
      {date && <span className={styles.roleDate}>{date}</span>}
    </span>
  ) : null;
  // Completed steps are locked; every step still in flight can be reassigned.
  if (status === 'Completed') {
    return (
      <div className={styles.stackCell}>
        <span className={styles.roleName}>{name}</span>
        {statusLine}
      </div>
    );
  }
  return (
    <div className={styles.stackCell}>
      <RolePicker role={role} memberId={memberId} dosDate={dosDate} current={{ name }} />
      {statusLine}
    </div>
  );
}

/**
 * Role-assignee cell trigger. Wraps the shared searchable RoleAssigneePicker
 * with the worklist's native triggers: the current name/status cell (reassign)
 * or the muted "Assign" pill (unassigned). Used for unassigned steps and any
 * assigned step that isn't Completed yet.
 */
export function RolePicker({ role, memberId, dosDate, current }) {
  // Names only here, except someone out of office: their avatar carries the
  // Out of Office badge (and "You're covering" when it's you covering).
  const away = useAppStore(s => (current?.name ? activeOooFor(s.oooRecords, current.name) : null));
  return (
    <RoleAssigneePicker
      role={role}
      memberId={memberId}
      dosDate={dosDate}
      currentName={current?.name || null}
      trigger={({ ref, onClick }) => (current ? (
        <AssigneeChange
          ref={ref}
          hideAvatar={!away}
          name={current.name}
          initials={initialsOf(current.name)}
          oooUser={away ? { name: current.name } : undefined}
          showRole={false}
          onClick={onClick}
          ariaLabel={`Change ${ROLE_LABEL[role] || role} assignee (currently ${current.name})`}
        />
      ) : (
        <AssigneeChange
          ref={ref}
          unassigned
          hideAvatar
          unassignedLabel="Assign"
          onClick={onClick}
          ariaLabel={`Assign ${ROLE_LABEL[role] || role}`}
        />
      ))}
    />
  );
}

export function OpenIcdsCell({ member, onOpenWithCode }) {
  // Count is derived from the SAME open-ICD list the popover renders, so the
  // badge number always equals the number of ICDs shown on hover. Mandatory
  // field: never render an empty ICD count: fall back to the record's stored
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

  if (!count) return <span className={styles.muted}>-</span>;

  return (
    <>
      <div
        ref={cellRef}
        className={styles.openIcdsTrigger}
        onMouseEnter={gapCount ? onEnter : undefined}
        onMouseLeave={gapCount ? onLeave : undefined}
      >
        <Badge size="md" tone="warning" label={String(count)} />
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

export function RafImpactCell({ value, ru }) {
  if (value == null) return <span className={styles.muted}>-</span>;
  const positive = ru !== false; // default to positive/up unless explicitly false
  return (
    <Badge
      tone={positive ? 'success' : 'danger'}
      size="md"
      label={String(value)}
      trailingIcon={positive ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'}
    />
  );
}

// Skip rendering a `<td>` entirely if the parent column-config has hidden it.
export function Cell({ colKey, hidden, children, ...rest }) {
  if (hidden) return null;
  return (
    <td data-col={colKey} {...rest}>
      {children}
    </td>
  );
}

const RESOLVED_STATUSES = new Set(['Completed', 'Skipped']);
function isRoleResolved(s) { return RESOLVED_STATUSES.has(s); }

/**
 * Renders the current assignee cell with three visual variants:
 *   - 'active'     → orange provider avatar + name + role (current behaviour)
 *   - 'unassigned' → empty grey avatar slot + "Unassigned" + role hint
 *   - 'billing'    → green check chip + "Billing Ready"
 */
export function AssigneeCell({ member, dosState }) {
  const platformUsers = useAppStore(s => s.platformUsers);
  const a = resolveCurrentAssignee(member, dosState, platformUsers);

  if (!a || (a.kind === 'active' && !a.name)) {
    return <span className={styles.muted}>-</span>;
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

  if (a.kind === 'billed') {
    return (
      <div className={styles.assigneeCell}>
        <span className={styles.billingBadge}>
          <Icon name="solar:dollar-linear" size={16} color="var(--status-success)" />
        </span>
        <div className={styles.assigneeText}>
          <span className={styles.assigneeName}>Billed</span>
          <span className={styles.assigneeRole}>Record submitted &amp; billed</span>
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
      <Avatar variant="staff" initials={a.initials} />
      <div className={styles.assigneeText}>
        <span className={styles.assigneeName}>{a.name}</span>
        <span className={styles.assigneeRole}>{ROLE_LABEL[a.role] || a.role}</span>
      </div>
    </div>
  );
}

// Small circular source badge next to the DOS date (D=Document, C=Claim,
// M=Manual). Classifier + meta come from the shared `dosSource` module so the
// badge and the "DOS Source" filter agree on the source per date. Callers
// should pass the full `entry` (its persisted `source` picks the letter);
// the legacy `date`-only signature still works and falls back to the hash.
export function DosSourceBadge({ entry, date, hasDoc = true, onClick, claimNumber }) {
  const input = entry || date;
  const letter = dosSourceLetter(input, hasDoc);
  const meta = DOS_SOURCE_META[letter] || DOS_SOURCE_META.D;
  const displayDate = entry?.date || date;
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  // Hover-persist bookkeeping: closing on mouseleave-badge would cancel the
  // user's move onto the tooltip, blocking the claim-number link. Close is
  // deferred and cancelled when the tooltip picks up the pointer.
  const closeTimer = useRef(null);
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };

  const show = () => {
    cancelClose();
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
  };
  const hide = () => {
    cancelClose();
    // 200ms buffer lets the pointer cross the 6px gap between the badge
    // and the tooltip (and back onto the claim-number link inside it)
    // without the popover snapping shut mid-transit.
    closeTimer.current = setTimeout(() => setPos(null), 200);
  };

  // Click affordance: when the caller wires a handler (e.g. the worklist
  // opens the Claims tab for a C badge), swallow bubble/default so the
  // surrounding <td>'s row-open handler doesn't fire.
  const handleClick = onClick ? (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick(e);
  } : undefined;

  return (
    <span
      ref={ref}
      className={[styles.dosSrcBadge, styles[meta.cls], onClick ? styles.dosSrcBadgeClickable : ''].filter(Boolean).join(' ')}
      aria-label={onClick ? `Open ${meta.label} · ${displayDate}` : `${meta.label} · ${displayDate}`}
      onMouseEnter={show}
      onFocus={show}
      onMouseLeave={hide}
      onBlur={hide}
      onClick={handleClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
      } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={0}
    >
      {letter}
      {pos && createPortal(
        <div
          className={styles.dosSrcTip}
          style={{ top: pos.top, left: pos.left }}
          role="tooltip"
          onMouseEnter={cancelClose}
          onMouseLeave={hide}
        >
          <div className={styles.dosSrcTipHead}>
            <Icon name="solar:document-text-linear" size={12} />
            {meta.label}
          </div>
          {claimNumber ? (
            <button
              type="button"
              className={styles.dosSrcTipClaimLink}
              onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
              title={`Open claim ${claimNumber}`}
            >
              <span>{claimNumber}</span>
              <Icon name="solar:alt-arrow-right-linear" size={10} color="currentColor" />
            </button>
          ) : (
            <div className={styles.dosSrcTipMeta}>{meta.hint}</div>
          )}
          <div className={styles.dosSrcTipDate}>DOS: {displayDate}</div>
        </div>,
        document.body,
      )}
    </span>
  );
}
