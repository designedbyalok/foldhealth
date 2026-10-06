import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { useAddTaskDrawer } from './useAddTaskDrawer';
import { AddTaskDrawerBody } from './AddTaskDrawerBody';

export function AddTaskDrawer(props) {
  const { initialMember, initialAssignedTo } = props;
  const defaultsKey = `${initialMember ?? ''}:${initialAssignedTo ?? ''}`;
  return <AddTaskDrawerInner key={defaultsKey} {...props} />;
}

function AddTaskDrawerInner({ onClose, defaultStatus, initialMember, initialAssignedTo, onTaskCreated, extraFields, className, availableGoals, onOpenGoal, initialLinkedGoalIds, showScheduleFields = false, taskKind, libraryKind }) {
  const drawer = useAddTaskDrawer({ defaultStatus, initialMember, initialAssignedTo, onTaskCreated, extraFields, initialLinkedGoalIds, includeScheduleFields: showScheduleFields });
  const title = taskKind === 'internal-task' ? 'Add Internal Task'
    : taskKind === 'patient-task' ? 'Add Patient Task'
    : 'Add Task';

  return (
    <>
      <Drawer
        title={title}
        onClose={onClose}
        beforeClose={drawer.guardClose}
        className={className}
        headerRight={
          <Button variant="primary" size="L" disabled={!drawer.canSave} onClick={drawer.handleSave}>
            Save Task
          </Button>
        }
      >
        <AddTaskDrawerBody
          {...drawer}
          showScheduleFields={showScheduleFields}
          taskKind={taskKind}
          libraryKind={libraryKind}
          availableGoals={availableGoals}
          onOpenGoal={onOpenGoal}
        />
      </Drawer>
      {drawer.showCloseConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title="Discard unsaved task?"
          description="You have unsaved changes. Closing now will discard them."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          variant="error"
          onConfirm={() => { drawer.setShowCloseConfirm(false); onClose(); }}
          onCancel={() => drawer.setShowCloseConfirm(false)}
        />
      )}
    </>
  );
}
