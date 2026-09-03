import { Avatar } from '../../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../../components/Badge/Badge';
import { activityIcon, STATUS_COLOR } from '../programActivity';
import styles from './TimelineItem.module.css';

/**
 * One activity row inside the Program Activity Log — grey icon avatar on the
 * spine (peek/spine modes), meta line (time • actor), title • status, program
 * badge on the right.
 */
export function TimelineItem({ item, programCode, showDate = false, spine = false, peek = false, isLast = false }) {
  const { icon } = activityIcon(item.activityKind);
  const code = programCode || item.programCode;

  const meta = (
    <div className={styles.meta}>
      {showDate && item.dateLabel && (
        <>
          <span>{item.dateLabel}</span>
          <span className={styles.dot}>•</span>
        </>
      )}
      <span>{item.time}</span>
      {item.actorName && (
        <>
          <span className={styles.dot}>•</span>
          <span>{item.actorName} (Co-Ordinator)</span>
        </>
      )}
    </div>
  );

  const body = (
    <div className={styles.body}>
      {meta}
      <div className={styles.titleRow}>
        <span className={styles.title}>{item.title}</span>
        {item.statusLabel && (
          <span className={styles.status} style={{ color: STATUS_COLOR[item.statusType] || 'var(--neutral-300)' }}>
            <span className={styles.dot}>•</span>
            {item.statusLabel}
          </span>
        )}
      </div>
    </div>
  );

  const badge = code ? <Badge tone="primary" size="XS" label={code} className={styles.programBadge} /> : null;

  const spineAvatar = (
    <Avatar type="icon" variant="others" iconName={icon} size="XS" className={styles.spineAvatar} />
  );

  if (peek) {
    return (
      <div className={styles.peekRow}>
        <div className={styles.peekSpineCol}>
          <span className={styles.spineLine} />
          {spineAvatar}
          <span className={styles.spineLineGrow} />
        </div>
        <div className={styles.content}>
          {body}
          {badge}
        </div>
      </div>
    );
  }

  if (spine) {
    return (
      <div className={styles.spineRow}>
        <div className={styles.spineCol}>
          <span className={styles.spineLine} />
          {spineAvatar}
          <span className={isLast ? styles.spineLineEnd : styles.spineLineGrow} />
        </div>
        <div className={styles.content}>
          {body}
          {badge}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.content}>
        {body}
        {badge}
      </div>
    </div>
  );
}
