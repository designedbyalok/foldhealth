import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../store/useAppStore';
import { Drawer } from '../../../components/Drawer/Drawer';
import { BulkBar } from '../../../components/BulkBar/BulkBar';
import { Icon } from '../../../components/Icon/Icon';
import { CloseIcon } from '../../../components/Icon/CloseIcon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { PatientBanner } from '../../../components/PatientBanner/PatientBanner';
import { Switch } from '../../../components/Switch/Switch';
import { IcdRow } from './IcdRow';
import { IcdDosCard } from './IcdDosCard';
import { SuspectCard } from './HccSuspectGroup';
import { DosStatusMenu } from './DosStatusMenu';
import { LeftWorkspace } from './LeftWorkspace';
import { NewDiagGapPanel } from './NewDiagGapPanel';
import {
  DiagPanelFilterBar,
  icdMatchesFilters,
  activeFilterCount,
  EMPTY_FILTERS,
} from './DiagPanelFilterBar';
import {
  ReviewProgressPopover,
  ProgressRing,
  buildReviewStages,
  computeReviewProgress,
} from './ReviewProgressPopover';
import { SWEEP_ICD_DATA } from '../data/sweepIcds';
import { getIcdsForMember, getNotLinkedForMember } from '../data/icds';
import { RoleTooltip } from '../RoleTooltip';
import { resolveCurrentAssignee } from '../HccWorklistRow';
import { slaOutcome } from '../sla';
import { RoleAssigneePicker } from '../RoleAssigneePicker';
import { ROLE_LABEL } from '../assignment/astranaStaff';
import { dosKey } from '../assignment/dosState';
import styles from './DiagPanel.module.css';

// Initials-square avatar to the left of the DOS status pill. Reflects the
// SAME sequential resolver the worklist uses — shows whoever currently owns
// the DOS based on workflow stage, not "the coder if there's a coder". For
// records that have advanced past R2/R3 with no next assignee, shows a
// dashed-outline placeholder. For Billing Ready records, shows a green
// check chip. Hovering opens a RoleTooltip with the role label.
/**
 * UnassignedAssignTrigger — interactive dashed avatar slot. Clicking opens the
 * shared searchable RoleAssigneePicker (every platform user), so assigning a
 * DOS owner from the DiagPanel behaves exactly like the worklist role cells.
 */
function UnassignedAssignTrigger({ role, memberId, dosDate }) {
  return (
    <RoleAssigneePicker
      role={role}
      memberId={memberId}
      dosDate={dosDate}
      align="right"
      reason="Assigned from DiagPanel"
      trigger={({ ref, onClick }) => (
        <RoleTooltip
          name="Unassigned"
          role={`Awaiting ${ROLE_LABEL[role] || role} — click to assign`}
          initials="—"
          variant="provider"
        >
          <button
            type="button"
            ref={ref}
            onClick={onClick}
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'var(--neutral-50)',
              border: '0.5px dashed var(--neutral-200)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: 'pointer', padding: 0,
            }}
          >
            <Icon name="solar:user-plus-rounded-linear" size={14} color="var(--neutral-300)" />
          </button>
        </RoleTooltip>
      )}
    />
  );
}

function AssigneeAvatar({ member, dosState, currentDos }) {
  const a = resolveCurrentAssignee(member, dosState);
  if (!a) return null;
  // Unassigned slot is interactive — opens a candidate picker so the user
  // can assign someone from this exact spot. Lives in its own subcomponent
  // because of the portal + outside-click bookkeeping.
  if (a.kind === 'unassigned') {
    return <UnassignedAssignTrigger role={a.role} memberId={member?.id} dosDate={currentDos} />;
  }

  // Billing Ready — every stage completed. Green check chip, no person.
  if (a.kind === 'billing') {
    return (
      <RoleTooltip name="Billing Ready" role="All reviews complete" initials="✓" variant="provider">
        <span
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'var(--status-success-light)',
            border: '0.5px solid rgba(0, 155, 83, 0.3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--status-success)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Icon name="solar:check-circle-bold" size={14} color="var(--status-success)" />
        </span>
      </RoleTooltip>
    );
  }

  // Active assignee — always the orange provider palette (the DOS owner is a
  // provider/staff member regardless of stage).
  // Active assignee is reassignable — matches the worklist: an in-flight step
  // can change owner. Clicking opens the shared searchable picker.
  return (
    <RoleAssigneePicker
      role={a.role}
      memberId={member?.id}
      dosDate={currentDos}
      currentName={a.name}
      align="right"
      reason="Reassigned from DiagPanel"
      trigger={({ ref, onClick }) => (
        <RoleTooltip
          name={a.name}
          role={ROLE_LABEL[a.role] || a.role}
          initials={a.initials}
          variant="provider"
        >
          <button
            type="button"
            ref={ref}
            onClick={onClick}
            title="Change assignee"
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'var(--secondary-100)', border: '0.5px solid var(--secondary-200)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 10, fontWeight: 500, color: 'var(--secondary-300)',
              cursor: 'pointer', padding: 0,
            }}
          >
            {a.initials}
          </button>
        </RoleTooltip>
      )}
    />
  );
}

const isAISuggested = (icd) => ['Suspect', 'Recapture'].includes(icd.type || '');

// The status pill acts on the LOGGED-IN role's stage (Support/Coder/QA/
// Compliance), so each role completes their own step — completing while an
// earlier role never worked the record auto-skips that earlier stage.
const ROLE_KEY_BY_USER = { Support: 'support', Coder: 'coder', QA: 'reviewer', Compliance: 'reviewer2' };

// Keyboard shortcut legend — mirrors the handlers in DiagPanel's keydown
// effect. Rendered as the drawer's dark footer bar (Paper 1WXT).
const SHORTCUTS = [
  ['A', 'Accept'],
  ['X', 'Dismiss'],
  ['M', 'Missed opportunity'],
  ['D', 'Defer'],
  ['↑↓', 'Move'],
  ['Enter', 'Open Document'],
];
function ShortcutBar() {
  return (
    <div className={styles.shortcutBar}>
      {SHORTCUTS.map(([k, label]) => (
        <span key={k} className={styles.shortcutItem}>
          <kbd className={styles.shortcutKey}>{k}</kbd>
          <span className={styles.shortcutLabel}>{label}</span>
        </span>
      ))}
    </div>
  );
}


export function DiagPanel() {
  const memberId = useAppStore(s => s.diagPanelMemberId);
  const closeDiagPanel = useAppStore(s => s.closeDiagPanel);
  const member = useAppStore(s => s.hccMembers.find(m => m.id === memberId));
  const showToast = useAppStore(s => s.showToast);
  const fetchHccDiagnosisGaps = useAppStore(s => s.fetchHccDiagnosisGaps);
  const diagnosisGaps = useAppStore(s => s.hccDiagnosisGaps);
  const diagDosStatus = useAppStore(s => s.diagDosStatus);
  const setDiagDosStatus = useAppStore(s => s.setDiagDosStatus);
  // Assignment-engine read/write — drives the Coder stage pill below.
  const hccDosAssignments = useAppStore(s => s.hccDosAssignments);
  const initializeHccPatient = useAppStore(s => s.initializeHccPatient);
  const hccCompleteSupport = useAppStore(s => s.hccCompleteSupport);
  const hccCompleteCoder = useAppStore(s => s.hccCompleteCoder);
  const hccCompleteReviewer = useAppStore(s => s.hccCompleteReviewer);
  const hccCompleteReviewer2 = useAppStore(s => s.hccCompleteReviewer2);
  const hccRequestRecords = useAppStore(s => s.hccRequestRecords);
  const hccRecordsReceived = useAppStore(s => s.hccRecordsReceived);
  const hccMarkInsufficient = useAppStore(s => s.hccMarkInsufficient);
  const hccRejectDos = useAppStore(s => s.hccRejectDos);
  const hccReturnDos = useAppStore(s => s.hccReturnDos);
  const hccMarkSupportInProgress = useAppStore(s => s.hccMarkSupportInProgress);
  const hccSetRoleStatus = useAppStore(s => s.hccSetRoleStatus);
  const diagLeftPanel = useAppStore(s => s.diagLeftPanel);
  const diagActivityIcd = useAppStore(s => s.diagActivityIcd);
  const setDiagLeftPanel = useAppStore(s => s.setDiagLeftPanel);
  const setDiagTab = useAppStore(s => s.setDiagTab);
  const setHccGapDosAction = useAppStore(s => s.setHccGapDosAction);
  const hccGapDosActions = useAppStore(s => s.hccGapDosActions);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  // Bulk-select mode — mirrors the Content Settings pattern. DOS-row
  // checkboxes only render when this is on; the shortcut footer swaps to
  // the bulk-action bar the moment something is selected.
  const [bulkMode, setBulkMode] = useState(false);
  const toggleBulkMode = () => {
    setBulkMode(v => {
      const next = !v;
      // Clear any prior selection when leaving bulk mode so re-entering
      // starts fresh (matches Content Settings).
      if (!next) setSelectedKeys(new Set());
      return next;
    });
  };
  // Open/closed state for the removed Overridden/Closed ICD sections — kept
  // commented out rather than deleted.
  // const [overriddenOpen, setOverriddenOpen] = useState(false);
  // const [closedOpen, setClosedOpen] = useState(false);
  // Expandable "ICDs Associated with N/M DOSs" section (Paper 1ZV3): a row
  // per DOS with a toggle. Toggling a DOS off hides its ICD rows.
  const [dosExpanded, setDosExpanded] = useState(false);
  const [disabledDos, setDisabledDos] = useState(() => new Set());
  const [openDismissKey, setOpenDismissKey] = useState(null);
  const dosDeleted = useAppStore(s => s.hccGapDosDeleted);
  // Filter row (Figma 9810:158181) — toggled by the toolbar Filter button.
  // `filters` is a keyed object; the shared `icdMatchesFilters` predicate
  // applies the same rules across every ICD bucket below.
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const filterCount = activeFilterCount(filters);
  // -1 = no DOS highlighted; a row lights up only once an ICD is selected,
  // acted on, or reached via the keyboard.
  const [focusIdx, setFocusIdx] = useState(-1);

  // Fetch diagnosis gaps from Supabase when member changes
  useEffect(() => {
    if (member?.name) fetchHccDiagnosisGaps(member.name);
  }, [member?.name, fetchHccDiagnosisGaps]);

  // Phase 2f — fall back to the local ICD mock when Supabase has no rows for
  // this member. Without the fallback, the panel would render empty for any
  // member that hasn't been seeded into `hcc_diagnosis_gaps` yet.
  const icdsRaw = useMemo(() => {
    const fromSupabase = diagnosisGaps.filter(g => g.isLinked !== false);
    if (fromSupabase.length > 0) return fromSupabase;
    return member?.name ? getIcdsForMember(member.name) : [];
  }, [diagnosisGaps, member?.name]);

  const notLinkedRaw = useMemo(() => {
    const fromSupabase = diagnosisGaps.filter(g => g.isLinked === false);
    if (fromSupabase.length > 0) return fromSupabase;
    return member?.name ? getNotLinkedForMember(member.name) : [];
  }, [diagnosisGaps, member?.name]);

  // Buckets (see docs/features/hcc-coding-workflow.md §4):
  //  - assocICDs → the ICD-first cards ("ICDs Associated with N/M DOSs").
  //  - allNotAssoc → AI suspects grouped per HCC (HccSuspectGroup).
  //  - overridden / closed → collapsed sections at the bottom.
  // Filter chips apply the same predicate to every bucket so a chip picked
  // in the toolbar affects the whole panel view (Figma 9810:158181).
  const matchesFilters = useCallback(
    (icd) => icdMatchesFilters(icd, filters, member?.date),
    [filters, member?.date],
  );
  const assocICDs = useMemo(
    () => icdsRaw.filter(i => (!isAISuggested(i) || i.status === 'Accepted') && matchesFilters(i)),
    [icdsRaw, matchesFilters],
  );
  const allNotAssoc = useMemo(() => [
    ...icdsRaw.filter(i => isAISuggested(i) && i.status !== 'Accepted'),
    ...notLinkedRaw,
  ].filter(matchesFilters), [icdsRaw, notLinkedRaw, matchesFilters]);
  const overriddenICDs = useMemo(
    () => [...icdsRaw, ...notLinkedRaw].filter(i => i.dismissReason).filter(matchesFilters),
    [icdsRaw, notLinkedRaw, matchesFilters],
  );
  const closedICDs = useMemo(
    () => [...icdsRaw, ...notLinkedRaw]
      .filter(i => ['Accepted', 'Dismissed'].includes(i.status))
      .filter(matchesFilters),
    [icdsRaw, notLinkedRaw, matchesFilters],
  );

  // ── DOS list — from the member's dos_list, with a single-row stub fallback.
  const dosList = useMemo(() => {
    if (member?.dos_list?.length) return member.dos_list;
    if (member?.dos) return [{ date: member.dos, status: diagDosStatus }];
    return [];
  }, [member, diagDosStatus]);

  // Enabled DOS dates = all except the ones toggled off. Cards show only
  // entries whose DOS is enabled.
  const enabledDates = useMemo(
    () => dosList.map(d => d.date).filter(date => !disabledDos.has(date)),
    [dosList, disabledDos],
  );
  const currentDos = dosList[0]?.date || null;

  // Reset the per-DOS toggles when the member changes.
  useEffect(() => { setDisabledDos(new Set()); setDosExpanded(false); }, [memberId]);

  // Lazily seed the assignment engine for this patient — idempotent.
  useEffect(() => {
    if (member?.id) initializeHccPatient(member.id);
  }, [member?.id, initializeHccPatient]);

  // Live engine state for the currently-selected DOS (drives stage pill +
  // assignee avatar + status menu).
  const currentDosEntry = currentDos ? dosList.find(d => d.date === currentDos) : null;
  const dosStateKey = member && currentDos
    ? dosKey(member.id, currentDos, currentDosEntry?.provider, currentDosEntry?.pos)
    : null;
  const dosState = dosStateKey ? hccDosAssignments[dosStateKey] : null;

  // The role the logged-in user acts as — drives the DOS status pill so a
  // Coder completes the Coder stage, QA completes the QA stage, etc.
  const hccUserRole = useAppStore(s => s.hccUserRole);
  const actingRole = ROLE_KEY_BY_USER[hccUserRole] || 'coder';
  const actingStatus = useMemo(() => {
    const rs = dosState?.[actingRole];
    return rs?.status || diagDosStatus || 'New';
  }, [dosState, actingRole, diagDosStatus]);

  // QA / Compliance can't work a record until Support AND Coder are done —
  // their status pill and ICD-review actions stay locked until then.
  const stageLocked = useMemo(() => {
    if (actingRole !== 'reviewer' && actingRole !== 'reviewer2') return false;
    const supDone = (dosState?.support?.status || member?.supS) === 'Completed';
    const cdrDone = (dosState?.coder?.status || member?.cdrS) === 'Completed';
    return !(supDone && cdrDone);
  }, [actingRole, dosState, member]);

  // ── Review-progress stages + ring (drives the stage pill) ──
  const reviewStages = useMemo(
    () => buildReviewStages(member, dosState),
    [member, dosState],
  );
  const reviewProgress = useMemo(
    () => computeReviewProgress(reviewStages),
    [reviewStages],
  );
  // Pill shows the record's actual current stage — the one right after the
  // last resolved (done/skipped) stage — so it stays consistent with the
  // review-progress card even if statuses landed out of order.
  const pillLabel = useMemo(() => {
    if (!reviewStages.length) return 'Coder';
    const lastResolved = reviewStages.reduce(
      (acc, s, i) => (s.state === 'done' || s.state === 'skipped') ? i : acc, -1);
    if (lastResolved === reviewStages.length - 1) return 'Billing Ready';
    // Just the stage name — no "Awaiting" prefix.
    return reviewStages[lastResolved + 1].label;
  }, [reviewStages]);

  // Once Support + Coder are done the SLA window closes → show the verdict
  // (✓ SLA Met / ✗ SLA Breached) in place of the live "(Due …)" tag.
  const slaVerdict = useMemo(() => {
    const supDone = (dosState?.support?.status || member?.supS) === 'Completed';
    const cdrDone = (dosState?.coder?.status || member?.cdrS) === 'Completed';
    if (!supDone || !cdrDone) return null;
    const coderDoneAt = dosState?.coder?.history?.[dosState.coder.history.length - 1]?.at || null;
    return slaOutcome(member?.date, coderDoneAt);
  }, [dosState, member]);

  // Hover state for the Review Progress popover.
  const pillRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const [pillRect, setPillRect] = useState(null);
  const onPillEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (pillRect) return;
    openTimer.current = setTimeout(() => {
      const r = pillRef.current?.getBoundingClientRect();
      if (r) setPillRect(r);
    }, 200);
  };
  const onPillLeave = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setPillRect(null), 200);
  };
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const requestClose = () => {
    closeTimer.current = setTimeout(() => setPillRect(null), 200);
  };
  useEffect(() => () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  // Bridge from the DosStatusMenu's onChange to the right lifecycle
  // transition for whichever role currently owns the DOS. Only the workflow
  // status for the current role changes here — ICD statuses are NEVER
  // touched. Unaddressed ICDs stay in their existing state (New / Pending /
  // etc.); acceptance only happens when the user explicitly accepts an ICD.
  const handleStatusChange = (next) => {
    if (!member || !currentDos) { setDiagDosStatus(next); return; }
    // Act on the logged-in role's stage (not just whoever currently owns the
    // record) so a later role completing correctly triggers the skip logic.
    const role = actingRole;

    switch (next) {
      case 'Completed':
        if (role === 'support') {
          // Support completing after a Coder Record Requested — the record is
          // in the Returned state — routes through recordsReceived so the
          // Coder auto-flips to Record Received (AC-6 loop).
          const supStatus = dosState?.support?.status;
          if (supStatus === 'Returned') hccRecordsReceived(member.id, currentDos);
          else                          hccCompleteSupport(member.id, currentDos);
        }
        else if (role === 'coder')    hccCompleteCoder(member.id, currentDos);
        else if (role === 'reviewer') hccCompleteReviewer(member.id, currentDos);
        else if (role === 'reviewer2')hccCompleteReviewer2(member.id, currentDos);
        else                          hccSetRoleStatus(member.id, currentDos, role, 'Completed');
        break;
      case 'Record Requested':
        if (role === 'coder')        hccRequestRecords(member.id, currentDos);
        else                         hccSetRoleStatus(member.id, currentDos, role, 'Record Requested');
        break;
      case 'Insufficient':
        if (role === 'support')      hccMarkInsufficient(member.id, currentDos, 'current-user', 'Docs incomplete');
        else                         hccSetRoleStatus(member.id, currentDos, role, 'Insufficient');
        break;
      case 'Reject':
        if (role === 'support')      hccRejectDos(member.id, currentDos, 'current-user', 'Docs failed checklist');
        else                         hccSetRoleStatus(member.id, currentDos, role, 'Reject');
        break;
      case 'Returned':
        if (role === 'reviewer' || role === 'reviewer2') {
          hccReturnDos(member.id, currentDos, role, 'current-user', `Returned from ${role}`);
        } else {
          hccSetRoleStatus(member.id, currentDos, role, 'Returned');
        }
        break;
      case 'In Progress':
        if (role === 'support')      hccMarkSupportInProgress(member.id, currentDos, 'current-user');
        else                         hccSetRoleStatus(member.id, currentDos, role, 'In Progress');
        break;
      case 'New':
      case 'Awaiting':
      case 'Record Received':
      default:
        hccSetRoleStatus(member.id, currentDos, role, next);
        break;
    }
    setDiagDosStatus(next);
  };

  // ── Card + suspect data assembly (search + DOS filters applied) ──
  const q = searchQuery.trim().toLowerCase();
  const matchQ = (icd) =>
    !q || icd.code.toLowerCase().includes(q) || (icd.desc || '').toLowerCase().includes(q);

  // Prefer the Supabase sweep table (hcc_gap_sweep); fall back to the JS
  // mock when a member has no row seeded. Kick off the one-shot fetch
  // here — didFetch inside the store keeps it a single round-trip.
  const fetchHccGapSweep = useAppStore(s => s.fetchHccGapSweep);
  useEffect(() => { fetchHccGapSweep(); }, [fetchHccGapSweep]);
  const sweepFromDb = useAppStore(s => s.hccGapSweep);
  const sweepByCode = useMemo(() => {
    const m = new Map();
    // Only a member's OWN sweep mapping (design reference patients). No
    // `_default` fallback — otherwise generic dates would shadow the
    // dos_list-derived rows and break worklist grouping coherence.
    const dbOwn = member?.name ? sweepFromDb[member.name] : null;
    const own = dbOwn?.length ? dbOwn : (member?.name ? SWEEP_ICD_DATA[member.name] : null);
    if (own) own.forEach(s => m.set(s.code, s));
    return m;
  }, [member?.name, sweepFromDb]);

  // Each ICD card lists a row per DOS the code appears on. Grouping mirrors
  // the worklist: a DOS = one document/encounter (member.dos_list), each
  // yielding several ICDs. When a member has an explicit sweep mapping
  // (Annette, design reference) we use it; otherwise we deterministically
  // spread each ICD across a subset of the record's own DOS dates so the
  // drawer's grouping always stays coherent with the worklist.
  const cardIcds = useMemo(() => {
    const dates = dosList.map(d => d.date).filter(Boolean);
    return assocICDs
      .filter(matchQ)
      .map((icd, idx) => {
        const sweep = sweepByCode.get(icd.code);
        let base;
        if (sweep?.dos_entries?.length) {
          base = sweep.dos_entries.map(e => ({ dos: e.dos, claimed: !!e.claimed }));
        } else if (dates.length) {
          // Chronic conditions (earlier codes) recur across more encounters;
          // later codes appear on fewer. Deterministic — stable per render.
          const count = Math.max(1, dates.length - (idx % dates.length));
          base = dates.slice(0, count).map((d, i) => ({
            dos: d,
            claimed: idx === 0 && i === 0,
            manual: icd.type === 'Manual',
          }));
        } else {
          base = [{ dos: member?.dos || '—', claimed: false, manual: icd.type === 'Manual' }];
        }
        const entries = base
          .filter(e => !disabledDos.has(e.dos))
          .filter(e => !dosDeleted.includes(`${icd.code}|${e.dos}`));
        return { ...icd, entries };
      })
      .filter(c => c.entries.length > 0);
  }, [assocICDs, sweepByCode, dosList, disabledDos, dosDeleted, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const suspectGroups = useMemo(() => {
    const m = new Map();
    for (const icd of allNotAssoc.filter(matchQ)) {
      const key = icd.hcc || 'HCC Not Linked';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(icd);
    }
    return [...m.entries()].map(([hcc, icds]) => ({ hcc, icds }));
  }, [allNotAssoc, q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once a suspect / recapture is acted on (any DOS accepted/rejected/deferred/
  // missed), it graduates up into "ICDs Associated with" — rendered as a normal
  // ICD card (with a Suspected/Recaptured badge) whose entries are the acted
  // DOS. Un-acted suspects stay below in the Suspects & Recaptures section.
  const suspectIcds = useMemo(() => suspectGroups.flatMap(g => g.icds), [suspectGroups]);
  const actedSuspects = useMemo(() =>
    suspectIcds
      .map(icd => ({ icd, keys: Object.keys(hccGapDosActions).filter(k => k.startsWith(`${icd.code}|`)) }))
      .filter(x => x.keys.length > 0)
      .map(({ icd, keys }) => ({ ...icd, entries: keys.map(k => ({ dos: k.split('|')[1] })) })),
    [suspectIcds, hccGapDosActions]);
  const pendingSuspects = useMemo(() =>
    suspectIcds.filter(icd => !Object.keys(hccGapDosActions).some(k => k.startsWith(`${icd.code}|`))),
    [suspectIcds, hccGapDosActions]);

  // ── Keyboard model — a focus ring walks the flat list of DOS rows;
  // A/X/M/D act on the focused row, Enter opens the Documents workspace.
  // Suppressed while typing in any input.
  const rowKeys = useMemo(
    () => cardIcds.flatMap(c => c.entries.map(e => `${c.code}|${e.dos}`)),
    [cardIcds],
  );
  const focusKey = rowKeys[Math.min(focusIdx, rowKeys.length - 1)] || null;
  // The ICD being worked on (owns the focused DOS). The document evidence view
  // follows this so the highlighted note line tracks the active ICD.
  const activeIcdCode = focusKey ? focusKey.split('|')[0] : null;

  useEffect(() => {
    if (focusIdx > 0 && focusIdx >= rowKeys.length) {
      setFocusIdx(Math.max(0, rowKeys.length - 1));
    }
  }, [rowKeys.length, focusIdx]);

  // After acting on a DOS, advance focus to the next un-acted row (searching
  // forward, wrapping once) — this rolls onto the next ICD when the current
  // one is fully worked. If nothing is left un-acted, focus stays put.
  const advanceFocusAfterAction = useCallback((actedKey) => {
    const actions = useAppStore.getState().hccGapDosActions;
    const start = rowKeys.indexOf(actedKey);
    if (start < 0) return;
    for (let j = 1; j <= rowKeys.length; j++) {
      const idx = (start + j) % rowKeys.length;
      const k = rowKeys[idx];
      if (k !== actedKey && !actions[k]) { setFocusIdx(idx); return; }
    }
  }, [rowKeys]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!rowKeys.length) return;
      const key = e.key;
      if (key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx(i => Math.min(i + 1, rowKeys.length - 1));
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx(i => Math.max(i - 1, 0));
      } else if (key === 'Enter') {
        e.preventDefault();
        setDiagLeftPanel('documents');
      } else if (/^[axmd]$/i.test(key)) {
        const focused = rowKeys[Math.min(focusIdx, rowKeys.length - 1)];
        if (!focused) return;
        const k = key.toLowerCase();
        // Support can't accept/reject ICDs — ignore the A / X shortcuts.
        if ((k === 'a' || k === 'x') && useAppStore.getState().hccUserRole === 'Support') return;
        e.preventDefault();
        const [code, dos] = focused.split('|');
        if (k === 'x') {
          // Reject opens the dismiss-reason form for the focused row
          // (Figma: X → reason picker, not a silent dismiss). Advance happens
          // on confirm, via the row's onConfirmDismiss.
          setOpenDismissKey(focused);
        } else {
          setHccGapDosAction(code, dos, { a: 'accepted', m: 'missed', d: 'deferred' }[k]);
          // a/m/d toggle — only advance when the row ended up acted, not undone.
          if (useAppStore.getState().hccGapDosActions[focused]) advanceFocusAfterAction(focused);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rowKeys, focusIdx, setHccGapDosAction, setDiagLeftPanel, advanceFocusAfterAction]);

  // Selecting an ICD card highlights its first DOS automatically.
  useEffect(() => {
    if (!diagActivityIcd) return;
    const idx = rowKeys.findIndex(k => k.startsWith(`${diagActivityIcd}|`));
    if (idx >= 0) setFocusIdx(idx);
  }, [diagActivityIcd]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bulk selection (row checkboxes → bulk Accept / Reject bar) ──
  const toggleSelected = (key) => setSelectedKeys(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const bulkApply = (action) => {
    selectedKeys.forEach(k => {
      const [code, dos] = k.split('|');
      // Skip toggling rows already in the target state.
      if (hccGapDosActions[k] !== action) setHccGapDosAction(code, dos, action);
    });
    const verb = { accepted: 'accepted', rejected: 'rejected', missed: 'marked missed', deferred: 'deferred' }[action] || action;
    showToast(`${selectedKeys.size} row${selectedKeys.size === 1 ? '' : 's'} ${verb}`);
    setSelectedKeys(new Set());
  };

  if (!member) return null;

  const rafImpact = (Number(member.ri) || 0).toFixed(3);
  const noop = (label) => () => showToast(`${label} — coming soon`);

  return (
    <Drawer
      title={<span className={styles.drawerTitle}>Diagnosis Gaps Details</span>}
      onClose={closeDiagPanel}
      className={[styles.panel, diagLeftPanel ? styles.panelExpanded : ''].join(' ')}
      bodyClassName={[styles.body, diagLeftPanel ? styles.bodyExpanded : ''].join(' ')}
      headerStyle={{ display: 'none' }}
      footer={<ShortcutBar />}
    >
      {/* ── Row 1: Title + Close — spans the FULL drawer width. ── */}
      <div className={styles.titleRow}>
        <span className={styles.titleText}>Diagnosis Gaps Details</span>
        <ActionButton size="L" tooltip="Close" onClick={closeDiagPanel}>
          <CloseIcon size={20} color="var(--neutral-300)" />
        </ActionButton>
      </div>

      <div className={styles.contentRow}>
      {/* Workspace (document preview etc.) sits on the LEFT of the ICD
          listing (Paper 1UD1 / 5IX) — rendered first so it's the left pane. */}
      {diagLeftPanel === 'newDiagGap' ? (
        <NewDiagGapPanel
          onClose={() => setDiagLeftPanel(null)}
          member={member}
          excludeCodes={[...icdsRaw, ...notLinkedRaw].map(i => i.code)}
        />
      ) : diagLeftPanel && (
        <LeftWorkspace
          active={diagLeftPanel}
          icdScope={diagActivityIcd ? (activeIcdCode ?? diagActivityIcd) : null}
          onChange={setDiagTab}
          onClose={() => setDiagLeftPanel(null)}
          member={member}
          currentDos={currentDos}
        />
      )}
      <div className={diagLeftPanel ? styles.rightPane : styles.rightPaneFull}>
      {/* ── Row 2: Patient Banner (shared component) ── */}
      <PatientBanner
        initials={member.in}
        name={member.name}
        gender={member.g === 'M' ? 'Male' : member.g === 'F' ? 'Female' : member.g}
        age={member.age || ''}
        memberId={member.memberId || `#${member.id}`}
        raf={member.raf}
        rafChange={rafImpact}
        rafUp={member.ru !== false}
        onCall={noop('Call')}
      />

      {/* ── Meta row: Created date + overdue + stage pill | assignee + status ── */}
      <div className={styles.dosRow}>
        <div className={styles.dosRowLeft}>
          <span className={styles.createdLabel}>Created :</span>
          <span className={styles.createdDate}>{member.date || '—'}</span>
          {slaVerdict ? (
            <span className={styles.dueTag} style={{ color: slaVerdict.colorVar }}>
              <Icon name={slaVerdict.icon} size={12} color={slaVerdict.colorVar} /> {slaVerdict.label}
            </span>
          ) : member.due && (
            <span className={styles.dueTag} style={{ color: member.dueCol || 'var(--status-error)' }}>
              ({member.due})
            </span>
          )}
          <span className={styles.dosRowDivider} />
          {/* Stage pill — hover opens the Review Progress popover; the ring
              is a real progress indicator driven by the engine state. */}
          <span
            ref={pillRef}
            className={styles.withCoderPill}
            onMouseEnter={onPillEnter}
            onMouseLeave={onPillLeave}
            tabIndex={0}
            aria-label={`${pillLabel} — review ${Math.round(reviewProgress * 100)}% complete. Hover for details.`}
          >
            <ProgressRing progress={reviewProgress} size={16} stroke={2} />
            <span>{pillLabel}</span>
          </span>
          {pillRect && (
            <ReviewProgressPopover
              anchorRect={pillRect}
              stages={reviewStages}
              onEnter={cancelClose}
              onLeave={requestClose}
              onClose={() => setPillRect(null)}
            />
          )}
        </div>
        <div className={styles.dosRowRight}>
          <AssigneeAvatar member={member} dosState={dosState} currentDos={currentDos} />
          <span className={styles.dosRowDivider} />
          <DosStatusMenu
            value={actingStatus}
            onChange={handleStatusChange}
            role={actingRole}
            disabled={stageLocked}
            disabledReason="Support and Coder must complete their work first"
          />
        </div>
      </div>

      {/* ── Toolbar: bulk | inline search | + ICD, filter, docs, comments,
          history, more (Paper 1WXT). ── */}
      <div className={styles.toolbar}>
        <ActionButton
          icon={bulkMode ? 'custom:bulk-select-close' : 'custom:bulk-select'}
          size="S"
          tooltip={bulkMode ? 'Exit bulk select' : 'Bulk select'}
          className={bulkMode ? styles.toolbarBtnActive : ''}
          onClick={toggleBulkMode}
        />
        <span className={styles.divider} />
        <div className={styles.toolbarSearch}>
          <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-300)" />
          <input
            type="text"
            placeholder="Search by code or description"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <Icon name="solar:close-linear" size={13} color="var(--neutral-300)" />
            </button>
          )}
        </div>

        <div className={styles.toolbarIcons}>
          <span className={styles.addIcdWrap}>
            <button
              type="button"
              className={[
                styles.addIcdBtn,
                diagLeftPanel === 'newDiagGap' ? styles.addIcdBtnActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setDiagLeftPanel(diagLeftPanel === 'newDiagGap' ? null : 'newDiagGap')}
            >
              <Icon name="solar:add-circle-linear" size={16} color="var(--primary-300)" />
              <span>ICD</span>
            </button>
          </span>
          <span className={styles.divider} />
          <ActionButton
            icon="custom:filter"
            size="S"
            tooltip="Filter"
            notification={filterCount > 0}
            count={filterCount > 0 ? String(filterCount) : undefined}
            className={filterOpen ? styles.activeIcon : ''}
            onClick={() => setFilterOpen(v => !v)}
          />
          <span className={styles.divider} />
          <ActionButton
            icon="solar:file-text-linear"
            size="S"
            tooltip="Documents"
            count={String(member?.docStatus?.length || member?.ch || 0)}
            className={diagLeftPanel === 'documents' && !diagActivityIcd ? styles.activeIcon : ''}
            onClick={() => setDiagLeftPanel(diagLeftPanel === 'documents' && !diagActivityIcd ? null : 'documents')}
          />
          <span className={styles.divider} />
          <ActionButton
            icon="solar:chat-square-linear"
            size="S"
            tooltip="Comments"
            count="6"
            className={diagLeftPanel === 'comments' && !diagActivityIcd ? styles.activeIcon : ''}
            onClick={() => setDiagLeftPanel(diagLeftPanel === 'comments' && !diagActivityIcd ? null : 'comments')}
          />
          <span className={styles.divider} />
          <ActionButton
            icon="solar:history-linear"
            size="S"
            tooltip="Activity Log"
            className={diagLeftPanel === 'activity' && !diagActivityIcd ? styles.activeIcon : ''}
            onClick={() => setDiagLeftPanel(diagLeftPanel === 'activity' && !diagActivityIcd ? null : 'activity')}
          />
          <span className={styles.divider} />
          <ActionButton
            icon="solar:menu-dots-linear"
            size="S"
            tooltip="More"
            onClick={noop('More')}
          />
        </div>
      </div>

      {filterOpen && (
        <DiagPanelFilterBar
          filters={filters}
          icds={[...icdsRaw, ...notLinkedRaw]}
          member={member}
          onChange={setFilters}
          onClearAll={() => setFilters(EMPTY_FILTERS)}
        />
      )}

      {/* ── Body: ICD-first cards + HCC suspect groups + collapsed history ── */}
      <div className={styles.cardsList}>
        {/* Section header — the DOS badge expands an inline per-DOS panel
            with toggles (Paper 1ZV3). Toggling a DOS off hides its rows. */}
        <div className={styles.assocHeader}>
          <span className={styles.assocTitle}>ICDs Associated with</span>
          <button
            type="button"
            className={styles.dosBadge}
            onClick={() => setDosExpanded(o => !o)}
            aria-expanded={dosExpanded}
          >
            {enabledDates.length}/{dosList.length} DOSs
            <Icon name={dosExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={12} color="var(--primary-300)" />
          </button>
        </div>

        {dosExpanded && dosList.length > 0 && (
          <div className={styles.dosPanel}>
            {dosList.map(d => {
              const enabled = !disabledDos.has(d.date);
              const provider = d.provider || member.rp || '—';
              const pos = d.pos || d.posDesc || member.pos || member.posDesc || '—';
              const vt = d.vt || member.vt || 'HCC';
              return (
                <div key={d.date} className={styles.dosPanelRow}>
                  <div className={styles.dosPanelInfo}>
                    <div className={styles.dosPanelDate}>{d.date}</div>
                    <div className={styles.dosPanelMeta}>
                      Rendering Provider: {provider} <span className={styles.dosPanelSep}>•</span> POS: {pos} <span className={styles.dosPanelSep}>•</span> Visit Type: {vt}
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    ariaLabel={`Toggle DOS ${d.date}`}
                    onChange={() => setDisabledDos(prev => {
                      const next = new Set(prev);
                      if (next.has(d.date)) next.delete(d.date); else next.add(d.date);
                      return next;
                    })}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Bulk-action bar has moved to the drawer footer (see BulkActionFooter
            in the header slot swap above) so it stays pinned at the bottom
            regardless of scroll position. */}

        <div className={styles.cardsFlow}>
          {cardIcds.length === 0 && actedSuspects.length === 0 && pendingSuspects.length === 0 && (
            <div className={styles.empty}>
              <Icon name="solar:file-text-linear" size={32} color="var(--neutral-200)" />
              <p>No diagnosis gaps {q ? 'match your search' : 'recorded yet for this member'}.</p>
            </div>
          )}
          {cardIcds.map((icd, i) => (
            <IcdDosCard
              key={`card-${icd.code}-${i}`}
              icd={icd}
              focusKey={focusKey}
              selectedKeys={selectedKeys}
              onToggleSelect={bulkMode ? toggleSelected : null}
              openDismissKey={openDismissKey}
              onOpenDismiss={setOpenDismissKey}
              onActed={advanceFocusAfterAction}
              reviewLocked={stageLocked}
            />
          ))}
          {/* Acted suspects graduate into the associated list as normal cards. */}
          {actedSuspects.map((icd, i) => (
            <IcdDosCard
              key={`acted-suspect-${icd.code}-${i}`}
              icd={icd}
              focusKey={focusKey}
              selectedKeys={selectedKeys}
              onToggleSelect={bulkMode ? toggleSelected : null}
              openDismissKey={openDismissKey}
              onOpenDismiss={setOpenDismissKey}
              onActed={advanceFocusAfterAction}
              reviewLocked={stageLocked}
            />
          ))}

          {pendingSuspects.length > 0 && (
            <div className={styles.assocHeader}>
              <span className={styles.assocTitle}>Suspects and Recaptures</span>
            </div>
          )}
          {pendingSuspects.map((icd, i) => (
            <SuspectCard
              key={`suspect-${icd.code}-${i}`}
              icd={icd}
              dosList={dosList}
              member={member}
            />
          ))}
        </div>

        {/* Overridden ICDs + Closed ICDs sections removed per request — code
            kept commented out rather than deleted.
        <div className={styles.icdSections}>
          <IcdSection
            title="Overridden ICDs"
            count={overriddenICDs.length}
            open={overriddenOpen}
            onToggle={() => setOverriddenOpen(o => !o)}
          >
            {overriddenICDs.length === 0
              ? <SectionEmpty label="No overridden ICDs" />
              : overriddenICDs.map((icd, i) => <IcdRow key={`o-${icd.code}-${i}`} icd={icd} />)
            }
          </IcdSection>
          <IcdSection
            title="Closed ICDs"
            count={closedICDs.length}
            open={closedOpen}
            onToggle={() => setClosedOpen(o => !o)}
          >
            {closedICDs.length === 0
              ? <SectionEmpty label="No closed ICDs" />
              : closedICDs.map((icd, i) => <IcdRow key={`c-${icd.code}-${i}`} icd={icd} />)
            }
          </IcdSection>
        </div>
        */}
      </div>
      </div>{/* ── /rightPane ── */}
      </div>{/* ── /contentRow ── */}
      {/* Shared floating BulkBar — same component the worklist table uses, so
          the animation, styling and interaction match app-wide. Rendered
          inside the Drawer so it disappears with the panel; the bar itself
          is position: fixed and slides up from the viewport bottom. */}
      {bulkMode && (
        <BulkBar
          className={styles.bulkBarInDrawer}
          selectedIds={[...selectedKeys]}
          onClear={() => setSelectedKeys(new Set())}
          actions={[
            { label: 'Accept', icon: 'solar:check-read-linear', variant: 'primary',   onClick: () => bulkApply('accepted') },
            { label: 'Reject', icon: 'solar:close-circle-linear', variant: 'secondary', onClick: () => bulkApply('rejected') },
          ]}
          moreActions={[
            { label: 'Missed Opportunity', icon: 'solar:flag-linear',  onClick: () => bulkApply('missed') },
            { label: 'Defer',              icon: 'solar:alarm-linear', onClick: () => bulkApply('deferred') },
          ]}
        />
      )}
    </Drawer>
  );
}

// Section wrapper — collapsible header + content area
function IcdSection({ title, count, open, onToggle, badge, children }) {
  return (
    <section className={styles.icdSection}>
      <button type="button" className={styles.icdSectionHeader} onClick={onToggle}>
        <span className={styles.icdSectionTitle}>
          {title} ({count})
        </span>
        {badge}
        <Icon
          name={open ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
          size={12}
          color="var(--neutral-300)"
        />
      </button>
      {open && (
        <div className={styles.icdSectionBody}>
          {children}
        </div>
      )}
    </section>
  );
}

function SectionEmpty({ label }) {
  return <div className={styles.icdSectionEmpty}>{label}</div>;
}
