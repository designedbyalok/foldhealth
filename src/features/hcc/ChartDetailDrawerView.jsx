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
import { DocEvidenceViewer } from './DiagPanel/DocEvidenceViewer';
import { ReviewProgressPopover } from './DiagPanel/ReviewProgressPopover';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Textarea } from '../../components/Textarea/Textarea';
import {
  StatusIcon,
  FailReasonInline,
  EditDocInline,
  FailedBadgeWithTooltip,
  ChartCommentsPanel,
  InsufficientDosDialog,
} from './ChartDetailDrawerParts';
import { STATUS_OPTIONS, STATUS_BADGE } from './ChartDetailDrawer.utils';
import { DOC_TYPES } from './data/chartDocs';
import styles from './ChartDetailDrawer.module.css';
import { ChartDetailDrawerViewRightPane } from './ChartDetailDrawerViewRightPane';

export function ChartDetailDrawerView(props) {
  const { actionPos, actionRef, assignPos, assignSupport, canDeleteDos, canSaveUpload, cancelTeamClose, chooseStatus, commentsCountForMember, confirmDeleteDoc, confirmDeleteDos, confirmFailDoc, confirmInsufficient, currentBadge, currentStatus, dmRef, docActions, docs, dosExpanded, dosList, dosToDelete, editingDocId, effectiveStatus, failDetails, failDoc, failPrompt, gender, handleClose, insufficientPrompt, isEmpty, isSupportAssigned, leftPanel, m, moreMenu, onTeamPillClick, onTeamPillEnter, onTeamPillLeave, openAction, openAssign, overdue, passDoc, requestTeamClose, resetUpload, reviewerName, saveUpload, selected, setConfirmDeleteDoc, setDosExpanded, setDosToDelete, setEditingDocId, setFailPrompt, setInsufficientPrompt, setLeftPanel, setMoreMenu, setSelectedId, setShowUpload, setTeamPillPinned, setTeamPillRect, setUpCaption, setUpCaptionTouched, setUpFile, setUpType, showReviewBanner, showToast, showUpload, supportActionsLocked, supportInitials, supportLocked, supportLockedTip, supportName, supportStaff, teamBadgeRef, teamPillRect, teamReviewProgress, teamReviewStages, undoDoc, unlinkDoc, upCaption, upType, updateChartDocMeta, uploadKey, member } = props;

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
                {(selected.pdf || selected.file) ? (
                  <FilePreview src={selected.pdf} file={selected.file} name={selected.n} ext={selected.ext} />
                ) : (
                  <DocEvidenceViewer member={member} />
                )}
              </div>
            </div>
          )}

          <ChartDetailDrawerViewRightPane {...props} />
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
