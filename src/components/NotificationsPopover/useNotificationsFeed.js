import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Keeps the bell's notification list live for the signed-in user.
 *
 * Mounted once from AppLayout (i.e. only when authenticated). Owns three
 * things, all of which have to be app-level rather than page-level:
 *
 *   1. Resolving `currentUserProfile`. Only `useTasksView` used to call
 *      `fetchTaskProfiles`, so before this the signed-in identity — and
 *      therefore the whole notification feed — didn't exist until you
 *      happened to visit the Tasks page.
 *   2. The realtime subscription for this user's rows.
 *   3. Recovery refetches. A postgres_changes socket can die quietly
 *      (laptop sleep, VPN flip, network change) and delivers nothing for
 *      the window it was down, so a subscription on its own is not enough
 *      to be correct — only to be fast. Refetching when the tab is shown
 *      again, and when the browser reports coming back online, means the
 *      list and the unread badge heal themselves instead of staying
 *      permanently short by however many events were missed.
 */
export function useNotificationsFeed() {
  const meId = useAppStore(s => s.currentUserProfile?.id);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const fetchNotifications = useAppStore(s => s.fetchNotifications);
  const subscribeNotifications = useAppStore(s => s.subscribeNotifications);

  useEffect(() => { fetchTaskProfiles?.(); }, [fetchTaskProfiles]);

  // subscribeNotifications() fetches on SUBSCRIBED, so this covers the
  // initial load as well as reconnects.
  useEffect(() => {
    if (!meId) return undefined;
    return subscribeNotifications?.();
  }, [meId, subscribeNotifications]);

  useEffect(() => {
    if (!meId) return undefined;
    const resync = () => {
      if (document.visibilityState === 'visible') fetchNotifications?.();
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
    };
  }, [meId, fetchNotifications]);
}
