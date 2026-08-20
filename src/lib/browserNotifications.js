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
 *
 * On a grant it fires one confirmation banner. That is not decoration: the
 * browser can report 'granted' while the OS still refuses to display
 * anything — macOS keeps its own per-application notification setting, and
 * Focus/Do Not Disturb drops banners silently. Without this, the first
 * evidence that delivery is broken would be a notification that never
 * arrives hours later, which is indistinguishable from "nothing happened".
 */
export async function requestBrowserNotifications() {
  if (!canAskBrowserNotifications()) return browserNotificationPermission();
  let result;
  try {
    result = await Notification.requestPermission();
  } catch {
    // Older Safari used a callback signature and can throw on the promise
    // form; treat a failed ask as "still undecided" rather than denied.
    result = browserNotificationPermission();
  }
  if (result === 'granted') {
    showBrowserNotification({
      title: 'Notifications are on',
      body: "You'll get these when Fold isn't the tab you're looking at.",
      tag: 'fold-notifications-enabled',
      force: true,
    });
  }
  return result;
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
export function showBrowserNotification({ title, body, tag, onClick, force = false } = {}) {
  if (browserNotificationPermission() !== 'granted') return null;
  // Suppress only when the app is genuinely in front of the user, which means
  // visible AND focused — not just visible.
  //
  // `visibilityState` alone is not enough: a tab sitting in a background
  // WINDOW still reports 'visible', so gating on visibility silently dropped
  // every notification for anyone running the app in a second window
  // alongside their work. That is the common desktop layout, and it looked
  // exactly like the feature being broken.
  //
  // `force` is for the confirmation notification fired straight after the
  // user grants permission: they are looking at the app at that moment, and
  // showing it anyway is the point — it proves delivery works end to end,
  // and its absence is the fastest way to discover the browser is blocked at
  // the OS level.
  if (!force && typeof document !== 'undefined'
      && document.visibilityState === 'visible'
      && (typeof document.hasFocus !== 'function' || document.hasFocus())) {
    return null;
  }
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
