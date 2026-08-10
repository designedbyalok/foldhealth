import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { toast } from '../../../components/Toast/sonnerToast';
import { dosSourceLetter } from '../dosSource';
import { makeCard, DOS_CUSTOM } from './IcdCard.utils';
import {
  icdMatchesFilters,
  activeFilterCount,
  EMPTY_FILTERS,
} from './DiagPanelFilterBar.utils';
import {
  buildReviewStages,
  computeReviewProgress,
} from './ReviewProgressPopover.utils';
import { SWEEP_ICD_DATA } from '../data/sweepIcds';
import { getChartDocs } from '../data/chartDocs';
import { COMMENTS as COMMENTS_MOCK } from '../data/ancillary';
import { getIcdsForMember, getNotLinkedForMember } from '../data/icds';
import { resolveCurrentAssignee } from '../HccWorklistRow.utils';
import { slaOutcome } from '../sla';
import { dosKey } from '../assignment/dosState';
import { ROLE_LABEL } from '../assignment/astranaStaff';
import { POS_BY_VT, PROVIDER_POOL_BY_VT, VISIT_TYPES } from '../reference/visitTypes';
import { DOC_TYPES } from '../data/chartDocs';
import { isAISuggested, CLOSED_ICD_STATUSES, ROLE_KEY_BY_USER } from './DiagPanel.utils';

export function useDiagPanel() {
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
    // Clear any prior selection when leaving bulk mode so re-entering
    // starts fresh (matches Content Settings).
    if (bulkMode) setSelectedKeys(new Set());
    setBulkMode(v => !v);
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
    () => [...icdsRaw, ...notLinkedRaw].filter(i => i.dismissReason && matchesFilters(i)),
    [icdsRaw, notLinkedRaw, matchesFilters],
  );
  const closedICDs = useMemo(
    () => [...icdsRaw, ...notLinkedRaw].filter(i => CLOSED_ICD_STATUSES.has(i.status) && matchesFilters(i)),
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
  const enabledDates = useMemo(() => {
    const out = [];
    for (const d of dosList) {
      if (d.date && !disabledDos.has(d.date)) out.push(d.date);
    }
    return out;
  }, [dosList, disabledDos]);
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
    () => pendingGaps.flatMap(c => c.pick?.code ? [c.pick.code] : []),
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
      const { code, title, hcc } = c.pick;
      if (entry.mode === 'existing') {
        addHccGap({
          code,
          desc: title,
          hcc: hcc || '',
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
          code,
          desc: title,
          hcc: hcc || '',
          dos: entry.dosDate,
          provider: c.provider,
          pos: c.pos,
          visitType: c.visitType,
        });
        siblingCount += 1;
      } else {
        const newId = addHccGapNewRow({
          sourceMemberId: member?.id,
          code,
          desc: title,
          hcc: hcc || '',
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

  const dosDeletedSet = useMemo(() => new Set(dosDeleted), [dosDeleted]);

  // Each ICD card lists a row per DOS the code appears on. Grouping mirrors
  // the worklist: a DOS = one document/encounter (member.dos_list), each
  // yielding several ICDs. When a member has an explicit sweep mapping
  // (Annette, design reference) we use it; otherwise we deterministically
  // spread each ICD across a subset of the record's own DOS dates so the
  // drawer's grouping always stays coherent with the worklist.
  const cardIcds = useMemo(() => {
    const dates = dosList.flatMap(d => d.date ? [d.date] : []);
    const out = [];
    for (let idx = 0; idx < assocICDs.length; idx++) {
      const icd = assocICDs[idx];
      if (!matchQ(icd)) continue;
      const sweep = sweepByCode.get(icd.code);
      let base;
      if (sweep?.dos_entries?.length) {
        base = sweep.dos_entries.map(e => ({ dos: e.dos, claimed: !!e.claimed }));
      } else if (dates.length) {
        const count = Math.max(1, dates.length - (idx % dates.length));
        base = dates.slice(0, count).map((d, i) => ({
          dos: d,
          claimed: idx === 0 && i === 0,
          manual: icd.type === 'Manual',
        }));
      } else {
        base = [{ dos: member?.dos || '—', claimed: false, manual: icd.type === 'Manual' }];
      }
      const entries = base.filter(e =>
        !disabledDos.has(e.dos) && !dosDeletedSet.has(`${icd.code}|${e.dos}`));
      if (entries.length > 0) out.push({ ...icd, entries });
    }
    return out;
  }, [assocICDs, sweepByCode, dosList, disabledDos, dosDeletedSet, q]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const actedSuspects = useMemo(() => {
    const out = [];
    for (const icd of suspectIcds) {
      const keys = Object.keys(hccGapDosActions).filter(k => k.startsWith(`${icd.code}|`));
      if (keys.length === 0) continue;
      out.push({ ...icd, entries: keys.map(k => ({ dos: k.split('|')[1] })) });
    }
    return out;
  }, [suspectIcds, hccGapDosActions]);
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



  const rafImpact = (Number(member.ri) || 0).toFixed(3);
  const noop = (label) => () => showToast(`${label} — coming soon`);


  return {
    MIN_RHS_PX,
    actedSuspects,
    actingRole,
    actingStatus,
    activeIcdCode,
    addIcdMode,
    advanceFocusAfterAction,
    associatedSelectState,
    bulkApply,
    bulkMode,
    bulkUndo,
    cancelClose,
    cardIcds,
    chartsList,
    closeDiagPanel,
    closedICDs,
    commentsCount,
    confirmPendingStatusChange,
    confirmReject,
    contentRowRef,
    currentDos,
    diagActivityIcd,
    diagLeftPanel,
    diagnosisGapsLoading,
    disabledDos,
    dismissNewRowNotice,
    docsCount,
    dosExpanded,
    dosList,
    dosState,
    enabledDates,
    exitAddIcdMode,
    filterCount,
    filterOpen,
    filters,
    focusKey,
    gapDocTypeOptions,
    gapDosOptions,
    gapExcludeCodes,
    gapPosOptions,
    gapProviderAll,
    gapVtOptions,
    handleFocusRow,
    handleStatusChange,
    hccUserRole,
    icdsRaw,
    isDosRejected,
    member,
    memberDosList,
    memberId,
    moreOpen,
    moreWrapRef,
    newRowNotice,
    noop,
    notLinkedRaw,
    onPillClick,
    onPillEnter,
    onPillLeave,
    openDiagPanel,
    openDismissKey,
    openDocsFromToolbar,
    openHccClaimForDos,
    overriddenICDs,
    pendingGaps,
    pendingStatusChange,
    pendingSuspects,
    pillLabel,
    pillRect,
    pillRef,
    q,
    rafImpact,
    rejectInfo,
    rejectPrompt,
    rejectionLockReason,
    removePendingGap,
    requestClose,
    reviewProgress,
    reviewStages,
    rhsWidth,
    rowKeys,
    savePendingGap,
    searchQuery,
    selectedKeys,
    setAddIcdMode,
    setDiagLeftPanel,
    setDiagTab,
    setDisabledDos,
    setDosExpanded,
    setFilterOpen,
    setFilters,
    setFocusIdx,
    setMoreOpen,
    setOpenDismissKey,
    setPendingGaps,
    setPendingStatusChange,
    setPillPinned,
    setPillRect,
    setRejectPrompt,
    setSearchQuery,
    setSelectedKeys,
    slaVerdict,
    stageLocked,
    startResize,
    toggleBulkMode,
    toggleSelectAllAssociated,
    toggleSelected,
    updatePendingGap,
  };
}