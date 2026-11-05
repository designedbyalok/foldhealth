// PHQ-9 not complete: surfaced when the Coordinator tries to leave a
// DSF-B note with unanswered PHQ-9 items. Copy is verbatim per user
// story Section 5 (exact strings, actual calendar due date).
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';

function fmtLongDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function Phq9ExitDialog({
  answered,
  total = 9,
  dueDateISO,
  mode = 'close',
  onCompleteNow,
  onSaveExit,
}) {
  const dueDate = fmtLongDate(dueDateISO);
  const days = daysUntil(dueDateISO);

  if (mode === 'save-draft') {
    // Save-as-Draft branch: reached from the header's Save as Draft
    // button. This is a neutral confirmation (not a warning): the
    // draft is a safe stopping point. Primary action is Save as Draft
    // (what the user just asked for); secondary is Keep editing.
    // Copy names the DSF-B measure (not the PHQ-9 instrument) so it
    // matches the gap chip / worklist row the coordinator opened.
    const dayCopy = days === null
      ? ''
      : ` You have ${days} day${days === 1 ? '' : 's'} to complete it${dueDate ? ` (by ${dueDate})` : ''}.`;
    return (
      <ConfirmDialog
        variant="primary"
        icon="solar:clock-circle-linear"
        iconColor="var(--primary-300)"
        title="DSF-B is still open"
        description={`You haven't finished the DSF-B assessment (${answered}/${total} answered).${dayCopy}`}
        confirmLabel="Save as Draft"
        cancelLabel="Keep editing"
        onConfirm={onSaveExit}
        onCancel={onCompleteNow}
      />
    );
  }

  const description = dueDate
    ? `You haven't finished the DSF-B assessment (${answered}/${total} answered). Complete it now, or you have until ${dueDate} to finish the DSF-B screening if you save and exit.`
    : `You haven't finished the DSF-B assessment (${answered}/${total} answered). Complete it now, or save and exit to finish the DSF-B screening later.`;
  return (
    <ConfirmDialog
      variant="warning"
      icon="solar:clock-circle-linear"
      title="DSF-B not complete"
      description={description}
      confirmLabel="Complete now"
      cancelLabel="Save & exit"
      // Complete now returns the user to the form (dismisses the modal
      // AND keeps the drawer open). Save & exit persists the draft and
      // closes. Because the shared ConfirmDialog treats "confirm" as the
      // primary/right button, we map that to Complete now, and the
      // secondary/left "Cancel" button to Save & exit.
      onConfirm={onCompleteNow}
      onCancel={onSaveExit}
    />
  );
}
