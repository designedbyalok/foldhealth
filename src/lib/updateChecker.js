// Update checker — detects when a fresh deploy has landed while the user's
// tab is still running the previous build. Without this, clicking a route
// that lazy-imports a chunk with the old filename 404s and the app blanks
// to white. The banner (see UpdateAvailableBanner) prompts a reload before
// that happens.
//
// How it works:
//   • Vite bakes __APP_VERSION__ into the running bundle at build time
//     (see vite.config.js) — the commit SHA on Vercel, a timestamp locally.
//   • Vite also emits /version.json with the same value. It's served fresh
//     (no immutable cache) so a poll reflects reality within seconds.
//   • Poll every 60s. On visibility change (tab foregrounded) poll once
//     more so users who left the tab open overnight see the banner as
//     soon as they look back.
//   • When the fetched version doesn't match the running one, flip the
//     `hasNewBuild` store flag and stop polling (the banner takes over).
//
// Also catches chunk-load errors as a backstop — if the poller hasn't
// noticed yet and the user tries to open a lazy route whose chunk 404s,
// we mark the flag so the banner appears instead of a blank screen.

import { useAppStore } from '../store/useAppStore';

const POLL_MS = 60_000;

function currentVersion() {
  // eslint-disable-next-line no-undef
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
}

async function fetchDeployedVersion() {
  try {
    const r = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const body = await r.json();
    return body?.version || null;
  } catch {
    return null;
  }
}

let started = false;
let flagged = false;

function markNewBuild() {
  if (flagged) return;
  flagged = true;
  useAppStore.getState().setHasNewBuild(true);
}

export function startUpdateChecker() {
  if (started) return;
  started = true;
  const localVersion = currentVersion();

  // Chunk-load failures indicate the running bundle is trying to reach
  // filenames that no longer exist on the server — always a stale-deploy
  // symptom. Flag the banner so users see it before the app blanks out.
  const onChunkError = (e) => {
    const msg = String(e?.reason?.message || e?.message || '');
    if (/Loading chunk|(Failed to fetch|[Ee]rror loading) dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(msg)) {
      markNewBuild();
    }
  };
  window.addEventListener('error', onChunkError);
  window.addEventListener('unhandledrejection', onChunkError);
  // Vite's own signal from its preload helper. Fires even when a router
  // error boundary swallows the rejection, so it catches the cases the
  // two listeners above never see.
  window.addEventListener('vite:preloadError', () => markNewBuild());

  // Dev — no /version.json is emitted, so polling would 404 every minute.
  // Skip the poll but keep the chunk-error backstop in place.
  if (!localVersion) return;

  const check = async () => {
    if (flagged) return;
    const remote = await fetchDeployedVersion();
    if (remote && remote !== localVersion) markNewBuild();
  };
  check();
  const interval = setInterval(() => {
    if (flagged) { clearInterval(interval); return; }
    check();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
}
