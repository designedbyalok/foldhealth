import { useState } from 'react';
import { Icon } from '../../../../components/Icon/Icon';
import { CollapsibleContent } from '../../../../components/Collapsible/Collapsible';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { CloseIcon } from '../../../../components/Icon/CloseIcon';
import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import { ruleSummary } from './availabilityUtils';
import styles from './UserAvailability.module.css';

// Users who share the same reasons sit under one band.
function byReason(list) {
  const groups = new Map();
  list.forEach(({ user, lines }) => {
    const k = lines.join('|');
    if (!groups.has(k)) groups.set(k, { lines, users: [] });
    groups.get(k).users.push(user);
  });
  return [...groups.values()];
}

function UserRow({ user, onRemove }) {
  return (
    <div className={styles.reviewRow}>
      <Avatar variant="staff" size="S" initials={user.initials} userName={user.name} userId={user.id} />
      <span className={styles.reviewUserText}>
        <span className={styles.reviewUserName}>{user.name}</span>
        <span className={styles.reviewUserRole}>{user.role || user.clinicalRoles?.[0] || 'Staff'}</span>
      </span>
      <ActionButton size="md" tooltip="Remove user" tooltipLeft onClick={() => onRemove(user)}>
        <CloseIcon size={20} color="var(--neutral-300)" />
      </ActionButton>
    </div>
  );
}

// The reason band: one line, or bullets when there are several.
function ReasonBand({ lines, tone }) {
  return (
    <div className={`${styles.reviewBand} ${tone === 'skip' ? styles.reviewBandSkip : styles.reviewBandWarn}`}>
      {lines.length > 1 ? (
        <ul className={styles.reviewBandList}>
          {lines.map(l => <li key={l}>{l}</li>)}
        </ul>
      ) : lines[0]}
    </div>
  );
}

// Each reason's band, then its users.
function ReasonGroups({ list, tone, onRemove }) {
  return byReason(list).map(({ lines, users }) => (
    <div key={lines.join('|')} className={styles.reviewGroup}>
      <ReasonBand lines={lines} tone={tone} />
      {users.map(user => <UserRow key={user.id || user.name} user={user} onRemove={onRemove} />)}
    </div>
  ));
}

/**
 * Review before adding availability for multiple users (Figma Eventus
 * 17856:123383): the counts on top, then a folding card of the schedules
 * being added, then white cards for "Will be skipped" (folded), "Will be added
 * with warnings" and "Will be added". Skipped and warned users sit under a
 * band with their reason (red or yellow), grouped when they share it. Any
 * user can be taken off the list.
 *
 * @param {object[]} props.results  – reviewUser() per user
 * @param {object[]} props.blocks   – the schedules, in order
 * @param {function} props.onRemove – (user) => void
 */
export function BulkAvailabilityReview({ results, blocks, onRemove }) {
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const [skippedOpen, setSkippedOpen] = useState(false);
  if (!results.length) {
    return (
      <div className={styles.reviewEmpty}>
        <EmptyState size="sm" icon="solar:users-group-rounded-linear" title="No users left to add availability for" />
      </div>
    );
  }
  const of = (k) => results.filter(r => r.outcome === k);
  const skipped = of('skip');
  const warned = of('warn');
  const added = of('add');
  const stats = [['Total users', results.length], ['Skipped', skipped.length, styles.reviewStatSkip], ['Warnings', warned.length, styles.reviewStatWarn], ['Added', added.length, styles.reviewStatAdd]];
  const chevron = (open) => (
    <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" className={open ? `${styles.reviewChevron} ${styles.reviewChevronOpen}` : styles.reviewChevron} />
  );

  return (
    <div className={styles.review}>
      <div className={styles.reviewStats}>
        {stats.map(([label, n, tone]) => (
          <div key={label} className={styles.reviewStat}>
            <span className={styles.reviewStatLabel}>{label}</span>
            <span className={`${styles.reviewStatValue} ${tone || ''}`}>{n}</span>
          </div>
        ))}
      </div>

      <section className={styles.reviewCard}>
        <button type="button" className={`${styles.reviewCardTitle} ${styles.reviewCardToggle} ${schedulesOpen ? '' : styles.reviewCardTitleShut}`} aria-expanded={schedulesOpen} onClick={() => setSchedulesOpen(v => !v)}>
          Schedules to be added
          {chevron(schedulesOpen)}
        </button>
        <CollapsibleContent open={schedulesOpen}>
          <div className={styles.reviewGroup}>
            {blocks.map((b, i) => (
              <div key={i} className={`${styles.reviewRow} ${styles.reviewScheduleRow}`}>
                <span className={styles.reviewUserText}>
                  <span className={styles.reviewUserName}>Schedule {i + 1}</span>
                  <span className={styles.reviewScheduleSub}>{ruleSummary(b)}</span>
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </section>

      {skipped.length > 0 && (
        <section className={styles.reviewCard}>
          <button type="button" className={`${styles.reviewCardTitle} ${styles.reviewCardToggle} ${skippedOpen ? '' : styles.reviewCardTitleShut}`} aria-expanded={skippedOpen} onClick={() => setSkippedOpen(v => !v)}>
            Will be skipped
            <span className={styles.reviewCountBadge}>{skipped.length}</span>
            {chevron(skippedOpen)}
          </button>
          <CollapsibleContent open={skippedOpen}>
            <ReasonGroups list={skipped} tone="skip" onRemove={onRemove} />
          </CollapsibleContent>
        </section>
      )}

      {warned.length > 0 && (
        <section className={styles.reviewCard}>
          <h3 className={styles.reviewCardTitle}>Will be added with warnings</h3>
          <ReasonGroups list={warned} tone="warn" onRemove={onRemove} />
        </section>
      )}

      {added.length > 0 && (
        <section className={styles.reviewCard}>
          <h3 className={styles.reviewCardTitle}>Will be added</h3>
          <div className={styles.reviewGroup}>
            {added.map(({ user }) => <UserRow key={user.id || user.name} user={user} onRemove={onRemove} />)}
          </div>
        </section>
      )}
    </div>
  );
}
