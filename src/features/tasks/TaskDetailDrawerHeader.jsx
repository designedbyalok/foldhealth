import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Select } from '../../components/Select/Select';
import { InlineEditable } from '../../components/InlineEditable/InlineEditable';
import { STATUS_ORDER, STATUS_LABELS, TITLE_MAX } from './TasksView.utils';
import styles from './TasksView.module.css';

export function TaskDetailDrawerHeader({
  task,
  onTitleCommit,
  onStatusChange,
  onClaim,
  onCopyLink,
  onDelete,
}) {
  return (
    <>
      <div className={styles.drawerToolbar}>
        <Select
          style={{ width: 120 }}
          options={STATUS_ORDER.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
          value={task.status}
          onValueChange={onStatusChange}
        />
        <div className={styles.drawerToolbarRight}>
          {task.pool && !task.assigned_to && (
            <Button size="sm" onClick={onClaim}>Claim Task</Button>
          )}
          <ActionButton icon="solar:paperclip-linear" tooltip="Attachments" />
          <span className={styles.iconDivider} />
          <ActionButton icon="solar:link-minimalistic-linear" tooltip="Copy link" onClick={onCopyLink} />
          <span className={styles.iconDivider} />
          <ActionButton icon="solar:trash-bin-trash-linear" tooltip="Delete" onClick={onDelete} />
        </div>
      </div>

      <div className={styles.drawerTitleBlock}>
        {task.is_subtask && task.parent_task && (
          <Badge label={task.parent_task} />
        )}
        <InlineEditable
          value={task.name}
          onCommit={onTitleCommit}
          maxLength={TITLE_MAX}
          className={styles.drawerTaskTitleEditable}
          inputClassName={styles.drawerTaskTitleEditableInput}
          title="Edit title"
        />
      </div>
    </>
  );
}
