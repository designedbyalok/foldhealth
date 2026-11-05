// Loads Capture Consent on demand, outside React.lazy. A lazy component's
// first render suspends, and React holds the revealed Suspense boundary back
// about 300ms, which read as lag every time the drawer first opened.
let loaded = null;
let pending = null;

/** The drawer component once its chunk has loaded, else null. */
export const loadedCaptureConsentDrawer = () => loaded;

/** Fetch the chunk (once); safe to call early to warm it. */
export function loadCaptureConsentDrawer() {
  pending ??= import('./CaptureConsentDrawer').then((m) => {
    loaded = m.CaptureConsentDrawer;
    return loaded;
  });
  return pending;
}
