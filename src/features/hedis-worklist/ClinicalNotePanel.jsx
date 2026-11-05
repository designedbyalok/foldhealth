import { useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { useAppStore } from '../../store/useAppStore';
import { useClinicalNotePanel } from './useClinicalNotePanel';
import {
  HeaderActions,
  TitleBlock,
  NoteContextPane,
  GapEvidencePane,
  ConsolidatedNoteBody,
} from './ClinicalNotePanelParts';
import { ReviewerPickerPopover } from './ReviewerPickerPopover';
import { Phq9ExitDialog } from './dsf/Phq9ExitDialog';
import { computeDsfbDueDateISO } from './dsf/dsfScoring';
import styles from './ClinicalNotePanel.module.css';

export function ClinicalNotePanel({ member, gapCode, year, onClose, editingTaskId = null }) {
  const v = useClinicalNotePanel({ member, gapCode, onClose, editingTaskId });
  // DSF-B guard mirrors CareGapDetailDrawer's Phq9ExitDialog wiring,
  // Save as Draft on a note that carries DSF-B always warns about the
  // 30-day sign-off window because a draft leaves the gap Open; Close
  // only nags when PHQ-9 is partially answered.
  const [phq9ExitPrompt, setPhq9ExitPrompt] = useState(null);
  const detectPhq9Incomplete = ({ mode = 'close' } = {}) => {
    const dsfb = v.gapState?.['DSF-B'];
    if (!dsfb) return null;
    const items = dsfb.phq9?.items || [];
    const answered = items.filter(x => x !== null && x !== undefined).length;
    if (mode === 'close') {
      if (dsfb.decline) return null;
      if (answered === 0 || answered >= 9) return null;
    }
    const dsfa = v.gapState?.['DSF-A'];
    const dsfbGap = (member?.gaps || []).find(g => g.code === 'DSF-B');
    const dueDateISO = computeDsfbDueDateISO({
      dsfaSavedAt: dsfa?.phq2?.savedAt,
      dsfbGap,
    });
    return { answered, total: 9, dueDateISO };
  };
  // Save-as-Draft on this consolidated surface always closes the drawer
  // after the write lands. The coordinator finishes the DSF pair on one
  // call; leaving the drawer open behind the "Draft saved" toast just
  // makes them hunt for the X. The PHQ-9 exit dialog's Save-and-Exit
  // branch below routes through the same helper.
  const saveDraftAndClose = async () => {
    try { await v.handleSaveDraft(); } catch { /* toast surfaces the failure */ }
    onClose?.();
  };
  const handleGuardedSaveDraft = () => {
    const guard = detectPhq9Incomplete({ mode: 'save-draft' });
    if (guard) { setPhq9ExitPrompt({ ...guard, mode: 'save-draft' }); return; }
    saveDraftAndClose();
  };
  const canSaveDraftEffective = v.hasChanges || !!detectPhq9Incomplete({ mode: 'save-draft' });
  // A sign-off review lands here with a consolidated note that already
  // covers every gap the author submitted, the reviewer's job is to
  // read and revise every section top-to-bottom, not to pick one gap out
  // of a list. Render the same stacked layout the CareGap drawer uses
  // for its consolidated authoring surface (Date of Service on top, one
  // section per gap below it), instead of the split two-pane layout the
  // single-gap "Add Note" flow uses. `editingTaskId` is the review-flow
  // marker: set only when the panel opens from a sign-off task.
  const isReviewFlow = !!editingTaskId;
  // Resolve the linked note for this task so the drawer title can carry
  // the current DB status (Draft / Pending Review / Signed) underneath a
  // proper note title: "Consolidated Clinical Note" for a multi-gap
  // review, "${code} Visit Note" when only one gap is under review.
  const linkedNote = useAppStore(s => {
    if (!isReviewFlow) return null;
    const list = s.clinicalNotesByMember?.[member.id] || [];
    return list.find(n => String(n.reviewTaskId) === String(editingTaskId)) || null;
  });
  const reviewCodes = linkedNote?.gapCodes || [];
  const reviewTitle = reviewCodes.length > 1
    ? 'Consolidated Clinical Note'
    : reviewCodes[0]
      ? `${reviewCodes[0]} Visit Note`
      : 'Consolidated Clinical Note';
  // Author revisiting their own submitted note → primary flips to
  // "Update and Save" (routed through handleSubmitForReview so the
  // reviewer is re-notified). Reviewer's Edit path stays on "Update
  // Note" via primaryLabel below; the authorName !== reviewerName
  // guard keeps a name-collision from stealing the reviewer's UI.
  const currentActorName = useAppStore(s => s.currentActorName);
  const isAuthorEditingSubmitted = !!linkedNote
    && linkedNote.status === 'submitted'
    && linkedNote.authorName === currentActorName?.()
    && linkedNote.authorName !== linkedNote.reviewerName;

  return (
    <>
      <Drawer
        title={
          isReviewFlow
            ? <TitleBlock title={reviewTitle} stacked status={linkedNote?.status} />
            : <TitleBlock title={v.drawerTitle} />
        }
        onClose={onClose}
        width={isReviewFlow ? 700 : 1280}
        bodyClassName={styles.body}
        banner={isReviewFlow ? (
          <PatientBanner
            initials={member.in}
            name={member.name}
            gender={member.gender}
            age={member.age}
            dob={member.dob}
            memberId={member.memberId}
            hidePatientLabel
            patientId={member.id}
          />
        ) : undefined}
        headerRight={
          <HeaderActions
            onSaveDraft={handleGuardedSaveDraft}
            onSubmitForReview={v.handleSubmitForReview}
            onSaveAndSign={v.handleSaveAndSign}
            onSignAndPrint={v.handleSignAndPrint}
            primaryLabel="Sign & Save"
            reviewerFlow={isReviewFlow}
            canSaveDraft={canSaveDraftEffective}
            canSign={isReviewFlow ? v.anyReadyForReview : v.canSignReady}
            authorEditingSubmitted={isAuthorEditingSubmitted}
          />
        }
      >
        {isReviewFlow ? (
          <>
            {/* Pinned above the scroll region: same EHR-sync note the
                two-pane authoring surface pins above its own scroll. */}
            <div className={styles.infoBanner}>
              <Icon name="solar:info-circle-linear" size={14} color="var(--status-info)" />
              <span>All signed notes sync to the patient&apos;s EHR.</span>
            </div>
            <ConsolidatedNoteBody v={v} />
          </>
        ) : (
          <div className={styles.twoPane}>
            <NoteContextPane v={v} member={member} year={year} />
            <GapEvidencePane v={v} />
          </div>
        )}
      </Drawer>
      <ReviewerPickerPopover
        open={v.reviewerPickerOpen}
        onClose={() => v.setReviewerPickerOpen(false)}
        onConfirm={(reviewer) => v.handleConfirmSubmitForReview(reviewer)}
      />
      {phq9ExitPrompt && (
        <Phq9ExitDialog
          answered={phq9ExitPrompt.answered}
          total={phq9ExitPrompt.total}
          dueDateISO={phq9ExitPrompt.dueDateISO}
          mode={phq9ExitPrompt.mode}
          onCompleteNow={() => setPhq9ExitPrompt(null)}
          onSaveExit={() => {
            setPhq9ExitPrompt(null);
            saveDraftAndClose();
          }}
        />
      )}
    </>
  );
}
