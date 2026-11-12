import { useState } from 'react';
import { Icon } from '../../../../components/Icon/Icon';
import { CollapsibleContent } from '../../../../components/Collapsible/Collapsible';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import styles from './UserAvailability.module.css';

function UserRow({ user }) {
  return (
    <div className={styles.reviewRow}>
      <Avatar variant="staff" size="S" initials={user.initials} userName={user.name} userId={user.id} />
      <span className={styles.reviewUserText}>
        <span className={styles.reviewUserName}>{user.name}</span>
        <span className={styles.reviewUserRole}>{user.role || user.clinicalRoles?.[0] || 'Staff'}</span>
      </span>
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

// Each user, then their reason band under them.
function UserReasons({ list, tone }) {
  return list.map(({ user, lines }) => (
    <div key={user.id || user.name} className={styles.reviewGroup}>
      <UserRow user={user} />
      {lines.length > 0 && <ReasonBand lines={lines} tone={tone} />}
    </div>
  ));
}

/**
 * Review before adding availability for multiple users (Figma Eventus
 * 17856:123383): the counts on top, then white cards for "Will be
 * skipped" (open, folds), "Will be added with warnings" and "Will be added".
 * Each user is listed with their reason on a band under them (red or
 * yellow).
 *
 * @param {object[]} props.results – reviewUser() per user
 */
export function BulkAvailabilityReview({ results }) {
  const [skippedOpen, setSkippedOpen] = useState(true);
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

      {skipped.length > 0 && (
        <section className={styles.reviewCard}>
          <button type="button" className={`${styles.reviewCardTitle} ${styles.reviewCardToggle} ${skippedOpen ? '' : styles.reviewCardTitleShut}`} aria-expanded={skippedOpen} onClick={() => setSkippedOpen(v => !v)}>
            Will be skipped
            <span className={styles.reviewCountBadge}>{skipped.length}</span>
            {chevron(skippedOpen)}
          </button>
          <CollapsibleContent open={skippedOpen}>
            <UserReasons list={skipped} tone="skip" />
          </CollapsibleContent>
        </section>
      )}

      {warned.length > 0 && (
        <section className={styles.reviewCard}>
          <h3 className={styles.reviewCardTitle}>Will be added with warnings</h3>
          <UserReasons list={warned} tone="warn" />
        </section>
      )}

      {added.length > 0 && (
        <section className={styles.reviewCard}>
          <h3 className={styles.reviewCardTitle}>Will be added</h3>
          <UserReasons list={added} />
        </section>
      )}
    </div>
  );
}
