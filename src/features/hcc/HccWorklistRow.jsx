import { useRef, useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/ui/checkbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import {
  RafTooltip,
  VisitsPopover,
  ChartPopover,
  ActionsMenuPopover,
  OpenIcdsHoverPopover,
} from './RowPopovers';
import { getIcdsForMember, getNotLinkedForMember } from './data/icds';
import { getStatusSpec } from './statusSpec';
import { staffById, ROLE_LABEL, ROLES } from './assignment/astranaStaff';
import { dosKey } from './assignment/dosState';
import styles from './HccWorklistRow.module.css';

const RISK_VARIANT = { High: 'lace-high', Medium: 'lace-medium', Low: 'lace-low' };

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

function CreateDateCell({ date, due, dueCol }) {
  return (
    <div className={styles.stackCell}>
      <span className={styles.dateText}>{date}</span>
      {due && (
        <span className={styles.dueLine} style={{ color: dueCol }}>
          <Icon name="solar:clock-circle-linear" size={12} color={dueCol} />
          <span>{due}</span>
        </span>
      )}
    </div>
  );
}

function summarizeDocs(docStatus = []) {
  if (docStatus.length === 0) return { label: 'No Charts', color: 'var(--neutral-200)' };
  const pass = docStatus.filter(s => s === 'passed').length;
  const fail = docStatus.filter(s => s === 'failed').length;
  const pend = docStatus.filter(s => s === 'pending').length;
  if (pass === docStatus.length) return { label: 'All Verified', color: 'var(--status-success)' };
  if (fail === docStatus.length) return { label: 'All Failed',   color: 'var(--status-error)' };
  if (pend === docStatus.length) return { label: 'All Pending',  color: 'var(--neutral-200)' };
  if (fail > 0)                  return { label: `${fail} Failed`, color: 'var(--status-error)' };
  return { label: `${pend} Pending`, color: 'var(--status-warning)' };
}

function HccEvidenceCell({ count, docStatus, onClick }) {
  if (count == null) return <span className={styles.muted}>—</span>;
  const summary = summarizeDocs(docStatus);
  return (
    <button type="button" className={styles.evidenceTrigger} onClick={onClick}>
      <div className={styles.evidenceBadge}>
        <Icon name="solar:file-text-linear" size={12} color="var(--primary-300)" />
        <span>{count}</span>
        <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--primary-300)" />
      </div>
      <div className={styles.evidenceStatus}>
        <span className={styles.evidenceDot} style={{ background: summary.color }} />
        <span>{summary.label}</span>
      </div>
    </button>
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
 * number of days per role (Support=+0, Coder=+7, Rev1=+14, Rev2=+21, Rev3=+28).
 * The status itself isn't spelled out — the row legend at the bottom of the
 * worklist explains the icon meanings.
 */
function RoleStatusCell({ name, status, date }) {
  if (!name || !status || status === 'Assign') {
    return (
      <div className={styles.roleUnassigned}>
        <Icon name="solar:user-plus-rounded-linear" size={14} color="var(--neutral-200)" />
        <span>Assign</span>
      </div>
    );
  }
  const spec = getStatusSpec(status);
  return (
    <div className={styles.stackCell}>
      <span className={styles.roleName}>{name}</span>
      <span className={styles.roleStatusLine}>
        <Icon name={spec.icon} size={12} color={spec.color} />
        {date && <span className={styles.roleDate}>{date}</span>}
      </span>
    </div>
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
const ROLE_OFFSET = { sup: 0, cdr: 7, r1: 14, r2: 21, r3: 28 };

function OpenIcdsCell({ count, member, onOpenWithCode }) {
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

  if (count == null) return <span className={styles.muted}>—</span>;

  return (
    <>
      <div
        ref={cellRef}
        className={styles.openIcdsTrigger}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <Badge variant="status-queued" label={String(count)} />
      </div>
      {hovered && rect && (
        <OpenIcdsHoverPopover
          anchorRect={rect}
          member={member}
          icds={getIcdsForMember(member?.name)}
          notLinked={getNotLinkedForMember(member?.name)}
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

// Statuses that count as "this role is done with the DOS" — they hand the
// work off downstream. The DOS must complete the current stage before it
// can be picked up by the next role; we never skip backward to a prior
// completed assignee even if the next stage hasn't been assigned yet.
const TERMINAL_STATUSES = new Set(['Completed', 'Reject', 'Rejected', 'Billing Ready']);

// Sequential workflow order. The first role whose status is NOT terminal
// is where the DOS currently sits (HCC reality: Support → Coder → R1 →
// R2 → R3 → Billing). If a stage has no status / 'Assign' placeholder
// that means it's waiting for someone to pick it up — that's the
// current bucket but with no assignee yet.
const STAGES_LOW_TO_HIGH = ['support', 'coder', 'r1', 'r2', 'r3'];

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
export function resolveCurrentAssignee(member, dosState) {
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
          return makeActive(rs.assignee, role, status);
        }
        return { kind: 'unassigned', role };
      }
      // Stage has a non-terminal status → DOS lives here right now.
      if (!TERMINAL_STATUSES.has(status)) {
        return makeActive(rs?.assignee, role, status);
      }
      // Otherwise terminal → continue down the chain.
    }
    // All five stages terminal → Billing Ready.
    return { kind: 'billing' };
  }

  // ── Legacy fallback (no engine state yet) ──────────────────────────
  const legacy = [
    { role: 'support', name: member.sup, status: member.supS },
    { role: 'coder',   name: member.cdr, status: member.cdrS },
    { role: 'r1',      name: member.r1,  status: member.r1s },
    { role: 'r2',      name: member.r2,  status: member.r2s },
    { role: 'r3',      name: member.r3,  status: member.r3s },
  ];
  for (const r of legacy) {
    if (!r.name && (!r.status || r.status === 'Assign')) {
      return { kind: 'unassigned', role: r.role };
    }
    if (!r.status || r.status === 'Assign') {
      return makeActiveLegacy(r.name, r.role, r.status);
    }
    if (!TERMINAL_STATUSES.has(r.status)) {
      return makeActiveLegacy(r.name, r.role, r.status);
    }
  }
  return { kind: 'billing' };
}

function makeActive(staffId, role, status) {
  const staff = staffById(staffId);
  return {
    kind: 'active',
    name: staff?.name || staffId || null,
    initials: staff?.initials || (staffId || '').slice(0, 2),
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
  const a = resolveCurrentAssignee(member, dosState);

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
        <span className={styles.unassignedSlot} aria-hidden="true" />
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

// Per-column cell renderers. Keyed by `k` from HCC_COLUMNS. Each receives the
// member row + a couple of click handlers and returns the populated `<td>`.
// The row iterates over the (possibly user-reordered) columns array and calls
// the matching renderer — keeping body layout in sync with header order.
const CELL_RENDERERS = {
  dos: ({ member, openClaimPreview, openVisits }) => {
    // `dosFromClaim` toggles the cell between a clickable purple link
    // (claim-sourced) and static grey text (manually entered). When the
    // field isn't set explicitly we infer it from chart presence — every
    // claim ships with documentation, so a row with at least one chart
    // (`ch > 0`) almost certainly originated from a claim feed.
    const fromClaim = member.dosFromClaim != null
      ? !!member.dosFromClaim
      : (member.ch != null && member.ch > 0);
    return (
      <td key="dos" data-col="dos" className={styles.colLastVisit} onClick={(e) => e.stopPropagation()}>
        <LastVisitCell
          dos={member.dos}
          visits={member.visits}
          fromClaim={fromClaim}
          onClickDate={() => openClaimPreview?.(member, member.dos)}
          onClickVisits={openVisits}
        />
      </td>
    );
  },
  open: ({ member, openDiagPanel }) => (
    <td key="open" data-col="open" className={styles.colOpen} onClick={(e) => e.stopPropagation()}>
      <OpenIcdsCell
        count={member.open}
        member={member}
        onOpenWithCode={(code) => openDiagPanel(member.id, { highlightCode: code })}
      />
    </td>
  ),
  date: ({ member }) => (
    <td key="date" data-col="date" className={styles.colDate}>
      <CreateDateCell date={member.date} due={member.due} dueCol={member.dueCol} />
    </td>
  ),
  evidence: ({ member, openChart }) => (
    <td key="evidence" data-col="evidence" className={styles.colEvidence} onClick={(e) => e.stopPropagation()}>
      <HccEvidenceCell count={member.ch} docStatus={member.docStatus || []} onClick={openChart} />
    </td>
  ),
  // Current assignee — whoever owns the DOS right now per the engine.
  // dosState arrives via the render context (see HccWorklistRow below).
  assignee: ({ member, dosState }) => (
    <td key="assignee" data-col="assignee" className={styles.colAssignee}>
      <AssigneeCell member={member} dosState={dosState} />
    </td>
  ),
  // Role columns — bottom-line date = member.date + per-role offset.
  sup: ({ member }) => (
    <td key="sup" data-col="sup" className={styles.colRole}>
      <RoleStatusCell name={member.sup} status={member.supS} date={addDaysToDate(member.date, ROLE_OFFSET.sup)} />
    </td>
  ),
  cdr: ({ member }) => (
    <td key="cdr" data-col="cdr" className={styles.colRole}>
      <RoleStatusCell name={member.cdr} status={member.cdrS} date={addDaysToDate(member.date, ROLE_OFFSET.cdr)} />
    </td>
  ),
  r1: ({ member }) => (
    <td key="r1" data-col="r1" className={styles.colRole}>
      <RoleStatusCell name={member.r1} status={member.r1s} date={addDaysToDate(member.date, ROLE_OFFSET.r1)} />
    </td>
  ),
  r2: ({ member }) => (
    <td key="r2" data-col="r2" className={styles.colRole}>
      <RoleStatusCell name={member.r2} status={member.r2s} date={addDaysToDate(member.date, ROLE_OFFSET.r2)} />
    </td>
  ),
  r3: ({ member }) => (
    <td key="r3" data-col="r3" className={styles.colRole}>
      <RoleStatusCell name={member.r3} status={member.r3s} date={addDaysToDate(member.date, ROLE_OFFSET.r3)} />
    </td>
  ),
  rp: ({ member }) => (
    <td key="rp" data-col="rp" className={styles.colProvider}>
      <span className={styles.providerText}>{member.rp}</span>
    </td>
  ),
  pos: ({ member }) => (
    <td key="pos" data-col="pos" className={styles.colPos}>
      {member.pos
        ? <span className={styles.posBadge}>{member.pos}</span>
        : <span className={styles.muted}>—</span>}
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
  pcp: ({ member }) => (
    <td key="pcp" data-col="pcp" className={styles.colPcp}>
      <span className={styles.providerText}>{member.pcp}</span>
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
        ? <Badge variant={RISK_VARIANT[member.rl] || 'toc-new'} label={member.rl} />
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

export function HccWorklistRow({ member, hiddenCols, columns }) {
  const selectedHccIds = useAppStore(s => s.selectedHccIds);
  const selectHccMember = useAppStore(s => s.selectHccMember);
  const openDiagPanel = useAppStore(s => s.openDiagPanel);
  const diagPanelMemberId = useAppStore(s => s.diagPanelMemberId);
  const openQuickView = useAppStore(s => s.openQuickView);
  const showToast = useAppStore(s => s.showToast);
  const openHccUploadDrawer = useAppStore(s => s.openHccUploadDrawer);
  const openClaimPreview = useAppStore(s => s.openHccClaimPreview);
  // Per-DOS engine state — drives the Assignee column. `member.dos` is the
  // member's currently-selected DOS in the worklist (i.e. the row's "active"
  // visit), so we look that up in hccDosAssignments. May be undefined if the
  // engine hasn't been seeded yet — AssigneeCell falls back to legacy fields.
  const dosState = useAppStore(s =>
    member?.id && member?.dos ? s.hccDosAssignments[dosKey(member.id, member.dos)] : null
  );
  const checked = selectedHccIds.includes(member.id);
  const isOpenInDrawer = diagPanelMemberId === member.id;
  const isHidden = (k) => hiddenCols?.has(k);

  // Anchored popover state — all click-driven, only one open at a time.
  const [visitsRect, setVisitsRect] = useState(null);
  const [chartRect, setChartRect] = useState(null);
  const [actionsRect, setActionsRect] = useState(null);

  const openVisits = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setVisitsRect(prev => prev ? null : rect);
  };
  const openChart = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setChartRect(prev => prev ? null : rect);
  };
  const openActions = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActionsRect(prev => prev ? null : rect);
  };

  return (
    <>
    <tr
      className={[
        styles.row,
        checked ? styles.rowChecked : '',
        isOpenInDrawer ? styles.rowActive : '',
      ].filter(Boolean).join(' ')}
    >
      {/* ── Sticky left: checkbox ── */}
      <td
        className={`${styles.checkTd} ${styles.stickyLeft} ${styles.stickyCheck}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={() => selectHccMember(member.id)}
          aria-label={`Select ${member.name}`}
        />
      </td>

      {/* ── Sticky left: member identity (matches TOC .patientCell exactly) ── */}
      <td className={`${styles.memberTd} ${styles.stickyLeft} ${styles.stickyMember} ${styles.colMember}`}>
        <div className={styles.patientCell}>
          <Avatar variant="patient" initials={member.in} />
          <div>
            <div className={styles.patientName}>
              <button
                className={styles.patientNameLink}
                onClick={e => { e.stopPropagation(); openQuickView({ id: member.id, name: member.name, initials: member.in, gender: member.g, age: member.age, memberId: member.memberId, language: member.language, raf: member.raf }); }}
              >{member.name}</button>{' '}
              <span className={styles.patientDemo}>({member.g}&bull;{member.age})</span>
            </div>
            <div className={styles.patientMeta}>
              {member.memberId} &bull;{' '}
              <button
                type="button"
                className={styles.langBadge}
                onClick={(e) => e.stopPropagation()}
              >
                {(member.language || 'en').toUpperCase()}
                <span className={styles.langTooltip}>Preferred Language: English</span>
              </button>
            </div>
          </div>
        </div>
      </td>

      {/* Body cells render in the order driven by `columns` (which the parent
          builds from HCC_COLUMNS + the user's hccColumnOrder). Each column's
          content lives in CELL_RENDERERS keyed by column key. */}
      {(columns || []).map((col) => {
        const render = CELL_RENDERERS[col.k];
        if (!render || isHidden(col.k)) return null;
        return render({ member, dosState, openVisits, openChart, openDiagPanel, openClaimPreview });
      })}

      {/* ── Sticky right: actions ── */}
      <td className={`${styles.actionsCell} ${styles.stickyRight} ${styles.colActions}`}>
        <div className={styles.actionsRow}>
          <ActionButton
            icon="solar:eye-linear"
            size="L"
            tooltip="View Diagnosis Gaps"
            onClick={(e) => { e.stopPropagation(); openDiagPanel(member.id); }}
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

    {/* Anchored popovers: rendered as Fragment siblings to the row. Each
        popover uses createPortal internally so it lands on document.body. */}
    {visitsRect && (
      <VisitsPopover
        anchorRect={visitsRect}
        name={member.name}
        visits={member.dos_list}
        onClose={() => setVisitsRect(null)}
        onSelect={(v) => { setVisitsRect(null); openDiagPanel(member.id, { initialDos: v.date }); }}
      />
    )}
    {chartRect && (
      <ChartPopover
        anchorRect={chartRect}
        member={member}
        onClose={() => setChartRect(null)}
        onUpload={() => openHccUploadDrawer(member)}
      />
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
