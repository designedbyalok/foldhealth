import { ReasonDialog } from '../../../../../../../../components/ReasonDialog/ReasonDialog';
import { CLOSURE_REASONS } from '../../../../../../data/programStatus';

const LABELS = CLOSURE_REASONS.map(r => r.label);

/**
 * Close a program enrollment with a reason (Close Program / End Program, or
 * picking Completed / Discontinued as its status). "Goal met" closes it as
 * Completed, the others as Discontinued, unless `status` was picked already.
 * onSubmit gets { reason, note, status }.
 */
export function CloseProgramDialog({ program, status = null, onCancel, onSubmit }) {
  const ending = status || 'Completed or Discontinued';
  return (
    <ReasonDialog
      title={`Close ${program.name}?`}
      description={`Ends this enrollment today as ${ending}. It moves to Past Care Programs and keeps its history.`}
      decision="fail"
      standardReasons={LABELS}
      confirmLabel="Close Program"
      notesPlaceholder="Add a note (optional)"
      onCancel={onCancel}
      onSubmit={({ code, freeText }) => {
        const reason = CLOSURE_REASONS.find(r => r.label === code)?.value || 'other';
        onSubmit({ reason, note: freeText, status });
      }}
    />
  );
}
