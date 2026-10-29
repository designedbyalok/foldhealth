import { useEffect } from 'react';
import { ReviewDock } from '@designedbyalok/review-kit';
import { useAppStore } from '../../store/useAppStore';
import '@designedbyalok/review-kit/styles.css';
import './reviewKitTheme.css';

/**
 * Fold adapter for @designedbyalok/review-kit: the floating review box for one Design
 * Signoff item. Comments and their files are saved to Supabase
 * (feature_review_comments + the review-attachments bucket).
 */
export function FoldReviewDock({ review }) {
  const submit = useAppStore(s => s.submitFeatureReviewComment);
  const endReview = useAppStore(s => s.endFeatureReview);
  const fetchComments = useAppStore(s => s.fetchFeatureReviewComments);
  const comments = useAppStore(s => s.featureReviewComments[review.featureId]);

  useEffect(() => { fetchComments(review.featureId); }, [fetchComments, review.featureId]);

  const count = comments?.length || 0;

  return (
    <ReviewDock
      title={review.title}
      subtitle={review.area ? `Design Signoff · ${review.area}` : 'Design Signoff'}
      storageKey="fold:review-dock"
      onSubmit={({ points, context }) => submit({ featureId: review.featureId, points, context })}
      onClose={endReview}
    >
      {count > 0 && (
        <p className="fold-review-count">
          {count} piece{count === 1 ? '' : 's'} of feedback on this item so far. See them in Signoff.
        </p>
      )}
    </ReviewDock>
  );
}
