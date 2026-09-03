import { Icon } from '../../../../../../components/Icon/Icon';
import { activityIcon, STATUS_COLOR } from '../programActivity';
import styles from './TimelineItem.module.css';

export function TimelineItem({ item }) {
  const { icon, bg, color } = activityIcon(item.activityKind);
  return (
    <div className={styles.row}>
      <div className={styles.iconWrap} style={{ background: bg }}>
        <Icon name={icon} size={14} color={color} />
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.time}>{item.time}</span>
          {item.actorName && <span className={styles.coordinator}>{item.actorName} (Co-Ordinator)</span>}
        </div>
        <div className={styles.titleRow}>
          <span className={styles.title}>{item.title}</span>
          {item.statusLabel && (
            <span className={styles.status} style={{ color: STATUS_COLOR[item.statusType] || 'var(--neutral-300)' }}>
              • {item.statusLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
