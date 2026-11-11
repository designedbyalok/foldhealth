import { useState } from 'react';
import { Icon } from '../../../../components/Icon/Icon';
import { CollapsibleContent } from '../../../../components/Collapsible/Collapsible';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { Badge } from '../../../../components/Badge/Badge';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { CloseIcon } from '../../../../components/Icon/CloseIcon';
import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import { ruleSummary } from './availabilityUtils';
import { StatTile } from '../../../../components/StatTile/StatTile';
import styles from './UserAvailability.module.css';

const KPIS = [
  { key: 'all', label: 'Users' },
  { key: 'add', label: 'Will be added', valueClass: 'kpiAdd', tileClass: 'kpiAddTile' },
  { key: 'warn', label: 'Added with warnings', valueClass: 'kpiWarn', tileClass: 'kpiWarnTile' },
  { key: 'skip', label: 'Will be skipped', valueClass: 'kpiSkip', tileClass: 'kpiSkipTile' },
];

const GROUPS = [
  { key: 'add', title: 'Will be added' },
  { key: 'warn', title: 'Will be added – check warnings' },
  { key: 'skip', title: 'Will be skipped' },
];

function ScheduleCard({ block, title }) {
  return (
    <section className={styles.reviewSchedule}>
      <span className={styles.reviewScheduleTitle}>{title}</span>
      {/* The summary as plain text, wrapping onto more lines as needed. */}
      <span className={styles.reviewScheduleSub}>{ruleSummary(block)}</span>
    </section>
  );
}

/**
 * Review before adding availability for multiple users: the count, what
 * each user gets (every schedule, or none), then users grouped by outcome.
 * Users who pass every check show just their name; the rest list
 * one line per problem. Any user can be taken off the list.
 *
 * @param {object[]} props.results  – reviewUser() per user
 * @param {object[]} props.blocks   – the schedules, in order
 * @param {function} props.onRemove – (user) => void
 */
export function BulkAvailabilityReview({ results, blocks, onRemove }) {
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  // Outcome groups folded shut, by key.
  const [shut, setShut] = useState(() => new Set());
  const toggleGroup = (k) => setShut(cur => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  if (!results.length) {
    return (
      <div className={styles.reviewEmpty}>
        <EmptyState size="sm" icon="solar:users-group-rounded-linear" title="No users left to add availability for" />
      </div>
    );
  }
  return (
    <div className={styles.review}>
      <div className={styles.reviewIntro}>
        {/* The count, as KPI tiles: everyone, then each outcome. */}
        <div className={styles.reviewKpis}>
          {KPIS.map(k => (
            <StatTile
              key={k.key}
              label={k.label}
              className={styles[k.tileClass]}
              value={<span className={styles[k.valueClass]}>{k.key === 'all' ? results.length : results.filter(r => r.outcome === k.key).length}</span>}
            />
          ))}
        </div>
      </div>
      {/* What's being added, folded shut by default: each schedule as a card
          (its title over where, when, hours). */}
      <section className={styles.reviewSection}>
        <button type="button" className={styles.reviewToggle} aria-expanded={schedulesOpen} onClick={() => setSchedulesOpen(v => !v)}>
          Schedules to be added
          <span className={styles.reviewCountBadge}>{blocks.length}</span>
          <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" className={schedulesOpen ? `${styles.reviewChevron} ${styles.reviewChevronOpen}` : styles.reviewChevron} />
        </button>
        <CollapsibleContent open={schedulesOpen}>
          <div className={`${styles.reviewSchedules} ${styles.reviewSectionBody}`}>
            {blocks.map((b, i) => <ScheduleCard key={i} block={b} title={`Schedule ${i + 1}`} />)}
          </div>
        </CollapsibleContent>
      </section>
      {GROUPS.map(({ key, title }) => {
        const list = results.filter(r => r.outcome === key);
        if (!list.length) return null;
        return (
          <section key={key} className={styles.reviewFold}>
            {/* Each outcome folds; all start open. */}
            <button type="button" className={styles.reviewFoldHead} aria-expanded={!shut.has(key)} onClick={() => toggleGroup(key)}>
              <span className={styles.groupTitle}>{title}</span>
              <Badge size="sm" label={String(list.length)} className={styles.reviewBadge} />
              <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" className={shut.has(key) ? styles.reviewChevron : `${styles.reviewChevron} ${styles.reviewChevronOpen}`} />
            </button>
            <CollapsibleContent open={!shut.has(key)}>
            <ul className={`${styles.reviewUsers} ${styles.reviewFoldBody}`}>
              {list.map(({ user, lines }) => (
                <li key={user.id || user.name} className={styles.reviewUser}>
                  <Avatar variant="staff" size="M" initials={user.initials} userName={user.name} userId={user.id} />
                  <span className={styles.reviewUserText}>
                    <span className={styles.userName}>{user.name}</span>
                    {lines.map(l => (
                      <span key={l} className={key === 'skip' ? styles.reviewLineSkip : styles.reviewLineWarn}>{l}</span>
                    ))}
                  </span>
                  <ActionButton size="md" tooltip="Remove user" tooltipLeft onClick={() => onRemove(user)}>
                    <CloseIcon size={20} color="var(--neutral-300)" />
                  </ActionButton>
                </li>
              ))}
            </ul>
            </CollapsibleContent>
          </section>
        );
      })}
    </div>
  );
}
