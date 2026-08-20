import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { canAskBrowserNotifications, requestBrowserNotifications } from '../../lib/browserNotifications';
import boneStyles from '../TableSkeleton/TableSkeleton.module.css';
import styles from './NotificationsPopover.module.css';

/**
 * Cold-load placeholder. Shaped like `.entry` (icon square + title line +
 * sub line) so the list doesn't jump when real rows replace it. Reuses the
 * shared `.bone` shimmer rather than defining another one.
 */
function NotificationSkeleton({ count = 3 }) {
  return (
    <div className={styles.list} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.entry} style={{ cursor: 'default' }}>
          <span className={styles.entryIcon}>
            <span className={boneStyles.bone} style={{ width: 16, height: 16, borderRadius: 4 }} />
          </span>
          <span className={styles.entryBody}>
            <span className={boneStyles.bone} style={{ width: '70%', height: 12 }} />
            <span className={boneStyles.bone} style={{ width: '45%', height: 10 }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * NotificationsPopover — bell-icon dropdown.
 *
 * Renders the notifications slice from the global store. Each entry has
 * a typed icon, title, body, and a relative-time stamp. Clicking an
 * entry runs its mapped action (e.g. re-opening the HCC upload drawer
 * at the review phase) and marks the entry read. A "Mark all as read"
 * footer link clears the unread badge in one tap.
 *
 * Anchor: positioned absolutely under the bell icon by the parent.
 * Click-outside closes via a document listener.
 */
export function NotificationsPopover({ onClose, anchorRef }) {
  const ref = useRef(null);
  // Read once on open — Notification.permission is not reactive, so this is
  // re-evaluated when the popover mounts and after the user answers.
  const [canAsk, setCanAsk] = useState(canAskBrowserNotifications);
  const notifications = useAppStore(s => s.notifications) || [];
  const loading = useAppStore(s => s.notificationsLoading);
  const didFetch = useAppStore(s => s.notificationsDidFetch);
  const fetchNotifications = useAppStore(s => s.fetchNotifications);
  const markRead = useAppStore(s => s.markNotificationRead);
  const markAllRead = useAppStore(s => s.markAllNotificationsRead);
  const expandHccUpload = useAppStore(s => s.expandHccUpload);
  const openHccSftpReview = useAppStore(s => s.openHccSftpReview);
  const setActivePage = useAppStore(s => s.setActivePage);
  const setActiveSubnavList = useAppStore(s => s.setActiveSubnavList);
  const openTaskFromNotification = useAppStore(s => s.openTaskFromNotification);
  const openAppointmentFromNotification = useAppStore(s => s.openAppointmentFromNotification);
  const setPendingChatUserEmail = useAppStore(s => s.setPendingChatUserEmail);

  // Refetch on open. The realtime subscription is the fast path, not the
  // source of truth: a binding created before the table was published — or
  // one that died while the tab stayed visible and online — delivers silence
  // forever, and none of the other resync triggers (visibilitychange, online,
  // re-subscribe) fire in that state. Reading once at the moment the user
  // actually looks makes the panel correct regardless of socket health, and
  // also reconciles rows deleted elsewhere, which INSERT events never cover.
  useEffect(() => { fetchNotifications?.(); }, [fetchNotifications]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose, anchorRef]);

  const handleEntryClick = (n) => {
    markRead?.(n.id);
    if (n.action === 'openHccReview') {
      setActivePage?.('population');
      setActiveSubnavList?.('HCC');
      expandHccUpload?.();
    } else if (n.action === 'openSftpReview') {
      setActivePage?.('population');
      setActiveSubnavList?.('HCC');
      openHccSftpReview?.();
    } else if (n.action === 'openTask' && n.taskId != null) {
      openTaskFromNotification?.(n.taskId);
    } else if (n.action === 'openAppointment' && n.appointmentId != null) {
      openAppointmentFromNotification?.(n.appointmentId);
    } else if (n.action === 'openChat' && n.chatUserEmail) {
      setActivePage?.('messages');
      setPendingChatUserEmail?.(n.chatUserEmail);
    }
    onClose?.();
  };

  return (
    <div ref={ref} className={styles.popover} role="dialog" aria-label="Notifications">
      <div className={styles.header}>
        <span className={styles.title}>Notifications</span>
        {notifications.some(n => !n.read) && (
          <button
            type="button"
            className={styles.markAll}
            onClick={() => markAllRead?.()}
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Opt-in for OS-level delivery. Deliberately a control the user
          clicks rather than an auto-prompt on mount: Safari requires user
          activation for requestPermission(), and a prompt the user dismisses
          can get the origin permanently auto-blocked in Chrome. Disappears
          once the choice is made either way. */}
      {canAsk && (
        <button
          type="button"
          className={styles.enablePush}
          onClick={async () => {
            await requestBrowserNotifications();
            setCanAsk(canAskBrowserNotifications());
          }}
        >
          <Icon name="solar:bell-bing-linear" size={14} color="var(--primary-300)" />
          Get these on other tabs
        </button>
      )}

      {/* Cold load only — `didFetch` keeps the skeleton from flashing on
          background resyncs (tab refocus, realtime reconnect), which would
          otherwise blank a list the user is actively reading. */}
      {loading && !didFetch && notifications.length === 0 ? (
        <NotificationSkeleton />
      ) : notifications.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="solar:bell-off-linear" size={24} color="var(--neutral-200)" />
          <span>You're all caught up</span>
        </div>
      ) : (
        <div className={styles.list}>
          {notifications.map(n => (
            <button
              key={n.id}
              type="button"
              className={[styles.entry, n.read ? styles.entryRead : ''].join(' ')}
              onClick={() => handleEntryClick(n)}
            >
              <span className={styles.entryIcon}>
                <Icon
                  name={iconForType(n.type)}
                  size={16}
                  color="var(--primary-300)"
                />
              </span>
              <span className={styles.entryBody}>
                <span className={styles.entryTitle}>{n.title}</span>
                {n.body && (
                  <span className={styles.entrySub}>
                    {n.actorName ? `${n.actorName} · ${n.body}` : n.body}
                  </span>
                )}
                <span className={styles.entryTime}>{relativeTime(n.ts)}</span>
              </span>
              {!n.read && <span className={styles.entryDot} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function iconForType(type) {
  if (type === 'task.assigned') return 'solar:user-plus-rounded-linear';
  if (type === 'task.mentioned') return 'solar:mention-square-linear';
  if (type === 'appointment.assigned') return 'solar:calendar-linear';
  if (type === 'message.received') return 'solar:chat-round-linear';
  if (type === 'hcc.extraction_complete') return 'solar:document-text-linear';
  return 'solar:bell-linear';
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
