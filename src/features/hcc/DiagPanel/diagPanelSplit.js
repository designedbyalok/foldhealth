import { flushSync } from 'react-dom';
import { useAppStore } from '../../../store/useAppStore';
import styles from './DiagPanel.module.css';

// While set on <html>, the drawer and the split's panel stack share one
// view-transition-name, so the drawer morphs into the panel (and back), and
// the patient card slides in or out beside it. See DiagPanel.module.css and
// PatientDetailView.module.css. 'in' = drawer → panel, 'out' = panel → drawer.
const MORPH_ATTR = 'data-diag-morph';
const EMBEDDED_SELECTOR = '[data-diag-split]';
const READY_TIMEOUT_MS = 1500;

// Moving between the drawer and the side panel remounts the panel, whose
// mount refetches (and blanks) the member's gaps. For the length of a
// hand-off the loaded gaps are still current, so the remount keeps them.
let handoffMemberId = null;
export function isDiagHandoff(memberId) {
  return handoffMemberId != null && String(handoffMemberId) === String(memberId);
}

// The patient view and the embedded panel are lazy chunks; hold the new
// snapshot until the destination has rendered so the morph lands on it
// rather than on a Suspense fallback. Timers, not rAF: rendering is paused
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

function morph(direction, update, readySelector) {
  const s = useAppStore.getState();
  if (!s.hccDiagnosisGapsLoading) handoffMemberId = s.diagPanelMemberId;
  const clearHandoff = () => { handoffMemberId = null; };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduced) {
    update();
    setTimeout(clearHandoff, READY_TIMEOUT_MS);
    return;
  }
  const root = document.documentElement;
  root.setAttribute(MORPH_ATTR, direction);
  const t = document.startViewTransition(async () => {
    flushSync(update);
    await whenPresent(readySelector);
  });
  // An interrupted transition rejects these; the state change still applied.
  t.ready.catch(() => {});
  t.finished.catch(() => {}).finally(() => {
    root.removeAttribute(MORPH_ATTR);
    clearHandoff();
  });
}

/** Floating shell: move the open Diagnosis Gaps Details into the patient split. */
export function openDiagInSidePanel() {
  const s = useAppStore.getState();
  const memberId = s.diagPanelMemberId;
  if (memberId == null) return;
  morph('in', () => {
    s.setDiagPanelSplit(true);
    // The side panel lays out patient / documents / ICDs, so bring up the
    // document workspace if it was closed.
    if (!s.diagLeftPanel) s.setDiagLeftPanel('documents');
    s.navigateToPatient(memberId);
  }, EMBEDDED_SELECTOR);
}

/** Back to the worklist with Diagnosis Gaps Details as a drawer again. */
export function returnDiagToDrawer() {
  const s = useAppStore.getState();
  morph('out', () => {
    s.setDiagPanelSplit(false);
    s.navigateBackToWorklist();
  }, `.${styles.panel}`);
}
