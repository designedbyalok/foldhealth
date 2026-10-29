import { lazy, Suspense } from 'react';
import { useAppStore } from '../../store/useAppStore';

// The review box (and its capture libraries) loads only once someone starts
// a review, so nobody else pays for it in the main bundle.
const FoldReviewDock = lazy(() => import('./FoldReviewDock').then(m => ({ default: m.FoldReviewDock })));

/** Mounted once in AppLayout; shows the review box while a review is active. */
export function DesignReviewHost() {
  const activeReview = useAppStore(s => s.activeReview);
  if (!activeReview) return null;
  return (
    <Suspense fallback={null}>
      <FoldReviewDock review={activeReview} />
    </Suspense>
  );
}
