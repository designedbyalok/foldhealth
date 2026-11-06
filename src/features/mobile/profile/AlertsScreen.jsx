import { useEffect } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Icon } from '../../../components/Icon/Icon';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { supabase } from '../../../lib/supabase';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { listStamp } from '../mobileFormat';
import common from '../mobile.module.css';
import styles from './AlertsScreen.module.css';

const ICON_BY_TYPE = [
  [/task/i, 'solar:checklist-minimalistic-linear'],
  [/appoint|calendar|schedule|ooo|reassign/i, 'solar:calendar-mark-linear'],
  [/message|chat|sms/i, 'solar:chat-round-linear'],
  [/email|referral/i, 'solar:letter-linear'],
  [/hcc|document|upload/i, 'solar:document-text-linear'],
  [/form/i, 'solar:clipboard-text-linear'],
];
const iconFor = (n) => ICON_BY_TYPE.find(([re]) => re.test(`${n.type || ''} ${n.action || ''}`))?.[1] || 'solar:bell-linear';

// Alerts whose target is a desktop-only workspace (HCC review, user
// admin, bulk and reassignment summaries).
const DESKTOP_ONLY = new Set([
  'openHccReview', 'openSftpReview', 'openProfileName', 'openPendingUsers', 'openLockedUsers',
  'openReassignmentSummary', 'openBulkSummary', 'viewAssignedAppointments',
]);

/**
 * The bell's notifications, newest first (Figma Alerts 759:25866). Tapping
 * one marks it read and opens what it is about, like the desktop
 * NotificationsPopover. The list itself stays live through the app-level
 * useNotificationsFeed subscription (AppLayout), which also feeds the bell.
 */
export function AlertsScreen() {
  const { push, setTab, canTab, openMember } = useMobileNav();
  const notifications = useAppStore(s => s.notifications) || [];
  const loading = useAppStore(s => s.notificationsLoading);
  const didFetch = useAppStore(s => s.notificationsDidFetch);
  const fetchNotifications = useAppStore(s => s.fetchNotifications);
  const markRead = useAppStore(s => s.markNotificationRead);
  const markAllRead = useAppStore(s => s.markAllNotificationsRead);
  const unread = notifications.some(n => !n.read);

  // Read once when the list is opened, as the desktop popover does: the
  // socket is the fast path, this makes the list right even if it died.
  useEffect(() => { fetchNotifications?.({ force: true }); }, [fetchNotifications]);

  const openMessages = () => {
    if (canTab('messages')) setTab('messages');
    else toast.error("You don't have access to messages.");
  };

  // A staff chat alert names the sender by email (as desktop's
  // setPendingChatUserEmail does); open that person's internal thread.
  const openChat = async (email) => {
    if (!canTab('messages')) { openMessages(); return; }
    const { data } = await supabase.from('profiles')
      .select('id, full_name, first_name, last_name, email, avatar_url')
      .ilike('email', email).limit(1);
    const profile = data?.[0];
    if (profile?.id) push('internalThread', { userId: profile.id, profile });
    else openMessages();
  };

  const open = (n) => {
    markRead?.(n.id);
    if (n.action === 'openTask' && n.taskId != null) {
      push('taskDetail', { taskId: n.taskId });
    } else if (n.action === 'openAppointment' && n.appointmentId != null) {
      push('appointment', { appointmentId: n.appointmentId });
    } else if (n.action === 'openChat' && n.chatUserEmail) {
      openChat(n.chatUserEmail);
    } else if (n.action === 'openChat' || n.action === 'openEmail') {
      openMessages();
    } else if (n.action === 'openDiagPanel' && n.hccMemberId) {
      const m = (useAppStore.getState().hccMembers || []).find(x => String(x.id) === String(n.hccMemberId));
      openMember({ memberId: m?.memberId, name: m?.name });
    } else if (DESKTOP_ONLY.has(n.action)) {
      toast.info('Open Fold Health on a computer to review this.');
    }
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader
        title="Alerts"
        actions={unread ? (
          <ActionButton icon="solar:list-check-linear" size="lg" aria-label="Mark all as read" onClick={() => markAllRead?.()} />
        ) : null}
      />
      <div className={common.body}>
        {loading && !didFetch && notifications.length === 0 ? (
          <MobileListSkeleton count={4} height={78} />
        ) : notifications.length === 0 ? (
          <MobileEmpty icon="solar:bell-linear" title="You're all caught up" description="New alerts show up here." />
        ) : (
          <ul className={`${common.list} ${styles.list}`}>
            {notifications.map(n => (
              <li key={n.id}>
                <button type="button" className={styles.card} onClick={() => open(n)} aria-label={n.read ? undefined : `Unread: ${n.title}`}>
                  <span className={styles.icon}><Icon name={iconFor(n)} size={32} color="currentColor" /></span>
                  <span className={styles.text}>
                    <span className={styles.head}>
                      <span className={[styles.title, n.read ? '' : styles.unread].filter(Boolean).join(' ')}>{n.title}</span>
                      <span className={styles.time}>{listStamp(Number.isFinite(new Date(n.ts).getTime()) ? new Date(n.ts).toISOString() : null)}</span>
                    </span>
                    {n.body && <span className={styles.body}>{n.body}</span>}
                  </span>
                  {!n.read && <span className={styles.dot} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
