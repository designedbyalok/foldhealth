import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '../../../../../../../../components/Dialog/Dialog';
import { Button } from '../../../../../../../../components/Button/Button';
import { goalCascadeQuestion } from '../../lib/carePlanGoalCascade';

/**
 * RemoveGoalDialog: removing a goal that has linked items is a choice, not a
 * yes/no: delete its interventions and barriers with it, or take out only the
 * goal and leave them on the plan. A goal with nothing linked falls back to a
 * plain confirm, since there is nothing to choose between.
 *
 * @param {object}   props
 * @param {string}   props.goalTitle  – Named in the fallback confirm copy.
 * @param {object}   props.cascade    – From `goalCascade(plan, goalId)`.
 * @param {function} props.onRemoveAll      – Goal plus its linked items.
 * @param {function} props.onRemoveGoalOnly – Goal only; linked items stay.
 * @param {function} props.onCancel         – Cancel, the cross, or the overlay.
 */
export function RemoveGoalDialog({ goalTitle, cascade, onRemoveAll, onRemoveGoalOnly, onCancel }) {
  const question = goalCascadeQuestion(cascade);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Goal?</DialogTitle>
          <DialogDescription>
            {question || `This removes "${goalTitle}" from the patient's care plan. This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {question ? (
            <>
              <Button variant="outline" onClick={onRemoveAll}>Remove all</Button>
              <Button variant="soft" tone="danger" onClick={onRemoveGoalOnly}>Remove goal only</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button variant="soft" tone="danger" onClick={onRemoveAll}>Remove</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
