import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { buildReviewStages, computeReviewProgress } from './DiagPanel/ReviewProgressPopover.utils';
import { dosKey } from './assignment/dosState';
import { DOC_TYPES, makeUploadedChartDoc } from './data/chartDocs';
import { staffForRole } from './assignment/astranaStaff';
import {
  deriveStatus,
  isAddressed,
  actionForStatus,
  nameToInitials,
  STATUS_OPTIONS,
  STATUS_BADGE,
} from './ChartDetailDrawer.utils';

export function useChartDetailDrawer({ charts, initialId, member, onClose }) {
  const docs = charts || [];

  // Selected document:
  // the first document.
  const [selectedId, setSelectedId] = useState(
    () => initialId || docs.find(d => !isAddressed(d))?.id || docs[0]?.id || null,
  );
  // Per-document pass/fail review state, seeded from each doc's status.
  const [docActions, setDocActions] = useState(() => {
    const m = {};
    docs.forEach(d => { const a = actionForStatus(d); if (a) m[d.id] = a; });
    return m;
  });
  // Flag: has the coder touched any doc's status in this drawer session?
  // We use it to know whether to sync the Support member status on close;
  // syncing mid-review would flip Support to Completed and force this
  // row out of the "New / In Progress" filter, unmounting the drawer
  // before the user is done reviewing.
  const pendingSyncRef = useRef(false);

  // Fire once when the drawer is dismissed (Escape, overlay click, close
  // button). Flushes the Support-status sync using the latest docActions
  // + docs so the record only moves out of the reviewer's filter AFTER
  // they've explicitly closed the review session.
  const handleClose = () => {
    if (pendingSyncRef.current && !manualStatus) {
      syncSupportStatus(deriveStatus(docs, docActions));
      pendingSyncRef.current = false;
    }
    onClose?.();
  };

  // Keep the Escape handler pointed at the latest handleClose without
  // re-subscribing every render (handleClose is recreated each render).
  const handleCloseRef = useRef(handleClose);
  useEffect(() => { handleCloseRef.current = handleClose; });
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // "Assign Support Team" dropdown anchored on the team badge.
  const dmRef = useRef(null);
  const [assignPos, setAssignPos] = useState(null);
  useEffect(() => {
    if (!assignPos) return;
    const onDoc = (e) => {
      if (!dmRef.current?.contains(e.target) && !e.target.closest?.(`.${styles.assignMenu}`)) setAssignPos(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [assignPos]);

  // Per-document "More actions" menu. Anchored on the clicked doc's ⋯
  // button; holds { docId, top, left }.
  const [moreMenu, setMoreMenu] = useState(null);
  // Fail-reason prompt — { id, name } | null. Set by failDoc; confirming
  // logs the reason and applies the Fail status.
  const [failPrompt, setFailPrompt] = useState(null);
  // Per-doc fail metadata captured by the inline Fail prompt. Keyed by doc id
  // so the hover tooltip on each row's "Failed" badge can render the reasons
  // + comment. Doesn't clear on Undo — the entry is stale until the doc is
  // failed again, which overwrites it, so we drop it on `undoDoc`.
  const [failDetails, setFailDetails] = useState({});
  // Confirmation dialogs for the destructive actions on the per-doc menu.
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null);
  // Inline edit — when set to a doc id, the doc card renders an inline
  // Caption + Document Type editor below its header, in place of the
  // per-row Pass/Fail/⋯ actions. Doesn't reuse UploadChartDrawer here
  // because that drawer's z-index would sit behind this ChartDetailDrawer.
  const [editingDocId, setEditingDocId] = useState(null);
  // Review Progress popover state — hover-open + click-to-pin (mirrors the
  // DiagPanel status-pill treatment). Anchored on the "Support Team" badge
  // in the drawer header so a reviewer can peek at the four-stage timeline
  // without leaving the drawer.
  const teamBadgeRef = useRef(null);
  const [teamPillRect, setTeamPillRect] = useState(null);
  const [teamPillPinned, setTeamPillPinned] = useState(false);
  const teamOpenTimer = useRef(null);
  const teamCloseTimer = useRef(null);
  useEffect(() => {
    if (!moreMenu) return;
    const onDoc = (e) => {
      if (!e.target.closest?.(`.${styles.docMoreMenu}`) && !e.target.closest?.(`.${styles.moreBtn}`)) setMoreMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreMenu]);

  // When the last document is unlinked we keep the drawer open and switch the
  // right pane to the Upload section (left preview hidden) instead of closing.
  const [emptiedViaUnlink, setEmptiedViaUnlink] = useState(false);

  // "N/M DOSs" expandable list (mirrors the Diagnosis Gap drawer). Support
  // can delete a DOS from here while the record is in their stage; the
  // confirm modal target lives in `dosToDelete` (the date string) and
  // clearing it dismisses the dialog.
  const [dosExpanded, setDosExpanded] = useState(false);
  const [dosToDelete, setDosToDelete] = useState(null);

  // Left pane mode. Defaults to the PDF preview; the "Comment" action next to
  // Upload flips this to a Comment panel that reads/writes the same
  // hccDiagComments slice the Diagnosis Gap drawer uses (so entries added
  // here surface in the DiagPanel Comments tab and vice-versa).
  const [leftPanel, setLeftPanel] = useState('preview');

  // Header status dropdown anchored on the status button. The status is
  // derived from the documents' pass/fail state; the user can also manually
  // override it (e.g. force Completed, or Rejected once a doc has passed).
  const actionRef = useRef(null);
  const [manualStatus, setManualStatus] = useState(null);
  const [actionPos, setActionPos] = useState(null);
  // Insufficient confirmation modal — non-null when open. Selecting
  // Insufficient in the status menu opens this instead of applying the
  // status directly, so support has to name a reason (and can drop a note)
  // before the record is flagged as unusable evidence.
  const [insufficientPrompt, setInsufficientPrompt] = useState(null);
  const showToast = useAppStore(s => s.showToast);
  const addChartDoc = useAppStore(s => s.addChartDoc);
  const setChartDocStatus = useAppStore(s => s.setChartDocStatus);
  const removeChartDoc = useAppStore(s => s.removeChartDoc);
  const updateChartDocMeta = useAppStore(s => s.updateChartDocMeta);
  const addActivityEntry = useAppStore(s => s.addActivityEntry);
  // Workflow-engine writers — these keep the Support assignee + status in sync
  // with the worklist Support column and the Diagnosis Gaps Details view.
  const hccReassignRole = useAppStore(s => s.hccReassignRole);
  const hccSetRoleStatus = useAppStore(s => s.hccSetRoleStatus);
  const hccCompleteSupport = useAppStore(s => s.hccCompleteSupport);
  const hccDeleteDos = useAppStore(s => s.hccDeleteDos);
  const hccUserRole = useAppStore(s => s.hccUserRole);
  const initializeHccPatient = useAppStore(s => s.initializeHccPatient);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  // Live member from the store so the assignee badge reflects reassignments
  // made here (or elsewhere) without waiting on the parent's prop to refresh.
  const liveMember = useAppStore(s => s.hccMembers.find(x => x.id === member?.id));
  const m = liveMember || member;

  // Ensure the engine has seeded per-DOS assignments for this patient — the
  // Chart Review drawer can open from the worklist without the Diagnosis Gaps
  // drawer having run its own initializeHccPatient effect, and without this
  // the badge + assignee lookups would read `null` from `hccDosAssignments`.
  useEffect(() => {
    if (member?.id) initializeHccPatient(member.id);
  }, [member?.id, initializeHccPatient]);

  // Inline "Upload" panel (opened from the Upload link in the assoc row).
  // Mirrors the Add DOS drawer's upload states: Dropzone → uploading progress
  // card → uploaded file card.
  const [showUpload, setShowUpload] = useState(false);
  const [upFile, setUpFileState] = useState(null);
  const [upCaption, setUpCaption] = useState('');
  const [upCaptionTouched, setUpCaptionTouched] = useState(false);
  const [upType, setUpType] = useState('');
  const [uploadKey, setUploadKey] = useState(0); // remount UploadDropField to reset it
  // Once a file lands in the drop zone, seed the Caption with the file's
  // name (extension stripped) so the user has a sensible default — unless
  // they've already typed their own caption. Seeded here, at the drop, rather
  // than from an effect that re-derives it on every render.
  const setUpFile = (file) => {
    setUpFileState(file);
    if (file && !upCaptionTouched) {
      setUpCaption(file.name.replace(/\.[a-z0-9]+$/i, ''));
    }
  };
  useEffect(() => {
    if (!actionPos) return;
    const onDoc = (e) => {
      if (!actionRef.current?.contains(e.target) && !e.target.closest?.(`.${styles.statusMenu}`)) setActionPos(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [actionPos]);

  // Store selectors + the pinned-team-pill dismiss effect are declared here,
  // before the early return below, so hook order stays stable across renders.
  const hccDiagCommentsAll = useAppStore(s => s.hccDiagComments);
  const hccDosAssignmentsMap = useAppStore(s => s.hccDosAssignments);
  useEffect(() => {
    if (!teamPillPinned) return undefined;
    const onDoc = (e) => {
      if (teamBadgeRef.current?.contains(e.target)) return;
      if (e.target.closest?.('[role="tooltip"][aria-label="Review progress"]')) return;
      setTeamPillPinned(false); setTeamPillRect(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setTeamPillPinned(false); setTeamPillRect(null); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [teamPillPinned]);

  // Nothing to show only when the drawer opened empty. If the user unlinked
  // down to zero, stay open and render the Upload section (handled below).
  if (docs.length === 0 && !emptiedViaUnlink) return null;

  const isEmpty = docs.length === 0;
  const selected = docs.find(d => d.id === selectedId) || docs[0] || null;

  // DOS list for the "N/M DOSs" toggle. Prefer member.dos_list; fall back to a
  // single synthetic entry from member.dos. Provider/POS/visit-type read from
  // the entry with member-level fallbacks (same as the Diagnosis Gap drawer).
  const dosList = m?.dos_list?.length
    ? m.dos_list
    : (m?.dos ? [{ date: m.dos }] : []);
  // Support-only DOS deletion. Available only while Support still owns the
  // record — the moment support marks Completed/Rejected the record moves
  // downstream to the Coder and Delete disappears.
  const canDeleteDos = hccUserRole === 'Support'
    && !['Completed', 'Rejected'].includes(m?.supS);
  const confirmDeleteDos = () => {
    if (!dosToDelete) return;
    hccDeleteDos(m.id, dosToDelete);
    setDosToDelete(null);
    showToast?.(`DOS ${dosToDelete} deleted`);
  };

  const supportStaff = staffForRole('support');
  const openAssign = () => {
    if (assignPos) { setAssignPos(null); return; }
    const r = dmRef.current?.getBoundingClientRect();
    if (r) setAssignPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  // Current Support assignee, read live from the store — must match the
  // worklist RoleStatusCell rule: a lingering name with no real status (or
  // status 'Assign') still counts as UNASSIGNED. Only a name + concrete
  // status shows an owner.
  const supportName = m?.sup || null;
  const supportStatus = m?.supS || null;
  const isSupportAssigned = !!(supportName && supportStatus && supportStatus !== 'Assign');
  const supportInitials = isSupportAssigned ? nameToInitials(supportName) : null;
  const reviewerName = (isSupportAssigned && supportName) || 'the support team';

  // DOS anchor for engine writes + reads. Mirrors DiagPanel's `currentDos`
  // rule (`dos_list[0]`) so the Chart Review and Diagnosis Gaps drawers
  // always target the same engine record for the same member — otherwise
  // Support/Coder status would visibly diverge between the two views.
  // Falls back to `member.dos` / `member.date` when a member has no
  // `dos_list` (older seed data).
  const primaryDosEntry = m?.dos_list?.[0] || null;
  const dosDate = primaryDosEntry?.date || m?.dos || m?.date;
  const dosRp = primaryDosEntry?.provider || m?.rp || null;
  const dosPos = primaryDosEntry?.pos || m?.pos || null;

  // The logged-in user acting in the Support role. Real Supabase identity when
  // present; otherwise the first active Support staffer stands in (dev/bypass),
  // so avatars + the worklist show consistent, real initials.
  const currentUser = currentUserProfile?.name
    ? { id: currentUserProfile.id, name: currentUserProfile.name, initials: nameToInitials(currentUserProfile.name) }
    : (supportStaff.find(s => s.active) || supportStaff[0]);

  // Assign the logged-in user to Support if the DOS has no support owner yet.
  // Reads fresh store state so it's idempotent across rapid actions.
  const ensureSupportAssignee = () => {
    if (!dosDate || !currentUser) return;
    const fresh = useAppStore.getState().hccMembers.find(x => x.id === member.id);
    const assigned = fresh?.sup && fresh?.supS && fresh.supS !== 'Assign';
    if (!assigned) {
      hccReassignRole(member.id, dosDate, 'support', currentUser.id, 'You',
        'Auto-assigned on document review', currentUser.name);
    }
  };

  // Push a derived/selected review status to the workflow engine. Completed
  // routes through completeSupport so the Coder is auto-assigned (AC); every
  // other status is a plain support-status patch that leaves the Coder alone.
  const syncSupportStatus = (statusKey) => {
    if (!dosDate) return;
    switch (statusKey) {
      case 'completed':    hccCompleteSupport(member.id, dosDate, currentUser?.name); break;
      case 'insufficient': hccSetRoleStatus(member.id, dosDate, 'support', 'Insufficient'); break;
      case 'rejected':     hccSetRoleStatus(member.id, dosDate, 'support', 'Reject'); break;
      case 'in-progress':  hccSetRoleStatus(member.id, dosDate, 'support', 'In Progress'); break;
      default:             hccSetRoleStatus(member.id, dosDate, 'support', 'Awaiting'); break;
    }
  };

  // Pass/Fail writes the doc status through to the store (worklist evidence
  // cell) AND — because changing a document's status is a Support action —
  // assigns the acting user and syncs the derived Support status everywhere.
  const applyDocAction = (id, action) => {
    const next = action
      ? { ...docActions, [id]: action }
      : (() => { const n = { ...docActions }; delete n[id]; return n; })();
    setDocActions(next);
    // Persist the per-doc mark immediately so a crash doesn't lose it —
    // this write is scoped to hcc_chart_status and does NOT flip the
    // record's Support status by itself. `deferSync` suppresses the
    // store's all-failed → Insufficient cascade; the drawer syncs the
    // derived status itself on close via handleClose.
    setChartDocStatus(
      member.id,
      id,
      action === 'pass' ? 'Passed' : action === 'fail' ? 'Failed' : 'Pending',
      { deferSync: true },
    );
    if (action) ensureSupportAssignee();
    // Defer the Support-member status sync to drawer close — flipping
    // it here would move the record out of the "New / In Progress"
    // filter and unmount the row (and this drawer with it) before the
    // user finishes reviewing.
    pendingSyncRef.current = true;
    // "Support Task is Completed" toast fires only on the transition from
    // partially-reviewed → every-doc-reviewed. Firing on each pass would
    // mislead when only 1 of N docs is done; firing on undo would be wrong
    // too (transition goes the other way, so this branch stays silent).
    const wasAllReviewed = docs.length > 0 && docs.every(d => !!docActions[d.id]);
    const isAllReviewed = docs.length > 0 && docs.every(d => !!next[d.id]);
    if (!wasAllReviewed && isAllReviewed) showToast('Support Task is Completed');
  };
  const passDoc = (id) => {
    // Passing a doc supersedes any open Fail form on the same doc — close it
    // so the reason list + comment field don't linger over a Passed doc.
    if (failPrompt?.id === id) setFailPrompt(null);
    applyDocAction(id, 'pass');
    const doc = docs.find(d => d.id === id);
    addActivityEntry?.({
      _memberId: member?.id,
      t: 'doc-status', by: 'You', role: 'Support Team',
      headline: `Marked "${doc?.n || 'Document'}" as Passed`,
    });
  };
  const failDoc = (id) => {
    const doc = docs.find(d => d.id === id);
    setFailPrompt({ id, name: doc?.n || 'Document' });
  };
  const undoDoc = (id) => {
    const doc = docs.find(d => d.id === id);
    const prevStatus = doc?.status;
    applyDocAction(id, null);
    setFailDetails(prev => { const n = { ...prev }; delete n[id]; return n; });
    addActivityEntry?.({
      _memberId: member?.id,
      t: 'doc-status', by: 'You', role: 'Support Team',
      headline: `Undid ${prevStatus || 'review'} on "${doc?.n || 'Document'}"`,
    });
  };
  const confirmFailDoc = ({ reasons, note }) => {
    if (!failPrompt) return;
    applyDocAction(failPrompt.id, 'fail');
    setFailDetails(prev => ({ ...prev, [failPrompt.id]: { reasons: reasons || [], note: note || '' } }));
    const doc = docs.find(d => d.id === failPrompt.id);
    const reasonText = (reasons || []).join(', ');
    addActivityEntry?.({
      _memberId: member?.id,
      t: 'doc-status', by: 'You', role: 'Support Team',
      headline: `Marked "${doc?.n || failPrompt.name}" as Failed`,
      details: [{ note: note ? `${reasonText} — ${note}` : reasonText }],
    });
    showToast(`Marked ${failPrompt.name} failed`);
    setFailPrompt(null);
  };

  // Count of comments the shared `hccDiagComments` store holds — used to
  // show a numeric badge on the header Comment action so support can see at
  // a glance how much discussion is on the record without opening the panel.
  // Same slice DiagPanel's Comments tab reads, so the two counts agree.
  const commentsCountForMember = hccDiagCommentsAll.length;

  // Build the four-stage review timeline for the popover. Reads the same
  // dosState + member the ReviewProgressPopover already understands.
  const dosStateForBadge = (member?.id && dosDate)
    ? hccDosAssignmentsMap[dosKey(member.id, dosDate, dosRp, dosPos)]
    : null;
  const teamReviewStages = buildReviewStages(member, dosStateForBadge);
  const teamReviewProgress = computeReviewProgress(teamReviewStages);
  // Once Support has handed off (marked Completed) and a Coder is on the DOS,
  // the Support assignee is no longer editable from this drawer — reassigning
  // would break the linear Support → Coder pipeline the engine enforces.
  // Falls back to the member-level `sup/supS/cdr` fields because the drawer's
  // primary-DOS lookup can miss the engine record when member.rp/pos don't
  // line up with the seeded DOS composite key.
  const supportCompletedFlag = dosStateForBadge?.support?.status === 'Completed'
    || m?.supS === 'Completed';
  const coderAssignedFlag = !!dosStateForBadge?.coder?.assignee
    || !!(m?.cdr && m?.cdrS && m.cdrS !== 'Assign');
  const supportLocked = supportCompletedFlag && coderAssignedFlag;

  // While the Coder is actively working the record (any status other than
  // "Record Requested"), Support has already handed off — so record status
  // AND per-doc Pass/Fail/Undo actions freeze. When the Coder flips to
  // "Record Requested" they're explicitly bouncing docs back to Support, so
  // every action unlocks again.
  const coderStatus = dosStateForBadge?.coder?.status || m?.cdrS || null;
  const coderEngaged = !!coderStatus && coderStatus !== 'Assign';
  const supportActionsLocked = supportCompletedFlag && coderEngaged
    && coderStatus !== 'Record Requested';
  const supportLockedTip = 'Coder is reviewing this record — Support actions unlock when the Coder requests records.';

  const onTeamPillEnter = () => {
    if (teamCloseTimer.current) { clearTimeout(teamCloseTimer.current); teamCloseTimer.current = null; }
    if (teamPillRect) return;
    teamOpenTimer.current = setTimeout(() => {
      const r = teamBadgeRef.current?.getBoundingClientRect();
      if (r) setTeamPillRect(r);
    }, 80);
  };
  const onTeamPillLeave = () => {
    if (teamPillPinned) return;
    if (teamOpenTimer.current) { clearTimeout(teamOpenTimer.current); teamOpenTimer.current = null; }
    teamCloseTimer.current = setTimeout(() => setTeamPillRect(null), 200);
  };
  const onTeamPillClick = (e) => {
    e.stopPropagation();
    if (teamOpenTimer.current) { clearTimeout(teamOpenTimer.current); teamOpenTimer.current = null; }
    if (teamCloseTimer.current) { clearTimeout(teamCloseTimer.current); teamCloseTimer.current = null; }
    if (teamPillPinned) {
      setTeamPillPinned(false); setTeamPillRect(null);
    } else {
      const r = teamBadgeRef.current?.getBoundingClientRect();
      if (r) { setTeamPillRect(r); setTeamPillPinned(true); }
    }
  };
  const cancelTeamClose = () => {
    if (teamCloseTimer.current) { clearTimeout(teamCloseTimer.current); teamCloseTimer.current = null; }
  };
  const requestTeamClose = () => {
    if (teamPillPinned) return;
    teamCloseTimer.current = setTimeout(() => setTeamPillRect(null), 200);
  };

  // Unlink a document from this Created-date record. Removes it from the
  // member's chart list (store) + clears its local review state. When it was
  // the last document, keep the drawer open on the Upload section with the
  // left preview hidden; closing the drawer then shows the Upload button in
  // the Chart Available column (existing empty-chart behaviour).
  const unlinkDoc = (id) => {
    setMoreMenu(null);
    const remaining = docs.filter(d => d.id !== id);
    removeChartDoc(member.id, id);
    setDocActions(a => { const n = { ...a }; delete n[id]; return n; });
    if (remaining.length === 0) {
      setEmptiedViaUnlink(true);
      setShowUpload(true);
    } else if (id === selectedId) {
      setSelectedId(remaining[0].id);
    }
    showToast('Document unlinked from this record');
  };

  // Manually assign a Support staffer from the badge popover.
  const assignSupport = (staff) => {
    setAssignPos(null);
    if (dosDate) {
      hccReassignRole(member.id, dosDate, 'support', staff.id, 'You',
        'Assigned via document review', staff.name);
    }
  };

  // Header status dropdown: assign the acting user, then sync the status.
  // Insufficient has a two-step gate:
  //   • no doc has been Failed yet → block with a toast (the DOS is only
  //     "insufficient" when at least one document has been rejected)
  //   • ≥1 doc failed → open the Insufficient DOS reasons modal; the
  //     status is only committed once the user hits Confirm there.
  const chooseStatus = (statusKey) => {
    setActionPos(null);
    if (statusKey === 'insufficient') {
      const anyFailed = Object.values(docActions).some(v => v === 'fail');
      if (!anyFailed) {
        showToast('Mark at least one document as Failed before setting the record Insufficient.');
        return;
      }
      setInsufficientPrompt({});
      return;
    }
    setManualStatus(statusKey);
    ensureSupportAssignee();
    syncSupportStatus(statusKey);
  };

  // Called by the Insufficient DOS modal on Confirm. Commits the record's
  // manual status + fires the same engine sync the normal path uses, and
  // logs the DOS-level reasons to the activity feed so the Coder can see
  // exactly why Support rejected the record.
  const confirmInsufficient = ({ reasons, note }) => {
    setInsufficientPrompt(null);
    setManualStatus('insufficient');
    ensureSupportAssignee();
    syncSupportStatus('insufficient');
    const reasonText = (reasons || []).join(', ');
    addActivityEntry?.({
      _memberId: member?.id,
      t: 'doc-status', by: 'You', role: 'Support Team',
      headline: 'Marked record Insufficient',
      details: [{ note: note ? `${reasonText} — ${note}` : reasonText }],
    });
    showToast('Record marked Insufficient.');
  };

  // Once Support has handed off (locked), the pill pins to "Completed" — the
  // handoff outcome — so it doesn't flicker between "In Progress" and
  // "Completed" if a doc gets undone downstream. Otherwise it tracks the
  // manual override / derived doc-review status normally.
  const effectiveStatus = supportActionsLocked
    ? 'completed'
    : (manualStatus || deriveStatus(docs, docActions));
  // Trigger label lookup: "Action Needed" is a derived-only state so it's not
  // in the dropdown, but the trigger still renders it when nothing has been
  // reviewed yet — hence the explicit fallback here.
  const currentStatus = STATUS_OPTIONS.find(s => s.key === effectiveStatus)
    || { key: 'action-needed', label: 'Action Needed' };
  const currentBadge = STATUS_BADGE[effectiveStatus] || STATUS_BADGE['action-needed'];
  const openAction = () => {
    if (actionPos) { setActionPos(null); return; }
    const r = actionRef.current?.getBoundingClientRect();
    if (r) setActionPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 198) });
  };

  const gender = member?.g === 'F' ? 'Female' : 'Male';
  const overdue = /overdue/i.test(member?.due || '');
  // Only surface the "Completed Document Review Task" banner when the overall
  // status is Completed — not when it's manually set to anything else.
  const showReviewBanner = effectiveStatus === 'completed';

  const resetUpload = () => {
    setShowUpload(false); setUpFile(null); setUpCaption(''); setUpCaptionTouched(false); setUpType('');
    setUploadKey(k => k + 1);
  };
  const canSaveUpload = !!(upFile && upCaption.trim() && upType);
  const saveUpload = () => {
    if (!canSaveUpload) return;
    addChartDoc(member.id, makeUploadedChartDoc(member, { file: upFile, caption: upCaption, docType: upType }), upFile);
    showToast(`Uploaded ${upFile.name} to ${member?.name || 'patient'}'s documents.`);
    resetUpload();
  };


  return {
    action,
    actionPos,
    actionRef,
    assignPos,
    assignSupport,
    canDeleteDos,
    canSaveUpload,
    cancelTeamClose,
    chooseStatus,
    commentsCountForMember,
    confirmDeleteDoc,
    confirmDeleteDos,
    confirmFailDoc,
    confirmInsufficient,
    currentBadge,
    currentStatus,
    dmRef,
    doc,
    docActions,
    docs,
    dosExpanded,
    dosList,
    dosToDelete,
    editingDocId,
    effectiveStatus,
    failDetails,
    failDoc,
    failPrompt,
    gender,
    handleClose,
    insufficientPrompt,
    isEditingRow,
    isEmpty,
    isFailing,
    isSel,
    isSupportAssigned,
    leftPanel,
    m,
    moreMenu,
    onTeamPillClick,
    onTeamPillEnter,
    onTeamPillLeave,
    openAction,
    openAssign,
    overdue,
    passDoc,
    pos,
    provider,
    requestTeamClose,
    resetUpload,
    reviewerName,
    saveUpload,
    sel,
    selected,
    setConfirmDeleteDoc,
    setDosExpanded,
    setDosToDelete,
    setEditingDocId,
    setFailPrompt,
    setInsufficientPrompt,
    setLeftPanel,
    setMoreMenu,
    setSelectedId,
    setShowUpload,
    setTeamPillPinned,
    setTeamPillRect,
    setUpCaption,
    setUpCaptionTouched,
    setUpFile,
    setUpType,
    showReviewBanner,
    showToast,
    showUpload,
    supportActionsLocked,
    supportInitials,
    supportLocked,
    supportLockedTip,
    supportName,
    supportStaff,
    teamBadgeRef,
    teamPillRect,
    teamReviewProgress,
    teamReviewStages,
    undoDoc,
    unlinkDoc,
    upCaption,
    upType,
    updateChartDocMeta,
    uploadKey,
    vt,
    charts,
    initialId,
    member,
    onClose,
    docs,
  };
}
