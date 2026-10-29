import { useEffect } from 'react';
import { ReviewDock } from 'review-dock';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button/Button';
import 'review-dock/styles.css';
import './reviewKitTheme.css';

/**
 * Fold adapter for review-dock: the floating review box for one Design
 * Signoff item. Comments and their files are saved to Supabase
 * (feature_review_comments + the review-attachments bucket).
 */
export function FoldReviewDock({ review }) {
  const submit = useAppStore(s => s.submitFeatureReviewComment);
  const endReview = useAppStore(s => s.endFeatureReview);
  const fetchComments = useAppStore(s => s.fetchFeatureReviewComments);
  const openSignoff = useAppStore(s => s.openFeatureReviewsDrawer);
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
      <div className="fold-review-footer">
        <p className="fold-review-count">
          {count > 0 ? `${count} piece${count === 1 ? '' : 's'} of feedback so far.` : 'Done reviewing? Sign it off in Signoff.'}
        </p>
        <Button
          variant="secondary"
          size="S"
          leadingIcon="solar:clipboard-check-linear"
          onClick={() => openSignoff(review.featureId)}
        >
          Open in Signoff
        </Button>
      </div>
    </ReviewDock>
  );
}
