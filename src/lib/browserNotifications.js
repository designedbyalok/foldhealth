/**
 * OS-level (Web Notifications API) delivery for the in-app bell feed.
 *
 * The bell and the nav badges only work while the app is the visible tab.
 * This surfaces the same events when it isn't.
 *
 * Two rules shape the whole module:
 *
 *   1. Permission is only ever requested from a user gesture. Safari requires
 *      user activation for `requestPermission()` outright, and Chrome
 *      penalises pages that prompt on load — a dismissed prompt can get the
 *      origin auto-blocked, which is unrecoverable from script. So there is
 *      no auto-prompt on mount; `requestBrowserNotifications()` is wired to
 *      an explicit control in the notifications popover.
 *
 *   2. Nothing is shown while the app is the visible tab. An OS banner for
 *      something the user can already see on screen is pure noise — the bell
 *      badge is the right signal there.
 */

const ICON = '/favicon.svg';

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export function browserNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** True only when a prompt is possible and would not be a repeat ask. */
export function canAskBrowserNotifications() {
  return browserNotificationPermission() === 'default';
}

/**
 * Ask for permission. MUST be called from a user gesture handler.
 * Resolves to the resulting permission string.
 */
export async function requestBrowserNotifications() {
  if (!canAskBrowserNotifications()) return browserNotificationPermission();
  try {
    return await Notification.requestPermission();
  } catch {
    // Older Safari used a callback signature and can throw on the promise
    // form; treat a failed ask as "still undecided" rather than denied.
    return browserNotificationPermission();
  }
}

/**
 * Show an OS notification, if allowed and if the app is not the visible tab.
 *
 * `tag` collapses repeats: re-notifying the same task replaces the previous
 * banner instead of stacking a column of them.
 *
 * `onClick` is invoked after focusing the window, so a handler can navigate
 * once the app is actually in front of the user.
 */
export function showBrowserNotification({ title, body, tag, onClick } = {}) {
  if (browserNotificationPermission() !== 'granted') return null;
  // `hidden` covers another tab, another window, and a minimised browser.
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return null;
  if (!title) return null;
  try {
    const n = new Notification(title, { body: body || '', icon: ICON, tag, badge: ICON });
    n.onclick = () => {
      try { window.focus(); } catch { /* focus can be refused; still navigate */ }
      n.close();
      onClick?.();
    };
    return n;
  } catch (err) {
    // Constructing a Notification throws on Android Chrome, where the API is
    // service-worker-only. Nothing to recover — the in-app bell still works.
    console.warn('browser notification failed:', err?.message || err);
    return null;
  }
}
