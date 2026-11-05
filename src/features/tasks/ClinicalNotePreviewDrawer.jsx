import { useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { ClinicalNotePreviewBody } from '../hedis-worklist/ClinicalNotePreviewBody';
import { ClinicalNoteVersionsDrawer } from './ClinicalNoteVersionsDrawer';
import { useAppStore } from '../../store/useAppStore';
import styles from './TasksView.module.css';
import { openSafeUrl } from '../../lib/openSafeUrl';

/**
 * ClinicalNotePreviewDrawer: read-only linked-note preview shell.
 *
 * Renders the same title / patient banner / EHR-sync body the CareGap and
 * Task Detail flows use, but as a standalone drawer that can be summoned
 * without a task drawer wrapping it (paperclip hover card, activity log,
 * etc.). Branches header affordances by note.status:
 *   • signed    → Displayed to Member + Print + Amend
 *   • submitted → Pending Review pill + Edit
 *
 * Props:
 *   • note: the persisted clinical_notes row to preview
 *   • onClose: dismisses the drawer
 *   • onEdit: optional. Called with the note when Amend / Edit is
 *                 clicked. When omitted the caller can rely on `onClose`
 *                 firing and route from there (e.g. show a toast).
 */
export function ClinicalNotePreviewDrawer({ note, onClose, onEdit }) {
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const showToast = useAppStore(s => s.showToast);
  const [showHistory, setShowHistory] = useState(false);
  if (!note) return null;

  const codes = note.gapCodes || [];
  const templatesById = useAppStore.getState().noteTemplatesById;
  const template = note.formId ? templatesById?.[note.formId] : null;
  const isNonVisit = note.formType === 'non_visit_note' || note.formType === 'normal_note';
  const noteTitle = template?.name
    || (isNonVisit
      ? (note.payload?.title || (note.formType === 'normal_note' ? 'Clinical Note' : 'Non-Visit Note'))
      : codes.length > 1
        ? 'Consolidated Clinical Note'
        : codes[0]
          ? `${codes[0]} Visit Note`
          : 'Clinical Note');
  const noteMember = note.hedisMemberId
    ? hedisMembers.find(m => m.id === note.hedisMemberId)
    : null;
  const isSigned = note.status === 'signed';
  const signer = note.signedByName || note.reviewerName || note.authorName || 'Provider';
  let signedWhen = '';
  if (note.signedAt) {
    const d = new Date(note.signedAt);
    if (!Number.isNaN(d.getTime())) {
      signedWhen = ` · ${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    }
  }
  const subtitleIcon = isSigned
    ? { name: 'solar:check-circle-bold', color: 'var(--status-success)' }
    : { name: 'solar:pen-new-square-linear', color: 'var(--primary-300)' };
  const subtitleText = isSigned
    ? `Signed by ${signer}${signedWhen}`
    : `Submitted for Review to ${note.reviewerName || '-'}`;
  const handleEdit = () => {
    onClose?.();
    onEdit?.(note);
  };

  return (
    <>
    <Drawer
      title={
        <span className={styles.previewTitleStack}>
          <span className={styles.previewTitleMain}>{noteTitle}</span>
          <span className={styles.previewTitleSub}>
            <Icon name={subtitleIcon.name} size={12} color={subtitleIcon.color} />
            {subtitleText}
          </span>
        </span>
      }
      onClose={onClose}
      width={700}
      noCloseDivider
      headerRight={
        <>
          {isSigned ? (
            <>
              <span className={styles.previewDisplayedTag}>
                <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
                Displayed to Member
              </span>
              <span className={styles.previewHeaderDivider} aria-hidden />
              <ActionButton
                icon="solar:printer-linear"
                tooltip="Print"
                onClick={() => {
                  const url = note.pdfDataUrl;
                  if (url) openSafeUrl(url);
                  else showToast?.('No PDF for this version');
                }}
              />
              <ActionButton
                icon="solar:history-linear"
                tooltip="Amend history"
                onClick={() => setShowHistory(true)}
              />
              <Button
                variant="soft"
                leadingIcon="solar:lock-keyhole-minimalistic-linear"
                onClick={handleEdit}
              >
                Amend
              </Button>
            </>
          ) : (
            <>
              <span className={styles.previewPendingReviewTag}>
                <Icon name="solar:clock-circle-linear" size={16} color="var(--status-warning)" />
                Pending Review
              </span>
              <span className={styles.previewHeaderDivider} aria-hidden />
              <Button
                variant="soft"
                leadingIcon="solar:pen-new-square-linear"
                onClick={handleEdit}
              >
                Edit
              </Button>
            </>
          )}
          <span className={styles.previewHeaderDivider} aria-hidden />
        </>
      }
      banner={noteMember ? (
        <PatientBanner
          initials={noteMember.in}
          name={noteMember.name}
          gender={noteMember.gender}
          age={noteMember.age}
          dob={noteMember.dob}
          memberId={noteMember.memberId}
          hidePatientLabel
          patientId={noteMember.id}
        />
      ) : undefined}
    >
      <ClinicalNotePreviewBody
        memberId={note.hedisMemberId || note.patientId}
        gapCode={note.gapCodes?.[0]}
        noteId={note.id}
      />
    </Drawer>
    {showHistory && (
      <ClinicalNoteVersionsDrawer note={note} onClose={() => setShowHistory(false)} />
    )}
    </>
  );
}
