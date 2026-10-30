import { lazy, Suspense, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';

// The review box (and its capture libraries) loads only once someone starts
// a review, so nobody else pays for it in the main bundle.
const FoldReviewDock = lazy(() => import('./FoldReviewDock').then(m => ({ default: m.FoldReviewDock })));

// Events from the box stop at its own container, so the page's "click
// outside closes it" and keyboard-shortcut listeners never see them: an open
// drawer, menu or popover stays open while you comment on it or pick an
// element inside it. Capture-phase listeners (Popover, Select) skip presses
// inside [data-outside-press-ignore] themselves.
const CONTAINED_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown'];
const stop = (e) => e.stopPropagation();

// One container for the app's lifetime. It must already be in the page when
// the box mounts: the drag library measures its offset on mount, and a
// detached container measures as 0,0, which doubles the box's position.
let boxContainer = null;
function attachedBoxContainer() {
  if (!boxContainer) {
    boxContainer = document.createElement('div');
    boxContainer.setAttribute('data-outside-press-ignore', '');
    CONTAINED_EVENTS.forEach(type => boxContainer.addEventListener(type, stop));
  }
  if (!boxContainer.isConnected) document.body.appendChild(boxContainer);
  return boxContainer;
}

// Moved to the end of <body> each time a review starts, so it stacks above
// layers opened since.
function useBoxContainer(active) {
  const host = attachedBoxContainer();
  useEffect(() => {
    if (active) document.body.appendChild(host);
  }, [active, host]);
  return host;
}

/** Mounted once in AppLayout; shows the review box while a review is active.
 *  It renders last in <body>, above every drawer and popover. */
export function DesignReviewHost() {
  const activeReview = useAppStore(s => s.activeReview);
  const host = useBoxContainer(!!activeReview);
  if (!activeReview) return null;
  return createPortal(
    <Suspense fallback={null}>
      <FoldReviewDock review={activeReview} />
    </Suspense>,
    host,
  );
}
