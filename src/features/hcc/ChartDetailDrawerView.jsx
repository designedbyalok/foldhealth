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
import { openSafeUrl } from '../../lib/openSafeUrl';
import { DemoPhiStrip } from '../../components/DemoPhiStrip/DemoPhiStrip';
import { Select } from '../../components/Select/Select';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { DocEvidenceViewer } from './DiagPanel/DocEvidenceViewer';
import { ReviewProgressPopover } from './DiagPanel/ReviewProgressPopover';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { Textarea } from '../../components/Textarea/Textarea';
import {
  StatusIcon,
  FailReasonInline,
  EditDocInline,
  FailedBadgeWithTooltip,
  InsufficientDosDialog,
} from './ChartDetailDrawerParts';
import { CommentsTab, ActivityTab, FilterRow, computeFilterOptions } from './DiagPanel/LeftWorkspace';
import { Tabs } from '../../components/Tabs/Tabs';
import { useAppStore } from '../../store/useAppStore';
import { useMemo, useRef, useState, useEffect } from 'react';
import { ACTIVITY, getActivityFromDb } from './data/activity';

// Status pill palette shared with DocPreviewDrawer so the PDF-pane
// header reads the same in the coder / QA / compliance preview
// drawer as it does inside the Support review drawer.
const PDF_STATUS_STYLE = {
  Passed:  { color: 'var(--status-success)', bg: 'var(--status-success-light)', border: 'rgba(0, 155, 83, 0.2)',  icon: 'solar:check-read-linear',    label: 'Passed' },
  Failed:  { color: 'var(--status-error)',   bg: 'var(--status-error-light)',   border: 'rgba(215, 40, 37, 0.2)', icon: 'solar:close-circle-linear',  label: 'Failed' },
  Pending: { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)',           border: 'var(--neutral-150)',     icon: 'solar:clock-circle-linear',  label: 'Pending' },
};
import { STATUS_OPTIONS, STATUS_BADGE } from './ChartDetailDrawer.utils';
import { DOC_TYPES } from './data/chartDocs';
import styles from './ChartDetailDrawer.module.css';
import { ChartDetailDrawerViewRightPane } from './ChartDetailDrawerViewRightPane';

export function ChartDetailDrawerView(props) {
  const { actionPos, actionRef, assignPos, assignSupport, canDeleteDos, canSaveUpload, cancelTeamClose, chooseStatus, commentsCountForMember, confirmDeleteDoc, confirmDeleteDos, confirmFailDoc, confirmInsufficient, currentBadge, currentStatus, dmRef, docActions, docs, dosExpanded, dosList, dosToDelete, editingDocId, effectiveStatus, failDetails, failDoc, failPrompt, gender, handleClose, insufficientPrompt, isEmpty, isSupportAssigned, leftPanel, m, moreMenu, onTeamPillClick, onTeamPillEnter, onTeamPillLeave, openAction, openAssign, overdue, passDoc, requestTeamClose, resetUpload, reviewerName, saveUpload, selected, setConfirmDeleteDoc, setDosExpanded, setDosToDelete, setEditingDocId, setFailPrompt, setInsufficientPrompt, setLeftPanel, setMoreMenu, setSelectedId, setShowUpload, setTeamPillPinned, setTeamPillRect, setUpCaption, setUpCaptionTouched, setUpFile, setUpType, upVisitType, setUpVisitType, showReviewBanner, showToast, showUpload, supportActionsLocked, supportInitials, supportLocked, supportLockedTip, supportName, supportStaff, teamBadgeRef, teamPillRect, teamReviewProgress, teamReviewStages, undoDoc, unlinkDoc, upCaption, upType, updateChartDocMeta, uploadKey, member } = props;

  // When true, the PDF preview takes the full drawer width and both
  // the tabbed Comments/Timeline left column AND the right-hand doc
  // listing are hidden. Local state, resets when the drawer unmounts.
  const [pdfExpanded, setPdfExpanded] = useState(false);

  // Merge live activity (this session's doc-status / comment / assignment
  // writes via `addActivityEntry`) with the mock / DB-seeded log, same
  // recipe LeftWorkspace uses so the Timeline pane here reads 1:1 with
  // the DiagPanel Activity tab.
  const liveLog = useAppStore(s => s.hccActivityLog[m?.name]);
  const activityFromDb = useAppStore(s => s.hccGapActivity);
  const rawActivity = useMemo(() => {
    const mock = getActivityFromDb(activityFromDb, m?.name) || ACTIVITY[m?.name] || ACTIVITY._default || [];
    if (!liveLog?.length) return mock;
    const todayLabel = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
    const header = mock[0]?.t === 'group' && mock[0]?.label === todayLabel
      ? []
      : [{ t: 'group', label: todayLabel }];
    return [...header, ...liveLog, ...mock];
  }, [liveLog, m?.name, activityFromDb]);

  // Timeline + Comments both filter by DOS / HCC / ICD / Recorded By /
  // Date. Same shape + helpers the DiagPanel LeftWorkspace uses so a
  // filter dialled in here reads 1:1 with what the DiagPanel would
  // show. State is drawer-local; it resets when the drawer unmounts.
  // Member DOS shape varies (array of { date } in some seeds, keyed
  // object in others, missing entirely for a freshly-loaded row).
  // Guard the read so a mismatched shape never crashes the drawer.
  const memberDosList = useMemo(() => {
    if (Array.isArray(m?.dos)) {
      return Array.from(new Set(m.dos.map(d => d?.date || d).filter(Boolean)));
    }
    if (m?.dos && typeof m.dos === 'object') {
      return Array.from(new Set(Object.keys(m.dos)));
    }
    return [];
  }, [m?.dos]);
  const [chartFilters, setChartFilters] = useState({ dos: [], hcc: [], icd: [], by: [], date: [] });
  const dbCommentsAll = useAppStore(s => s.hccDiagComments);
  const dbNotesAll = useAppStore(s => s.hccDiagNotes);
  const dbDocsAll = useAppStore(s => s.hccDiagDocumentsList);
  const platformUsersAll = useAppStore(s => s.platformUsers);
  const filterOptions = useMemo(
    () => computeFilterOptions(rawActivity, m, {
      comments: dbCommentsAll,
      notes: dbNotesAll,
      docs: dbDocsAll,
      platformUsers: platformUsersAll,
    }),
    [rawActivity, m, dbCommentsAll, dbNotesAll, dbDocsAll, platformUsersAll],
  );
  // Seed DOS with the full option list so the default reads as "all
  // dates" until the reviewer narrows it. Same rule LeftWorkspace uses.
  const dosSeededRef = useRef(false);
  useEffect(() => {
    if (dosSeededRef.current) return;
    const opts = filterOptions.dos || memberDosList;
    if (opts.length) {
      setChartFilters(f => (f.dos.length === 0 ? { ...f, dos: opts } : f));
      dosSeededRef.current = true;
    }
  }, [filterOptions.dos, memberDosList]);
  const setChartFilter = (key, value) => setChartFilters(f => ({ ...f, [key]: value }));
  const clearAllChartFilters = () => setChartFilters({ dos: [], hcc: [], icd: [], by: [], date: [] });

  return (
    <>
      <Drawer
        title="Document Review"
        onClose={handleClose}
        width={1300}
        bodyClassName={`${styles.body} ${isEmpty ? styles.bodyEmpty : ''}`}
      >
        {/* Body: two panes normally; right-pane only once the last doc is
            unlinked (left preview closed, Upload section shown). PatientBanner
            + Created meta strip live INSIDE the right pane per Figma
            ICD-Import 4481:112909, so the left PDF gets the full drawer height. */}
        <>
          {/* Left: PDF preview, or the Comments panel when the header
              "Comment" action is toggled on. Panel writes/reads the same
              hccDiagComments store the Diagnosis Gap drawer uses, so support
              comments dropped here appear in DiagPanel's Comments tab. */}
          {!isEmpty && !pdfExpanded && (leftPanel === 'comments' || leftPanel === 'activity') && (
            <div className={styles.leftPane}>
              {/* Tabbed header: matches the DiagPanel left-workspace tab
                  strip. Comments count mirrors the toolbar badge; the
                  close button collapses back to the PDF preview and
                  re-selects the first doc so the right-hand card
                  highlight comes back. */}
              <div className={styles.paneTabsHeader}>
                <Tabs
                  items={[
                    { key: 'comments', label: commentsCountForMember > 0 ? `Comments(${commentsCountForMember})` : 'Comments' },
                    { key: 'activity', label: 'Timeline' },
                  ]}
                  value={leftPanel}
                  onValueChange={(k) => setLeftPanel(k)}
                  embedded
                />
                <CloseButton
                  size={18}
                  onClick={() => {
                    setLeftPanel('preview');
                    if (!selected && docs?.[0]) setSelectedId(docs[0].id);
                  }}
                  className={styles.iconBtn}
                  label={leftPanel === 'comments' ? 'Close comments' : 'Close timeline'}
                />
              </div>
              {/* Filter row: same DOS / HCC / ICD / Recorded By / Date
                  chips the DiagPanel LeftWorkspace uses, so a filter
                  set here narrows both Timeline and Comments the way
                  it would in the Diagnosis Gap surface. */}
              <FilterRow
                filters={chartFilters}
                options={filterOptions}
                onChange={setChartFilter}
                onClearAll={clearAllChartFilters}
              />
              {leftPanel === 'comments' ? (
                /* Same tab component the DiagPanel Comments tab uses, so a
                   comment posted here shows up there (and vice-versa) with
                   identical UI. memberOverride scopes the entry to this
                   drawer's patient when the DiagPanel isn't open. */
                <CommentsTab
                  filters={chartFilters}
                  memberOverride={m}
                />
              ) : (
                /* Same tab component the DiagPanel Timeline tab uses.
                   Feeds the merged live + seed activity log for THIS
                   member; entries logged from either drawer surface in
                   both. */
                <ActivityTab member={m} rawEntries={rawActivity} filters={chartFilters} />
              )}
            </div>
          )}
          {!isEmpty && (pdfExpanded || (leftPanel !== 'comments' && leftPanel !== 'activity')) && (() => {
            // When the user hits Expand from the Comments/Timeline pane
            // (where `selected` is null so the doc list has no active
            // card), fall back to the first doc so the PDF pane isn't
            // blank on toggle.
            const doc = selected || (pdfExpanded ? docs[0] : null);
            if (!doc) return null;
            return (
              <PdfPreviewPane
                selected={doc}
                member={member}
                docStatus={docActions?.[doc.id] === 'pass'
                  ? 'Passed'
                  : docActions?.[doc.id] === 'fail' ? 'Failed' : 'Pending'}
                expanded={pdfExpanded}
                onToggleExpand={() => setPdfExpanded(v => !v)}
              />
            );
          })()}

          {!pdfExpanded && <ChartDetailDrawerViewRightPane {...props} />}
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
              // Inline edit: the doc card renders a Caption + Document Type
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

// PDF preview pane: file name on the left of the header, review
// status pill + Expand + Open-in-new-tab actions on the right.
// Expand toggles an in-app full-drawer mode (right-hand doc list and
// Comments/Timeline pane hide, PDF pane takes the full width). Open
// in new tab pops the underlying PDF URL (or a fresh object URL for
// local uploads) so support can view it in their own window.
function PdfPreviewPane({ selected, member, docStatus, expanded, onToggleExpand }) {
  const status = PDF_STATUS_STYLE[docStatus] || PDF_STATUS_STYLE.Pending;
  const blobUrlRef = useRef(null);

  useEffect(() => () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, [selected?.id, selected?.pdf, selected?.file]);

  const openInNewTab = () => {
    let url = selected?.pdf || null;
    if (!url && selected?.file) {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = URL.createObjectURL(selected.file);
      url = blobUrlRef.current;
    }
    if (!url) return;
    openSafeUrl(url, 'noopener,noreferrer');
  };

  return (
    <div className={`${styles.leftPane} ${expanded ? styles.leftPaneExpanded : ''}`}>
      <div className={`${styles.paneHeader} ${styles.pdfPaneHeader}`}>
        <span className={styles.pdfPaneTitle} title={selected.n}>{selected.n}</span>
        <div className={styles.pdfPaneActions}>
          <span
            className={styles.pdfStatusPill}
            style={{ color: status.color, background: status.bg, borderColor: status.border }}
          >
            <Icon name={status.icon} size={12} color={status.color} />
            {status.label}
          </span>
          <span className={styles.pdfPaneActionsDivider} aria-hidden="true" />
          <ActionButton
            icon={expanded ? 'solar:quit-full-screen-linear' : 'solar:full-screen-linear'}
            size="sm"
            tooltip={expanded ? 'Collapse' : 'Expand'}
            tooltipBelow
            onClick={onToggleExpand}
            aria-pressed={expanded}
          />
          <ActionButton
            icon="solar:external-link-linear"
            size="sm"
            tooltip="Open in new tab"
            tooltipBelow
            tooltipLeft
            onClick={openInNewTab}
            disabled={!selected?.pdf && !selected?.file}
          />
        </div>
      </div>
      <div className={styles.pdfWrap}>
        {(selected.pdf || selected.file) ? (
          <FilePreview src={selected.pdf} file={selected.file} name={selected.n} ext={selected.ext} />
        ) : (
          <DocEvidenceViewer member={member} />
        )}
      </div>
    </div>
  );
}
