import { flushSync } from 'react-dom';
import { useLiveCall } from './useLiveCall';

// While set on <html>, the floating call card and the overlay panel share one
// view-transition-name, so the card grows into the panel (and shrinks back)
// while the scrim fades. See ActiveCallCard.module.css and
// LiveCallOverlay.module.css. Same approach as hcc/DiagPanel/diagPanelSplit.js.
const MORPH_ATTR = 'data-call-morph';
const READY_TIMEOUT_MS = 1500;

// The overlay is a lazy chunk; hold the new snapshot until the destination
// has rendered so the morph lands on it. Timers, not rAF: rendering is paused
// while a view transition's update runs.
function whenPresent(selector) {
  return new Promise((resolve) => {
    const start = performance.now();
    const check = () => {
      if (document.querySelector(selector) || performance.now() - start > READY_TIMEOUT_MS) resolve();
      else setTimeout(check, 16);
    };
    check();
  });
}

function morph(update, readySelector) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduced) {
    update();
    return;
  }
  const root = document.documentElement;
  root.setAttribute(MORPH_ATTR, '');
  const t = document.startViewTransition(async () => {
    flushSync(update);
    await whenPresent(readySelector);
  });
  // An interrupted transition rejects these; the state change still applied.
  t.ready.catch(() => {});
  t.finished.catch(() => {}).finally(() => root.removeAttribute(MORPH_ATTR));
}

/** Floating card → full-screen live transcript. The script loads first so the morph lands on it. */
export async function expandLiveCall(patient) {
  await useLiveCall.getState().prepare(patient);
  morph(() => useLiveCall.getState().show(), '[data-live-call]');
}

/** Full-screen live transcript → floating card. */
export function minimizeLiveCall() {
  if (!useLiveCall.getState().open) return;
  morph(() => useLiveCall.getState().minimize(), '[data-call-card]');
}
