import { useMemo } from 'react';
import { ReviewDock } from 'review-dock';
import { useAppStore } from '../../store/useAppStore';
import { GENERAL_FEEDBACK } from '../../store/slices/featureReviewsSlice';
import { Icon } from '../../components/Icon/Icon';
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
 * After a send or sign-off the box offers the next item waiting on you.
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
    doneLabel: 'Signed off',
    onFinish: () => signOff(pendingId),
  } : undefined), [pendingId, signOff]);

  // Up next: what's still waiting on your sign-off, newest first like the
  // To sign tab, other than this item.
  const features = useAppStore(s => s.featureReviews);
  const startReview = useAppStore(s => s.startFeatureReview);
  const waiting = useMemo(() => features.filter(f => {
    if (f.id === review.featureId || f.status !== 'approved') return false;
    const r = mySignoff(f, myEmail);
    return r && !r.signedAt;
  }), [features, review.featureId, myEmail]);
  const nextUp = useMemo(() => {
    const next = waiting[0];
    if (!next) return undefined;
    const parent = next.parentId ? features.find(f => f.id === next.parentId) : null;
    const area = next.area || parent?.area || '';
    const link = next.link || parent?.link || '';
    const more = waiting.length - 1;
    return {
      title: next.title,
      meta: [area, more > 0 ? `${more} more waiting` : ''].filter(Boolean).join(' · ') || undefined,
      onAccept: () => {
        startReview({ id: next.id, title: next.title, area, link });
        if (link) window.location.hash = link;
      },
    };
  }, [waiting, features, startReview]);

  const headerActions = useMemo(() => [{
    id: 'signoff',
    label: 'Open in Signoff',
    icon: OpenSignoffIcon,
    onClick: () => openSignoff(review.featureId || GENERAL_FEEDBACK),
  }], [openSignoff, review.featureId]);

  return (
    <ReviewDock
      key={review.featureId || GENERAL_FEEDBACK}
      title={review.title}
      storageKey="fold:review-dock"
      onSubmit={({ points, context }) => submit({ featureId: review.featureId, points, context })}
      onClose={endReview}
      headerActions={headerActions}
      finishAction={finishAction}
      nextUp={nextUp}
    />
  );
}
