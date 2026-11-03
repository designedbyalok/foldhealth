import { useEffect, useMemo } from 'react';
import { Drawer } from '../Drawer/Drawer';
import { Badge } from '../Badge/Badge';
import { Icon } from '../Icon/Icon';
import { CardSkeleton } from '../CardSkeleton/CardSkeleton';
import { useAppStore } from '../../store/useAppStore';
import styles from './WhatsNewDrawer.module.css';

// kind → Badge variant (existing Badge palette: purple / blue / green).
const KIND_VARIANT = {
  New: 'primary',
  Improved: 'info',
  Fixed: 'success',
};

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/**
 * WhatsNewDrawer: in-house changelog, opened from Help → "What's New".
 * Entries live in Supabase (changelog_entries), written automatically by
 * the changelog GitHub Action on every push to main. Opening the drawer
 * marks everything as seen (clears the unread badge in the Help popover).
 */
export function WhatsNewDrawer({ onClose }) {
  const entries = useAppStore(s => s.changelogEntries);
  const loading = useAppStore(s => s.changelogLoading);
  const fetchChangelog = useAppStore(s => s.fetchChangelog);
  const markChangelogSeen = useAppStore(s => s.markChangelogSeen);

  useEffect(() => {
    fetchChangelog();
    markChangelogSeen();
  }, [fetchChangelog, markChangelogSeen]);

  // Group by calendar day, newest first (fetch is already sorted desc).
  const groups = useMemo(() => {
    const byDay = new Map();
    for (const e of entries) {
      const day = DATE_FMT.format(new Date(e.created_at));
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(e);
    }
    return [...byDay.entries()];
  }, [entries]);

  return (
    <Drawer title="What's New" onClose={onClose}>
      {loading ? (
        <CardSkeleton count={5} />
      ) : groups.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="solar:gift-linear" size={32} color="var(--neutral-200)" />
          <p>No updates published yet: check back soon.</p>
        </div>
      ) : (
        groups.map(([day, items]) => (
          <div key={day} className={styles.group}>
            <div className={styles.dayLabel}>{day}</div>
            {items.map(e => (
              <div key={e.id} className={styles.entry}>
                <Badge tone={KIND_VARIANT[e.kind] || 'neutral'} label={e.kind} />
                <span className={styles.entryTitle}>{e.title}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </Drawer>
  );
}
