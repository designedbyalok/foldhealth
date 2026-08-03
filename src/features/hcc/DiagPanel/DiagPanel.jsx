import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../store/useAppStore';
import { toast } from '../../../components/Toast/Toast';
import { Drawer } from '../../../components/Drawer/Drawer';
import { BulkBar } from '../../../components/BulkBar/BulkBar';
import { Icon } from '../../../components/Icon/Icon';
import { CloseIcon } from '../../../components/Icon/CloseIcon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { PatientBanner } from '../../../components/PatientBanner/PatientBanner';
import { Switch } from '../../../components/Switch/Switch';
import { Badge } from '../../../components/Badge/Badge';
import { dosSourceLetter } from '../dosSource';
import { IcdRow } from './IcdRow';
import { IcdDosCard } from './IcdDosCard';
import { SuspectCard } from './HccSuspectGroup';
import { DosStatusMenu } from './DosStatusMenu';
import { LeftWorkspace } from './LeftWorkspace';
import { IcdCard, makeCard, DOS_CUSTOM } from './IcdCard';
import { IcdSearch } from '../../../components/IcdSearch/IcdSearch';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { POS_BY_VT, PROVIDER_POOL_BY_VT, VISIT_TYPES } from '../reference/visitTypes';
import { DOC_TYPES } from '../data/chartDocs';
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
import { getChartDocs } from '../data/chartDocs';
import { COMMENTS as COMMENTS_MOCK } from '../data/ancillary';
import { getIcdsForMember, getNotLinkedForMember } from '../data/icds';
import { RoleTooltip } from '../RoleTooltip';
import { resolveCurrentAssignee } from '../HccWorklistRow';
import { slaOutcome } from '../sla';
import { RoleAssigneePicker } from '../RoleAssigneePicker';
import { ROLE_LABEL } from '../assignment/astranaStaff';
import { dosKey } from '../assignment/dosState';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from '../../../components/ConfirmDialog/AlertDialogPrimitives';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Button } from '../../../components/Button/Button';
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

function AssigneeAvatar({ member, dosState, currentDos, locked = false }) {
  const a = resolveCurrentAssignee(member, dosState);
  if (!a) return null;
  // Unassigned slot is interactive — opens a candidate picker so the user
  // can assign someone from this exact spot. Lives in its own subcomponent
  // because of the portal + outside-click bookkeeping. When the record is
  // rejected the slot renders as a plain dashed placeholder (no picker) so
  // ownership can't be reshuffled once the audit trail is closed.
  if (a.kind === 'unassigned') {
    if (locked) {
      return (
        <span
          title="Rejected — assignee is locked"
          style={{
            width: 24, height: 24, borderRadius: 6,
            border: '1px dashed var(--neutral-200)',
            background: 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--neutral-200)',
          }}
        >
          <Icon name="solar:user-plus-linear" size={12} color="var(--neutral-200)" />
        </span>
      );
    }
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
  // can change owner. Clicking opens the shared searchable picker. Once the
  // record is Rejected we drop the picker and render a plain, non-interactive
  // chip; hover still shows the RoleTooltip so it's clear who owns the row.
  if (locked) {
    return (
      <RoleTooltip
        name={a.name}
        role={ROLE_LABEL[a.role] || a.role}
        initials={a.initials}
        variant="provider"
      >
        <span
          title={`${a.name} — assignee locked (record Rejected)`}
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'var(--secondary-100)', border: '0.5px solid var(--secondary-200)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 10, fontWeight: 500, color: 'var(--secondary-300)',
            cursor: 'default', padding: 0,
          }}
        >
          {a.initials}
        </span>
      </RoleTooltip>
    );
  }
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

export function DiagPanel() {
  const memberId = useAppStore(s => s.diagPanelMemberId);
  const closeDiagPanel = useAppStore(s => s.closeDiagPanel);
  const openDiagPanel = useAppStore(s => s.openDiagPanel);
  const member = useAppStore(s => s.hccMembers.find(m => m.id === memberId));
  // Notice payload set by addHccGapNewRow when a New Diagnosis Gap saved
  // with a brand-new DOS spawned a duplicate worklist row for this patient.
  const newRowNotice = useAppStore(s => s.hccNewRowNotice?.[memberId]);
  const dismissNewRowNotice = useAppStore(s => s.dismissNewRowNotice);
  // Gaps added to this row via addHccGapNewRow / addHccGapToRow. Kept
  // separate from hccDiagnosisGaps so drawer-open refetches don't wipe them
  // and so they don't leak into sibling rows that share member_name.
  const spawnedGaps = useAppStore(s => s.hccSpawnedGaps?.[memberId]);
  const showToast = useAppStore(s => s.showToast);
  const hccMembers = useAppStore(s => s.hccMembers);
  const addHccGap = useAppStore(s => s.addHccGap);
  const addHccGapNewRow = useAppStore(s => s.addHccGapNewRow);
  const addHccGapToRow = useAppStore(s => s.addHccGapToRow);
  const fetchHccDiagnosisGaps = useAppStore(s => s.fetchHccDiagnosisGaps);
  const diagnosisGaps = useAppStore(s => s.hccDiagnosisGaps);
  const diagnosisGapsLoading = useAppStore(s => s.hccDiagnosisGapsLoading);
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
  // Inline + ICD flow (right-side toolbar). Clicking + ICD flips the
  // toolbar into search mode — the `Search by code…` input is swapped for
  // an <IcdSearch> autocomplete and the + ICD button hides so the search
  // reclaims its space. Picking an ICD prepends a gap card to the
  // associated-ICDs list where the user completes it. LHS stays free for
  // the document workspace so users can review evidence while adding.
  const [addIcdMode, setAddIcdMode] = useState(false);
  const [pendingGaps, setPendingGaps] = useState([]);
  // RHS width (px) when the LHS document workspace is open. `null` = default
  // 50/50 split (both panes flex:1). Users can drag the divider between the
  // panes to give the LHS more room for viewing documents; the RHS is
  // clamped to [MIN_RHS_PX, 50% of contentRow] so it never eats the LHS or
  // collapses past the point where its own controls stop being usable.
  const [rhsWidth, setRhsWidth] = useState(null);
  const contentRowRef = useRef(null);
  const MIN_RHS_PX = 380;
  const startResize = useCallback((e) => {
    e.preventDefault();
    const row = contentRowRef.current;
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    // Pointer capture pins the pointer stream to the handle for the drag's
    // whole life — it survives the pointer leaving the browser window,
    // focus loss, and other cases where a plain window-scoped mouseup can
    // silently misfire. Without this the mousemove listener would leak
    // after the first drag and every subsequent hover would resize the
    // pane before the user could grab the handle again.
    const handle = e.currentTarget;
    const { pointerId } = e;
    try { handle.setPointerCapture(pointerId); } catch { /* ignore */ }

    const maxWidth = Math.floor(rowRect.width * 0.5);
    const onMove = (moveEvt) => {
      if (moveEvt.pointerId !== pointerId) return;
      const rawWidth = rowRect.right - moveEvt.clientX;
      const clamped = Math.max(MIN_RHS_PX, Math.min(rawWidth, maxWidth));
      setRhsWidth(clamped);
    };
    const onUp = (upEvt) => {
      if (upEvt.pointerId !== pointerId) return;
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      try { handle.releasePointerCapture(pointerId); } catch { /* ignore */ }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }, []);
  const updatePendingGap = useCallback((idx, patch) => {
    setPendingGaps(prev => prev.map((c, i) => i === idx
      ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch) }
      : c));
  }, []);
  const removePendingGap = useCallback((idx) => {
    setPendingGaps(prev => prev.filter((_, i) => i !== idx));
  }, []);
  const exitAddIcdMode = useCallback(() => setAddIcdMode(false), []);
  // Toolbar overflow menu — surfaces the actions currently hidden by the
  // container-query collapse (Documents / Comments / Timeline). Click-outside
  // closes the dropdown; individual items are still routed to the same
  // handlers as their toolbar-icon counterparts.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef(null);
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDocDown = (e) => {
      if (moreWrapRef.current && !moreWrapRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [moreOpen]);
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
  // Status transitions that require the acting user to leave a comment
  // (currently just Coder → Record Requested). `pendingStatusChange`
  // holds the deferred transition until the dialog resolves.
  const [pendingStatusChange, setPendingStatusChange] = useState(null); // { from, to }
  const addHccDiagComment = useAppStore(s => s.addHccDiagComment);
  const addActivityEntry = useAppStore(s => s.addActivityEntry);
  const setHccRejectInfo = useAppStore(s => s.setHccRejectInfo);
  const hccRejectInfoMap = useAppStore(s => s.hccRejectInfo);
  // Filter row (Figma 9810:158181) — toggled by the toolbar Filter button.
  // `filters` is a keyed object; the shared `icdMatchesFilters` predicate
  // applies the same rules across every ICD bucket below.
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const filterCount = activeFilterCount(filters);
  // -1 = no DOS highlighted; a row lights up only once an ICD is selected,
  // acted on, or reached via the keyboard.
  const [focusIdx, setFocusIdx] = useState(-1);

  // Selection ↔ left-panel binding. Closing the panel drops the current
  // ICD/DOS highlight so no card stays "selected" without context; picking
  // a card while the panel is closed opens it to Documents so the preview
  // and selection stay in sync.
  useEffect(() => {
    if (!diagLeftPanel && focusIdx !== -1) setFocusIdx(-1);
  }, [diagLeftPanel, focusIdx]);
  useEffect(() => {
    if (focusIdx >= 0 && !diagLeftPanel) setDiagLeftPanel('documents');
  }, [focusIdx, diagLeftPanel, setDiagLeftPanel]);

  // Fetch diagnosis gaps from Supabase when member changes
  useEffect(() => {
    if (member?.name) fetchHccDiagnosisGaps(member.id, member.name);
  }, [member?.id, member?.name, fetchHccDiagnosisGaps]);

  // Phase 2f — fall back to the local ICD mock when Supabase has no rows for
  // this member. Without the fallback, the panel would render empty for any
  // member that hasn't been seeded into `hcc_diagnosis_gaps` yet.
  // Spawned rows (created client-side via addHccGapNewRow) never fall back
  // to the mock — they'd inherit their source patient's mock ICDs, which
  // is wrong. They DO still use DB gaps (member_id-scoped) plus the
  // session-level spawnedGaps buffer to cover the persist→refetch race.
  const icdsRaw = useMemo(() => {
    const spawned = (spawnedGaps || []).filter(g => g.isLinked !== false);
    const fromSupabase = diagnosisGaps.filter(g => g.isLinked !== false);
    // Dedupe by code — the session buffer and the DB fetch can both carry
    // the same gap once the persist round-trips.
    const merged = [...fromSupabase];
    const seen = new Set(fromSupabase.map(g => g.code));
    for (const g of spawned) if (!seen.has(g.code)) merged.push(g);
    if (member?.isSpawned) return merged;
    if (merged.length > 0) return merged;
    const fromMock = member?.name ? getIcdsForMember(member.name) : [];
    return [...fromMock, ...spawned];
  }, [diagnosisGaps, member?.name, member?.isSpawned, spawnedGaps]);

  const notLinkedRaw = useMemo(() => {
    const spawned = (spawnedGaps || []).filter(g => g.isLinked === false);
    const fromSupabase = diagnosisGaps.filter(g => g.isLinked === false);
    const merged = [...fromSupabase];
    const seen = new Set(fromSupabase.map(g => g.code));
    for (const g of spawned) if (!seen.has(g.code)) merged.push(g);
    if (member?.isSpawned) return merged;
    if (merged.length > 0) return merged;
    const fromMock = member?.name ? getNotLinkedForMember(member.name) : [];
    return [...fromMock, ...spawned];
  }, [diagnosisGaps, member?.name, member?.isSpawned, spawnedGaps]);

  // Buckets (see docs/features/hcc-coding-workflow.md §4):
  //  - assocICDs → the ICD-first cards ("ICDs Associated with N/M DOSs").
  //  - allNotAssoc → AI suspects grouped per HCC (HccSuspectGroup).
  //  - overridden / closed → collapsed sections at the bottom.
  // Filter chips apply the same predicate to every bucket so a chip picked
  // in the toolbar affects the whole panel view (Figma 9810:158181).
  const matchesFilters = useCallback(
    (icd) => icdMatchesFilters(icd, filters, member),
    [filters, member],
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
  // Claim-sourced DOS rows link to the ClaimsTab detail view via this action.
  const openHccClaimForDos = useAppStore(s => s.openHccClaimForDos);
  // Chart-doc count for the Documents toolbar button — mirrors what the
  // Documents tab actually renders (getChartDocs applies added / removed
  // filters), so the badge tracks reality instead of a stale mock field.
  const hccAddedCharts = useAppStore(s => s.hccAddedCharts[member?.id]);
  const hccChartStatus = useAppStore(s => s.hccChartStatus[member?.id]);
  const hccRemovedCharts = useAppStore(s => s.hccRemovedCharts[member?.id]);
  const chartsList = useMemo(() => {
    if (!member) return [];
    return getChartDocs(member, hccAddedCharts || [], hccChartStatus || {}, hccRemovedCharts || []);
  }, [member, hccAddedCharts, hccChartStatus, hccRemovedCharts]);
  const docsCount = chartsList.length;

  // Options for pending IcdCard(s) rendered inline in the associated-ICDs
  // list when the toolbar is in `addIcdMode`. Same shape as
  // NewDiagGapPanel's derivations so the shared IcdCard component agrees.
  const memberDosList = useMemo(
    () => (member?.dos_list || []).filter(d => d?.date),
    [member?.dos_list],
  );
  const siblingRows = useMemo(() => {
    if (!member) return [];
    return hccMembers.filter(m =>
      m.id !== member.id
      && ((member.memberId && m.memberId === member.memberId) || m.name === member.name)
    );
  }, [hccMembers, member]);
  const gapDosOptions = useMemo(() => {
    const opts = [];
    if (memberDosList.length > 0) {
      opts.push({ type: 'header', value: 'hdr-current', label: `This row (Created ${member?.date || '—'})` });
      for (const d of memberDosList) {
        opts.push({ value: d.date, label: d.date, memberId: member?.id });
      }
    }
    for (const sib of siblingRows) {
      const sibDosList = (sib.dos_list || []).filter(d => d?.date);
      if (sibDosList.length === 0) continue;
      opts.push({ type: 'header', value: `hdr-${sib.id}`, label: `Created ${sib.date || '—'}` });
      for (const d of sibDosList) {
        opts.push({
          value: `${sib.id}::${d.date}`,
          label: d.date,
          memberId: sib.id,
          dosDate: d.date,
        });
      }
    }
    opts.push({ value: DOS_CUSTOM, label: '+ Add New DOS' });
    return opts;
  }, [memberDosList, siblingRows, member?.id, member?.date]);
  const gapProviderAll = useMemo(
    () => [...new Set(Object.values(PROVIDER_POOL_BY_VT).flat())].map(n => ({ value: n, label: n })),
    [],
  );
  const gapPosOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of Object.values(POS_BY_VT)) {
      if (seen.has(p.code)) continue;
      seen.add(p.code);
      out.push({ value: p.code, label: `${p.code} — ${p.desc}` });
    }
    return out;
  }, []);
  const gapVtOptions = useMemo(() => VISIT_TYPES.map(vt => ({ value: vt, label: vt })), []);
  const gapDocTypeOptions = useMemo(() => DOC_TYPES.map(t => ({ value: t, label: t })), []);
  const gapExcludeCodes = useMemo(
    () => pendingGaps.map(c => c.pick?.code).filter(Boolean),
    [pendingGaps],
  );

  const savePendingGap = useCallback((idx) => {
    const c = pendingGaps[idx];
    if (!c || !c.dosList?.length) return;
    let existingCount = 0;
    let siblingCount = 0;
    let newRowCount = 0;
    // Iterate every selected DOS and route each to the right store action.
    // The form's Provider/POS/VT/DocType are shared across all DOSs on
    // this card (the user picked them once); each save call gets them.
    for (const entry of c.dosList) {
      if (entry.mode === 'existing') {
        addHccGap({
          code: c.pick.code,
          desc: c.pick.title,
          hcc: c.pick.hcc || '',
          dos: entry.dosDate,
          provider: c.provider,
          pos: c.pos,
          docType: c.docType,
          linkedDocIds: [...c.linkedDocIds],
        });
        existingCount += 1;
      } else if (entry.mode === 'sibling' && entry.memberId) {
        addHccGapToRow({
          sourceMemberId: member?.id,
          targetMemberId: entry.memberId,
          code: c.pick.code,
          desc: c.pick.title,
          hcc: c.pick.hcc || '',
          dos: entry.dosDate,
          provider: c.provider,
          pos: c.pos,
          visitType: c.visitType,
        });
        siblingCount += 1;
      } else {
        const newId = addHccGapNewRow({
          sourceMemberId: member?.id,
          code: c.pick.code,
          desc: c.pick.title,
          hcc: c.pick.hcc || '',
          dos: entry.dosDate,
          provider: c.provider,
          pos: c.pos,
          visitType: c.visitType,
        });
        if (newId) newRowCount += 1;
      }
    }
    const parts = [];
    if (existingCount) parts.push(`${existingCount} to current row`);
    if (siblingCount) parts.push(`${siblingCount} to sibling row${siblingCount === 1 ? '' : 's'}`);
    if (newRowCount) parts.push(`${newRowCount} new row${newRowCount === 1 ? '' : 's'} spawned`);
    showToast(`Added ${c.pick.code} — ${parts.join(' · ')}`);
    removePendingGap(idx);
    // Once an ICD is saved, drop the toolbar back to its default state so
    // the search field reverts to filtering the ICD list. Users who want to
    // add another ICD click + ICD again.
    setAddIcdMode(false);
  }, [pendingGaps, member?.id, addHccGap, addHccGapNewRow, addHccGapToRow, showToast, removePendingGap]);
  // Comments count for the toolbar chip — mirrors what the Comments tab
  // renders (Supabase-hydrated rows when present, mock fallback otherwise).
  const dbComments = useAppStore(s => s.hccDiagComments);
  const commentsCount = dbComments.length || COMMENTS_MOCK.length;
  const setDiagOpenDocId = useAppStore(s => s.setDiagOpenDocId);
  const diagOpenDocId = useAppStore(s => s.diagOpenDocId);
  // Toolbar Documents click: open the preview (first doc) rather than the list.
  // Clicking again while it's open closes the panel.
  const openDocsFromToolbar = useCallback(() => {
    const alreadyOpen = diagLeftPanel === 'documents' && !diagActivityIcd;
    if (alreadyOpen) {
      setDiagLeftPanel(null);
      return;
    }
    setDiagLeftPanel('documents');
    if (chartsList.length) setDiagOpenDocId(chartsList[0].id);
  }, [diagLeftPanel, diagActivityIcd, chartsList, setDiagLeftPanel, setDiagOpenDocId]);
  // DOS-row click: open the doc that matches this DOS date (system docs seed
  // `dateAdded` from the member's DOS). Falls back to the first doc if no
  // match — never leaves the user on an empty list.
  const openDocsForDos = useCallback((dos) => {
    if (!chartsList.length) return;
    const match = chartsList.find(c => c.dateAdded === dos) || chartsList[0];
    setDiagLeftPanel('documents');
    setDiagOpenDocId(match.id);
  }, [chartsList, setDiagLeftPanel, setDiagOpenDocId]);
  const actingStatus = useMemo(() => {
    const rs = dosState?.[actingRole];
    return rs?.status || diagDosStatus || 'New';
  }, [dosState, actingRole, diagDosStatus]);

  // Coder is locked until Support marks the record Completed — coders
  // shouldn't accept / dismiss / mark missed / defer while the underlying
  // docs are still under Support review. Support-blocked states
  // (Insufficient / Reject / Rejected) are a subset of "not Completed"
  // and stay locked too.
  //
  // QA and Compliance are reviewers of the Coder's work — they take ICD
  // actions independently and are not gated by Support/Coder completion.
  const stageLocked = useMemo(() => {
    if (actingRole !== 'coder') return false;
    const supStatus = dosState?.support?.status || member?.supS;
    return supStatus !== 'Completed';
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

  // Hover + click-pin state for the Review Progress popover. Click toggles
  // "pinned" — while pinned, hover-leave and popover blur are ignored; only
  // a click on the pill or outside the popover dismisses.
  const pillRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const [pillRect, setPillRect] = useState(null);
  const [pillPinned, setPillPinned] = useState(false);
  const onPillEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (pillRect) return;
    openTimer.current = setTimeout(() => {
      const r = pillRef.current?.getBoundingClientRect();
      if (r) setPillRect(r);
    }, 80);
  };
  const onPillLeave = () => {
    if (pillPinned) return;
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setPillRect(null), 200);
  };
  const onPillClick = (e) => {
    e.stopPropagation();
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (pillPinned) {
      setPillPinned(false); setPillRect(null);
    } else {
      const r = pillRef.current?.getBoundingClientRect();
      if (r) { setPillRect(r); setPillPinned(true); }
    }
  };
  useEffect(() => {
    if (!pillPinned) return undefined;
    const onDoc = (e) => {
      if (pillRef.current?.contains(e.target)) return;
      if (e.target.closest?.('[role="tooltip"][aria-label="Review progress"]')) return;
      setPillPinned(false); setPillRect(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setPillPinned(false); setPillRect(null); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pillPinned]);
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const requestClose = () => {
    if (pillPinned) return;
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
  // Runs the transition after any gating dialogs have resolved. Split out
  // so the "Record Requested" flow can pause on the status-change comment
  // dialog and resume from its onConfirm handler.
  const applyStatusChange = (next) => {
    if (!member || !currentDos) { setDiagDosStatus(next); return; }
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

  // Public entry point wired to DosStatusMenu. Some transitions require a
  // mandatory comment before they're allowed (Coder → Record Requested).
  // For those we defer the transition, open the Comments panel, and let
  // the coder author the explanation inline in CommentsTab — matching the
  // Figma pattern of a card in the comment stream rather than a modal.
  const handleStatusChange = (next) => {
    if (next === 'Reject' || next === 'Rejected') {
      // Reject requires a reason + a mandatory comment for every role —
      // open the confirmation modal instead of applying immediately.
      setRejectPrompt({});
      return;
    }
    const requiresComment =
      actingRole === 'coder' && next === 'Record Requested';
    if (requiresComment) {
      setPendingStatusChange({ from: actingStatus || 'New', to: next });
      setDiagLeftPanel('comments');
      return;
    }
    applyStatusChange(next);
  };
  const [rejectPrompt, setRejectPrompt] = useState(null);
  // Confirming the Reject dialog: apply the status through the engine +
  // stamp the reasons and note onto the activity feed / comment stream so
  // downstream reviewers see exactly why the record was rejected.
  const confirmReject = ({ reasons, note }) => {
    setRejectPrompt(null);
    // Defer the store writes past the dialog-unmount microtask so Radix's
    // focus-trap teardown finishes before the tree re-renders under a new
    // `isDosRejected` value — otherwise the focus scope collides with the
    // re-render cascade and the drawer wedges.
    setTimeout(() => {
      applyStatusChange('Reject');
      const reasonText = (reasons || []).join(', ');
      const combined = reasonText ? `${reasonText} — ${note}` : note;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
      const hours = now.getHours();
      const time = `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
      const userRole = useAppStore.getState().hccUserRole || ROLE_LABEL[actingRole] || 'Coder';
      if (dosStateKey) {
        setHccRejectInfo?.(dosStateKey, {
          by: 'You',
          role: userRole,
          date, time,
          reasons: reasons || [],
          note: note || '',
        });
      }
      addHccDiagComment?.({
        id: `c${Date.now()}`,
        author: 'You', role: userRole, date, time, edited: false,
        body: `Rejected: ${combined}`,
        icd: null, dos: currentDos || null,
      });
      addActivityEntry?.({
        t: 'doc-status', by: 'You', role: userRole,
        headline: 'Rejected the record',
        details: [{ note: combined }],
      });
    }, 0);
  };
  const rejectInfo = dosStateKey ? hccRejectInfoMap?.[dosStateKey] : null;
  // Once any role has flagged the DOS Rejected the record is terminal —
  // every ICD-level action (Accept / Dismiss / More / Suspect DOS pickers)
  // freezes across roles, only the Comments composer stays live. Assignee
  // reassignment is also blocked so the audit trail stays intact.
  const isDosRejected = (() => {
    const s = dosState || {};
    return ['support', 'coder', 'reviewer', 'reviewer2'].some(
      r => s[r]?.status === 'Reject' || s[r]?.status === 'Rejected',
    );
  })();
  // Human-readable "Rejected by X (role) on <date>" — used as the tooltip
  // on locked ICD action buttons so they explain the actual cause (a
  // rejection upstream) instead of the generic "Support hasn't reviewed
  // the documents yet". Same fallback chain as the reject banner below.
  const rejectionLockReason = useMemo(() => {
    if (!isDosRejected) return null;
    const ROLE_LABEL_R = { support: 'Support Team', coder: 'Coder', reviewer: 'QA', reviewer2: 'Compliance' };
    const rejectingRole = ['support', 'coder', 'reviewer', 'reviewer2']
      .find(r => (dosState?.[r]?.status === 'Reject' || dosState?.[r]?.status === 'Rejected'));
    const roleRecord = rejectingRole ? dosState?.[rejectingRole] : null;
    const nameField = { support: 'sup', coder: 'cdr', reviewer: 'r1', reviewer2: 'r2' }[rejectingRole];
    const by = rejectInfo?.by || roleRecord?.by || (nameField ? member?.[nameField] : null);
    const roleLabel = rejectInfo?.role || ROLE_LABEL_R[rejectingRole] || '';
    const stamp = rejectInfo?.date
      ? `${rejectInfo.date}${rejectInfo.time ? ` · ${rejectInfo.time}` : ''}`
      : (roleRecord?.at
          ? new Date(roleRecord.at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
          : null);
    if (by) {
      return `Record rejected by ${by}${roleLabel ? ` (${roleLabel})` : ''}${stamp ? ` on ${stamp}` : ''}. All ICD actions are locked.`;
    }
    return roleLabel
      ? `Record rejected by ${roleLabel}. All ICD actions are locked.`
      : 'Record has been rejected. All ICD actions are locked.';
  }, [isDosRejected, dosState, rejectInfo, member]);

  // Finalize the Record-Requested transition: writes the mandatory
  // comment (tagged with the from/to statuses so the Comments tab and
  // Activity Log can render the pair together), then applies the status.
  const confirmPendingStatusChange = (body) => {
    if (!pendingStatusChange || !member) return;
    const { from, to } = pendingStatusChange;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const hours = now.getHours();
    const time = `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
    const userRole = useAppStore.getState().hccUserRole || 'Coder';
    addHccDiagComment({
      id: `c${Date.now()}`,
      author: 'You',
      role: userRole,
      date,
      time,
      edited: false,
      body,
      icd: null,
      dos: currentDos || null,
      statusFrom: from,
      statusTo: to,
    });
    setPendingStatusChange(null);
    applyStatusChange(to);
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
  // Keyboard nav includes acted Suspect / Recapture rows so A / X / M / D
  // + arrow keys can walk through them the same way they do the primary
  // ICDs. Un-acted suspects still live under the "Suspects and Recaptures"
  // header and require a DOS pick in their own picker — they're not part
  // of the row-walk model.
  const rowKeys = useMemo(
    () => [
      ...cardIcds.flatMap(c => c.entries.map(e => `${c.code}|${e.dos}`)),
      ...actedSuspects.flatMap(c => (c.entries || []).map(e => `${c.code}|${e.dos}`)),
    ],
    [cardIcds, actedSuspects],
  );
  const focusKey = rowKeys[Math.min(focusIdx, rowKeys.length - 1)] || null;
  // Click-to-focus for DOS rows — clicking a row makes it the keyboard
  // target for A/X/M/D shortcuts, matching what arrow keys already do.
  const handleFocusRow = useCallback((rowKey) => {
    const idx = rowKeys.indexOf(rowKey);
    if (idx >= 0) setFocusIdx(idx);
    // Also open the source document that maps to this DOS in the left preview.
    const dos = rowKey.split('|')[1];
    if (dos) openDocsForDos(dos);
  }, [rowKeys, openDocsForDos]);
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
        // Support can't code ICDs — surface an error toast so the shortcut
        // isn't silently swallowed. Applies to every ICD-coding shortcut:
        // A / X / M / D. Matches the tooltip on the disabled action buttons.
        if (useAppStore.getState().hccUserRole === 'Support') {
          e.preventDefault();
          toast.error('Support role cannot code ICDs');
          return;
        }
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

  // Auto-Complete the current role's DOS status once every ICD row on that
  // DOS has been addressed (accepted / dismissed / missed / deferred). Mirror
  // of _maybeAutoBumpInProgress: same role gate (Coder / QA / Compliance —
  // Support doesn't code), only fires while the DOS is 'In Progress' so a
  // manual override (Record Requested / Rejected / Skipped) stays put.
  useEffect(() => {
    if (!member?.id || !rowKeys.length) return;
    if (actingRole === 'support') return;
    // Group rowKeys by DOS.
    const byDos = new Map();
    for (const k of rowKeys) {
      const [, dos] = k.split('|');
      if (!byDos.has(dos)) byDos.set(dos, []);
      byDos.get(dos).push(k);
    }
    for (const [dos, keys] of byDos) {
      if (!keys.every(k => hccGapDosActions[k])) continue;
      const dosEntry = (member.dos_list || []).find(d => d.date === dos);
      const stateKey = dosKey(member.id, dos, dosEntry?.provider, dosEntry?.pos);
      const curStatus = hccDosAssignments[stateKey]?.[actingRole]?.status;
      if (curStatus === 'In Progress') {
        hccSetRoleStatus(member.id, dos, actingRole, 'Completed');
      }
    }
  }, [rowKeys, hccGapDosActions, hccDosAssignments, member, actingRole, hccSetRoleStatus]);

  // ── Bulk selection (row checkboxes → bulk Accept / Reject bar) ──
  const toggleSelected = (key) => setSelectedKeys(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  // Tri-state select-all for the "ICDs Associated with" section — reflects
  // how many of the visible rowKeys are currently selected. Clicking the
  // header checkbox toggles: nothing/some → select all; all → clear.
  const associatedSelectState = useMemo(() => {
    if (rowKeys.length === 0) return 'unchecked';
    let count = 0;
    for (const k of rowKeys) if (selectedKeys.has(k)) count += 1;
    if (count === 0) return 'unchecked';
    if (count === rowKeys.length) return 'checked';
    return 'indeterminate';
  }, [rowKeys, selectedKeys]);
  const toggleSelectAllAssociated = useCallback(() => {
    setSelectedKeys(prev => {
      if (rowKeys.every(k => prev.has(k))) {
        // All selected → clear only the associated keys (leave any others
        // untouched — defensive; today rowKeys covers the whole section).
        const next = new Set(prev);
        for (const k of rowKeys) next.delete(k);
        return next;
      }
      // None or some selected → select every associated key.
      const next = new Set(prev);
      for (const k of rowKeys) next.add(k);
      return next;
    });
  }, [rowKeys]);
  const bulkApply = (action) => {
    selectedKeys.forEach(k => {
      const [code, dos] = k.split('|');
      // Skip toggling rows already in the target state.
      if (hccGapDosActions[k] !== action) setHccGapDosAction(code, dos, action);
    });
    const verb = { accepted: 'accepted', rejected: 'dismissed', missed: 'marked missed', deferred: 'deferred' }[action] || action;
    showToast(`${selectedKeys.size} row${selectedKeys.size === 1 ? '' : 's'} ${verb}`);
    setSelectedKeys(new Set());
  };
  // Bulk-undo — clears the DOS action for every selected row that has one
  // (accepted / dismissed / missed / deferred → undecided). Rows already in
  // the undecided state are skipped so we don't fire needless persistence.
  const bulkUndo = () => {
    let count = 0;
    selectedKeys.forEach(k => {
      if (hccGapDosActions[k]) {
        const [code, dos] = k.split('|');
        setHccGapDosAction(code, dos, null);
        count += 1;
      }
    });
    if (count > 0) {
      showToast(`${count} row${count === 1 ? '' : 's'} reverted to undecided`);
    } else {
      showToast('No rows to undo — none had a decision');
    }
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
    >
      {/* ── Row 1: Title + Close — spans the FULL drawer width. ── */}
      <div className={styles.titleRow}>
        <span className={styles.titleText}>Diagnosis Gaps Details</span>
        <ActionButton size="L" tooltip="Close" onClick={closeDiagPanel}>
          <CloseIcon size={20} color="var(--neutral-300)" />
        </ActionButton>
      </div>

      <div className={styles.contentRow} ref={contentRowRef}>
      {/* Workspace (document preview etc.) sits on the LEFT of the ICD
          listing (Paper 1UD1 / 5IX) — rendered first so it's the left pane.
          The Add-ICD flow now lives entirely on the RHS (via addIcdMode +
          pendingGaps in the toolbar/cardsList), so the LHS stays free for
          the document workspace users need while coding. */}
      {diagLeftPanel && (
        <>
          <LeftWorkspace
            active={diagLeftPanel}
            icdScope={diagActivityIcd ? (activeIcdCode ?? diagActivityIcd) : null}
            onChange={setDiagTab}
            onClose={() => { setFocusIdx(-1); setDiagLeftPanel(null); }}
            member={member}
            pendingStatusChange={pendingStatusChange}
            onConfirmStatusChange={confirmPendingStatusChange}
            onCancelStatusChange={() => setPendingStatusChange(null)}
          />
          {/* Draggable divider — lets users grow the LHS document viewer
              by shrinking the RHS. Clamped in startResize to
              [MIN_RHS_PX, 50% of contentRow]. */}
          <div
            className={styles.resizeHandle}
            onPointerDown={startResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize document workspace"
          />
        </>
      )}
      <div
        className={diagLeftPanel ? styles.rightPane : styles.rightPaneFull}
        style={diagLeftPanel && rhsWidth != null ? { flex: `0 0 ${rhsWidth}px` } : undefined}
      >
      {/* ── Row 2: Patient Banner (shared component) ── */}
      <PatientBanner
        initials={member.in}
        name={member.name}
        gender={member.g === 'M' ? 'Male' : member.g === 'F' ? 'Female' : member.g}
        age={member.age || ''}
        dob={member.dob}
        memberId={member.memberId || `#${member.id}`}
        raf={member.raf}
        rafChange={rafImpact}
        rafUp={member.ru !== false}
        onCall={noop('Call')}
      />

      {/* ── Meta row: Created date + overdue + stage pill | assignee + status ── */}
      <div className={styles.dosRow}>
        <div className={styles.dosRowLeft}>
          <span className={[styles.createdLabel, styles.hideBelow540].join(' ')}>Created :</span>
          <span className={styles.createdDate}>{member.date || '—'}</span>
          {slaVerdict ? (
            <span className={[styles.dueTag, styles.hideBelow460].join(' ')} style={{ color: slaVerdict.colorVar }}>
              <Icon name={slaVerdict.icon} size={12} color={slaVerdict.colorVar} /> {slaVerdict.label}
            </span>
          ) : member.due && (
            <span className={[styles.dueTag, styles.hideBelow460].join(' ')} style={{ color: member.dueCol || 'var(--status-error)' }}>
              ({member.due})
            </span>
          )}
          <span className={[styles.dosRowDivider, styles.hideBelow540].join(' ')} />
          {/* Stage pill — hover opens the Review Progress popover; the ring
              is a real progress indicator driven by the engine state. */}
          <span
            ref={pillRef}
            className={styles.withCoderPill}
            onMouseEnter={onPillEnter}
            onMouseLeave={onPillLeave}
            onClick={onPillClick}
            role="button"
            tabIndex={0}
            aria-label={`${pillLabel} — review ${Math.round(reviewProgress * 100)}% complete. Hover or click for details.`}
            aria-expanded={!!pillRect}
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
              onClose={() => { setPillPinned(false); setPillRect(null); }}
            />
          )}
        </div>
        <div className={styles.dosRowRight}>
          <AssigneeAvatar member={member} dosState={dosState} currentDos={currentDos} locked={isDosRejected} />
          <span className={styles.dosRowDivider} />
          <DosStatusMenu
            value={actingStatus}
            onChange={handleStatusChange}
            role={actingRole}
            disabled={stageLocked || isDosRejected}
            disabledReason={(() => {
              const supStatus = dosState?.support?.status || member?.supS;
              if (isDosRejected) return 'Record was Rejected upstream — no downstream action';
              if (supStatus === 'Insufficient') return 'Support marked the documents Insufficient — nothing to code yet';
              if (supStatus === 'Reject' || supStatus === 'Rejected') return 'Support rejected this DOS — no downstream action';
              return 'Support and Coder must complete their work first';
            })()}
          />
        </div>
      </div>

      {/* ── Toolbar: bulk | inline search | + ICD, filter, docs, comments,
          history, more (Paper 1WXT). In addIcdMode the toolbar collapses
          to a single dedicated search row — all sibling actions hide so
          the user's focus stays on adding an ICD. Exit via the X inside
          the search field. */}
      <div className={styles.toolbar}>
        {addIcdMode ? (
          <div className={styles.toolbarAddIcd}>
            <IcdSearch
              placeholder="Search & Add ICD"
              autoFocus
              excludeCodes={gapExcludeCodes}
              onSelect={(icd) => setPendingGaps(prev => [makeCard(icd), ...prev])}
            />
            <button
              type="button"
              className={styles.toolbarAddIcdClose}
              onClick={exitAddIcdMode}
              aria-label="Close ICD search"
            >
              <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-300)" />
            </button>
          </div>
        ) : (
          <>
            {/* Bulk select is an ICD coding action — Support can't code,
                so hide the entry entirely (matches row-level gating). */}
            {hccUserRole !== 'Support' && (
              <>
                <ActionButton
                  icon={bulkMode ? 'custom:bulk-select-close' : 'custom:bulk-select'}
                  size="S"
                  tooltip={bulkMode ? 'Exit bulk select' : 'Bulk select'}
                  className={bulkMode ? styles.toolbarBtnActive : ''}
                  onClick={toggleBulkMode}
                />
                <span className={styles.divider} />
              </>
            )}
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
              {hccUserRole !== 'Support' && (
                <>
                  <span className={styles.addIcdWrap}>
                    <button
                      type="button"
                      className={styles.addIcdBtn}
                      onClick={() => setAddIcdMode(true)}
                      aria-label="Add ICD"
                    >
                      <Icon
                        name="solar:add-circle-linear"
                        size={16}
                        color="var(--primary-300)"
                      />
                      <span>ICD</span>
                    </button>
                  </span>
                  <span className={styles.divider} />
                </>
              )}
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
                count={String(docsCount)}
                className={[
                  styles.hideBelow460,
                  diagLeftPanel === 'documents' && !diagActivityIcd ? styles.activeIcon : '',
                ].filter(Boolean).join(' ')}
                onClick={openDocsFromToolbar}
              />
              <span className={[styles.divider, styles.hideBelow460].join(' ')} />
              <ActionButton
                icon="solar:chat-round-line-linear"
                size="S"
                tooltip="Comments"
                count={String(commentsCount)}
                className={[
                  styles.hideBelow540,
                  diagLeftPanel === 'comments' && !diagActivityIcd ? styles.activeIcon : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setDiagLeftPanel(diagLeftPanel === 'comments' && !diagActivityIcd ? null : 'comments')}
              />
              <span className={[styles.divider, styles.hideBelow540].join(' ')} />
              <ActionButton
                icon="solar:history-linear"
                size="S"
                tooltip="Timeline"
                className={[
                  styles.hideBelow640,
                  diagLeftPanel === 'activity' && !diagActivityIcd ? styles.activeIcon : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  const closing = diagLeftPanel === 'activity' && !diagActivityIcd;
                  // Deselect the currently-focused ICD so the right-pane ICD
                  // card highlight clears at the same time the left panel
                  // drops out of ICD scope.
                  setFocusIdx(-1);
                  setDiagLeftPanel(closing ? null : 'activity');
                }}
              />
              <span className={[styles.divider, styles.showToolbarMore].join(' ')} />
              <span className={[styles.toolbarMoreWrap, styles.showToolbarMore].join(' ')} ref={moreWrapRef}>
                <ActionButton
                  icon="solar:menu-dots-linear"
                  size="S"
                  tooltip="More"
                  onClick={(e) => { e.stopPropagation(); setMoreOpen(v => !v); }}
                  className={moreOpen ? styles.activeIcon : ''}
                />
                {moreOpen && (
                  <div className={styles.toolbarMoreDropdown} role="menu">
                    <button
                      type="button"
                      className={[styles.toolbarMoreItem, styles.showBelow460].join(' ')}
                      role="menuitem"
                      onClick={() => { setMoreOpen(false); openDocsFromToolbar(); }}
                    >
                      <Icon name="solar:file-text-linear" size={16} color="var(--neutral-400)" />
                      <span>Documents</span>
                      <span className={styles.toolbarMoreItemCount}>{docsCount}</span>
                    </button>
                    <button
                      type="button"
                      className={[styles.toolbarMoreItem, styles.showBelow540].join(' ')}
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        setDiagLeftPanel(diagLeftPanel === 'comments' && !diagActivityIcd ? null : 'comments');
                      }}
                    >
                      <Icon name="solar:chat-round-line-linear" size={16} color="var(--neutral-400)" />
                      <span>Comments</span>
                      <span className={styles.toolbarMoreItemCount}>{commentsCount}</span>
                    </button>
                    <button
                      type="button"
                      className={[styles.toolbarMoreItem, styles.showBelow640].join(' ')}
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        setDiagLeftPanel(diagLeftPanel === 'activity' && !diagActivityIcd ? null : 'activity');
                      }}
                    >
                      <Icon name="solar:history-linear" size={16} color="var(--neutral-400)" />
                      <span>Timeline</span>
                    </button>
                  </div>
                )}
              </span>
            </div>
          </>
        )}
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
        {/* Reject banner takes priority — surfaces terminal-reject context
            above every other cards-list affordance. Falls back on dosState
            role history + role-labelled assignee when no in-session
            rejectInfo exists (persisted rejections). */}
        {isDosRejected && (() => {
          const ROLE_LABEL_R = { support: 'Support Team', coder: 'Coder', reviewer: 'QA', reviewer2: 'Compliance' };
          // Find which role rejected. Preferred: the one whose status is
          // Reject/Rejected. Comes with dosState[role].by / .at fallbacks.
          const rejectingRole = ['support', 'coder', 'reviewer', 'reviewer2']
            .find(r => (dosState?.[r]?.status === 'Reject' || dosState?.[r]?.status === 'Rejected'));
          const roleRecord = rejectingRole ? dosState?.[rejectingRole] : null;
          // Assignee name for the rejecting role from the legacy member fields
          // (sup / cdr / r1 / r2) so we can name a person even when only
          // persisted state is available.
          const nameField = { support: 'sup', coder: 'cdr', reviewer: 'r1', reviewer2: 'r2' }[rejectingRole];
          const fallbackBy = rejectInfo?.by || roleRecord?.by || (nameField ? member?.[nameField] : null);
          const roleLabel = rejectInfo?.role || ROLE_LABEL_R[rejectingRole] || '';
          const reasons = rejectInfo?.reasons || (roleRecord?.reason ? [roleRecord.reason] : []);
          const note = rejectInfo?.note || '';
          const stamp = rejectInfo?.date
            ? `${rejectInfo.date}${rejectInfo.time ? ` · ${rejectInfo.time}` : ''}`
            : null;
          return (
            <div className={styles.rejectBanner} role="status">
              <Icon name="solar:info-circle-bold" size={18} color="var(--status-error)" />
              <div className={styles.rejectBannerText}>
                <div className={styles.rejectBannerTitle}>Record Rejected</div>
                <div className={styles.rejectBannerMeta}>
                  {fallbackBy
                    ? <>Rejected by <strong>{fallbackBy}</strong>{roleLabel ? ` (${roleLabel})` : ''}{stamp ? ` on ${stamp}` : ''}</>
                    : (roleLabel ? `Rejected by ${roleLabel}` : 'This record has been rejected.')}
                </div>
                {(reasons.length > 0 || note) && (
                  <div className={styles.rejectBannerBody}>
                    {reasons.length > 0 && (
                      <div className={styles.rejectBannerReasons}>
                        <span className={styles.rejectBannerLabel}>Reason:</span>
                        {reasons.map(r => (
                          <span key={r} className={styles.rejectBannerReason}>{r}</span>
                        ))}
                      </div>
                    )}
                    {note && (
                      <div className={styles.rejectBannerNote}>
                        <span className={styles.rejectBannerLabel}>Note:</span> {note}
                      </div>
                    )}
                  </div>
                )}
                <div className={styles.rejectBannerHint}>
                  All ICD actions are locked. You can still add a Comment.
                </div>
              </div>
            </div>
          );
        })()}

        {/* New-DOS-row alert: the last save either spawned a fresh worklist
            row (DOS didn't exist for this patient) or routed the ICD to a
            sibling row. Sits directly below the toolbar (at the same
            vertical level as pending gap cards) so it's next to the flow
            that created it. Clicking navigates to the new row. */}
        {newRowNotice && (
          <div className={styles.newRowBadge} role="status">
            <Icon name="solar:info-circle-linear" size={16} color="var(--primary-300)" />
            <span className={styles.newRowBadgeText}>
              {newRowNotice.kind === 'existing-row'
                ? <>ICD added to sibling row (Created <strong>{newRowNotice.createdDate}</strong>) for DOS <strong>{newRowNotice.dos}</strong></>
                : <>New worklist row created for DOS <strong>{newRowNotice.dos}</strong></>}
            </span>
            <button
              type="button"
              className={styles.newRowBadgeLink}
              onClick={() => {
                const { newMemberId } = newRowNotice;
                dismissNewRowNotice(memberId);
                openDiagPanel(newMemberId);
              }}
            >
              View row
              <Icon name="solar:arrow-right-linear" size={12} color="currentColor" />
            </button>
            <ActionButton
              size="S"
              tooltip="Dismiss"
              onClick={() => dismissNewRowNotice(memberId)}
            >
              <CloseIcon size={14} color="var(--neutral-300)" />
            </ActionButton>
          </div>
        )}

        {/* Pending gap cards from the toolbar's + ICD flow. Rendered above
            the associated-ICDs list so the user completes them in place
            without leaving the drawer or losing sight of the linked docs
            on the LHS. */}
        {pendingGaps.length > 0 && (
          <div className={styles.pendingGaps}>
            {pendingGaps.map((card, idx) => (
              <IcdCard
                key={`pending-${card.pick.code}-${idx}`}
                card={card}
                member={member}
                memberDosList={memberDosList}
                memberDocs={chartsList}
                dosOptions={gapDosOptions}
                posOptions={gapPosOptions}
                vtOptions={gapVtOptions}
                docTypeOptions={gapDocTypeOptions}
                providerAll={gapProviderAll}
                onUpdate={(patch) => updatePendingGap(idx, patch)}
                onRemove={() => removePendingGap(idx)}
                onSave={() => savePendingGap(idx)}
              />
            ))}
          </div>
        )}

        {/* Section header — the DOS badge expands an inline per-DOS panel
            with toggles (Paper 1ZV3). Toggling a DOS off hides its rows.
            In bulk mode a select-all checkbox precedes the title with a
            tri-state (none/some/all) that mirrors row selection. */}
        <div className={styles.assocHeader}>
          {bulkMode && rowKeys.length > 0 && (
            <Checkbox
              className={styles.assocSelectAll}
              checked={
                associatedSelectState === 'checked'
                  ? true
                  : associatedSelectState === 'indeterminate'
                    ? 'indeterminate'
                    : false
              }
              onCheckedChange={toggleSelectAllAssociated}
              aria-label={associatedSelectState === 'checked' ? 'Deselect all associated ICDs' : 'Select all associated ICDs'}
            />
          )}
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
              // Same D/C/M classifier the worklist letter badge uses, so this
              // panel and the worklist agree on where each DOS came from.
              // No document on file → 'D' is impossible.
              const srcLetter = dosSourceLetter(d.date, chartsList.length > 0);
              const srcMeta = srcLetter === 'D' ? { label: 'Documents', variant: 'dos-source-documents' }
                : srcLetter === 'C' ? { label: 'Claims',   variant: 'dos-source-claims'    }
                :                     { label: 'Manual',   variant: 'dos-source-manual'    };
              const isClaim = srcLetter === 'C';
              return (
                <div key={d.date} className={styles.dosPanelRow}>
                  <div className={styles.dosPanelInfo}>
                    {isClaim ? (
                      <button
                        type="button"
                        className={styles.dosPanelDateRowBtn}
                        onClick={() => openHccClaimForDos(d.date)}
                        title={`Open claim for DOS ${d.date}`}
                      >
                        <span className={styles.dosPanelDate}>{d.date}</span>
                        <Badge variant={srcMeta.variant} label={srcMeta.label} />
                      </button>
                    ) : (
                      <div className={styles.dosPanelDateRow}>
                        <span className={styles.dosPanelDate}>{d.date}</span>
                        <Badge variant={srcMeta.variant} label={srcMeta.label} />
                      </div>
                    )}
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
          {/* Skeleton state — replaces the ICD cards while the diagnosis-gap
              fetch is in flight, so switching between members doesn't flash
              the previous record's ICDs before the new data lands. */}
          {diagnosisGapsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`skel-${i}`} className={styles.icdCardSkeleton} aria-hidden="true">
                <div className={[styles.skelBar, styles.skelBarTitle].join(' ')} />
                <div className={[styles.skelBar, styles.skelBarSub].join(' ')} />
                <div className={styles.skelBar} />
              </div>
            ))
          ) : (cardIcds.length === 0 && actedSuspects.length === 0 && pendingSuspects.length === 0 && (
            <div className={styles.empty}>
              <Icon name="solar:file-text-linear" size={32} color="var(--neutral-200)" />
              <p>No diagnosis gaps {q ? 'match your search' : 'recorded yet for this member'}.</p>
            </div>
          ))}
          {!diagnosisGapsLoading && cardIcds.map((icd, i) => (
            <IcdDosCard
              key={`card-${icd.code}-${i}`}
              icd={icd}
              focusKey={focusKey}
              onFocusRow={handleFocusRow}
              selectedKeys={selectedKeys}
              onToggleSelect={bulkMode ? toggleSelected : null}
              openDismissKey={openDismissKey}
              onOpenDismiss={setOpenDismissKey}
              onActed={advanceFocusAfterAction}
              reviewLocked={stageLocked || isDosRejected}
              lockReason={rejectionLockReason}
            />
          ))}
          {/* Acted suspects graduate into the associated list as normal cards. */}
          {!diagnosisGapsLoading && actedSuspects.map((icd, i) => (
            <IcdDosCard
              key={`acted-suspect-${icd.code}-${i}`}
              icd={icd}
              focusKey={focusKey}
              onFocusRow={handleFocusRow}
              selectedKeys={selectedKeys}
              onToggleSelect={bulkMode ? toggleSelected : null}
              openDismissKey={openDismissKey}
              onOpenDismiss={setOpenDismissKey}
              onActed={advanceFocusAfterAction}
              reviewLocked={stageLocked || isDosRejected}
              lockReason={rejectionLockReason}
            />
          ))}

          {!diagnosisGapsLoading && pendingSuspects.length > 0 && (
            <div className={styles.assocHeader}>
              <span className={styles.assocTitle}>Suspects and Recaptures</span>
            </div>
          )}
          {!diagnosisGapsLoading && pendingSuspects.map((icd, i) => (
            <SuspectCard
              key={`suspect-${icd.code}-${i}`}
              icd={icd}
              dosList={dosList}
              member={member}
              reviewLocked={stageLocked || isDosRejected}
              lockReason={rejectionLockReason}
              bulkDisabled={bulkMode}
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
            { label: 'Accept',  icon: 'solar:check-read-linear',   variant: 'primary',   onClick: () => bulkApply('accepted') },
            { label: 'Dismiss', icon: 'solar:close-circle-linear', variant: 'secondary', onClick: () => bulkApply('rejected') },
          ]}
          moreActions={[
            { label: 'Missed Opportunity', icon: 'solar:flag-linear',  onClick: () => bulkApply('missed') },
            { label: 'Defer',              icon: 'solar:alarm-linear', onClick: () => bulkApply('deferred') },
            { label: 'Undo',               icon: 'solar:undo-left-round-linear', onClick: bulkUndo },
          ]}
        />
      )}
      {rejectPrompt && (
        <RejectRecordDialog
          onCancel={() => setRejectPrompt(null)}
          onConfirm={confirmReject}
        />
      )}
    </Drawer>
  );
}

// Record-level Reject reasons. Multi-select; a comment is ALWAYS required
// (no "optional" branch, unlike Insufficient) — reject is terminal and
// downstream reviewers need the specific reason on the audit trail.
const REJECT_RECORD_REASONS = [
  'All documents belong to wrong patient',
  'All documents illegible',
  'All documents missing signature',
  'All documents outside valid date range',
  'Fraudulent or invalid submission',
  'Other',
];

/**
 * Modal shown when a reviewer picks "Rejected" in the DosStatusMenu.
 * Same shape as InsufficientDosDialog on ChartDetailDrawer — white card,
 * multi-select reasons, MANDATORY comment. Confirm applies the reject.
 */
function RejectRecordDialog({ onCancel, onConfirm }) {
  const [reasons, setReasons] = useState(() => new Set());
  const [note, setNote] = useState('');
  const toggleReason = (r) => setReasons(prev => {
    const next = new Set(prev);
    if (next.has(r)) next.delete(r); else next.add(r);
    return next;
  });
  const canSubmit = reasons.size > 0 && note.trim().length > 0;
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <AlertDialogContent className={`${styles.rejectDialog} !max-w-[420px]`}>
        <div className={styles.rejectDialogHeader}>
          <div className={styles.rejectDialogTitleGroup}>
            <AlertDialogTitle className={styles.rejectDialogTitle}>
              Mark record Rejected
            </AlertDialogTitle>
            <AlertDialogDescription className={styles.rejectDialogSubtitle}>
              Please select a reason. A note is required.
            </AlertDialogDescription>
          </div>
          <CloseButton size={16} onClick={onCancel} className={styles.rejectDialogClose} />
        </div>
        <div className={styles.rejectDialogReasons}>
          {REJECT_RECORD_REASONS.map((r) => {
            const checked = reasons.has(r);
            return (
              <div
                key={r}
                role="checkbox"
                tabIndex={0}
                aria-checked={checked}
                aria-label={r}
                className={styles.rejectReasonOption}
                onClick={() => toggleReason(r)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleReason(r); } }}
              >
                <Checkbox
                  checked={checked}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none"
                />
                <span className={styles.rejectReasonLabel}>{r}</span>
              </div>
            );
          })}
        </div>
        <div className={styles.rejectDialogNoteLabel}>
          Note<span className={styles.rejectDialogRequired} aria-hidden="true"> *</span>
        </div>
        <Textarea
          rows={2}
          placeholder="Add a note explaining the rejection (required)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className={styles.rejectDialogActions}>
          <Button
            variant="danger"
            size="S"
            disabled={!canSubmit}
            onClick={() => onConfirm({ reasons: REJECT_RECORD_REASONS.filter(r => reasons.has(r)), note: note.trim() })}
          >
            Confirm
          </Button>
          <Button variant="secondary" size="S" onClick={onCancel}>Cancel</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
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
