import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { PriorityIcon } from '../../../components/PriorityIcon/PriorityIcon';
import { useAppStore } from '../../../store/useAppStore';
import { useMobileNav } from '../MobileNavContext';
import { dueLabel } from './myTasks';
import styles from './TaskRow.module.css';

/**
 * A task as a mobile card (Figma Task 759:26387): due line, a round check,
 * title and the member it's about. The check completes or reopens it;
 * the title opens the task's details. `onClaim` adds the pool footer with
 * a Claim button (unclaimed pooled tasks).
 */
export function TaskRow({ task, onOpenMember, onClaim }) {
  const updateTask = useAppStore(s => s.updateTask);
  const { push } = useMobileNav();
  const done = task.status === 'completed';
  const late = task.bucket === 'overdue';
  const toggle = () => updateTask(task.id, { status: done ? 'pending' : 'completed' });

  return (
    <div className={styles.card}>
      <div className={[styles.due, late ? styles.late : ''].join(' ')}>
        {task.priority && task.priority !== 'none' && <PriorityIcon priority={task.priority} size={16} />}
        {dueLabel(task)}
      </div>
      <div className={styles.main}>
        <button
          type="button"
          className={[styles.check, done ? styles.checked : ''].join(' ')}
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Reopen ${task.name}` : `Complete ${task.name}`}
          onClick={toggle}
        >
          {done && <Icon name="solar:check-read-linear" size={16} color="currentColor" />}
        </button>
        <div className={styles.text}>
          <button type="button" className={styles.titleBtn} onClick={() => push('taskDetail', { taskId: task.id })}>
            <span className={[styles.title, done ? styles.titleDone : ''].join(' ')}>{task.name}</span>
          </button>
          {task.member && (
            onOpenMember
              ? <button type="button" className={styles.member} onClick={() => onOpenMember(task)}>{task.member}</button>
              : <span className={styles.memberText}>{task.member}</span>
          )}
        </div>
      </div>
      {onClaim && (
        <div className={styles.pool}>
          <span className={styles.poolName}>
            <Icon name="solar:users-group-rounded-linear" size={16} color="currentColor" />
            {task.pool}
          </span>
          <Button size="lg" variant="soft" onClick={() => onClaim(task)}>Claim</Button>
        </div>
      )}
    </div>
  );
}
