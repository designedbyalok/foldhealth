import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Select } from '../../components/Select/Select';
import { STATUS_ORDER, STATUS_LABELS } from './TasksView.utils';
import styles from './TasksView.module.css';

export function TaskDetailDrawerHeader({
  task,
  labels,
  editingTitle,
  titleDraft,
  setTitleDraft,
  setEditingTitle,
  titleRef,
  onTitleSave,
  onTitleKeyDown,
  onStatusChange,
  onClaim,
  onCopyLink,
  onCopyId,
  onDelete,
}) {
  return (
    <>
      <div className={styles.drawerToolbar}>
        <Select
          style={{ width: 120 }}
          options={STATUS_ORDER.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
          value={task.status}
          onChange={onStatusChange}
        />
        <div className={styles.drawerToolbarRight}>
          {task.pool && !task.assigned_to && (
            <Button variant="primary" size="S" onClick={onClaim}>Claim Task</Button>
          )}
          <ActionButton icon="solar:paperclip-linear" size="L" tooltip="Attachments" />
          <span className={styles.iconDivider} />
          <ActionButton icon="solar:link-minimalistic-linear" size="L" tooltip="Copy link" onClick={onCopyLink} />
          <span className={styles.iconDivider} />
          <ActionButton icon="solar:clipboard-text-linear" size="L" tooltip="Copy ID" onClick={onCopyId} />
          <span className={styles.iconDivider} />
          <ActionButton icon="solar:trash-bin-trash-linear" size="L" tooltip="Delete" onClick={onDelete} />
        </div>
      </div>

      <div className={styles.drawerTitleBlock}>
        {task.is_subtask && task.parent_task && (
          <Badge variant="overflow" label={task.parent_task} />
        )}
        {labels.length > 0 && !task.is_subtask && (
          <Badge variant="overflow" label={labels[0]} />
        )}
        {editingTitle ? (
          <input
            ref={titleRef}
            className={styles.drawerTaskTitleInput}
            aria-label="Task title"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={onTitleSave}
            onKeyDown={onTitleKeyDown}
            autoFocus
          />
        ) : (
          <h3
            className={styles.drawerTaskTitle}
            onClick={() => { setTitleDraft(task.name); setEditingTitle(true); }}
          >
            {task.name}
          </h3>
        )}
      </div>
    </>
  );
}
