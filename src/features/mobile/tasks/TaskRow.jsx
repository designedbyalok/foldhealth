import { Icon } from '../../../components/Icon/Icon';
import { PriorityIcon } from '../../../components/PriorityIcon/PriorityIcon';
import { useAppStore } from '../../../store/useAppStore';
import { dueLabel } from './myTasks';
import styles from './TaskRow.module.css';

/**
 * A task as a mobile card (Figma Task 759:26387): due line, a round check,
 * title and the member it's about. The check completes or reopens it.
 */
export function TaskRow({ task, onOpenMember }) {
  const updateTask = useAppStore(s => s.updateTask);
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
          <p className={[styles.title, done ? styles.titleDone : ''].join(' ')}>{task.name}</p>
          {task.member && (
            onOpenMember
              ? <button type="button" className={styles.member} onClick={() => onOpenMember(task)}>{task.member}</button>
              : <span className={styles.memberText}>{task.member}</span>
          )}
        </div>
      </div>
    </div>
  );
}
