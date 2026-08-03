import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Drawer } from '../../components/Drawer/Drawer';
import { Avatar } from '../../components/Avatar/Avatar';
import { CommentComposer } from '../../components/CommentComposer/CommentComposer';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { RoleTooltip } from './RoleTooltip';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { Button } from '../../components/Button/Button';
import { UploadDropField } from '../../components/UploadDropField/UploadDropField';
import { FilePreview } from '../../components/FilePreview/FilePreview';
import { DemoPhiStrip } from '../../components/DemoPhiStrip/DemoPhiStrip';
import { Select } from '../../components/Select/Select';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { useAppStore } from '../../store/useAppStore';
import { DocEvidenceViewer } from './DiagPanel/DocEvidenceViewer';
import { ReviewProgressPopover, buildReviewStages, computeReviewProgress, ProgressRing } from './DiagPanel/ReviewProgressPopover';
import { dosKey } from './assignment/dosState';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from '../../components/ConfirmDialog/AlertDialogPrimitives';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Textarea } from '../../components/Textarea/Textarea';
import { DOC_TYPES, makeUploadedChartDoc } from './data/chartDocs';
import { staffForRole } from './assignment/astranaStaff';
import styles from './ChartDetailDrawer.module.css';

// Manually-selectable statuses. Note "Action Needed" is intentionally NOT
// listed — it's the auto-derived default when no doc has been reviewed yet,
// and never needs to be picked by hand. The trigger still renders it when
// derived, but the dropdown skips it so support can only move the record
// forward (In Progress → Completed / Insufficient / Rejected).
const STATUS_OPTIONS = [
  { key: 'in-progress', label: 'In Progress' },
  { key: 'insufficient', label: 'Insufficient' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected', textColor: 'var(--status-error)' },
];

// Badge colouring for the header status pill, keyed to the review outcome.
const STATUS_BADGE = {
  'action-needed': { color: 'var(--neutral-300)',     bg: 'var(--neutral-50)',            border: 'rgba(111, 122, 144, 0.1)' },
  'in-progress':   { color: 'var(--status-warning)',  bg: 'var(--status-warning-light)',  border: 'rgba(240, 160, 0, 0.2)' },
  'insufficient':  { color: 'var(--status-warning)',  bg: 'var(--status-warning-light)',  border: 'rgba(240, 160, 0, 0.2)' },
  'completed':     { color: 'var(--status-success)',  bg: 'var(--status-success-light)',  border: 'rgba(0, 155, 83, 0.2)' },
  'rejected':      { color: 'var(--status-error)',    bg: 'var(--status-error-light)',    border: 'rgba(215, 40, 37, 0.2)' },
};

/**
 * Derive the document-set review status from each doc's pass/fail state:
 *   • every doc failed     → insufficient (nothing usable on the chart)
 *   • >1 failed (mixed)    → insufficient
 *   • all passed           → completed
 *   • at least one decided → in progress
 *   • nothing decided yet  → action needed
 */
function deriveStatus(docs, actions) {
  const passCount = docs.filter(d => actions[d.id] === 'pass').length;
  const failCount = docs.filter(d => actions[d.id] === 'fail').length;
  if (docs.length > 0 && failCount === docs.length) return 'insufficient';
  if (failCount > 1) return 'insufficient';
  if (docs.length > 0 && passCount === docs.length) return 'completed';
  if (passCount + failCount > 0) return 'in-progress';
  return 'action-needed';
}

function StatusIcon({ status, size = 16 }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', style: { flexShrink: 0 } };
  switch (status) {
    case 'in-progress':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.5" stroke="var(--status-warning)" strokeWidth="1.2" />
          <path d="M8 1.5A6.5 6.5 0 0 1 8 14.5Z" fill="var(--status-warning)" />
        </svg>
      );
    case 'insufficient':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="var(--status-warning-light)" stroke="var(--status-warning)" />
          <path d="M8 4.5V8.6" stroke="var(--status-warning)" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.75" fill="var(--status-warning)" />
        </svg>
      );
    case 'completed':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="var(--status-success-light)" stroke="var(--status-success)" />
          <path d="M5 8.2l2 2 4-4.4" stroke="var(--status-success)" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'rejected':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="var(--status-error-light)" stroke="var(--status-error)" />
          <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--status-error)" strokeLinecap="round" />
        </svg>
      );
    case 'action-needed':
    default:
      return (
        <svg {...common}>
          <path d="M8 0.5C12.1421 0.5 15.5 3.85786 15.5 8C15.5 12.1421 12.1421 15.5 8 15.5C3.85786 15.5 0.5 12.1421 0.5 8C0.5 3.85786 3.85786 0.5 8 0.5Z" fill="var(--status-warning-light)" />
          <path d="M8 0.5C12.1421 0.5 15.5 3.85786 15.5 8C15.5 12.1421 12.1421 15.5 8 15.5C3.85786 15.5 0.5 12.1421 0.5 8C0.5 3.85786 3.85786 0.5 8 0.5Z" stroke="var(--neutral-400)" />
          <path d="M8 4V5.33333M12 8H10.6667M8 12V10.6667M4 8H5.33333M5.17151 5.17157L6.11432 6.11438M10.8284 5.17157L9.88556 6.11438M10.8285 10.8284L9.88568 9.88561M5.17163 10.8284L6.11444 9.88561" stroke="var(--neutral-400)" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

// Derive avatar initials from a display name ("E. Johnson" → "EJ").
function nameToInitials(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// A document is "addressed" once it has been passed or failed; the incoming
// chart status carries that over (Passed / Failed), otherwise it is pending.
const isAddressed = (doc) => doc?.status === 'Passed' || doc?.status === 'Failed';
const actionForStatus = (doc) =>
  doc?.status === 'Passed' ? 'pass' : doc?.status === 'Failed' ? 'fail' : null;

/**
 * ChartDetailDrawer — "Document Review" full-width overlay opened
 * from the ChartPopover. Left pane shows the selected chart PDF; right pane
 * lists every document on the patient's chart, with the entry document (or,
 * when opened via "View more", the first not-yet-reviewed document) selected
 * by default. Figma: ICD-Import 4481:112907.
 *
 * @param {object}   props
 * @param {object[]} props.charts    – full document list from getChartDocs
 * @param {string}   [props.initialId] – id of the doc to select; when omitted
 *                                       (opened from "View more") the first
 *                                       pass/fail-not-addressed doc is selected
 * @param {object}   props.member    – worklist member (patient banner + PDF)
 * @param {function} props.onClose
 */
export function ChartDetailDrawer({ charts, initialId, member, onClose }) {
  const docs = charts || [];

  // Selected document: the one entered from, else the first unaddressed, else
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

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

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
  const [upFile, setUpFile] = useState(null);
  const [upCaption, setUpCaption] = useState('');
  const [upCaptionTouched, setUpCaptionTouched] = useState(false);
  const [upType, setUpType] = useState('');
  const [uploadKey, setUploadKey] = useState(0); // remount UploadDropField to reset it
  // Once a file lands in the drop zone, seed the Caption with the file's
  // name (extension stripped) so the user has a sensible default. Stop
  // auto-syncing as soon as the user types their own caption; a subsequent
  // file swap re-syncs. Matches the UploadChartDrawer behavior.
  useEffect(() => {
    if (!upFile || upCaptionTouched) return;
    setUpCaption(upFile.name.replace(/\.[a-z0-9]+$/i, ''));
  }, [upFile, upCaptionTouched]);
  useEffect(() => {
    if (!actionPos) return;
    const onDoc = (e) => {
      if (!actionRef.current?.contains(e.target) && !e.target.closest?.(`.${styles.statusMenu}`)) setActionPos(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [actionPos]);

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
  const hccDiagCommentsAll = useAppStore(s => s.hccDiagComments);
  const commentsCountForMember = hccDiagCommentsAll.length;

  // Build the four-stage review timeline for the popover. Reads the same
  // dosState + member the ReviewProgressPopover already understands.
  const hccDosAssignmentsMap = useAppStore(s => s.hccDosAssignments);
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

  // Wraps the shared Drawer so this reviewer participates in the same
  // portal + slide animation + overlay behavior as every other drawer.
  // `width={1300}` keeps the wide two-pane layout; `bodyClassName={styles.body}`
  // resets the shared 16px body padding to the flex two-pane container.
  return (
    <>
      <Drawer
        title="Document Review"
        onClose={handleClose}
        width={1300}
        bodyClassName={`${styles.body} ${isEmpty ? styles.bodyEmpty : ''}`}
      >
        {/* Body — two panes normally; right-pane only once the last doc is
            unlinked (left preview closed, Upload section shown). PatientBanner
            + Created meta strip live INSIDE the right pane per Figma
            ICD-Import 4481:112909, so the left PDF gets the full drawer height. */}
        <>
          {/* Left — PDF preview, or the Comments panel when the header
              "Comment" action is toggled on. Panel writes/reads the same
              hccDiagComments store the Diagnosis Gap drawer uses, so support
              comments dropped here appear in DiagPanel's Comments tab. */}
          {!isEmpty && leftPanel === 'comments' && (
            <div className={styles.leftPane}>
              <div className={styles.paneHeader}>
                <span>Comments</span>
                <CloseButton size={18} onClick={() => setLeftPanel('preview')} className={styles.iconBtn} label="Close comments" />
              </div>
              <ChartCommentsPanel member={m} />
            </div>
          )}
          {!isEmpty && selected && leftPanel === 'preview' && (
            <div className={styles.leftPane}>
              <div className={styles.paneHeader}>{selected.n}</div>
              <div className={styles.pdfWrap}>
                {selected.pdf ? (
                  <FilePreview src={selected.pdf} name={selected.n} ext={selected.ext} />
                ) : (
                  <DocEvidenceViewer member={member} />
                )}
              </div>
            </div>
          )}

          {/* Right — metadata + document list */}
          <div className={styles.rightPane}>
            {/* Shared PatientBanner — scoped to the right column (Figma
                ICD-Import 4481:112909). */}
            <PatientBanner
              initials={member?.in || (member?.name || 'P').split(' ').map(w => w[0]).slice(0, 2).join('')}
              name={member?.name || 'Patient'}
              gender={gender}
              age={member?.age || ''}
              dob={member?.dob}
              memberId={member?.memberId || `#${member?.id || ''}`}
              raf={member?.raf}
              rafChange={member?.ri}
              rafUp={member?.ru !== false}
            />
            {/* Created / Support Team / assignee / status strip. */}
            <div className={styles.metaStrip}>
              <div className={styles.createdGroup}>
                <span className={styles.createdLabel}>Created :</span>
                <span className={styles.createdDate}>{member?.date || '06/15/2026'}</span>
                {overdue && <span className={styles.overdue}>({member.due})</span>}
              </div>
              <span className={styles.vDivider} />
              <span
                ref={teamBadgeRef}
                className={styles.teamBadge}
                onMouseEnter={onTeamPillEnter}
                onMouseLeave={onTeamPillLeave}
                onClick={onTeamPillClick}
                role="button"
                tabIndex={0}
                aria-label={`Support Team — review ${Math.round(teamReviewProgress * 100)}% complete. Hover or click for details.`}
                aria-expanded={!!teamPillRect}
              >
                <ProgressRing progress={teamReviewProgress} size={16} stroke={2} />
                <span>Support Team</span>
              </span>
              {teamPillRect && (
                <ReviewProgressPopover
                  anchorRect={teamPillRect}
                  stages={teamReviewStages}
                  onEnter={cancelTeamClose}
                  onLeave={requestTeamClose}
                  onClose={() => { setTeamPillPinned(false); setTeamPillRect(null); }}
                />
              )}
              <div className={styles.metaStripEnd}>
                {isSupportAssigned ? (
                  <RoleTooltip name={supportName} role="Support Team" initials={supportInitials} variant="provider">
                    {supportLocked ? (
                      <span
                        className={`${styles.dmBadge} ${styles.dmBadgeLocked}`}
                        aria-label={supportName}
                      >
                        <span className={styles.dmAvatar}>{supportInitials}</span>
                      </span>
                    ) : (
                      <button type="button" ref={dmRef} className={styles.dmBadge} onClick={openAssign} aria-label={supportName}>
                        <span className={styles.dmAvatar}>{supportInitials}</span>
                        <Icon name="solar:alt-arrow-down-linear" size={11} color="var(--secondary-300)" />
                      </button>
                    )}
                  </RoleTooltip>
                ) : (
                  <button type="button" ref={dmRef} className={styles.dmUnassigned} onClick={openAssign} title="Assign Support Team" aria-label="Assign Support Team">
                    <Icon name="solar:user-plus-linear" size={14} color="var(--neutral-300)" />
                    <Icon name="solar:alt-arrow-down-linear" size={11} color="var(--neutral-300)" />
                  </button>
                )}
                <span className={styles.vDivider} />
                <button
                  type="button"
                  ref={actionRef}
                  className={styles.actionNeeded}
                  style={{ color: currentBadge.color, background: currentBadge.bg, borderColor: currentBadge.border }}
                  onClick={supportActionsLocked ? undefined : openAction}
                  disabled={supportActionsLocked}
                  title={supportActionsLocked ? supportLockedTip : undefined}
                  aria-disabled={supportActionsLocked}
                >
                  <StatusIcon status={currentStatus.key} size={12} />
                  {currentStatus.label}
                  {!supportActionsLocked && (
                    <Icon name="solar:alt-arrow-down-linear" size={12} color={currentBadge.color} />
                  )}
                </button>
              </div>
            </div>
            {showReviewBanner && (
              <div className={styles.passBanner}>
                <Icon name="solar:info-circle-linear" size={16} color="var(--status-success)" />
                <span>{reviewerName} Completed Document Review Task on {member?.date || '—'}.</span>
              </div>
            )}

            <div className={styles.rightBody}>
              <div className={styles.assocRow}>
                <div className={styles.assocLeft}>
                  <span className={styles.assocLabel}>Document Associated with</span>
                  <button
                    type="button"
                    className={styles.dosBadge}
                    onClick={() => setDosExpanded(o => !o)}
                    aria-expanded={dosExpanded}
                  >
                    {dosList.length} DOSs
                    <Icon name={dosExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={11} color="var(--primary-300)" />
                  </button>
                </div>
                <div className={styles.assocActions}>
                  <button
                    type="button"
                    className={styles.uploadLink}
                    onClick={() => setShowUpload(v => !v)}
                    disabled={supportActionsLocked}
                    title={supportActionsLocked ? supportLockedTip : undefined}
                  >
                    <Icon name="solar:upload-minimalistic-linear" size={16} color="var(--primary-300)" />
                    Upload
                  </button>
                  <span className={styles.assocActionsDivider} aria-hidden="true" />
                  <ActionButton
                    icon="solar:chat-round-linear"
                    size="S"
                    tooltip={supportActionsLocked ? supportLockedTip : 'Comment'}
                    tooltipLeft={supportActionsLocked}
                    tooltipBelow={supportActionsLocked}
                    count={commentsCountForMember > 0 ? String(commentsCountForMember) : undefined}
                    className={leftPanel === 'comments' ? styles.commentBtnActive : ''}
                    onClick={supportActionsLocked ? undefined : () => setLeftPanel(v => v === 'comments' ? 'preview' : 'comments')}
                    aria-pressed={leftPanel === 'comments'}
                    state={supportActionsLocked ? 'disabled' : 'active'}
                  />
                </div>
              </div>

              {/* Expandable DOS list with a per-DOS toggle (mirrors the
                  Diagnosis Gap drawer). */}
              {dosExpanded && dosList.length > 0 && (
                <div className={styles.dosPanel}>
                  {dosList.map(d => {
                    const provider = d.provider || m?.rp || '—';
                    const pos = d.pos || d.posDesc || m?.pos || m?.posDesc || '—';
                    const vt = d.vt || m?.vt || 'HCC';
                    return (
                      <div key={d.date} className={styles.dosPanelRow}>
                        <div className={styles.dosPanelInfo}>
                          <div className={styles.dosPanelDate}>{d.date}</div>
                          <div className={styles.dosPanelMeta}>
                            Rendering Provider: {provider}
                            <span className={styles.dosPanelSep}>•</span>
                            POS: {pos}
                            <span className={styles.dosPanelSep}>•</span>
                            Visit Type: {vt}
                          </div>
                        </div>
                        {canDeleteDos && (
                          <ActionButton
                            size="S"
                            icon="solar:trash-bin-trash-linear"
                            tooltip="Delete DOS"
                            onClick={() => setDosToDelete(d.date)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {showUpload && (
                <div className={styles.uploadPanel}>
                  <DemoPhiStrip />
                  <UploadDropField key={uploadKey} onChange={setUpFile} />
                  <div className={styles.uploadField}>
                    <span className={styles.uploadLabel}>Caption<span className={styles.uploadReq} aria-hidden="true" /></span>
                    <input
                      type="text"
                      className={styles.uploadInput}
                      placeholder="Add caption"
                      value={upCaption}
                      onChange={(e) => { setUpCaption(e.target.value); setUpCaptionTouched(true); }}
                    />
                  </div>
                  <div className={styles.uploadField}>
                    <span className={styles.uploadLabel}>Document Type<span className={styles.uploadReq} aria-hidden="true" /></span>
                    <Select
                      className={styles.uploadSelect}
                      options={DOC_TYPES.map((t) => ({ value: t, label: t }))}
                      value={upType}
                      onChange={setUpType}
                      placeholder="Select Type"
                    />
                  </div>
                  <div className={styles.uploadActions}>
                    <Button variant="primary" size="S" disabled={!canSaveUpload} onClick={saveUpload}>Save</Button>
                    <Button variant="secondary" size="S" onClick={resetUpload}>Discard</Button>
                  </div>
                </div>
              )}

              {docs.map((d) => {
                const action = docActions[d.id] || null;
                const isSel = d.id === selected.id;
                const isFailing = failPrompt?.id === d.id;
                const isEditingRow = editingDocId === d.id;
                return (
                  <div
                    key={d.id}
                    className={`${styles.docCard} ${isSel ? styles.docCardSelected : ''} ${(isFailing || isEditingRow) ? styles.docCardFailing : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(d.id)}
                    onKeyDown={(e) => {
                      // Only act when the card div itself is focused — otherwise a
                      // space typed into the inline Fail form's textarea (or any
                      // nested input) bubbles up and gets preventDefault'd here.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(d.id); }
                    }}
                  >
                    <div className={styles.docCardHeader}>
                      <span className={styles.docThumb} aria-hidden="true">
                        <Icon name="custom:pdf-file" size={20} color="var(--neutral-400)" />
                      </span>
                      <div className={styles.docCardText}>
                        <span className={styles.docName}>{d.caption || d.n}</span>
                        <span className={styles.docMeta}>
                          {d.t} • {d.dateAdded || '—'} • {d.addedBy || '—'}
                        </span>
                      </div>
                      <div className={styles.docActions} onClick={(e) => e.stopPropagation()}>
                        {action === 'pass' ? (
                          <>
                            <span className={styles.passedBadge}>
                              <Icon name="solar:check-read-linear" size={12} color="var(--status-success)" />
                              Passed
                            </span>
                            <button
                              type="button"
                              className={styles.undoBtn}
                              aria-label="Undo"
                              disabled={supportActionsLocked}
                              title={supportActionsLocked ? supportLockedTip : 'Undo'}
                              onClick={() => undoDoc(d.id)}
                            >
                              <Icon name="solar:undo-left-round-linear" size={16} color="var(--neutral-400)" />
                            </button>
                          </>
                        ) : action === 'fail' ? (
                          <>
                            <FailedBadgeWithTooltip details={failDetails[d.id]} />
                            <button
                              type="button"
                              className={styles.undoBtn}
                              aria-label="Undo"
                              disabled={supportActionsLocked}
                              title={supportActionsLocked ? supportLockedTip : 'Undo'}
                              onClick={() => undoDoc(d.id)}
                            >
                              <Icon name="solar:undo-left-round-linear" size={16} color="var(--neutral-400)" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.passFailPill}
                              title={supportActionsLocked ? supportLockedTip : 'Pass'}
                              disabled={supportActionsLocked}
                              onClick={() => passDoc(d.id)}
                            >
                              <Icon name="solar:check-circle-linear" size={12} color="var(--neutral-300)" />
                              Pass
                            </button>
                            <button
                              type="button"
                              className={styles.passFailPill}
                              title={supportActionsLocked ? supportLockedTip : 'Fail'}
                              disabled={isFailing || supportActionsLocked}
                              onClick={() => failDoc(d.id)}
                            >
                              <Icon name="solar:close-circle-linear" size={12} color="var(--neutral-300)" />
                              Fail
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className={styles.moreBtn}
                          aria-label="More actions"
                          disabled={supportActionsLocked}
                          title={supportActionsLocked ? supportLockedTip : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (moreMenu?.docId === d.id) { setMoreMenu(null); return; }
                            const r = e.currentTarget.getBoundingClientRect();
                            setMoreMenu({ docId: d.id, top: r.bottom + 4, right: window.innerWidth - r.right });
                          }}
                        >
                          <Icon name="solar:menu-dots-linear" size={15} color="currentColor" />
                        </button>
                      </div>
                    </div>
                    {isFailing && (
                      <FailReasonInline
                        onCancel={() => setFailPrompt(null)}
                        onConfirm={confirmFailDoc}
                      />
                    )}
                    {isEditingRow && (
                      <EditDocInline
                        doc={d}
                        onCancel={() => setEditingDocId(null)}
                        onSave={({ caption, docType }) => {
                          updateChartDocMeta(m.id, d.id, { n: caption, caption, t: docType });
                          showToast(`Updated ${caption}`);
                          setEditingDocId(null);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      </Drawer>

      {/* Portaled to document.body so `position: fixed` uses the viewport as
          its containing block. If we left the menu inside the drawer panel,
          its transform (entry animation) would make the panel the containing
          block instead, and the right-offset math would push the menu off
          the visible area. */}
      {moreMenu && createPortal(
        <div
          className={styles.docMoreMenu}
          style={{ top: moreMenu.top, right: moreMenu.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.docMoreItem}
            onClick={() => {
              const doc = docs.find(d => d.id === moreMenu.docId);
              setMoreMenu(null);
              if (!doc) return;
              // Inline edit — the doc card renders a Caption + Document Type
              // editor in place of the header actions until the user saves
              // or cancels.
              setEditingDocId(doc.id);
              setSelectedId(doc.id);
            }}
          >
            <Icon name="solar:pen-linear" size={16} color="var(--neutral-400)" />
            Edit
          </button>
          <button
            type="button"
            className={styles.docMoreItem}
            onClick={() => {
              const doc = docs.find(d => d.id === moreMenu.docId);
              setMoreMenu(null);
              if (doc) setConfirmDeleteDoc({ id: doc.id, name: doc.n });
            }}
          >
            <Icon name="solar:trash-bin-2-linear" size={16} color="var(--status-error)" />
            Delete
          </button>
        </div>,
        document.body,
      )}
      {confirmDeleteDoc && (
        <ConfirmDialog variant="destructive"
          title="Delete document?"
          description={`"${confirmDeleteDoc.name}" will be removed from this record. This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDeleteDoc(null)}
          onConfirm={() => {
            unlinkDoc(confirmDeleteDoc.id);
            setConfirmDeleteDoc(null);
          }}
        />
      )}
      {insufficientPrompt && (
        <InsufficientDosDialog
          onCancel={() => setInsufficientPrompt(null)}
          onConfirm={confirmInsufficient}
        />
      )}

      {dosToDelete && (
        <ConfirmDialog
          icon="solar:trash-bin-trash-linear"
          iconColor="var(--status-error)"
          title={`Delete DOS ${dosToDelete}?`}
          description="This removes the DOS from both the Document Review and Diagnosis Gap drawers. This action can't be undone."
          confirmLabel="Delete"
          variant="error"
          onCancel={() => setDosToDelete(null)}
          onConfirm={confirmDeleteDos}
        />
      )}

      {assignPos && (
        <div
          className={styles.assignMenu}
          style={{ top: assignPos.top, right: assignPos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.assignTitle}>Assign Support Team</div>
          {supportStaff.map(s => (
            <button
              key={s.id}
              type="button"
              className={styles.assignItem}
              onClick={() => assignSupport(s)}
            >
              <Avatar variant="assignee" initials={s.initials} />
              <span className={styles.assignName}>{s.name}</span>
              <span className={styles.assignRole}>Support Team</span>
            </button>
          ))}
        </div>
      )}

      {actionPos && (
        <div
          className={styles.statusMenu}
          style={{ top: actionPos.top, left: actionPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {STATUS_OPTIONS.map(opt => {
            const sel = opt.key === effectiveStatus;
            return (
              <button
                key={opt.key}
                type="button"
                className={`${styles.statusItem} ${sel ? styles.statusItemSelected : ''}`}
                onClick={() => chooseStatus(opt.key)}
              >
                <StatusIcon status={opt.key} size={16} />
                <span
                  className={styles.statusLabel}
                  style={{ color: sel ? 'var(--primary-300)' : (opt.textColor || 'var(--neutral-400)') }}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// Reasons offered when marking a document Failed. Mirrors the Figma spec
// on ICD-Import 4806:142581 — the canonical HCC review vocabulary used by
// the Support team when a chart document can't be accepted as evidence.
const FAIL_REASONS = [
  'Missing signature',
  'Wrong document type',
  'Illegible document',
  'Incomplete fields',
  'Document belongs to wrong patient',
  'Document outside valid date range',
  'Progress Note/Attachment Not available',
  'DOS Not Charted',
  'Provider Name Not Printed',
  'POS Not Available',
  'Other',
];

// Inline fail-reason form — renders INSIDE the doc card whose Fail button
// was clicked, so the doc header (name + meta + Pass/Fail/⋯) and the
// reason picker read as one bordered container per Figma. Keeps every
// other doc row and header action live so the reviewer can bail out
// (three-dots, hover on the status pill, etc.) without an overlay
// blocking the surface.
function FailReasonInline({ onCancel, onConfirm }) {
  // Multi-select: the reviewer can flag more than one reason on a fail
  // (e.g. "Illegible" AND "Missing Signature"). Stored as a Set for O(1)
  // toggle; onConfirm hands out an array in the original option order.
  const [reasons, setReasons] = useState(() => new Set());
  const [comment, setComment] = useState('');
  const toggleReason = (r) => setReasons((prev) => {
    const next = new Set(prev);
    if (next.has(r)) next.delete(r); else next.add(r);
    return next;
  });
  // At least one reason is always required. The comment is optional — with
  // one exception: picking "Other" makes it mandatory, since the reviewer
  // owes a specific reason for the downstream reviewer to act on. When
  // required, a red asterisk appears next to the Comment label.
  const commentRequired = reasons.has('Other');
  const canSubmit = reasons.size > 0 && (!commentRequired || comment.trim().length > 0);
  return (
    <div className={styles.failInline} onClick={(e) => e.stopPropagation()}>
      <div className={styles.failBody}>
        <div className={styles.failIntro}>
          Select a reason and add a note to mark document as a failed:
          <span className={styles.failNoteRequired} aria-hidden="true"> *</span>
        </div>
        <div className={styles.failReasons}>
          {FAIL_REASONS.map((r) => {
            const checked = reasons.has(r);
            return (
              <button
                key={r}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={r}
                className={styles.reasonOption}
                onClick={(e) => { e.stopPropagation(); toggleReason(r); }}
              >
                <Checkbox
                  checked={checked}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none"
                />
                <span className={styles.reasonLabel}>{r}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.failNoteLabel}>
          Comment
          {commentRequired && <span className={styles.failNoteRequired} aria-hidden="true"> *</span>}
        </div>
        <Textarea
          rows={3}
          placeholder="Add a Comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div className={styles.failActions}>
        <Button
          variant="danger"
          size="S"
          disabled={!canSubmit}
          onClick={() => onConfirm({ reasons: FAIL_REASONS.filter(r => reasons.has(r)), note: comment })}
        >
          Confirm
        </Button>
        <Button variant="secondary" size="S" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// Inline metadata editor — the doc card's second row when the ⋯ menu's Edit
// item is picked. Only caption + document type are editable (the file
// itself stays put); Save writes through updateChartDocMeta upstream.
function EditDocInline({ doc, onCancel, onSave }) {
  const [caption, setCaption] = useState(doc?.caption || doc?.n || '');
  const [docType, setDocType] = useState(doc?.t || '');
  const canSave = caption.trim().length > 0 && !!docType;
  return (
    <div className={styles.failInline} onClick={(e) => e.stopPropagation()}>
      <div className={styles.failBody}>
        <div className={styles.failNoteLabel}>Caption</div>
        <input
          type="text"
          className={styles.editInput}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Document caption"
          autoFocus
        />
        <div className={styles.failNoteLabel}>Document Type</div>
        <Select
          className={styles.editSelectTrigger}
          options={DOC_TYPES.map(t => ({ value: t, label: t }))}
          value={docType}
          onChange={setDocType}
          placeholder="Select a type"
        />
      </div>
      <div className={styles.failActions}>
        <Button
          variant="primary"
          size="S"
          disabled={!canSave}
          onClick={() => onSave({ caption: caption.trim(), docType })}
        >
          Save
        </Button>
        <Button variant="secondary" size="S" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/**
 * Hover tooltip for a doc row's "Failed" badge. Renders the design's
 * "Failed Due to:" card — bulleted reasons + a subtle Comment box — as a
 * portalled popover so it can escape the doc-row + drawer stacking
 * contexts. Falls back to the base badge (no tooltip) when there are no
 * reasons captured (e.g. a legacy fail with no metadata).
 */
function FailedBadgeWithTooltip({ details }) {
  const badgeRef = useRef(null);
  const openTimer = useRef(null);
  const [rect, setRect] = useState(null);

  const reasons = details?.reasons || [];
  const note = (details?.note || '').trim();
  const hasContent = reasons.length > 0 || note.length > 0;

  const open = () => {
    if (!hasContent) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      const r = badgeRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    }, 120);
  };
  const close = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    setRect(null);
  };
  useEffect(() => () => clearTimeout(openTimer.current), []);

  const W = 260;
  const style = rect
    ? { top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - W - 8), width: W }
    : null;

  return (
    <>
      <span
        ref={badgeRef}
        className={styles.failedBadge}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        tabIndex={hasContent ? 0 : -1}
      >
        <Icon name="solar:close-circle-linear" size={12} color="var(--status-error)" />
        Failed
      </span>
      {rect && hasContent && createPortal(
        <div
          role="tooltip"
          aria-label="Fail reasons"
          className={styles.failTooltip}
          style={style}
        >
          {reasons.length > 0 && (
            <>
              <div className={styles.failTooltipHeading}>Failed Due to:</div>
              <ul className={styles.failTooltipList}>
                {reasons.map(r => <li key={r}>{r}</li>)}
              </ul>
            </>
          )}
          {note && (
            <div className={styles.failTooltipComment}>Comment: {note}</div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * Comment panel rendered in the left column when the header "Comment" action
 * is toggled on. Composer + timeline read/write the SAME `hccDiagComments`
 * store slice the Diagnosis Gap drawer's Comments tab uses — no separate
 * chart-scoped list, so a comment posted here shows up there and vice-versa.
 * Stamps `dos` from the member's primary DOS (matches DiagPanel's scoping);
 * `icd` is left null because this drawer is chart-level, not ICD-scoped.
 */
function ChartCommentsPanel({ member }) {
  const comments = useAppStore(s => s.hccDiagComments);
  const addHccDiagComment = useAppStore(s => s.addHccDiagComment);
  const addActivityEntry = useAppStore(s => s.addActivityEntry);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const hccUserRole = useAppStore(s => s.hccUserRole);

  // Show the full comment thread — no per-DOS or per-member filter here.
  // DiagPanel's Comments tab renders every row too, so the two views agree
  // 1:1 (per the sync requirement).
  const visibleComments = comments;

  const addComment = (body) => {
    if (!body) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const hours = now.getHours();
    const time = `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
    const author = currentUserProfile?.name || 'You';
    const role = hccUserRole || 'Support';
    const dos = member?.dos_list?.[0]?.date || member?.dos || null;
    const row = { id: `c${Date.now()}`, author, role, date, time, body, icd: null, dos };
    addHccDiagComment(row);
    addActivityEntry?.({
      t: 'comment', by: author, role,
      headline: 'Added a Comment',
      details: [{ note: body }],
    });
  };

  return (
    <div className={styles.commentsPanel}>
      <div className={styles.commentsComposerWrap}>
        <CommentComposer onSubmit={addComment} placeholder="Add a comment, use @ to mention someone" />
      </div>
      <div className={styles.commentsList}>
        {visibleComments.length === 0 ? (
          <div className={styles.commentsEmpty}>
            <Icon name="solar:chat-round-linear" size={20} color="var(--neutral-200)" />
            <span>No comments yet. Drop the first one above.</span>
          </div>
        ) : visibleComments.map((c) => (
          <div key={c.id} className={styles.commentRow}>
            <span className={styles.commentAvatar} aria-hidden="true">
              {(c.author || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
            </span>
            <div className={styles.commentBubble}>
              <div className={styles.commentMeta}>
                <span className={styles.commentAuthor}>{c.author}</span>
                <span className={styles.commentRole}>({c.role})</span>
                <span className={styles.commentDot} aria-hidden="true">•</span>
                <span className={styles.commentDate}>{c.date} · {c.time}</span>
                {c.edited && <span className={styles.commentEdited}>Edited</span>}
              </div>
              <div className={styles.commentBody}>{c.body}</div>
              {c.icd && (
                <div className={styles.commentScope}>ICD {c.icd}{c.dos ? ` · DOS ${c.dos}` : ''}</div>
              )}
              {!c.icd && c.dos && (
                <div className={styles.commentScope}>DOS {c.dos}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// DOS-level reasons for marking the whole record Insufficient. A tighter
// subset of FAIL_REASONS — the record-level vocabulary is narrower than the
// per-document one because doc-only reasons ("DOS Not Charted", "POS Not
// Available", …) don't apply once you're grading the DOS as a whole.
const INSUFFICIENT_REASONS = [
  'Document belongs to wrong patient',
  'Document outside valid date range',
  'Illegible document',
  'Incomplete fields',
  'Missing signature',
  'Wrong document type',
  'Other',
];

/**
 * Modal shown when Support picks the record-level "Insufficient" status.
 * Design: white card, centred, close X, multi-select reason checkboxes,
 * optional note (mandatory when "Other" is picked, mirroring the doc-level
 * FailReasonInline rule). Confirm commits the status upstream.
 */
function InsufficientDosDialog({ onCancel, onConfirm }) {
  const [reasons, setReasons] = useState(() => new Set());
  const [note, setNote] = useState('');
  const toggleReason = (r) => setReasons(prev => {
    const next = new Set(prev);
    if (next.has(r)) next.delete(r); else next.add(r);
    return next;
  });
  const commentRequired = reasons.has('Other');
  const canSubmit = reasons.size > 0 && (!commentRequired || note.trim().length > 0);
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <AlertDialogContent className={`${styles.insufficientDialog} !max-w-[420px]`}>
        <div className={styles.insufficientHeader}>
          <div className={styles.insufficientTitleGroup}>
            <AlertDialogTitle className={styles.insufficientTitle}>
              Mark documents Insufficient
            </AlertDialogTitle>
            <AlertDialogDescription className={styles.insufficientSubtitle}>
              Please select a reason. Adding a note is optional
            </AlertDialogDescription>
          </div>
          <CloseButton size={16} onClick={onCancel} className={styles.insufficientClose} />
        </div>
        <div className={styles.insufficientReasons}>
          {INSUFFICIENT_REASONS.map((r) => {
            const checked = reasons.has(r);
            return (
              <div
                key={r}
                role="checkbox"
                tabIndex={0}
                aria-checked={checked}
                aria-label={r}
                className={styles.reasonOption}
                onClick={() => toggleReason(r)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleReason(r); } }}
              >
                <Checkbox
                  checked={checked}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none"
                />
                <span className={styles.reasonLabel}>{r}</span>
              </div>
            );
          })}
        </div>
        {commentRequired && (
          <div className={styles.failNoteLabel}>
            Note<span className={styles.failNoteRequired} aria-hidden="true"> *</span>
          </div>
        )}
        <Textarea
          rows={2}
          placeholder={commentRequired ? 'Add a note explaining "Other"' : 'Add a note (optional)'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className={styles.insufficientActions}>
          <Button
            variant="danger"
            size="S"
            disabled={!canSubmit}
            onClick={() => onConfirm({ reasons: INSUFFICIENT_REASONS.filter(r => reasons.has(r)), note })}
          >
            Confirm
          </Button>
          <Button variant="secondary" size="S" onClick={onCancel}>Cancel</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
