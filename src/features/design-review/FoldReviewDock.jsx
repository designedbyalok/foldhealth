import { useEffect, useMemo, useState } from 'react';
import { ReviewDock } from 'review-dock';
import { useAppStore } from '../../store/useAppStore';
import { GENERAL_FEEDBACK } from '../../store/slices/featureReviewsSlice';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { toast } from '../../components/Toast/sonnerToast';
import { mySignoff, useReviewerEmail } from '../../components/FeatureReviewsDrawer/featureReviewHooks';
import 'review-dock/styles.css';
import './reviewKitTheme.css';

const OpenSignoffIcon = ({ width }) => <Icon name="solar:arrow-right-up-linear" size={width} />;

const SIGNED_AT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Fold adapter for review-dock: the floating review box for one Design
 * Signoff item, or for general feedback when review.featureId is null.
 * Comments and their files are saved to Supabase (feature_review_comments +
 * the review-attachments bucket). A reviewer assigned to the item can sign
 * it off from the box.
 */
export function FoldReviewDock({ review }) {
  const submit = useAppStore(s => s.submitFeatureReviewComment);
  const endReview = useAppStore(s => s.endFeatureReview);
  const fetchComments = useAppStore(s => s.fetchFeatureReviewComments);
  const openSignoff = useAppStore(s => s.openFeatureReviewsDrawer);
  const signOff = useAppStore(s => s.signOffFeatureReview);
  const feature = useAppStore(s => (review.featureId ? s.featureReviews.find(f => f.id === review.featureId) : null));
  const myEmail = useReviewerEmail();
  const general = !review.featureId;
  const comments = useAppStore(s => s.featureReviewComments[review.featureId || GENERAL_FEEDBACK]);
  const [signing, setSigning] = useState(false);

  useEffect(() => { fetchComments(review.featureId); }, [fetchComments, review.featureId]);

  const count = comments?.length || 0;
  const mine = feature && feature.status !== 'suggested' ? mySignoff(feature, myEmail) : null;
  const canSign = !!mine && !mine.signedAt;

  // Signs only this item; sub-items still waiting on you stay in Signoff.
  const handleSignOff = async () => {
    setSigning(true);
    try {
      if (await signOff(mine.id)) toast.success(`Signed off ${review.title}`);
    } finally {
      setSigning(false);
    }
  };

  let status;
  if (general) status = count > 0 ? `${count} piece${count === 1 ? '' : 's'} of general feedback so far.` : 'Not tied to a Signoff item.';
  else if (mine?.signedAt) status = `You signed off ${SIGNED_AT.format(new Date(mine.signedAt))}.`;
  else if (count > 0) status = `${count} piece${count === 1 ? '' : 's'} of feedback so far.`;
  else if (canSign) status = 'Looks good? Sign it off here.';
  else status = feature ? 'Not assigned to you for sign-off.' : 'Feedback goes to this Signoff item.';

  const headerActions = useMemo(() => [{
    id: 'signoff',
    label: 'Open in Signoff',
    icon: OpenSignoffIcon,
    onClick: () => openSignoff(review.featureId || GENERAL_FEEDBACK),
  }], [openSignoff, review.featureId]);

  return (
    <ReviewDock
      title={review.title}
      storageKey="fold:review-dock"
      onSubmit={({ points, context }) => submit({ featureId: review.featureId, points, context })}
      onClose={endReview}
      headerActions={headerActions}
    >
      <div className="fold-review-footer">
        <p className="fold-review-count">
          {mine?.signedAt && <Icon name="solar:check-circle-linear" size={14} color="var(--status-success)" />}
          {status}
        </p>
        {canSign && (
          <Button variant="soft" size="sm" leadingIcon="solar:check-circle-linear" onClick={handleSignOff} disabled={signing}>
            Sign off
          </Button>
        )}
      </div>
    </ReviewDock>
  );
}
