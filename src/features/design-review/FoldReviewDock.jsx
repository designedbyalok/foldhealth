import { useMemo } from 'react';
import { ReviewDock } from 'review-dock';
import { useAppStore } from '../../store/useAppStore';
import { GENERAL_FEEDBACK } from '../../store/slices/featureReviewsSlice';
import { Icon } from '../../components/Icon/Icon';
import { toast } from '../../components/Toast/sonnerToast';
import { mySignoff, useReviewerEmail } from '../../components/FeatureReviewsDrawer/featureReviewHooks';
import 'review-dock/styles.css';
import './reviewKitTheme.css';

const OpenSignoffIcon = ({ width }) => <Icon name="solar:arrow-right-up-linear" size={width} />;

/**
 * Fold adapter for review-dock: the floating review box for one Design
 * Signoff item, or for general feedback when review.featureId is null.
 * Comments and their files are saved to Supabase (feature_review_comments +
 * the review-attachments bucket). An assigned reviewer who hasn't signed yet
 * gets Sign off on the Send button (and Send and sign off in its menu).
 */
export function FoldReviewDock({ review }) {
  const submit = useAppStore(s => s.submitFeatureReviewComment);
  const endReview = useAppStore(s => s.endFeatureReview);
  const openSignoff = useAppStore(s => s.openFeatureReviewsDrawer);
  const signOff = useAppStore(s => s.signOffFeatureReview);
  const feature = useAppStore(s => (review.featureId ? s.featureReviews.find(f => f.id === review.featureId) : null));
  const myEmail = useReviewerEmail();

  const mine = feature && feature.status !== 'suggested' ? mySignoff(feature, myEmail) : null;
  const pendingId = mine && !mine.signedAt ? mine.id : null;

  // Signs only this item; sub-items still waiting on you stay in Signoff.
  const finishAction = useMemo(() => (pendingId ? {
    label: 'Sign off',
    submitLabel: 'Send and sign off',
    onFinish: async () => {
      if (await signOff(pendingId)) toast.success(`Signed off ${review.title}`);
    },
  } : undefined), [pendingId, signOff, review.title]);

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
      finishAction={finishAction}
    />
  );
}
