import { Avatar } from '../../../components/Avatar/Avatar';
import { useAppStore } from '../../../store/useAppStore';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty } from '../MobileParts';
import { listStamp } from '../mobileFormat';
import styles from '../mobile.module.css';

const ICON_BY_TYPE = [
  [/task/i, 'solar:checklist-minimalistic-linear'],
  [/appoint|calendar|schedule/i, 'solar:calendar-minimalistic-linear'],
  [/message|chat|sms/i, 'solar:chat-round-linear'],
  [/form/i, 'solar:clipboard-text-linear'],
];
const iconFor = (type) => ICON_BY_TYPE.find(([re]) => re.test(type || ''))?.[1] || 'solar:bell-linear';

/** The bell's notifications, newest first (Figma 759:25866). */
export function AlertsScreen() {
  const notifications = useAppStore(s => s.notifications);
  const markRead = useAppStore(s => s.markNotificationRead);
  const markAllRead = useAppStore(s => s.markAllNotificationsRead);
  const unread = notifications.some(n => !n.read);

  return (
    <div className={styles.screen}>
      <MobileSubHeader
        title="Alerts"
        actions={unread ? (
          <button type="button" className={styles.textBtn} aria-label="Mark all as read" onClick={() => markAllRead?.()}>
            Read all
          </button>
        ) : null}
      />
      <div className={styles.body}>
        {notifications.length === 0 ? (
          <MobileEmpty icon="solar:bell-linear" title="You're all caught up" description="New alerts show up here." />
        ) : (
          <div className={styles.list}>
            {notifications.map(n => (
              <button key={n.id} type="button" className={`${styles.card} ${styles.cardTop}`} onClick={() => !n.read && markRead?.(n.id)}>
                <Avatar type="icon" variant="primary" iconName={iconFor(n.type)} size="L" />
                <span className={styles.cardText}>
                  <span className={[styles.primaryText, n.read ? '' : styles.strong].join(' ')}>{n.title}</span>
                  {n.body && <span className={`${styles.secondaryText} ${styles.wrap}`}>{n.body}</span>}
                </span>
                <span className={styles.metaText}>{listStamp(new Date(n.ts).toISOString())}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
