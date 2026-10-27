import { useEffect } from 'react';
import { FeatureReviewsDrawer } from './FeatureReviewsDrawer';
import { useAppStore } from '../../store/useAppStore';

const ME = { id: 'story-me', name: 'Alok Kumar', email: 'alokk@fold.health' };
const MANAGERS = ['alokk@fold.health', 'ketanp@fold.health', 'devanshis@fold.health'];

const reviewer = (id, featureId, name, email, signedAt = null, comment = '') => ({
  id, featureId, name, email, assignedAt: '2026-10-20T10:00:00Z', signedAt, comment, commentedAt: comment ? signedAt : null,
});

const feature = (id, title, extra = {}) => ({
  id, parentId: null, status: 'approved', kind: 'feature', title, description: '', area: '', link: '#/home', createdBy: 'Alok Kumar',
  createdAt: '2026-10-20T10:00:00Z', reviewers: [], ...extra,
});

const REVIEWS = [
  feature('sms', 'SMS attribution for shared phone numbers', {
    area: 'Comms', link: '#/messages', createdAt: '2026-10-26T10:00:00Z',
    description: 'Staff pick which member an SMS is logged for when several members share one number.',
    reviewers: [
      reviewer('s1', 'sms', 'Alok Kumar', 'alokk@fold.health'),
      reviewer('s2', 'sms', 'Devanshi Sharma', 'devanshis@fold.health', '2026-10-26T12:10:00Z', 'Looks good on the shared-number family.'),
    ],
  }),
  feature('ph', 'Pharmacy worklist', { area: 'Population · Pharmacy', link: '#/population/pharmacy', createdAt: '2026-10-24T10:00:00Z' }),
  feature('ph1', 'Gap status model', {
    parentId: 'ph', link: '#/population/pharmacy', createdAt: '2026-10-24T10:01:00Z',
    reviewers: [reviewer('p1', 'ph1', 'Ketan Patni', 'ketanp@fold.health', '2026-10-25T09:30:00Z')],
  }),
  feature('ph2', 'Filters and saved views', {
    parentId: 'ph', link: '#/population/pharmacy', createdAt: '2026-10-24T10:02:00Z',
    reviewers: [reviewer('p2', 'ph2', 'Alok Kumar', 'alokk@fold.health')],
  }),
  feature('ac', 'Access Control roles', {
    area: 'Settings · Account', link: '#/settings/account/access-control',
    reviewers: [reviewer('a1', 'ac', 'Ketan Patni', 'ketanp@fold.health', '2026-10-22T15:42:00Z')],
  }),
];

function Frame({ reviews, managers }) {
  useEffect(() => {
    const prev = useAppStore.getState();
    const keep = {
      featureReviews: prev.featureReviews,
      featureReviewManagers: prev.featureReviewManagers,
      _featureReviewsFetched: prev._featureReviewsFetched,
      currentUserProfile: prev.currentUserProfile,
    };
    useAppStore.setState({
      featureReviews: reviews,
      featureReviewManagers: managers,
      _featureReviewsFetched: true,
      featureReviewsLoading: false,
      currentUserProfile: ME,
    });
    return () => useAppStore.setState(keep);
  }, [reviews, managers]);
  return <FeatureReviewsDrawer onClose={() => {}} />;
}

export default {
  title: 'Components/FeatureReviewsDrawer',
  component: FeatureReviewsDrawer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Design Signoff, opened from "Signoff" in the nav bar. An aligned list of features and ' +
          'their sub-items; each names one or more reviewers and links to the section to review. Reviewers ' +
          'sign off in one click and can leave a comment. Managers can add features and change reviewers.',
      },
    },
  },
};

export const Manager = { render: () => <Frame reviews={REVIEWS} managers={MANAGERS} /> };
export const Reviewer = { render: () => <Frame reviews={REVIEWS} managers={[]} /> };
export const Empty = { render: () => <Frame reviews={[]} managers={[]} /> };
