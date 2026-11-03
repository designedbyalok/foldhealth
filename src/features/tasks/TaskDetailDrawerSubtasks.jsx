import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Input } from '../../components/Input/Input';
import { Link } from '../../components/Link/Link';
import { TITLE_MAX, isOverdue, formatDateFriendly, STATUS_LABELS, STATUS_BADGE_VARIANTS } from './TasksView.utils';
import { PriorityIcon, CheckIcon } from './TasksViewIcons';
import styles from './TasksView.module.css';

export function TaskDetailDrawerSubtasks({
  task, subtasks, completedSubs, showAddSubtask, setShowAddSubtask, subtaskName, setSubtaskName,
  handleAddSubtask, updateTask, onSelectTask, allTasks,
}) {
  return (
    <>
        {/* Subtasks: show progress + list of children, allow adding new ones */}
        {!task.is_subtask && (
          <div className={styles.drawerSection}>
            <div className={styles.subtaskHeader}>
              <h4 className={styles.drawerSectionTitle}>
                Subtasks {subtasks.length > 0 && <span className={styles.subtaskCount}>{completedSubs}/{subtasks.length}</span>}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon="solar:add-circle-linear"
                onClick={() => setShowAddSubtask(v => !v)}
              >
                Add Subtask
              </Button>
            </div>
            {subtasks.length > 0 && (
              <div className={styles.subtaskProgressBar}>
                <div
                  className={styles.subtaskProgressFill}
                  style={{ transform: `scaleX(${completedSubs / subtasks.length})` }}
                />
              </div>
            )}
            {showAddSubtask && (
              <div className={styles.subtaskAddRow}>
                <Input
                  aria-label="Subtask name"
                  wrapperClassName={styles.subtaskAddInputWrap}
                  placeholder="Enter subtask name..."
                  maxLength={TITLE_MAX}
                  value={subtaskName}
                  onChange={e => setSubtaskName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setShowAddSubtask(false); setSubtaskName(''); } }}
                  autoFocus
                />
                <Button size="sm" onClick={handleAddSubtask} disabled={!subtaskName.trim()}>Add</Button>
                <Button variant="outline" size="sm" onClick={() => { setShowAddSubtask(false); setSubtaskName(''); }}>Cancel</Button>
              </div>
            )}
            {subtasks.map(sub => (
              <div key={sub.id} className={styles.subtaskCard} onClick={() => onSelectTask?.(sub)}>
                <button
                  type="button"
                  className={`${styles.taskCheckbox} ${sub.status === 'completed' ? styles.taskCheckboxChecked : ''}`}
                  aria-label={sub.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
                  onClick={e => {
                    e.stopPropagation();
                    updateTask(sub.id, { status: sub.status === 'completed' ? 'pending' : 'completed' });
                  }}
                >
                  <span className={styles.taskCheckIcon}>
                    <CheckIcon size={13} />
                  </span>
                </button>
                <div className={styles.subtaskCardBody}>
                  <div className={styles.subtaskCardRow}>
                    <PriorityIcon priority={sub.priority} size={16} />
                    <span className={`${styles.subtaskCardName} ${sub.status === 'completed' ? styles.subtaskCardNameDone : ''}`}>{sub.name}</span>
                    <Badge tone={STATUS_BADGE_VARIANTS[sub.status]} label={STATUS_LABELS[sub.status]} />
                    <span className={`${styles.subtaskCardDate} ${isOverdue(sub) ? styles.dueMissed : ''}`}>
                      {formatDateFriendly(sub.due_date)}
                    </span>
                  </div>
                  {(sub.attachments > 0 || sub.comments > 0) && (
                    <div className={styles.subtaskCardAttachments}>
                      {sub.attachments > 0 && (
                        <span className={styles.linkedItem}>
                          <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
                          {sub.attachments}
                        </span>
                      )}
                      {sub.comments > 0 && (
                        <span className={styles.linkedItem}>
                          <Icon name="solar:chat-round-line-linear" size={14} color="var(--neutral-300)" />
                          {sub.comments}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {subtasks.length === 0 && !showAddSubtask && (
              <div className={styles.subtaskEmpty}>No subtasks yet. Break this task down into smaller steps.</div>
            )}
          </div>
        )}
        {task.is_subtask && task.parent_task && (
          <div className={styles.drawerSection}>
            <span className={styles.drawerSectionLabel}>Parent Task</span>
            <Link
              className={styles.subtaskParentLink}
              onClick={() => {
                const parent = allTasks.find(t => t.id === task.parent_task_id);
                if (parent) onSelectTask?.(parent);
              }}
            >
              <Icon name="solar:link-minimalistic-linear" size={14} color="var(--primary-300)" />
              {task.parent_task}
            </Link>
          </div>
        )}
    </>
  );
}
