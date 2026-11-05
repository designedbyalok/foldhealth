import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Drawer } from '@/components/Drawer/Drawer';
import { Button } from '@/components/Button/Button';
import { Icon } from '@/components/Icon/Icon';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { goTo } from '../lib/useHashRoute';
import { listTime } from '../messages/messageFormat';
import { groupByDay } from './notificationFormat';
import styles from './NotificationsDrawer.module.css';

const ICON = { message: 'solar:chat-round-line-linear', appointment: 'solar:calendar-mark-linear' };

// Notifications drawer from the header bell (frame 701:5509). Derived from
// care-team messages and upcoming visits (patient_notifications).
export function NotificationsDrawer({ memberId, onClose }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_notifications', { p_member_id: memberId }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError('We could not load your notifications.');
      setItems(data || []);
    });
    return () => { alive = false; };
  }, [memberId]);

  const open = (path) => { goTo(path); setDismissed(true); };

  return (
    <Drawer title="Notifications" onClose={onClose} dismissed={dismissed} width={460}>
      {items === null && <CardSkeleton count={3} />}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {items?.length === 0 && !error && (
        <EmptyState icon="solar:bell-linear" title="You're all caught up" description="Messages from your care team and visit reminders will show here." />
      )}
      {items?.length > 0 && groupByDay(items).map((group) => (
        <section key={group.label} className={styles.group} aria-label={group.label}>
          <h3 className={styles.groupTitle}>{group.label}</h3>
          <ul className={styles.list}>
            {group.items.map((n) => (
              <li key={n.id} className={`${styles.item} ${n.unread ? styles.unread : ''}`}>
                <Icon name={ICON[n.kind] || 'solar:bell-linear'} size={20} color={n.unread ? 'var(--primary-300)' : 'var(--neutral-200)'} />
                <div className={styles.body}>
                  <span className={styles.title}>{n.title}</span>
                  {n.body && <span className={styles.text}>{n.body}</span>}
                  {n.kind === 'message' && <span className={styles.time}>{listTime(n.at)}</span>}
                </div>
                {n.kind === 'message' && (
                  <Button variant="ghost" size="sm" onClick={() => open(`messages?c=${n.conversation_id}`)}>Reply</Button>
                )}
                {n.kind === 'appointment' && (
                  <Button variant="ghost" size="sm" onClick={() => open('home')}>View</Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Drawer>
  );
}
