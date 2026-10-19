// Update checker — detects when a fresh deploy has landed while the user's
// tab is still running the previous build. Without this, clicking a route
// that lazy-imports a chunk with the old filename 404s and the app blanks
// to white. The card (see UpdateCard) prompts a reload before
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
//     `hasNewBuild` store flag with that version and its highlights (the
//     update card takes over). Keep polling, so a card dismissed for one
//     deploy comes back when a later deploy lands.
//
// Also catches chunk-load errors as a backstop. If the poller hasn't noticed
// yet and the user opens a lazy route whose chunk 404s, that navigation is
// already lost, so we reload once to pick up the fresh bundle (see
// reloadForStaleChunk) and fall back to the banner when a reload can't help.

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
    if (!body?.version) return null;
    return { version: body.version, highlights: Array.isArray(body.highlights) ? body.highlights : [] };
  } catch {
    return null;
  }
}

let started = false;
let flaggedVersion = null;

function markNewBuild(remote) {
  const version = remote?.version || null;
  if (flaggedVersion && (!version || version === flaggedVersion)) return;
  flaggedVersion = version || 'unknown';
  useAppStore.getState().setHasNewBuild(true, remote);
}

const RELOAD_KEY = 'fold:chunk-reload-version';

// A failed chunk import has already broken this navigation: React's lazy()
// throws, and with no error boundary above AppLayout the whole tree unmounts,
// taking UpdateCard down with it. So the card cannot be the
// recovery here, and reloading onto the fresh bundle is the only way back.
//
// Once per build. The key holds the version that failed, so a genuinely
// broken deploy (an asset that 404s for everyone, not just stale tabs)
// reloads a single time and then leaves the card to it instead of looping.
// Storage can throw when site data is blocked; treat that as "don't reload"
// rather than risking a loop we can't remember having started.
function reloadForStaleChunk() {
  if (!import.meta.env.PROD) return;
  const version = currentVersion() || 'unknown';
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === version) return;
    sessionStorage.setItem(RELOAD_KEY, version);
  } catch {
    return;
  }
  window.location.reload();
}

export function startUpdateChecker() {
  if (started) return;
  started = true;
  const localVersion = currentVersion();

  // Chunk-load failures indicate the running bundle is trying to reach
  // filenames that no longer exist on the server — always a stale-deploy
  // symptom. Flag the card so users see it before the app blanks out.
  const onChunkError = (e) => {
    const msg = String(e?.reason?.message || e?.message || '');
    if (/Loading chunk|(Failed to fetch|[Ee]rror loading) dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(msg)) {
      markNewBuild();
      reloadForStaleChunk();
    }
  };
  window.addEventListener('error', onChunkError);
  window.addEventListener('unhandledrejection', onChunkError);
  // Vite's own signal from its preload helper. Fires even when a router
  // error boundary swallows the rejection, so it catches the cases the
  // two listeners above never see.
  window.addEventListener('vite:preloadError', () => { markNewBuild(); reloadForStaleChunk(); });

  // Dev — no /version.json is emitted, so polling would 404 every minute.
  // Skip the poll but keep the chunk-error backstop in place.
  if (!localVersion) return;

  const check = async () => {
    const remote = await fetchDeployedVersion();
    if (remote && remote.version !== localVersion) markNewBuild(remote);
  };
  check();
  setInterval(check, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
}
