import { useState } from 'react';
import { Icon } from '../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Avatar } from '../../../../../../components/Avatar/Avatar';
import { TimelineItem } from '../TimelineItem/TimelineItem.jsx';
import { activityIcon } from '../programActivity';
import styles from './ProgramActivityCard.module.css';

/** Count badge on the timeline spine for a multi-activity program group. */
function SpineCount({ count, isLast }) {
  return (
    <div className={styles.spineCol}>
      <span className={styles.spineLine} />
      <Avatar variant="others" initials={String(count)} size="XS" className={styles.spineAvatar} />
      <span className={isLast ? styles.spineLineEnd : styles.spineLineGrow} />
    </div>
  );
}

/** A program's activities on a day: a summary card that fans peek edges when
 *  collapsed and expands the full list in place (Figma 108:127731). */
function ActivityStack({ entry, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const peekCount = Math.min(2, entry.count - 1);

  return (
    <div className={styles.entry}>
      <SpineCount count={entry.count} isLast={isLast} />
      <div className={styles.entryBody}>
        <div className={styles.stack}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryText}>
              <span className={styles.programTitle}>{entry.programName}</span>
              <span className={styles.summaryMeta}>
                {entry.count} {entry.count === 1 ? 'Activity' : 'Activities'} • {entry.userCount} {entry.userCount === 1 ? 'User' : 'Users'}
              </span>
            </div>
            <Badge tone="primary" size="XS" label={entry.programCode} />
          </div>

          {!expanded && Array.from({ length: peekCount }).map((_, i) => (
            <span key={i} className={styles.peekEdge} style={{ zIndex: 2 - i, '--peek-i': i + 1 }} />
          ))}

          {expanded && (
            <div className={styles.expandedList}>
              {entry.items.map((item, idx) => (
                <TimelineItem
                  key={item.id}
                  item={item}
                  programCode={entry.programCode}
                  spine
                  isLast={idx === entry.items.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        <button type="button" className={`${styles.seeAll} ${styles.seeAllButton}`} onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
          <Icon name={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-right-linear'} size={14} color="var(--primary-300)" />
          {expanded ? 'Collapse' : 'See all activities'}
        </button>
      </div>
    </div>
  );
}

/** Single activity on a day — spine column + content (no stack). */
function ActivitySingle({ entry, isLast }) {
  const item = entry.items[0];
  const { icon } = activityIcon(item.activityKind);

  return (
    <div className={styles.entry}>
      <div className={styles.spineCol}>
        <span className={styles.spineLine} />
        <Avatar type="icon" variant="others" iconName={icon} size="XS" className={styles.spineAvatar} />
        <span className={isLast ? styles.spineLineEnd : styles.spineLineGrow} />
      </div>
      <div className={styles.entryBody}>
        <TimelineItem item={item} programCode={entry.programCode} />
      </div>
    </div>
  );
}

/**
 * One calendar day in the Program Activity Log — date column on the left,
 * program stacks / single rows on the right (Figma 108:119415).
 */
export function ProgramActivityDay({ day }) {
  return (
    <div className={styles.day}>
      <div className={styles.dateCol}>
        <span className={styles.date}>{day.date}</span>
        <Badge tone="grey" size="XS" label={day.day} />
      </div>
      <div className={styles.dayEntries}>
        {day.entries.map((entry, i) => {
          const isLast = i === day.entries.length - 1;
          if (entry.type === 'group') {
            return <ActivityStack key={entry.key} entry={entry} isLast={isLast} />;
          }
          return <ActivitySingle key={entry.key} entry={entry} isLast={isLast} />;
        })}
      </div>
    </div>
  );
}

/** @deprecated Use ProgramActivityDay */
export function ProgramActivityCard({ card }) {
  const day = {
    date: card.date,
    day: card.day,
    entries: [{
      ...card,
      type: card.count > 1 ? 'group' : 'single',
      key: card.key,
      items: card.items,
    }],
  };
  return <ProgramActivityDay day={day} />;
}
