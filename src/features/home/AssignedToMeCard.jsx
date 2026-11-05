import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import styles from './HomeView.module.css';

const ASSIGNED = [
  { id: 1, name: 'Justin Huge', text: 'Missed Call', icon: 'solar:phone-calling-linear', time: '9 mins' },
  { id: 2, name: 'Jane Cooper', text: 'That sounds fantastic', icon: 'solar:user-rounded-linear', time: '2 hrs' },
];

export function AssignedToMeCard({ dragHandleClassName }) {
  return (
    <div className={styles.card}>
      <div className={[styles.cardHeader, dragHandleClassName].filter(Boolean).join(' ')}>
        <div className={styles.cardTitle}>
          <Icon name="solar:user-plus-linear" size={14} color="var(--primary-300)" />
          Assigned to me
        </div>
        <div className={styles.cardActions}>
          <ActionButton icon="solar:share-linear" size="sm" tooltip="Share" />
          <ActionButton icon="custom:filter" size="sm" tooltip="Filter" />
        </div>
      </div>
      <div className={styles.cardBody}>
        {ASSIGNED.map(item => (
          <div key={item.id} className={styles.assignedRow}>
            <div className={styles.assignedIcon}>
              <Icon name={item.icon} size={16} />
            </div>
            <div className={styles.assignedBody}>
              <div className={styles.assignedName}>{item.name}</div>
              <div className={styles.assignedText}>{item.text}</div>
            </div>
            <div className={styles.assignedTime}>{item.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
