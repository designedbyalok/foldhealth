import { useAppStore } from '../../../../../../store/useAppStore';
import { Icon } from '../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { useClinicalNotePanel } from '../../../../../hedis-worklist/useClinicalNotePanel';
import { ConsolidatedNoteBody, HeaderActions as ClinicalNoteHeaderActions } from '../../../../../hedis-worklist/ClinicalNotePanelParts';
import { ClinicalNotePreviewBody } from '../../../../../hedis-worklist/ClinicalNotePreviewBody';
import { formatDate } from './noteRows';
import styles from './PatientNotesTab.module.css';

/**
 * InlineNoteView: replaces the notes card body when a row is opened
 * inline. Two variants, decided per the current viewer's relationship
 * to the note:
 *
 *   • Assigned reviewer opening a submitted note → editable
 *     ConsolidatedNoteBody with the same reviewer-flow header actions
 *     the standalone drawer uses (Save as Draft / Sign & Save).
 *   • Everyone else (author, other clinicians) → read-only
 *     ClinicalNotePreviewBody. Same content, just no edit affordances.
 *
 * Read-only is the safe fallback when the reviewer can't be resolved
 * or the note isn't in a state that supports editing.
 */
export function InlineNoteView({ note, member, onBack }) {
  const currentActorName = useAppStore(s => s.currentActorName);
  const isReviewerForThis = !!note?.reviewerName
    && !!currentActorName?.()
    && String(note.reviewerName) === String(currentActorName())
    && note.status === 'submitted'
    && !!note.reviewTaskId
    && !!member;

  // Reviewer flow needs one useClinicalNotePanel instance shared by
  // both the header's action buttons and the body's ConsolidatedNote-
  // Body, so save/sign edits the same gapState the reviewer sees. Non-
  // reviewer path can skip the hook entirely (no editable state).
  if (isReviewerForThis) {
    return <InlineReviewerPane member={member} note={note} onBack={onBack} />;
  }
  return (
    <div className={styles.inlinePane}>
      <InlineNoteHeader note={note} onBack={onBack} />
      <div className={styles.inlinePreviewBody}>
        <ClinicalNotePreviewBody
          memberId={note.hedisMemberId || note.patientId}
          gapCode={note.gapCodes?.[0]}
          noteId={note.id}
        />
      </div>
    </div>
  );
}

// Shared header block for the inline note view: back arrow + stacked
// title/subtitle. Reviewer flow drops action buttons alongside it via
// the parent InlineReviewerPane.
function InlineNoteHeader({ note, onBack, actions }) {
  return (
    <div className={styles.inlineHeader}>
      <ActionButton
        icon="solar:arrow-left-linear"
        size="sm"
        tooltip="Back to notes list"
        onClick={onBack}
      />
      <div className={styles.inlineTitleBlock}>
        <span className={styles.inlineTitle}>
          {(note.gapCodes || []).length > 1
            ? 'Consolidated Clinical Note'
            : (note.gapCodes?.[0] ? `${note.gapCodes[0]} Visit Note` : 'Clinical Note')}
        </span>
        <span className={styles.inlineSubtitle}>
          {note.status === 'signed'
            ? `Signed by ${note.signedByName || note.authorName || '-'} · ${formatDate(note.updatedAt || note.createdAt)}`
            : note.status === 'submitted'
              ? `Submitted for Review to ${note.reviewerName || '-'} · ${formatDate(note.updatedAt || note.createdAt)}`
              : `Draft · ${formatDate(note.updatedAt || note.createdAt)}`}
        </span>
      </div>
      {actions && <div className={styles.inlineHeaderActions}>{actions}</div>}
    </div>
  );
}

// Reviewer-editable inline pane: mounts useClinicalNotePanel once
// and passes the same `v` handle to the header's action buttons and
// to ConsolidatedNoteBody, so a save from the header commits the
// edits shown in the body. The header structure (back arrow + title
// + actions) is threaded through via `header` so the two halves share
// a row.
function InlineReviewerPane({ member, note, onBack }) {
  const v = useClinicalNotePanel({
    member,
    gapCode: note.gapCodes?.[0],
    onClose: onBack,
    editingTaskId: note.reviewTaskId,
  });
  return (
    <div className={styles.inlinePane}>
      <InlineNoteHeader
        note={note}
        onBack={onBack}
        actions={(
          <ClinicalNoteHeaderActions
            onSaveDraft={v.handleSaveDraft}
            onSubmitForReview={v.handleSubmitForReview}
            onSaveAndSign={v.handleSaveAndSign}
            onSignAndPrint={v.handleSignAndPrint}
            primaryLabel="Sign & Save"
            reviewerFlow
            canSaveDraft={v.hasChanges}
            canSign={v.anyReadyForReview}
          />
        )}
      />
      <div className={styles.inlineInfoBanner}>
        <Icon name="solar:info-circle-linear" size={14} color="var(--status-info)" />
        <span>All signed notes sync to the patient&apos;s EHR record.</span>
      </div>
      <div className={styles.inlineEditorBody}>
        <ConsolidatedNoteBody v={v} />
      </div>
    </div>
  );
}
