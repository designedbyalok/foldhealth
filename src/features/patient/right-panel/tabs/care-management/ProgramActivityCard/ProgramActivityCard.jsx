import { useState } from 'react';
import { Icon } from '../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Avatar } from '../../../../../../components/Avatar/Avatar';
import { TimelineItem } from '../TimelineItem/TimelineItem.jsx';
import styles from './ProgramActivityCard.module.css';

/**
 * One (date × program) group in the Program Activity Log: the program's changes
 * on a single day, collapsed to a summary with a "See all activities" toggle.
 */
export function ProgramActivityCard({ card }) {
  const [expanded, setExpanded] = useState(false);
  const extra = Math.max(0, card.users.length - 2);

  return (
    <div className={styles.card}>
      <div className={styles.dateCol}>
        <span className={styles.date}>{card.date}</span>
        <span className={styles.dayBadge}>{card.day}</span>
        <div className={styles.dotLine}><span className={styles.dot} /></div>
      </div>
      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.program}>{card.programName}</span>
          <div className={styles.headerRight}>
            {card.users.length > 0 && (
              <div className={styles.avatarStack}>
                {card.users.slice(0, 2).map((initials, i) => (
                  <div key={initials} className={styles.avatarWrap} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }}>
                    <Avatar variant="assignee" initials={initials} />
                  </div>
                ))}
                {extra > 0 && (
                  <div className={styles.avatarWrap} style={{ marginLeft: -8 }}>
                    <span className={styles.avatarCount}>+{extra}</span>
                  </div>
                )}
              </div>
            )}
            <Badge tone="grey" size="S" label={card.programCode} />
          </div>
        </div>

        <div className={styles.activities}>
          {card.count} {card.count === 1 ? 'Activity' : 'Activities'} • {card.userCount} {card.userCount === 1 ? 'User' : 'Users'}
        </div>

        <button type="button" className={styles.seeAll} onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
          <Icon name={expanded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={14} color="var(--primary-300)" />
          {expanded ? 'Hide activities' : 'See all activities'}
        </button>

        {expanded && (
          <div className={styles.timeline}>
            {card.items.map(item => <TimelineItem key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}
